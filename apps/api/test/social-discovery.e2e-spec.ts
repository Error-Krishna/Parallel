import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp, getHttpServer } from './utils/create-test-app.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UsersService } from '../src/modules/users/users.service.js';

describe('Phase 7 Social Discovery & Twin Matching (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let usersService: UsersService;
  const createdEmails: string[] = [];
  const createdParallelTypeIds: string[] = [];

  let tokenAlpha: string;
  let userAlpha: { id: string; username: string };
  let userBeta: { id: string; username: string };
  let parallelBuilder: { id: string; name: string };
  let parallelUrbanist: { id: string; name: string };
  let parallelGamer: { id: string; name: string };
  let parallelMusicHead: { id: string; name: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersService = app.get(UsersService);

    const getOrCreateParallel = async (
      name: string,
      description: string,
      icon: string,
    ) => {
      let pt = await prisma.parallelType.findUnique({ where: { name } });
      if (!pt) {
        pt = await prisma.parallelType.create({
          data: { name, description, icon },
        });
        createdParallelTypeIds.push(pt.id);
      }
      return pt;
    };

    parallelBuilder = await getOrCreateParallel(
      'Builder',
      'Builds systems and software',
      'hammer',
    );
    parallelUrbanist = await getOrCreateParallel(
      'Urbanist',
      'Explores city infrastructure and public design',
      'map-pin',
    );
    parallelGamer = await getOrCreateParallel(
      'Gamer',
      'Enjoys deep gameplay mechanics',
      'gamepad',
    );
    parallelMusicHead = await getOrCreateParallel(
      'Music Head',
      'Immersed in soundscapes and records',
      'music',
    );

    const makeUser = async (label: string) => {
      const suffix = randomUUID().slice(0, 8);
      const email = `e2e-social-${label}-${suffix}@example.com`;
      createdEmails.push(email);
      const username = `u_${label}_${suffix}`;
      const signupRes = await request(getHttpServer(app))
        .post('/v1/auth/signup')
        .send({ email, username, password: 'password123' });
      return {
        id: signupRes.body.data.user.id,
        username,
        token: signupRes.body.data.accessToken as string,
      };
    };

    const resAlpha = await makeUser('alpha');
    userAlpha = { id: resAlpha.id, username: resAlpha.username };
    tokenAlpha = resAlpha.token;

    const resBeta = await makeUser('beta');
    userBeta = { id: resBeta.id, username: resBeta.username };

    // User Alpha setup:
    // Builder (85%), Urbanist (90%), Gamer (40%)
    await prisma.userParallel.createMany({
      data: [
        {
          userId: userAlpha.id,
          parallelTypeId: parallelBuilder.id,
          strengthPct: 85,
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
        {
          userId: userAlpha.id,
          parallelTypeId: parallelUrbanist.id,
          strengthPct: 90,
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
        {
          userId: userAlpha.id,
          parallelTypeId: parallelGamer.id,
          strengthPct: 40,
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
      ],
    });

    // User Beta setup:
    // Builder (80%), Urbanist (88%), Music Head (35%)
    // Shared intersection: Builder + Urbanist (2 shared visible Parallels with close strengths!)
    await prisma.userParallel.createMany({
      data: [
        {
          userId: userBeta.id,
          parallelTypeId: parallelBuilder.id,
          strengthPct: 80,
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
        {
          userId: userBeta.id,
          parallelTypeId: parallelUrbanist.id,
          strengthPct: 88,
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
        {
          userId: userBeta.id,
          parallelTypeId: parallelMusicHead.id,
          strengthPct: 35,
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
      ],
    });
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (createdParallelTypeIds.length > 0) {
      await prisma.parallelType.deleteMany({
        where: { id: { in: createdParallelTypeIds } },
      });
    }
    await app.close();
  });

  it('People Discovery ranks candidate by unusual multi-Parallel intersection with plain-language explanation', async () => {
    const res = await request(getHttpServer(app))
      .get(`/v1/parallels/${parallelBuilder.id}/people`)
      .set('Authorization', `Bearer ${tokenAlpha}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);

    const betaDiscovery = res.body.find(
      (c: { user: { id: string } }) => c.user.id === userBeta.id,
    );
    expect(betaDiscovery).toBeDefined();

    // Verify shared parallels list includes both Builder and Urbanist
    const sharedNames = betaDiscovery.sharedParallels.map(
      (p: { name: string }) => p.name,
    );
    expect(sharedNames).toContain('Builder');
    expect(sharedNames).toContain('Urbanist');

    // Verify explainable plain-language text
    expect(betaDiscovery.explanation).toMatch(
      /Both exploring (Builder \+ Urbanist|Urbanist \+ Builder)/,
    );
  });

  it('Twin matching produces a valid match when similarity crosses the 70% threshold with 2+ shared Parallels', async () => {
    // Twin calculation job persists matches
    await usersService.saveTwinMatch(userAlpha.id, userBeta.id);

    const res = await request(getHttpServer(app))
      .get('/v1/users/twins')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);

    const match = res.body.data.find(
      (t: { user: { id: string } }) => t.user.id === userBeta.id,
    );
    expect(match).toBeDefined();
    expect(match.similarityScore).toBeGreaterThanOrEqual(70);
    expect(match.similarityScore).toBeLessThanOrEqual(100);
    expect(match.sharedParallelTypeIds).toContain(parallelBuilder.id);
    expect(match.sharedParallelTypeIds).toContain(parallelUrbanist.id);
  });

  it('supports follow and unfollow between the discovered accounts', async () => {
    // Follow
    const followRes = await request(getHttpServer(app))
      .post(`/v1/users/${userBeta.id}/follow`)
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect([200, 201, 204]).toContain(followRes.status);

    // Verify following list
    const followingRes = await request(getHttpServer(app))
      .get('/v1/users/following')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(followingRes.status).toBe(200);
    expect(followingRes.body.data).toContain(userBeta.id);

    // Unfollow
    const unfollowRes = await request(getHttpServer(app))
      .post(`/v1/users/${userBeta.id}/unfollow`)
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect([200, 201, 204]).toContain(unfollowRes.status);
  });
});
