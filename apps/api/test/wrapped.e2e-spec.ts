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

describe('Parallel Wrapped lifecycle (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const user = {
    email: `wrapped_${suffix}@example.com`,
    username: `wrapped_${suffix}`,
    password: 'StrongPassword123!',
  };

  let token = '';
  let userId = '';
  let ptPublicAId = '';
  let ptPublicBId = '';
  let ptGhostId = '';

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

    const signup = await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send(user)
      .expect(201);
    token = signup.body.data.accessToken;
    userId = signup.body.data.user.id;

    const [ptA, ptB, ptGhost] = await Promise.all([
      prisma.parallelType.create({
        data: {
          name: `Wrapped Public A ${suffix}`,
          description: 'Public A',
          icon: 'sparkles',
          isSystemGenerated: false,
        },
      }),
      prisma.parallelType.create({
        data: {
          name: `Wrapped Public B ${suffix}`,
          description: 'Public B',
          icon: 'compass',
          isSystemGenerated: false,
        },
      }),
      prisma.parallelType.create({
        data: {
          name: `Wrapped Secret Ghost ${suffix}`,
          description: 'Secret Ghost',
          icon: 'ghost',
          isSystemGenerated: false,
        },
      }),
    ]);

    ptPublicAId = ptA.id;
    ptPublicBId = ptB.id;
    ptGhostId = ptGhost.id;

    await Promise.all([
      prisma.userParallel.create({
        data: {
          userId,
          parallelTypeId: ptPublicAId,
          strengthPct: 84,
          streakCount: 5,
          isGhost: false,
          isHidden: false,
        },
      }),
      prisma.userParallel.create({
        data: {
          userId,
          parallelTypeId: ptPublicBId,
          strengthPct: 68,
          streakCount: 2,
          isGhost: false,
          isHidden: false,
        },
      }),
      prisma.userParallel.create({
        data: {
          userId,
          parallelTypeId: ptGhostId,
          strengthPct: 99,
          streakCount: 99,
          isGhost: true,
          isHidden: false,
        },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: userId },
    });
    await prisma.parallelType.deleteMany({
      where: { id: { in: [ptPublicAId, ptPublicBId, ptGhostId].filter(Boolean) } },
    });
    await app.close();
  });

  it('generates a Wrapped recap excluding Ghost Parallels, serves latest and public recap, and converts into a Card', async () => {
    // Unauthenticated generate & latest are rejected
    await request(app.getHttpServer()).post('/v1/wrapped/generate').expect(401);
    await request(app.getHttpServer()).get('/v1/wrapped/latest').expect(401);

    // Generate monthly Wrapped
    const genRes = await request(app.getHttpServer())
      .post('/v1/wrapped/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 'MONTHLY' })
      .expect(201);

    const wrappedId: string = genRes.body.id;
    expect(wrappedId).toBeTruthy();
    expect(genRes.body.period).toBe('MONTHLY');
    // Ghost Parallel with 99-day streak MUST NOT leak into Wrapped!
    expect(genRes.body.highlights.streakHighlight).toEqual({
      parallelTypeId: ptPublicAId,
      streakCount: 5,
    });
    expect(JSON.stringify(genRes.body)).not.toContain(ptGhostId);

    // Latest returns the generated Wrapped
    const latestRes = await request(app.getHttpServer())
      .get('/v1/wrapped/latest')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(latestRes.body.id).toBe(wrappedId);

    // Public share endpoint requires NO auth
    const publicRes = await request(app.getHttpServer())
      .get(`/v1/wrapped/${wrappedId}`)
      .expect(200);
    expect(publicRes.body.id).toBe(wrappedId);
    expect(publicRes.body.username).toBe(user.username);

    // User can turn their Wrapped into a shareable Identity Card
    const cardRes = await request(app.getHttpServer())
      .post('/v1/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ cardType: 'WRAPPED', sourceId: wrappedId })
      .expect(201);
    expect(cardRes.body.card.cardType).toBe('WRAPPED');
    expect(cardRes.body.card.sourceId).toBe(wrappedId);
  });
});
