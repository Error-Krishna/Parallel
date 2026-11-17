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

describe('Identity Cards lifecycle (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const userA = {
    email: `cards_a_${suffix}@example.com`,
    username: `cards_a_${suffix}`,
    password: 'StrongPassword123!',
  };
  const userB = {
    email: `cards_b_${suffix}@example.com`,
    username: `cards_b_${suffix}`,
    password: 'StrongPassword123!',
  };

  let tokenA = '';
  let tokenB = '';
  let userAId = '';
  let userBId = '';
  let parallelTypePublicId = '';
  let parallelTypeGhostId = '';
  let publicUserParallelId = '';
  let ghostUserParallelId = '';

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

    const [ptPublic, ptGhost] = await Promise.all([
      prisma.parallelType.create({
        data: {
          name: `Card Public ${suffix}`,
          description: 'A public Parallel ready to share.',
          icon: 'sparkles',
          isSystemGenerated: false,
        },
      }),
      prisma.parallelType.create({
        data: {
          name: `Card Ghost ${suffix}`,
          description: 'A private Ghost Parallel.',
          icon: 'ghost',
          isSystemGenerated: false,
        },
      }),
    ]);

    parallelTypePublicId = ptPublic.id;
    parallelTypeGhostId = ptGhost.id;

    const [upPublic, upGhost] = await Promise.all([
      prisma.userParallel.create({
        data: {
          userId: userAId,
          parallelTypeId: parallelTypePublicId,
          strengthPct: 82,
          streakCount: 4,
          isGhost: false,
          isHidden: false,
        },
      }),
      prisma.userParallel.create({
        data: {
          userId: userAId,
          parallelTypeId: parallelTypeGhostId,
          strengthPct: 45,
          isGhost: true,
          isHidden: false,
        },
      }),
    ]);

    publicUserParallelId = upPublic.id;
    ghostUserParallelId = upGhost.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId].filter(Boolean) } },
    });
    await prisma.parallelType.deleteMany({
      where: {
        id: { in: [parallelTypePublicId, parallelTypeGhostId].filter(Boolean) },
      },
    });
    await app.close();
  });

  it('rejects Ghost Parallels and foreign sources when creating cards', async () => {
    // Unauthenticated rejected
    await request(app.getHttpServer())
      .post('/v1/cards')
      .send({ cardType: 'PARALLEL', sourceId: publicUserParallelId })
      .expect(401);

    // Ghost Parallel rejected with 400
    await request(app.getHttpServer())
      .post('/v1/cards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ cardType: 'PARALLEL', sourceId: ghostUserParallelId })
      .expect(400);

    // Foreign user rejected with 404
    await request(app.getHttpServer())
      .post('/v1/cards')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ cardType: 'PARALLEL', sourceId: publicUserParallelId })
      .expect(404);
  });

  it('creates a persisted Identity Card and serves public metadata + SVG image without auth', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/cards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ cardType: 'PARALLEL', sourceId: publicUserParallelId })
      .expect(201);

    const cardId: string = createRes.body.id;
    expect(cardId).toBeTruthy();
    expect(createRes.body.jobId).toBe(cardId);
    expect(createRes.body.card.imageUrl).toBe(`/v1/cards/${cardId}/image`);

    // Public metadata endpoint requires NO auth
    const publicRes = await request(app.getHttpServer())
      .get(`/v1/cards/${cardId}`)
      .expect(200);

    expect(publicRes.body.id).toBe(cardId);
    expect(publicRes.body.metadata.username).toBe(userA.username);
    expect(publicRes.body.metadata.title).toBe(`Card Public ${suffix}`);

    // Public SVG endpoint requires NO auth and serves valid SVG XML
    const imageRes = await request(app.getHttpServer())
      .get(`/v1/cards/${cardId}/image`)
      .expect(200);

    const svgBody = Buffer.isBuffer(imageRes.body)
      ? imageRes.body.toString('utf8')
      : String(imageRes.text ?? '');

    expect(imageRes.headers['content-type']).toContain('image/svg+xml');
    expect(svgBody).toContain('<svg');
    expect(svgBody).toContain(`@${userA.username}`);

    // Authenticated listMine returns the created card
    const mineRes = await request(app.getHttpServer())
      .get('/v1/cards/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(mineRes.body.some((c: { id: string }) => c.id === cardId)).toBe(true);
  });
});
