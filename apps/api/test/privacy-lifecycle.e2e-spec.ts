import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp, getHttpServer } from './utils/create-test-app.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Privacy & Self-Serve Data Lifecycle (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await app.close();
  });

  it('exports personal data without passwordHash and deletes account with immediate JWT revocation', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `e2e-priv-${suffix}@example.com`;
    const username = `priv_${suffix}`;
    const password = 'password123';
    createdEmails.push(email);

    const signupRes = await request(getHttpServer(app))
      .post('/v1/auth/signup')
      .send({ email, username, password });
    expect(signupRes.status).toBe(201);

    const accessToken: string = signupRes.body.data.accessToken;
    const userId: string = signupRes.body.data.user.id;

    // Complete onboarding so user has real OnboardingResponse + UserParallel rows
    const questionsRes = await request(getHttpServer(app))
      .get('/v1/onboarding/questions')
      .set('Authorization', `Bearer ${accessToken}`);
    for (const q of questionsRes.body as Array<{
      key: string;
      options: Array<{ value: string }>;
    }>) {
      await request(getHttpServer(app))
        .post('/v1/onboarding/answers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ questionKey: q.key, answerValue: q.options[0].value });
    }
    const completeRes = await request(getHttpServer(app))
      .post('/v1/onboarding/complete')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(completeRes.status).toBe(201);

    // Update visibilitySettings
    const patchRes = await request(getHttpServer(app))
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        visibilitySettings: {
          profileVisibility: 'friends',
          showActivityStatus: false,
        },
      });
    expect(patchRes.status).toBe(200);

    // 1. Self-serve JSON export
    const exportRes = await request(getHttpServer(app))
      .get('/v1/users/me/export')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.success).toBe(true);
    const payload = exportRes.body.data;
    expect(payload.user.id).toBe(userId);
    expect(payload.user.username).toBe(username);
    expect(payload.user).not.toHaveProperty('passwordHash');
    expect(payload.user.visibilitySettings).toEqual({
      profileVisibility: 'friends',
      showActivityStatus: false,
    });
    expect(payload.onboardingResponses.length).toBeGreaterThanOrEqual(4);
    expect(payload.parallels).toHaveLength(4);
    expect(typeof payload.exportedAt).toBe('string');

    // 2. Irreversible self-serve account deletion
    const deleteRes = await request(getHttpServer(app))
      .delete('/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Active JWT is immediately revoked in Redis
    const meAfterDelete = await request(getHttpServer(app))
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meAfterDelete.status).toBe(401);

    // User and cascaded rows no longer exist in PostgreSQL
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser).toBeNull();
    const dbParallels = await prisma.userParallel.count({ where: { userId } });
    expect(dbParallels).toBe(0);

    // Login fails cleanly
    const loginAfterDelete = await request(getHttpServer(app))
      .post('/v1/auth/login')
      .send({ email, password });
    expect(loginAfterDelete.status).toBe(401);
  });
});
