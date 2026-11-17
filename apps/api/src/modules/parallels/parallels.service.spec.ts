import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ParallelsService } from './parallels.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';
import { StreakService } from '../quests/streak.service.js';

describe('ParallelsService', () => {
  let service: ParallelsService;

  let prisma: {
    contentItem: Record<string, ReturnType<typeof vi.fn>>;
    interestSignal: Record<string, ReturnType<typeof vi.fn>>;
    parallelType: Record<string, ReturnType<typeof vi.fn>>;
    userParallel: Record<string, ReturnType<typeof vi.fn>>;
  };

  let streakService: {
    touch: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      contentItem: {
        findUnique: vi.fn(),
      },
      interestSignal: {
        create: vi.fn(),
      },
      parallelType: {
        findUnique: vi.fn(),
      },
      userParallel: {
        findMany: vi.fn(),
      },
    };

    streakService = {
      touch: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParallelsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: IdentityEngineService,
          useValue: {},
        },
        {
          provide: StreakService,
          useValue: streakService,
        },
      ],
    }).compile();

    service = module.get(ParallelsService);
  });

  it('creates a content interaction and touches the Parallel streak', async () => {
    prisma.contentItem.findUnique.mockResolvedValue({
      id: 'content-1',
      parallelTypeId: 'parallel-1',
    });

    await service.createContentInteraction(
      'user-1',
      'content-1',
      'LIKE',
    );

    expect(prisma.interestSignal.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        signalType: 'LIKE',
        targetType: 'content',
        targetId: 'content-1',
        weight: 1.0,
      },
    });

    expect(streakService.touch).toHaveBeenCalledWith(
      'user-1',
      'parallel-1',
    );
  });

  it('rejects a missing content item without touching a streak', async () => {
    prisma.contentItem.findUnique.mockResolvedValue(null);

    await expect(
      service.createContentInteraction(
        'user-1',
        'missing-content',
        'LIKE',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.interestSignal.create).not.toHaveBeenCalled();
    expect(streakService.touch).not.toHaveBeenCalled();
  });

  describe('getPeople', () => {
    const builderParallel = {
      id: 'p-builder',
      name: 'Builder',
      description: 'Creates software and systems',
      icon: 'hammer',
    };

    const urbanistParallel = {
      id: 'p-urbanist',
      name: 'Urbanist',
      description: 'Explores cities and public spaces',
      icon: 'building',
    };

    const gamerParallel = {
      id: 'p-gamer',
      name: 'Gamer',
      description: 'Plays games',
      icon: 'gamepad',
    };

    it('throws NotFoundException when the parallel does not exist', async () => {
      prisma.parallelType.findUnique.mockResolvedValue(null);

      await expect(
        service.getPeople('user-1', 'missing-parallel'),
      ).rejects.toThrow(NotFoundException);
    });

    it('derives a multi-Parallel explanation from actual shared visible Parallels', async () => {
      prisma.parallelType.findUnique.mockResolvedValue(builderParallel);

      // Requesting user has Builder and Urbanist
      prisma.userParallel.findMany
        .mockResolvedValueOnce([
          { parallelTypeId: 'p-builder', strengthPct: 80 },
          { parallelTypeId: 'p-urbanist', strengthPct: 70 },
        ])
        // Candidate user has Builder, Urbanist, and Gamer
        .mockResolvedValueOnce([
          {
            userId: 'user-2',
            strengthPct: 85,
            discoveredAt: new Date('2026-09-01T10:00:00Z'),
            user: {
              id: 'user-2',
              username: 'taylor',
              avatarUrl: null,
              bio: 'Passionate builder & city lover',
              parallels: [
                {
                  strengthPct: 85,
                  parallelType: builderParallel,
                },
                {
                  strengthPct: 75,
                  parallelType: urbanistParallel,
                },
                {
                  strengthPct: 50,
                  parallelType: gamerParallel,
                },
              ],
            },
          },
        ]);

      const result = await service.getPeople('user-1', 'p-builder');

      expect(result).toHaveLength(1);
      expect(result[0].user.username).toBe('taylor');
      expect(result[0].sharedParallels).toEqual([
        builderParallel,
        urbanistParallel,
      ]);
      expect(result[0].explanation).toBe('Both exploring Builder + Urbanist');
      expect(result[0].parallels).toEqual([gamerParallel]);
    });

    it('ranks candidates with multi-Parallel intersections ahead of single-parallel candidates', async () => {
      prisma.parallelType.findUnique.mockResolvedValue(builderParallel);

      // Requesting user has Builder and Urbanist
      prisma.userParallel.findMany
        .mockResolvedValueOnce([
          { parallelTypeId: 'p-builder', strengthPct: 80 },
          { parallelTypeId: 'p-urbanist', strengthPct: 70 },
        ])
        // Candidate 1 (user-single): has Builder at 95% strength, but no other shared Parallels
        // Candidate 2 (user-multi): has Builder at 75% and Urbanist at 70% (2 shared Parallels)
        .mockResolvedValueOnce([
          {
            userId: 'user-single',
            strengthPct: 95,
            discoveredAt: new Date('2026-09-01T10:00:00Z'),
            user: {
              id: 'user-single',
              username: 'alex',
              avatarUrl: null,
              bio: 'Only builds',
              parallels: [
                {
                  strengthPct: 95,
                  parallelType: builderParallel,
                },
                {
                  strengthPct: 60,
                  parallelType: gamerParallel,
                },
              ],
            },
          },
          {
            userId: 'user-multi',
            strengthPct: 75,
            discoveredAt: new Date('2026-09-01T10:00:00Z'),
            user: {
              id: 'user-multi',
              username: 'jordan',
              avatarUrl: null,
              bio: 'Urban builder',
              parallels: [
                {
                  strengthPct: 75,
                  parallelType: builderParallel,
                },
                {
                  strengthPct: 70,
                  parallelType: urbanistParallel,
                },
              ],
            },
          },
        ]);

      const result = await service.getPeople('user-1', 'p-builder');

      expect(result).toHaveLength(2);
      // user-multi must rank first because of the 2-Parallel intersection
      expect(result[0].user.username).toBe('jordan');
      expect(result[0].sharedParallels).toHaveLength(2);
      expect(result[0].explanation).toBe('Both exploring Builder + Urbanist');

      // user-single ranks second
      expect(result[1].user.username).toBe('alex');
      expect(result[1].sharedParallels).toHaveLength(1);
      expect(result[1].explanation).toBe('Both exploring Builder');
    });

    it('allows non-Twin candidates to be discovered without needing a Twin qualification', async () => {
      prisma.parallelType.findUnique.mockResolvedValue(builderParallel);

      // Requesting user only shares Builder
      prisma.userParallel.findMany
        .mockResolvedValueOnce([
          { parallelTypeId: 'p-builder', strengthPct: 80 },
        ])
        .mockResolvedValueOnce([
          {
            userId: 'user-casual',
            strengthPct: 40,
            discoveredAt: new Date('2026-09-01T10:00:00Z'),
            user: {
              id: 'user-casual',
              username: 'casey',
              avatarUrl: null,
              bio: null,
              parallels: [
                {
                  strengthPct: 40,
                  parallelType: builderParallel,
                },
              ],
            },
          },
        ]);

      const result = await service.getPeople('user-1', 'p-builder');

      expect(result).toHaveLength(1);
      expect(result[0].user.username).toBe('casey');
      expect(result[0].explanation).toBe('Both exploring Builder');
    });

    it('strictly excludes the requesting user and inactive or ghost Parallels', async () => {
      prisma.parallelType.findUnique.mockResolvedValue(builderParallel);

      prisma.userParallel.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getPeople('user-requesting', 'p-builder');

      // Check requesting user Parallels query filters
      expect(prisma.userParallel.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          userId: 'user-requesting',
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
        select: {
          parallelTypeId: true,
          strengthPct: true,
        },
      });

      // Check candidate users query filters out requesting user and ghost/hidden/dismissed Parallels
      expect(prisma.userParallel.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          parallelTypeId: 'p-builder',
          userId: { not: 'user-requesting' },
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
        take: 50,
        select: {
          userId: true,
          strengthPct: true,
          discoveredAt: true,
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              bio: true,
              parallels: {
                where: {
                  isGhost: false,
                  isHidden: false,
                  dismissedAt: null,
                },
                orderBy: {
                  strengthPct: 'desc',
                },
                select: {
                  strengthPct: true,
                  parallelType: {
                    select: {
                      id: true,
                      name: true,
                      description: true,
                      icon: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('breaks ties deterministically on average strength, discoveredAt, and userId', async () => {
      prisma.parallelType.findUnique.mockResolvedValue(builderParallel);

      prisma.userParallel.findMany
        .mockResolvedValueOnce([
          { parallelTypeId: 'p-builder', strengthPct: 80 },
        ])
        .mockResolvedValueOnce([
          {
            userId: 'user-b',
            strengthPct: 80,
            discoveredAt: new Date('2026-09-01T10:00:00Z'),
            user: {
              id: 'user-b',
              username: 'user_b',
              avatarUrl: null,
              bio: null,
              parallels: [{ strengthPct: 80, parallelType: builderParallel }],
            },
          },
          {
            userId: 'user-a',
            strengthPct: 80,
            discoveredAt: new Date('2026-09-01T10:00:00Z'),
            user: {
              id: 'user-a',
              username: 'user_a',
              avatarUrl: null,
              bio: null,
              parallels: [{ strengthPct: 80, parallelType: builderParallel }],
            },
          },
        ]);

      const result = await service.getPeople('user-1', 'p-builder');

      expect(result).toHaveLength(2);
      // Both share 1 parallel and have identical strength and discoveredAt; user-a precedes user-b alphabetically
      expect(result[0].user.id).toBe('user-a');
      expect(result[1].user.id).toBe('user-b');
    });

    it('handles candidates with zero shared parallels appropriately without invented explanations', async () => {
      prisma.parallelType.findUnique.mockResolvedValue(builderParallel);

      // Requesting user does not have Builder, only Gamer
      prisma.userParallel.findMany
        .mockResolvedValueOnce([
          { parallelTypeId: 'p-gamer', strengthPct: 80 },
        ])
        // Candidate has Builder only
        .mockResolvedValueOnce([
          {
            userId: 'user-2',
            strengthPct: 70,
            discoveredAt: new Date('2026-09-01T10:00:00Z'),
            user: {
              id: 'user-2',
              username: 'builder_fan',
              avatarUrl: null,
              bio: null,
              parallels: [{ strengthPct: 70, parallelType: builderParallel }],
            },
          },
        ]);

      const result = await service.getPeople('user-1', 'p-builder');

      expect(result).toHaveLength(1);
      expect(result[0].sharedParallels).toHaveLength(0);
      expect(result[0].explanation).toBe('Active in Builder');
    });
  });
});
