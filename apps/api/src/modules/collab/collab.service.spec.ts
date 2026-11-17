import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { CollabService } from './collab.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { StreakService } from '../quests/streak.service.js';

describe('CollabService', () => {
  let service: CollabService;
  let prisma: {
    user: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    userParallel: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    parallelType: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    collabSession: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    interestSignal: {
      createMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
  };
  let streakService: {
    touch: ReturnType<typeof vi.fn>;
  };

  const userA = {
    id: 'user-a',
    username: 'alice',
    avatarUrl: null,
    bio: 'Explorer of things',
  };

  const userB = {
    id: 'user-b',
    username: 'bob',
    avatarUrl: null,
    bio: 'Food enthusiast',
  };

  const parallelTypeA = {
    id: 'pt-explorer',
    name: 'Explorer',
    description: 'Thrives on wandering and finding new trails',
    icon: 'compass',
  };

  const parallelTypeB = {
    id: 'pt-foodie',
    name: 'Foodie',
    description: 'Lives for flavor discoveries and street bites',
    icon: 'utensils',
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      userParallel: {
        findUnique: vi.fn(),
      },
      parallelType: {
        findUnique: vi.fn(),
      },
      collabSession: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      interestSignal: {
        createMany: vi.fn(),
      },
      $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    streakService = {
      touch: vi.fn().mockResolvedValue(1),
    };

    service = new CollabService(
      prisma as unknown as PrismaService,
      streakService as unknown as StreakService,
    );
  });

  describe('invite', () => {
    it('creates a pending session when inviting by username with a visible parallel', async () => {
      prisma.user.findFirst.mockResolvedValue(userB);
      prisma.userParallel.findUnique.mockResolvedValue({
        id: 'up-a',
        userId: userA.id,
        parallelTypeId: parallelTypeA.id,
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      });
      prisma.collabSession.findFirst.mockResolvedValue(null);

      const mockCreated = {
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        userA,
        userB,
        parallelTypeAId: parallelTypeA.id,
        parallelTypeA,
        parallelTypeBId: null,
        parallelTypeB: null,
        status: 'PENDING',
        challengeTitle: null,
        challengeDescription: null,
        challengeContext: null,
        userACompleted: false,
        userBCompleted: false,
        completedAt: null,
        createdAt: new Date('2026-10-23T00:00:00Z'),
        updatedAt: new Date('2026-10-23T00:00:00Z'),
      };
      prisma.collabSession.create.mockResolvedValue(mockCreated);

      const result = await service.invite(userA.id, {
        toUsername: 'bob',
        myParallelTypeId: parallelTypeA.id,
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: {
            equals: 'bob',
            mode: 'insensitive',
          },
        },
        select: expect.any(Object),
      });
      expect(prisma.collabSession.create).toHaveBeenCalledWith({
        data: {
          userAId: userA.id,
          userBId: userB.id,
          parallelTypeAId: parallelTypeA.id,
          status: 'PENDING',
        },
        include: expect.any(Object),
      });
      expect(result.status).toBe('PENDING');
      expect(result.userB.username).toBe('bob');
    });

    it('rejects self-invitation with 400 Bad Request', async () => {
      prisma.user.findUnique.mockResolvedValue(userA);

      await expect(
        service.invite(userA.id, {
          targetUserId: userA.id,
          myParallelTypeId: parallelTypeA.id,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('rejects non-existent target user with 404', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.invite(userA.id, {
          toUsername: 'nonexistent',
          myParallelTypeId: parallelTypeA.id,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('rejects ghost, hidden, or dismissed parallels with 400 Bad Request', async () => {
      prisma.user.findFirst.mockResolvedValue(userB);
      prisma.userParallel.findUnique.mockResolvedValue({
        id: 'up-a',
        userId: userA.id,
        parallelTypeId: parallelTypeA.id,
        isGhost: true, // Ghost mode
        isHidden: false,
        dismissedAt: null,
      });

      await expect(
        service.invite(userA.id, {
          toUsername: 'bob',
          myParallelTypeId: parallelTypeA.id,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('rejects concurrent duplicate session with 409 Conflict', async () => {
      prisma.user.findFirst.mockResolvedValue(userB);
      prisma.userParallel.findUnique.mockResolvedValue({
        id: 'up-a',
        userId: userA.id,
        parallelTypeId: parallelTypeA.id,
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      });
      prisma.collabSession.findFirst.mockResolvedValue({
        id: 'existing-session',
        status: 'PENDING',
      });

      await expect(
        service.invite(userA.id, {
          toUsername: 'bob',
          myParallelTypeId: parallelTypeA.id,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('accept', () => {
    it('accepts invite, sets status to ACTIVE, and generates signature curated challenge', async () => {
      const mockPendingSession = {
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        userA,
        userB,
        parallelTypeAId: parallelTypeA.id,
        parallelTypeA,
        parallelTypeBId: null,
        parallelTypeB: null,
        status: 'PENDING',
        challengeTitle: null,
        challengeDescription: null,
        challengeContext: null,
        userACompleted: false,
        userBCompleted: false,
        completedAt: null,
        createdAt: new Date('2026-10-23T00:00:00Z'),
        updatedAt: new Date('2026-10-23T00:00:00Z'),
      };
      prisma.collabSession.findUnique.mockResolvedValue(mockPendingSession);

      prisma.userParallel.findUnique.mockResolvedValue({
        id: 'up-b',
        userId: userB.id,
        parallelTypeId: parallelTypeB.id,
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
        parallelType: parallelTypeB,
      });

      const mockActiveSession = {
        ...mockPendingSession,
        parallelTypeBId: parallelTypeB.id,
        parallelTypeB,
        status: 'ACTIVE',
        challengeTitle: 'Street Food Expedition',
        challengeDescription: 'Venture to an unfamiliar neighborhood...',
        challengeContext: {
          theme: 'Culinary Expedition',
          category: 'Exploration & Taste',
          pairing: ['Explorer', 'Foodie'],
        },
      };
      prisma.collabSession.update.mockResolvedValue(mockActiveSession);

      const result = await service.accept(userB.id, 'session-1', {
        myParallelTypeId: parallelTypeB.id,
      });

      expect(result.status).toBe('ACTIVE');
      expect(result.challengeTitle).toBe('Street Food Expedition');
      expect(prisma.collabSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          parallelTypeBId: parallelTypeB.id,
          status: 'ACTIVE',
          challengeTitle: 'Street Food Expedition',
        }),
        include: expect.any(Object),
      });
    });

    it('rejects acceptance if requester is not user B (403 Forbidden)', async () => {
      prisma.collabSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'PENDING',
      });

      await expect(
        service.accept('user-impostor', 'session-1', {
          myParallelTypeId: parallelTypeB.id,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('rejects acceptance if session is not in PENDING status', async () => {
      prisma.collabSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'ACTIVE',
      });

      await expect(
        service.accept(userB.id, 'session-1', {
          myParallelTypeId: parallelTypeB.id,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('cancel', () => {
    it('allows participant to cancel pending or active session', async () => {
      prisma.collabSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'PENDING',
        userA,
        userB,
        parallelTypeAId: parallelTypeA.id,
        parallelTypeA,
        parallelTypeBId: null,
        parallelTypeB: null,
        challengeTitle: null,
        challengeDescription: null,
        challengeContext: null,
        userACompleted: false,
        userBCompleted: false,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prisma.collabSession.update.mockResolvedValue({
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'CANCELLED',
        userA,
        userB,
        parallelTypeAId: parallelTypeA.id,
        parallelTypeA,
        parallelTypeBId: null,
        parallelTypeB: null,
        challengeTitle: null,
        challengeDescription: null,
        challengeContext: null,
        userACompleted: false,
        userBCompleted: false,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.cancel(userA.id, 'session-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects cancellation from non-participant (403 Forbidden)', async () => {
      prisma.collabSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'PENDING',
      });

      await expect(
        service.cancel('random-user', 'session-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('complete', () => {
    it('updates userACompleted to true while keeping status ACTIVE if userB has not completed', async () => {
      const activeSession = {
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'ACTIVE',
        userA,
        userB,
        parallelTypeAId: parallelTypeA.id,
        parallelTypeA,
        parallelTypeBId: parallelTypeB.id,
        parallelTypeB,
        challengeTitle: 'Street Food Expedition',
        challengeDescription: 'Explore...',
        challengeContext: null,
        userACompleted: false,
        userBCompleted: false,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.collabSession.findUnique.mockResolvedValue(activeSession);
      prisma.collabSession.update.mockResolvedValue({
        ...activeSession,
        userACompleted: true,
      });

      const result = await service.complete(userA.id, 'session-1');
      expect(result.userACompleted).toBe(true);
      expect(result.status).toBe('ACTIVE');
      expect(prisma.interestSignal.createMany).not.toHaveBeenCalled();
    });

    it('transitions to COMPLETED and emits CHALLENGE_COMPLETE interest signals when both complete', async () => {
      const activeSession = {
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'ACTIVE',
        userA,
        userB,
        parallelTypeAId: parallelTypeA.id,
        parallelTypeA,
        parallelTypeBId: parallelTypeB.id,
        parallelTypeB,
        challengeTitle: 'Street Food Expedition',
        challengeDescription: 'Explore...',
        challengeContext: null,
        userACompleted: true, // User A already completed
        userBCompleted: false,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.collabSession.findUnique.mockResolvedValue(activeSession);
      prisma.collabSession.update.mockResolvedValue({
        ...activeSession,
        userBCompleted: true,
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      const result = await service.complete(userB.id, 'session-1');
      expect(result.status).toBe('COMPLETED');
      expect(result.userBCompleted).toBe(true);

      // Verify interest signals for both users
      expect(prisma.interestSignal.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: userA.id,
            signalType: 'CHALLENGE_COMPLETE',
            targetType: 'COLLAB',
            targetId: 'session-1',
            weight: 5.0,
          },
          {
            userId: userB.id,
            signalType: 'CHALLENGE_COMPLETE',
            targetType: 'COLLAB',
            targetId: 'session-1',
            weight: 5.0,
          },
        ],
      });

      // Verify streaks touched for both users
      expect(streakService.touch).toHaveBeenCalledWith(userA.id, parallelTypeA.id);
      expect(streakService.touch).toHaveBeenCalledWith(userB.id, parallelTypeB.id);
    });

    it('rejects complete call when session is not ACTIVE', async () => {
      prisma.collabSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'PENDING',
      });

      await expect(
        service.complete(userA.id, 'session-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getSession & getSessions', () => {
    it('returns session details for participants', async () => {
      const session = {
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'ACTIVE',
        userA,
        userB,
        parallelTypeAId: parallelTypeA.id,
        parallelTypeA,
        parallelTypeBId: parallelTypeB.id,
        parallelTypeB,
        challengeTitle: 'Street Food Expedition',
        challengeDescription: 'Explore...',
        challengeContext: null,
        userACompleted: false,
        userBCompleted: false,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.collabSession.findUnique.mockResolvedValue(session);

      const result = await service.getSession(userA.id, 'session-1');
      expect(result.id).toBe('session-1');
    });

    it('throws 403 Forbidden for non-participants', async () => {
      prisma.collabSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userAId: userA.id,
        userBId: userB.id,
        status: 'ACTIVE',
      });

      await expect(
        service.getSession('unauthorized-user', 'session-1'),
      ).rejects.toThrow(HttpException);
    });

    it('fetches sessions filtered by status', async () => {
      prisma.collabSession.findMany.mockResolvedValue([]);

      const result = await service.getSessions(userA.id, 'ACTIVE');
      expect(prisma.collabSession.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ userAId: userA.id }, { userBId: userA.id }],
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
      expect(result).toEqual([]);
    });
  });
});
