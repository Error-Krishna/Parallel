import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IdentityEngineService } from './identity-engine.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { UsersService } from '../users/users.service.js';

describe('IdentityEngineService', () => {
  let service: IdentityEngineService;
  let prisma: {
    userParallel: Record<string, ReturnType<typeof vi.fn>>;
    parallelType: Record<string, ReturnType<typeof vi.fn>>;
    onboardingResponse: Record<string, ReturnType<typeof vi.fn>>;
    parallelEvolutionSnapshot: Record<string, ReturnType<typeof vi.fn>>;
  };
  let usersService: {
    findById: ReturnType<typeof vi.fn>;
    toPublicUser: ReturnType<typeof vi.fn>;
  };

  const fakeUserRow = {
    id: 'u1',
    email: 'a@example.com',
    username: 'alex',
    passwordHash: 'super-secret-hash',
    avatarUrl: null,
    bio: null,
  };
  const fakePublicUser = { id: 'u1', username: 'alex', avatarUrl: null, bio: null };

  const fourAnswers = [
    { questionKey: 'friday_night', answerValue: 'create' },
    { questionKey: 'learn_or_make', answerValue: 'make' },
    { questionKey: 'plan_or_improvise', answerValue: 'plan' },
    { questionKey: 'natural_activity', answerValue: 'building' },
  ];

  beforeEach(async () => {
    prisma = {
      userParallel: { findFirst: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
      parallelType: { upsert: vi.fn() },
      onboardingResponse: { findMany: vi.fn() },
      parallelEvolutionSnapshot: { createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    };
    usersService = {
      findById: vi.fn().mockResolvedValue(fakeUserRow),
      toPublicUser: vi.fn().mockReturnValue(fakePublicUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        {
          provide: 'BullQueue_embedding',
          useValue: {
            add: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(IdentityEngineService);
  });

  it('throws if onboarding is not yet complete', async () => {
    prisma.userParallel.findFirst.mockResolvedValue(null);
    prisma.onboardingResponse.findMany.mockResolvedValue([fourAnswers[0]]); // only 1

    await expect(service.generateInitialMap('u1')).rejects.toThrow(BadRequestException);
  });

  it('generates 4 Parallel types and scores from 4 answers, returning a sanitized user', async () => {
    prisma.userParallel.findFirst.mockResolvedValue(null);
    prisma.onboardingResponse.findMany.mockResolvedValue(fourAnswers);
    prisma.parallelType.upsert.mockImplementation(({ where }) =>
      Promise.resolve({ id: `type-${where.name}`, name: where.name }),
    );
    prisma.userParallel.upsert.mockResolvedValue({});
    prisma.userParallel.findMany.mockResolvedValue([
      {
        id: 'up1',
        parallelType: { id: 'type-Builder', name: 'Builder', description: 'd', icon: 'plus' },
        strengthPct: 40,
        momentum: 0,
        streakCount: 0,
        isGhost: true,
        isHidden: false,
        dismissedAt: null,
        suggestionReason: 'Based on your onboarding choices.',
        discoveredAt: new Date(),
      },
    ]);

    const result = await service.generateInitialMap('u1');

    // The exact bug: this response must never carry passwordHash or email —
    // generateInitialMap used to pass the raw Prisma User straight through here.
    expect(result.user).toEqual(fakePublicUser);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('email');
    expect(prisma.parallelType.upsert).toHaveBeenCalledTimes(4);
    expect(prisma.userParallel.upsert).toHaveBeenCalledTimes(4);
  });

  it('does not re-run scoring for a user who already has a Parallel map', async () => {
    prisma.userParallel.findFirst.mockResolvedValue({ id: 'existing' });
    prisma.userParallel.findMany.mockResolvedValue([]);
    prisma.parallelEvolutionSnapshot.findFirst = vi.fn().mockResolvedValue({
      id: 'snapshot-existing',
    });

    await service.generateInitialMap('u1');

    // Idempotency guard: a repeat call must skip straight to getMap() and never
    // touch onboardingResponse/parallelType/userParallel.upsert again — that's what
    // would otherwise silently reset an existing user's momentum/strengthPct.
    expect(prisma.onboardingResponse.findMany).not.toHaveBeenCalled();
    expect(prisma.parallelType.upsert).not.toHaveBeenCalled();
    expect(prisma.userParallel.upsert).not.toHaveBeenCalled();
    expect(prisma.parallelEvolutionSnapshot.createMany).not.toHaveBeenCalled();
  });

  it('creates a missing initial evolution snapshot for an existing Parallel map', async () => {
    prisma.userParallel.findFirst.mockResolvedValue({ id: 'existing' });
    prisma.userParallel.findMany
      .mockResolvedValueOnce([
        {
          parallelTypeId: 'builder-id',
          strengthPct: 42,
        },
        {
          parallelTypeId: 'explorer-id',
          strengthPct: 28,
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.parallelEvolutionSnapshot.findFirst = vi.fn().mockResolvedValue(null);
    prisma.parallelEvolutionSnapshot.createMany = vi.fn().mockResolvedValue({
      count: 2,
    });

    await service.generateInitialMap('u1');

    expect(prisma.parallelEvolutionSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'u1',
          parallelTypeId: 'builder-id',
          strengthPct: 42,
        },
        {
          userId: 'u1',
          parallelTypeId: 'explorer-id',
          strengthPct: 28,
        },
      ],
    });
  });

  it('getMap always sanitizes the user, with no way to pass a raw row through', async () => {
    prisma.userParallel.findMany.mockResolvedValue([]);

    const result = await service.getMap('u1');

    expect(result.user).toEqual(fakePublicUser);
    expect(usersService.toPublicUser).toHaveBeenCalledWith(fakeUserRow);
  });

  it('captures the current strength of each Parallel as an evolution snapshot', async () => {
    prisma.userParallel.findMany.mockResolvedValue([
      {
        parallelTypeId: 'builder-id',
        strengthPct: 42.5,
      },
      {
        parallelTypeId: 'explorer-id',
        strengthPct: 27.5,
      },
    ]);
    prisma.parallelEvolutionSnapshot = {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
    };

    await service.captureEvolutionSnapshot('u1');

    expect(prisma.parallelEvolutionSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'u1',
          parallelTypeId: 'builder-id',
          strengthPct: 42.5,
        },
        {
          userId: 'u1',
          parallelTypeId: 'explorer-id',
          strengthPct: 27.5,
        },
      ],
    });
  });

  it('returns the change between the latest two snapshots for each Parallel', async () => {
    prisma.parallelEvolutionSnapshot.findMany = vi.fn().mockResolvedValue([
      {
        parallelTypeId: 'builder-id',
        strengthPct: 48,
        capturedAt: new Date('2026-09-13T02:00:00Z'),
      },
      {
        parallelTypeId: 'builder-id',
        strengthPct: 42,
        capturedAt: new Date('2026-09-13T01:00:00Z'),
      },
      {
        parallelTypeId: 'explorer-id',
        strengthPct: 25,
        capturedAt: new Date('2026-09-13T02:00:00Z'),
      },
    ]);

    const result = await service.getEvolution('u1');

    expect(result).toEqual([
      {
        parallelTypeId: 'builder-id',
        currentStrengthPct: 48,
        previousStrengthPct: 42,
        deltaPct: 6,
        history: [
          {
            strengthPct: 42,
            capturedAt: '2026-09-13T01:00:00.000Z',
          },
          {
            strengthPct: 48,
            capturedAt: '2026-09-13T02:00:00.000Z',
          },
        ],
      },
      {
        parallelTypeId: 'explorer-id',
        currentStrengthPct: 25,
        previousStrengthPct: null,
        deltaPct: null,
        history: [
          {
            strengthPct: 25,
            capturedAt: '2026-09-13T02:00:00.000Z',
          },
        ],
      },
    ]);
  });
});
