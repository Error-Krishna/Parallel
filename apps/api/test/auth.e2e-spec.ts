import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp, getHttpServer } from './utils/create-test-app.js';
import { PrismaService } from '../src/database/prisma.service.js';

// A real e2e suite: real Fastify HTTP pipeline, real JWT signing/verification, real
// class-validator ValidationPipe, real Postgres (via PrismaService) — nothing here is
// mocked. This is what the unit tests (users.service.spec.ts, auth.service.spec.ts,
// users.controller.spec.ts) deliberately don't cover, since those mock Prisma/JWT to
// stay fast and isolated. Requires infra/docker-compose.yml's Postgres + Redis to be
// running locally (or CI's service containers).
//
// Response envelope: every 2xx response body is { success: true, message, data }
// (see common/utils/api-response.ts / apiError.ts) — assertions below read through
// `.data`, not the top level.
describe('Auth + Users (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Real database, not a mock — clean up whatever this run created so repeated
    // local/CI runs don't accumulate junk rows or collide on unique constraints.
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await app.close();
  });

  function freshCredentials() {
    const suffix = randomUUID().slice(0, 8);
    const email = `e2e-${suffix}@example.com`;
    createdEmails.push(email);
    return { email, username: `e2e_${suffix}`, password: 'password123' };
  }

  it('signs up, logs in, and fetches the current user via a real token', async () => {
    const creds = freshCredentials();

    const signupRes = await request(getHttpServer(app)).post('/v1/auth/signup').send(creds);
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.data.user.username).toBe(creds.username);
    expect(signupRes.body.data.accessToken).toBeTruthy();
    // The exact bug class item 8 in the review was about — confirm passwordHash and
    // email never actually reach the wire, not just that toPublicUser() is unit-tested.
    expect(signupRes.body.data.user).not.toHaveProperty('passwordHash');
    expect(signupRes.body.data.user).not.toHaveProperty('email');

    const loginRes = await request(getHttpServer(app))
      .post('/v1/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();

    const meRes = await request(getHttpServer(app))
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.username).toBe(creds.username);
  });

  it('rejects login with the wrong password using the enumeration-safe error', async () => {
    const creds = freshCredentials();
    await request(getHttpServer(app)).post('/v1/auth/signup').send(creds);

    const res = await request(getHttpServer(app))
      .post('/v1/auth/login')
      .send({ email: creds.email, password: 'the-wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects login for a nonexistent email with the same error (no enumeration)', async () => {
    const res = await request(getHttpServer(app))
      .post('/v1/auth/login')
      .send({ email: 'definitely-not-registered@example.com', password: 'anything' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects a duplicate signup with 409, not a raw 500', async () => {
    const creds = freshCredentials();
    await request(getHttpServer(app)).post('/v1/auth/signup').send(creds);

    const res = await request(getHttpServer(app)).post('/v1/auth/signup').send(creds);

    expect(res.status).toBe(409);
    expect(typeof res.body.message).toBe('string');
  });

  it('rejects a protected route with no token', async () => {
    const res = await request(getHttpServer(app)).get('/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('returns a flattened, array-shaped validation error for a malformed signup body', async () => {
    // The exact case item 10 in the review flagged: before the AllExceptionsFilter
    // fix, this would have nested the real validation errors inside another object
    // under `message` instead of surfacing them directly.
    const res = await request(getHttpServer(app))
      .post('/v1/auth/signup')
      .send({ email: 'not-an-email', username: 'x', password: 'short' });

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it('enforces the same username rules on profile update as on signup', async () => {
    const creds = freshCredentials();
    const signupRes = await request(getHttpServer(app)).post('/v1/auth/signup').send(creds);
    const token = signupRes.body.data.accessToken;

    // Previously unvalidated on update (item 3 in the review) — this exact request
    // used to pass through unchecked before UpdateUserDto got @IsUsername().
    const res = await request(getHttpServer(app))
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'x' }); // too short — violates USERNAME_MIN_LENGTH

    expect(res.status).toBe(400);
  });

  it('actually revokes a token on logout — a logged-out token stops working', async () => {
    const creds = freshCredentials();
    const signupRes = await request(getHttpServer(app)).post('/v1/auth/signup').send(creds);
    const token = signupRes.body.data.accessToken;

    // Token works before logout.
    const before = await request(getHttpServer(app)).get('/v1/users/me').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    const logoutRes = await request(getHttpServer(app)).post('/v1/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(201);

    // Same token, same (unexpired) claims — should now be rejected because
    // JwtStrategy checks the Redis revocation list on every request.
    const after = await request(getHttpServer(app)).get('/v1/users/me').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });
});
