import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp, getHttpServer } from './utils/create-test-app.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { EmergingParallelService } from '../src/modules/identity-engine/emerging-parallel.service.js';
import { UsersService } from '../src/modules/users/users.service.js';

interface OnboardedUser {
  userId: string;
  username: string;
  accessToken: string;
  initialMap: {
    user: { id: string; username: string };
    parallels: Array<{
      id: string;
      isGhost: boolean;
      isHidden: boolean;
      parallelType: { id: string; name: string };
    }>;
  };
}

describe('Parallels Ghost Mode & Visibility (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let emergingParallelService: EmergingParallelService;
  let usersService: UsersService;

  const createdEmails: string[] = [];
  const createdParallelTypeIds: string[] = [];

  const unitVector = Array.from({ length: 384 }, (_, idx) =>
    idx === 0 ? 1 : 0,
  );

  let userA: OnboardedUser;
  let userB: OnboardedUser;

  async function signupAndCompleteOnboarding(): Promise<OnboardedUser> {
    const suffix = randomUUID().slice(0, 8);
    const email = `e2e-vis-${suffix}@example.com`;
    const username = `vis_${suffix}`;
    createdEmails.push(email);

    const signupRes = await request(getHttpServer(app))
      .post('/v1/auth/signup')
      .send({ email, username, password: 'password123' });

    expect(signupRes.status).toBe(201);
    const accessToken: string = signupRes.body.data.accessToken;
    const userId: string = signupRes.body.data.user.id;

    // Fetch real onboarding questions and submit all answers over HTTP
    const questionsRes = await request(getHttpServer(app))
      .get('/v1/onboarding/questions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(questionsRes.status).toBe(200);
    expect(Array.isArray(questionsRes.body)).toBe(true);
    expect(questionsRes.body.length).toBeGreaterThanOrEqual(4);

    for (const question of questionsRes.body as Array<{
      key: string;
      options: Array<{ value: string }>;
    }>) {
      const answerRes = await request(getHttpServer(app))
        .post('/v1/onboarding/answers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          questionKey: question.key,
          answerValue: question.options[0].value,
        });

      expect(answerRes.status).toBe(204);
    }

    // Complete onboarding over HTTP — generates the 4 initial starter Parallels
    const completeRes = await request(getHttpServer(app))
      .post('/v1/onboarding/complete')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(completeRes.status).toBe(201);

    return {
      userId,
      username,
      accessToken,
      initialMap: completeRes.body as OnboardedUser['initialMap'],
    };
  }

  async function createIsolatedGhostParallel(
    userId: string,
    label: string,
  ): Promise<{ parallelTypeId: string; userParallelId: string }> {
    const uniqueSuffix = randomUUID().slice(0, 8);
    const created = await emergingParallelService.createEmergingParallel(
      userId,
      {
        name: `${label} ${uniqueSuffix}`,
        description: `Isolated test Parallel for ${label}.`,
        icon: 'compass',
        strengthPct: 19,
        suggestionReason: `Emerged during ${label} e2e check.`,
        embedding: unitVector,
      },
    );
    createdParallelTypeIds.push(created.parallelTypeId);
    return created;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    emergingParallelService = app.get(EmergingParallelService);
    usersService = app.get(UsersService);

    userA = await signupAndCompleteOnboarding();
    userB = await signupAndCompleteOnboarding();
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    if (createdParallelTypeIds.length > 0) {
      await prisma.parallelType.deleteMany({
        where: { id: { in: createdParallelTypeIds } },
      });
    }
    await app.close();
  });

  it('publishes all 4 starter Parallels during onboarding and exposes them on public profiles immediately', async () => {
    expect(userA.initialMap.parallels).toHaveLength(4);
    for (const starter of userA.initialMap.parallels) {
      expect(starter.isGhost).toBe(false);
      expect(starter.isHidden).toBe(false);
    }

    const publicProfileRes = await request(getHttpServer(app))
      .get(`/v1/users/${userA.userId}/parallels`)
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(publicProfileRes.status).toBe(200);
    const starterTypeIds = userA.initialMap.parallels
      .map((p) => p.parallelType.id)
      .sort();
    const visibleTypeIds = (
      publicProfileRes.body.data as Array<{ parallelType: { id: string } }>
    )
      .map((p) => p.parallelType.id)
      .sort();

    expect(visibleTypeIds).toEqual(starterTypeIds);
  });

  it('matches onboarded users as Parallel Twins over HTTP and excludes unpublished Ghost Parallels', async () => {
    const ghostForTwinCheck = await createIsolatedGhostParallel(
      userA.userId,
      'Twin Ghost Exclusion',
    );

    // GET /v1/users/twins reads persisted rows computed by the Twins BullMQ job;
    // invoke the real pair-scoring method for (userA, userB) against PostgreSQL
    // without touching unrelated database users.
    await usersService.saveTwinMatch(userA.userId, userB.userId);

    const twinsRes = await request(getHttpServer(app))
      .get('/v1/users/twins')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(twinsRes.status).toBe(200);
    const matches = twinsRes.body.data as Array<{
      user: { id: string; username: string };
      similarityScore: number;
      sharedParallelTypeIds: string[];
    }>;

    const matchWithB = matches.find((m) => m.user.id === userB.userId);
    expect(matchWithB).toBeDefined();
    expect(matchWithB!.similarityScore).toBe(100);
    expect(matchWithB!.sharedParallelTypeIds).toHaveLength(4);
    expect(matchWithB!.sharedParallelTypeIds).not.toContain(
      ghostForTwinCheck.parallelTypeId,
    );
  });

  it('keeps emerging Parallels private until published by owner and exposes only the published Parallel', async () => {
    const emergingOne = await createIsolatedGhostParallel(
      userA.userId,
      'Urban Explorer',
    );
    const emergingTwo = await createIsolatedGhostParallel(
      userA.userId,
      'Analog Synth',
    );

    // Owner sees both emerging Parallels as Ghost on their map
    const mapBeforeRes = await request(getHttpServer(app))
      .get('/v1/parallels/map')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(mapBeforeRes.status).toBe(200);
    const mapBefore = mapBeforeRes.body.parallels as Array<{
      id: string;
      isGhost: boolean;
    }>;
    expect(
      mapBefore.find((p) => p.id === emergingOne.userParallelId)?.isGhost,
    ).toBe(true);
    expect(
      mapBefore.find((p) => p.id === emergingTwo.userParallelId)?.isGhost,
    ).toBe(true);

    // Neither Ghost Parallel appears on public profile or isolated people discovery
    const profileBeforeRes = await request(getHttpServer(app))
      .get(`/v1/users/${userA.userId}/parallels`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    const profileBeforeTypeIds = (
      profileBeforeRes.body.data as Array<{ parallelType: { id: string } }>
    ).map((p) => p.parallelType.id);
    expect(profileBeforeTypeIds).not.toContain(emergingOne.parallelTypeId);
    expect(profileBeforeTypeIds).not.toContain(emergingTwo.parallelTypeId);

    const peopleBeforeRes = await request(getHttpServer(app))
      .get(`/v1/parallels/${emergingOne.parallelTypeId}/people`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    expect(peopleBeforeRes.status).toBe(200);
    expect(
      (peopleBeforeRes.body as Array<{ user: { id: string } }>).some(
        (entry) => entry.user.id === userA.userId,
      ),
    ).toBe(false);

    // Publish emergingOne only
    const publishRes = await request(getHttpServer(app))
      .post(`/v1/parallels/${emergingOne.userParallelId}/make-public`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.id).toBe(emergingOne.userParallelId);
    expect(publishRes.body.isGhost).toBe(false);
    expect(publishRes.body.isHidden).toBe(false);
    expect(publishRes.body.parallelType.id).toBe(emergingOne.parallelTypeId);

    // emergingTwo remains private
    const untouchedRow = await prisma.userParallel.findUnique({
      where: { id: emergingTwo.userParallelId },
    });
    expect(untouchedRow?.isGhost).toBe(true);

    // emergingOne is now visible on public profile and isolated people discovery
    const profileAfterRes = await request(getHttpServer(app))
      .get(`/v1/users/${userA.userId}/parallels`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    const profileAfterTypeIds = (
      profileAfterRes.body.data as Array<{ parallelType: { id: string } }>
    ).map((p) => p.parallelType.id);
    expect(profileAfterTypeIds).toContain(emergingOne.parallelTypeId);
    expect(profileAfterTypeIds).not.toContain(emergingTwo.parallelTypeId);

    const peopleAfterRes = await request(getHttpServer(app))
      .get(`/v1/parallels/${emergingOne.parallelTypeId}/people`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    expect(peopleAfterRes.status).toBe(200);
    expect(
      (peopleAfterRes.body as Array<{ user: { id: string } }>).some(
        (entry) => entry.user.id === userA.userId,
      ),
    ).toBe(true);
  });

  it('enforces authentication (401) and returns 404 for non-owners and nonexistent IDs without mutating DB', async () => {
    const ownedGhost = await createIsolatedGhostParallel(
      userA.userId,
      'Ownership Guard',
    );

    // Unauthenticated -> 401
    const unauthRes = await request(getHttpServer(app)).post(
      `/v1/parallels/${ownedGhost.userParallelId}/make-public`,
    );
    expect(unauthRes.status).toBe(401);

    // Non-owner -> 404 (enumeration-safe, consistent with hideParallel)
    const nonOwnerRes = await request(getHttpServer(app))
      .post(`/v1/parallels/${ownedGhost.userParallelId}/make-public`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    expect(nonOwnerRes.status).toBe(404);

    // Nonexistent ID -> 404
    const missingRes = await request(getHttpServer(app))
      .post('/v1/parallels/non-existent-parallel-id/make-public')
      .set('Authorization', `Bearer ${userA.accessToken}`);
    expect(missingRes.status).toBe(404);

    // Owned Ghost Parallel was never mutated
    const dbRow = await prisma.userParallel.findUnique({
      where: { id: ownedGhost.userParallelId },
    });
    expect(dbRow?.isGhost).toBe(true);
  });

  it('rejects publishing a dismissed Parallel with 404 and leaves it unchanged', async () => {
    const dismissedGhost = await createIsolatedGhostParallel(
      userA.userId,
      'Dismissed Ghost',
    );

    const dismissedAt = new Date();
    await prisma.userParallel.update({
      where: { id: dismissedGhost.userParallelId },
      data: { dismissedAt },
    });

    const publishRes = await request(getHttpServer(app))
      .post(`/v1/parallels/${dismissedGhost.userParallelId}/make-public`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(publishRes.status).toBe(404);

    const dbRow = await prisma.userParallel.findUnique({
      where: { id: dismissedGhost.userParallelId },
    });
    expect(dbRow?.isGhost).toBe(true);
    expect(dbRow?.dismissedAt).not.toBeNull();
  });

  it('handles concurrent and repeated publication requests idempotently', async () => {
    const concurrentGhost = await createIsolatedGhostParallel(
      userA.userId,
      'Concurrent Publish',
    );

    // Fire two concurrent publish requests against real PostgreSQL
    const [res1, res2] = await Promise.all([
      request(getHttpServer(app))
        .post(`/v1/parallels/${concurrentGhost.userParallelId}/make-public`)
        .set('Authorization', `Bearer ${userA.accessToken}`),
      request(getHttpServer(app))
        .post(`/v1/parallels/${concurrentGhost.userParallelId}/make-public`)
        .set('Authorization', `Bearer ${userA.accessToken}`),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.isGhost).toBe(false);
    expect(res2.body.isGhost).toBe(false);

    // Subsequent sequential call remains idempotent
    const repeatRes = await request(getHttpServer(app))
      .post(`/v1/parallels/${concurrentGhost.userParallelId}/make-public`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.id).toBe(concurrentGhost.userParallelId);
    expect(repeatRes.body.isGhost).toBe(false);
  });

  it('excludes a hidden emerging Parallel from the owner map without publishing it', async () => {
    const hiddenGhost = await createIsolatedGhostParallel(
      userA.userId,
      'Hidden Ghost Only',
    );

    const hideRes = await request(getHttpServer(app))
      .patch(`/v1/parallels/${hiddenGhost.userParallelId}/hide`)
      .set('Authorization', `Bearer ${userA.accessToken}`);
    expect(hideRes.status).toBe(200);

    // Verify exclusion from owner's map over HTTP
    const mapAfterHideRes = await request(getHttpServer(app))
      .get('/v1/parallels/map')
      .set('Authorization', `Bearer ${userA.accessToken}`);
    expect(mapAfterHideRes.status).toBe(200);
    const mapIds = (mapAfterHideRes.body.parallels as Array<{ id: string }>).map(
      (p) => p.id,
    );
    expect(mapIds).not.toContain(hiddenGhost.userParallelId);

    // Verify Ghost and Hidden flags stayed distinct in PostgreSQL
    const dbRow = await prisma.userParallel.findUnique({
      where: { id: hiddenGhost.userParallelId },
    });
    expect(dbRow?.isHidden).toBe(true);
    expect(dbRow?.isGhost).toBe(true);
  });

  it('keeps a hidden Parallel excluded from map, public profile, and people discovery even after publishing', async () => {
    const hiddenThenPublished = await createIsolatedGhostParallel(
      userA.userId,
      'Hidden Then Published',
    );

    const hideRes = await request(getHttpServer(app))
      .patch(`/v1/parallels/${hiddenThenPublished.userParallelId}/hide`)
      .set('Authorization', `Bearer ${userA.accessToken}`);
    expect(hideRes.status).toBe(200);

    // Publish the hidden Parallel
    const publishRes = await request(getHttpServer(app))
      .post(`/v1/parallels/${hiddenThenPublished.userParallelId}/make-public`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.isGhost).toBe(false);
    expect(publishRes.body.isHidden).toBe(true);

    // Excluded from owner's map
    const mapRes = await request(getHttpServer(app))
      .get('/v1/parallels/map')
      .set('Authorization', `Bearer ${userA.accessToken}`);
    expect(
      (mapRes.body.parallels as Array<{ id: string }>).some(
        (p) => p.id === hiddenThenPublished.userParallelId,
      ),
    ).toBe(false);

    // Excluded from public profile
    const profileRes = await request(getHttpServer(app))
      .get(`/v1/users/${userA.userId}/parallels`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    expect(
      (
        profileRes.body.data as Array<{ parallelType: { id: string } }>
      ).some((p) => p.parallelType.id === hiddenThenPublished.parallelTypeId),
    ).toBe(false);

    // Excluded from isolated people discovery
    const peopleRes = await request(getHttpServer(app))
      .get(`/v1/parallels/${hiddenThenPublished.parallelTypeId}/people`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    expect(peopleRes.status).toBe(200);
    expect(
      (peopleRes.body as Array<{ user: { id: string } }>).some(
        (entry) => entry.user.id === userA.userId,
      ),
    ).toBe(false);

    // DB reflects isGhost: false and isHidden: true
    const dbRow = await prisma.userParallel.findUnique({
      where: { id: hiddenThenPublished.userParallelId },
    });
    expect(dbRow?.isGhost).toBe(false);
    expect(dbRow?.isHidden).toBe(true);
  });
});
