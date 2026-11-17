import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp, getHttpServer } from './utils/create-test-app.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Collab Parallels (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];
  const createdParallelTypeIds: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let userA: { id: string; username: string };
  let userB: { id: string; username: string };
  let userC: { id: string; username: string };
  let parallelExplorer: { id: string; name: string };
  let parallelFoodie: { id: string; name: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // Look up or setup curated Parallel types: Explorer & Foodie
    let explorer = await prisma.parallelType.findUnique({
      where: { name: 'Explorer' },
    });
    if (!explorer) {
      explorer = await prisma.parallelType.create({
        data: {
          name: 'Explorer',
          description: 'Loves wandering',
          icon: 'compass',
        },
      });
      createdParallelTypeIds.push(explorer.id);
    }
    parallelExplorer = explorer;

    let foodie = await prisma.parallelType.findUnique({
      where: { name: 'Foodie' },
    });
    if (!foodie) {
      foodie = await prisma.parallelType.create({
        data: {
          name: 'Foodie',
          description: 'Loves tasting foods',
          icon: 'utensils',
        },
      });
      createdParallelTypeIds.push(foodie.id);
    }
    parallelFoodie = foodie;

    // Create User A, User B, User C
    const makeUser = async (label: string) => {
      const suffix = randomUUID().slice(0, 8);
      const email = `e2e-collab-${label}-${suffix}@example.com`;
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

    const resA = await makeUser('a');
    userA = { id: resA.id, username: resA.username };
    tokenA = resA.token;

    const resB = await makeUser('b');
    userB = { id: resB.id, username: resB.username };
    tokenB = resB.token;

    const resC = await makeUser('c');
    userC = { id: resC.id, username: resC.username };
    tokenC = resC.token;

    // Grant User A visible Explorer parallel
    await prisma.userParallel.create({
      data: {
        userId: userA.id,
        parallelTypeId: parallelExplorer.id,
        strengthPct: 80,
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      },
    });

    // Grant User B visible Foodie parallel
    await prisma.userParallel.create({
      data: {
        userId: userB.id,
        parallelTypeId: parallelFoodie.id,
        strengthPct: 75,
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      },
    });

    // Grant User C a ghost Foodie parallel (invisible)
    await prisma.userParallel.create({
      data: {
        userId: userC.id,
        parallelTypeId: parallelFoodie.id,
        strengthPct: 50,
        isGhost: true, // Ghost mode
        isHidden: false,
        dismissedAt: null,
      },
    });
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await prisma.parallelType.deleteMany({
      where: { id: { in: createdParallelTypeIds } },
    });
    await app.close();
  });

  let createdSessionId: string;

  it('rejects self-invitation with 400', async () => {
    const res = await request(getHttpServer(app))
      .post('/v1/collab/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        targetUserId: userA.id,
        myParallelTypeId: parallelExplorer.id,
      });

    expect(res.status).toBe(400);
  });

  it('rejects invitation using a ghost (private) Parallel with 400', async () => {
    const res = await request(getHttpServer(app))
      .post('/v1/collab/invite')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({
        toUsername: userB.username,
        myParallelTypeId: parallelFoodie.id, // User C's Foodie is isGhost: true
      });

    expect(res.status).toBe(400);
  });

  it('creates a PENDING collab session when user A invites user B', async () => {
    const res = await request(getHttpServer(app))
      .post('/v1/collab/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        toUsername: userB.username,
        myParallelTypeId: parallelExplorer.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.userA.username).toBe(userA.username);
    expect(res.body.data.userB.username).toBe(userB.username);
    expect(res.body.data.parallelTypeA.name).toBe('Explorer');
    expect(res.body.data.parallelTypeB).toBeNull();
    expect(res.body.data.userACompleted).toBe(false);
    expect(res.body.data.userBCompleted).toBe(false);

    createdSessionId = res.body.data.id;
  });

  it('rejects concurrent duplicate invitation between the same pair with 409 Conflict', async () => {
    const res = await request(getHttpServer(app))
      .post('/v1/collab/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        targetUserId: userB.id,
        myParallelTypeId: parallelExplorer.id,
      });

    expect(res.status).toBe(409);
  });

  it('denies third-party (user C) access with 403 Forbidden', async () => {
    // Cannot view
    const viewRes = await request(getHttpServer(app))
      .get(`/v1/collab/sessions/${createdSessionId}`)
      .set('Authorization', `Bearer ${tokenC}`);
    expect(viewRes.status).toBe(403);

    // Cannot accept
    const acceptRes = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/accept`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ myParallelTypeId: parallelFoodie.id });
    expect(acceptRes.status).toBe(403);

    // Cannot cancel
    const cancelRes = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/cancel`)
      .set('Authorization', `Bearer ${tokenC}`);
    expect(cancelRes.status).toBe(403);

    // Cannot complete
    const completeRes = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/complete`)
      .set('Authorization', `Bearer ${tokenC}`);
    expect(completeRes.status).toBe(403);
  });

  it('allows user B to accept with their visible parallel, transitioning to ACTIVE with curated challenge', async () => {
    const res = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ myParallelTypeId: parallelFoodie.id });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.parallelTypeB.name).toBe('Foodie');
    expect(res.body.data.challengeTitle).toBe('Street Food Expedition');
    expect(res.body.data.challengeDescription).toContain('neighborhood');
    expect(res.body.data.challengeContext.theme).toBe('Culinary Expedition');
  });

  it('rejects second accept on already ACTIVE session with 400', async () => {
    const res = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ myParallelTypeId: parallelFoodie.id });

    expect(res.status).toBe(400);
  });

  it('records user A completion while keeping session ACTIVE', async () => {
    const res = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(201);
    expect(res.body.data.userACompleted).toBe(true);
    expect(res.body.data.userBCompleted).toBe(false);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.completedAt).toBeNull();

    // Verify no interest signal created yet
    const signals = await prisma.interestSignal.findMany({
      where: { targetId: createdSessionId, signalType: 'CHALLENGE_COMPLETE' },
    });
    expect(signals).toHaveLength(0);
  });

  it('records user B completion, transitions to COMPLETED, and logs interest signals exactly once', async () => {
    const res = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/complete`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(201);
    expect(res.body.data.userACompleted).toBe(true);
    expect(res.body.data.userBCompleted).toBe(true);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.completedAt).toBeTruthy();

    // Verify interest signals logged for both participants
    const signals = await prisma.interestSignal.findMany({
      where: { targetId: createdSessionId, signalType: 'CHALLENGE_COMPLETE' },
    });
    expect(signals).toHaveLength(2);
    const signalUserIds = signals.map((s) => s.userId).sort();
    expect(signalUserIds).toEqual([userA.id, userB.id].sort());
  });

  it('rejects further completion or cancellation attempts once COMPLETED', async () => {
    // Complete attempt on completed session
    const completeRes = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(completeRes.status).toBe(400);

    // Cancel attempt on completed session
    const cancelRes = await request(getHttpServer(app))
      .post(`/v1/collab/${createdSessionId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(cancelRes.status).toBe(400);
  });

  it('allows participants to fetch completed session via GET /v1/collab/sessions', async () => {
    const res = await request(getHttpServer(app))
      .get('/v1/collab/sessions?status=COMPLETED')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    const found = res.body.data.find(
      (s: { id: string }) => s.id === createdSessionId,
    );
    expect(found).toBeDefined();
    expect(found.status).toBe('COMPLETED');
  });
});
