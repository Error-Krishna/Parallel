import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { QuestsService } from './quests.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { StreakService } from './streak.service.js';

describe('QuestsService', () => {
  let service: QuestsService;
  let streakService: {
    touch: ReturnType<typeof vi.fn>;
  };

  let prisma: {
    parallelType: Record<string, ReturnType<typeof vi.fn>>;
    quest: Record<string, ReturnType<typeof vi.fn>>;
    userQuestProgress: Record<string, ReturnType<typeof vi.fn>>;
    interestSignal: Record<string, ReturnType<typeof vi.fn>>;
    userQuestReward: Record<string, ReturnType<typeof vi.fn>>;
  };

  beforeEach(async () => {
    streakService = {
      touch: vi.fn(),
    };

    prisma = {
      parallelType: {
        findUnique: vi.fn(),
      },
      quest: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      userQuestProgress: {
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      interestSignal: {
        create: vi.fn(),
      },
      userQuestReward: {
        upsert: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StreakService, useValue: streakService },
      ],
    }).compile();

    service = module.get(QuestsService);
  });

  it('returns quests with NOT_STARTED progress when the user has no progress', async () => {
    prisma.parallelType.findUnique.mockResolvedValue({ id: 'parallel-1' });

    prisma.quest.findMany.mockResolvedValue([
      {
        id: 'quest-1',
        parallelTypeId: 'parallel-1',
        title: 'Build something',
        description: 'Make something small.',
        steps: [
          { title: 'Plan', description: 'Plan it.' },
          { title: 'Build', description: 'Build it.' },
          { title: 'Share', description: 'Share it.' },
        ],
        rewardType: 'BADGE',
        rewardValue: 'Builder Badge',
        season: null,
        progress: [],
      },
    ]);

    await expect(
      service.getQuests('user-1', 'parallel-1'),
    ).resolves.toEqual([
      {
        id: 'quest-1',
        parallelTypeId: 'parallel-1',
        title: 'Build something',
        description: 'Make something small.',
        steps: [
          { title: 'Plan', description: 'Plan it.' },
          { title: 'Build', description: 'Build it.' },
          { title: 'Share', description: 'Share it.' },
        ],
        rewardType: 'BADGE',
        rewardValue: 'Builder Badge',
        season: null,
        progress: {
          status: 'NOT_STARTED',
          currentStep: 0,
          startedAt: null,
          completedAt: null,
        },
      },
    ]);
  });

  it('rejects quests for a missing Parallel', async () => {
    prisma.parallelType.findUnique.mockResolvedValue(null);

    await expect(
      service.getQuests('user-1', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('starts a quest', async () => {
    const startedAt = new Date('2026-09-14T10:00:00.000Z');

    prisma.quest.findUnique.mockResolvedValue({ id: 'quest-1' });
    prisma.userQuestProgress.upsert.mockResolvedValue({
      status: 'IN_PROGRESS',
      currentStep: 0,
      startedAt,
      completedAt: null,
    });

    await expect(
      service.startQuest('user-1', 'quest-1'),
    ).resolves.toEqual({
      status: 'IN_PROGRESS',
      currentStep: 0,
      startedAt,
      completedAt: null,
    });

    expect(prisma.userQuestProgress.upsert).toHaveBeenCalledOnce();
  });

  it('rejects starting a missing quest', async () => {
    prisma.quest.findUnique.mockResolvedValue(null);

    await expect(
      service.startQuest('user-1', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects completing a quest that has not been started', async () => {
    prisma.quest.findUnique.mockResolvedValue({
      id: 'quest-1',
      parallelTypeId: 'parallel-1',
      steps: [
        { title: 'Step 1', description: 'Do step 1.' },
        { title: 'Step 2', description: 'Do step 2.' },
      ],
    });
    prisma.userQuestProgress.findUnique.mockResolvedValue(null);

    await expect(
      service.completeStep('user-1', 'quest-1'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.userQuestProgress.update).not.toHaveBeenCalled();
  });

  it('advances an in-progress quest without completing it', async () => {
    prisma.quest.findUnique.mockResolvedValue({
      id: 'quest-1',
      parallelTypeId: 'parallel-1',
      steps: [
        { title: 'Step 1', description: 'Do step 1.' },
        { title: 'Step 2', description: 'Do step 2.' },
        { title: 'Step 3', description: 'Do step 3.' },
      ],
    });

    prisma.userQuestProgress.findUnique.mockResolvedValue({
      status: 'IN_PROGRESS',
      currentStep: 0,
    });

    prisma.userQuestProgress.update.mockResolvedValue({
      status: 'IN_PROGRESS',
      currentStep: 1,
      startedAt: new Date('2026-09-14T10:00:00.000Z'),
      completedAt: null,
    });

    await expect(
      service.completeStep('user-1', 'quest-1'),
    ).resolves.toEqual({
      progress: {
        status: 'IN_PROGRESS',
        currentStep: 1,
        startedAt: new Date('2026-09-14T10:00:00.000Z'),
        completedAt: null,
      },
      reward: null,
    });

    expect(prisma.interestSignal.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        signalType: 'QUEST_STEP',
        targetType: 'QUEST',
        targetId: 'quest-1',
      },
    });

    expect(streakService.touch).toHaveBeenCalledWith(
      'user-1',
      'parallel-1',
    );
  });

  it('completes the final step and creates a challenge-complete signal', async () => {
    prisma.quest.findUnique.mockResolvedValue({
      id: 'quest-1',
      parallelTypeId: 'parallel-1',
      steps: [
        { title: 'Step 1', description: 'Do step 1.' },
        { title: 'Step 2', description: 'Do step 2.' },
        { title: 'Step 3', description: 'Do step 3.' },
      ],
      rewardType: 'BADGE',
      rewardValue: 'Builder Badge',
    });

    prisma.userQuestProgress.findUnique.mockResolvedValue({
      status: 'IN_PROGRESS',
      currentStep: 2,
    });

    const completedAt = new Date('2026-09-14T11:00:00.000Z');

    prisma.userQuestReward.upsert.mockResolvedValue({
      rewardType: 'BADGE',
      rewardValue: 'Builder Badge',
    });

    prisma.userQuestProgress.update.mockResolvedValue({
      status: 'COMPLETED',
      currentStep: 3,
      startedAt: new Date('2026-09-14T10:00:00.000Z'),
      completedAt,
    });

    await expect(
      service.completeStep('user-1', 'quest-1'),
    ).resolves.toEqual({
      progress: {
        status: 'COMPLETED',
        currentStep: 3,
        startedAt: new Date('2026-09-14T10:00:00.000Z'),
        completedAt,
      },
      reward: {
        type: 'BADGE',
        value: 'Builder Badge',
      },
    });

    expect(prisma.interestSignal.create).toHaveBeenNthCalledWith(1, {
      data: {
        userId: 'user-1',
        signalType: 'QUEST_STEP',
        targetType: 'QUEST',
        targetId: 'quest-1',
      },
    });

    expect(prisma.interestSignal.create).toHaveBeenNthCalledWith(2, {
      data: {
        userId: 'user-1',
        signalType: 'CHALLENGE_COMPLETE',
        targetType: 'QUEST',
        targetId: 'quest-1',
      },
    });

    expect(streakService.touch).toHaveBeenCalledWith(
      'user-1',
      'parallel-1',
    );
  });

  it('does nothing when completing an already completed quest', async () => {
    prisma.quest.findUnique.mockResolvedValue({
      id: 'quest-1',
      parallelTypeId: 'parallel-1',
      steps: [
        { title: 'Step 1', description: 'Do step 1.' },
      ],
    });

    const completedAt = new Date('2026-09-14T11:00:00.000Z');

    prisma.userQuestProgress.findUnique.mockResolvedValue({
      status: 'COMPLETED',
      currentStep: 1,
      startedAt: new Date('2026-09-14T10:00:00.000Z'),
      completedAt,
    });

    await expect(
      service.completeStep('user-1', 'quest-1'),
    ).resolves.toEqual({
      status: 'COMPLETED',
      currentStep: 1,
      startedAt: new Date('2026-09-14T10:00:00.000Z'),
      completedAt,
    });

    expect(prisma.userQuestProgress.update).not.toHaveBeenCalled();
    expect(prisma.interestSignal.create).not.toHaveBeenCalled();
  });
});
