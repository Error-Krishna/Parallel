import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';

describe('Notifications lifecycle (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const userA = {
    email: `notif_a_${suffix}@example.com`,
    username: `notif_a_${suffix}`,
    password: 'StrongPassword123!',
  };
  const userB = {
    email: `notif_b_${suffix}@example.com`,
    username: `notif_b_${suffix}`,
    password: 'StrongPassword123!',
  };

  let tokenA = '';
  let tokenB = '';
  let userAId = '';
  let userBId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    notificationsService = app.get(NotificationsService);

    const signupA = await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send(userA)
      .expect(201);
    tokenA = signupA.body.data.accessToken;
    userAId = signupA.body.data.user.id;

    const signupB = await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send(userB)
      .expect(201);
    tokenB = signupB.body.data.accessToken;
    userBId = signupB.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId].filter(Boolean) } },
    });
    await app.close();
  });

  it('rejects unauthenticated access to /v1/notifications', async () => {
    await request(app.getHttpServer()).get('/v1/notifications').expect(401);
  });

  it('creates a notification on follow, lists it, enforces ownership, and marks read / read-all', async () => {
    // User B follows User A -> User A receives a NEW_FOLLOWER notification.
    await request(app.getHttpServer())
      .post(`/v1/users/${userAId}/follow`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(201);

    // Also seed a second notification for User A to test read-all and pagination.
    const questNotif = await notificationsService.create(
      userAId,
      'QUEST_COMPLETED',
      {
        questId: 'quest-e2e',
        questTitle: 'Test Quest',
        rewardType: 'BADGE',
        rewardValue: 'Explorer',
      },
    );

    const listRes = await request(app.getHttpServer())
      .get('/v1/notifications?limit=10')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(listRes.body.unreadCount).toBe(2);
    expect(listRes.body.items).toHaveLength(2);
    expect(listRes.body.items.map((n: { type: string }) => n.type)).toEqual(
      expect.arrayContaining(['NEW_FOLLOWER', 'QUEST_COMPLETED']),
    );

    // User B cannot mark User A's notification as read -> 404 (enumeration-safe).
    await request(app.getHttpServer())
      .post(`/v1/notifications/${questNotif.id}/read`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    // User A marks one notification as read (idempotent).
    await request(app.getHttpServer())
      .post(`/v1/notifications/${questNotif.id}/read`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    await request(app.getHttpServer())
      .post(`/v1/notifications/${questNotif.id}/read`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    const afterOneRead = await request(app.getHttpServer())
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(afterOneRead.body.unreadCount).toBe(1);

    // Mark all remaining notifications as read.
    const readAllRes = await request(app.getHttpServer())
      .post('/v1/notifications/read-all')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(readAllRes.body.updatedCount).toBe(1);

    const afterAllRead = await request(app.getHttpServer())
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(afterAllRead.body.unreadCount).toBe(0);
  });
});
