import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { StreakService } from './streak.service.js';

@Injectable()
export class QuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streakService: StreakService,
  ) {}

  async getQuests(userId: string, parallelId: string) {
    const parallel = await this.prisma.parallelType.findUnique({
      where: { id: parallelId },
      select: { id: true },
    });

    if (!parallel) {
      throw new NotFoundException('Parallel not found');
    }

    const quests = await this.prisma.quest.findMany({
      where: {
        parallelTypeId: parallelId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        progress: {
          where: {
            userId,
          },
          select: {
            status: true,
            currentStep: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    });

    return quests.map((quest) => ({
      id: quest.id,
      parallelTypeId: quest.parallelTypeId,
      title: quest.title,
      description: quest.description,
      steps: quest.steps,
      rewardType: quest.rewardType,
      rewardValue: quest.rewardValue,
      season: quest.season,
      progress: quest.progress[0] ?? {
        status: 'NOT_STARTED',
        currentStep: 0,
        startedAt: null,
        completedAt: null,
      },
    }));
  }
  async completeStep(userId: string, questId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
      select: {
        id: true,
        parallelTypeId: true,
        steps: true,
        rewardType: true,
        rewardValue: true,
      },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    const progress = await this.prisma.userQuestProgress.findUnique({
      where: {
        userId_questId: {
          userId,
          questId,
        },
      },
    });

    if (!progress) {
      throw new NotFoundException('Quest has not been started');
    }

    if (progress.status === 'COMPLETED') {
      return progress;
    }

    const steps = Array.isArray(quest.steps) ? quest.steps : [];
    const nextStep = progress.currentStep + 1;
    const completed = nextStep >= steps.length;

    const updatedProgress = await this.prisma.userQuestProgress.update({
      where: {
        userId_questId: {
          userId,
          questId,
        },
      },
      data: {
        currentStep: nextStep,
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: completed ? new Date() : null,
      },
      select: {
        status: true,
        currentStep: true,
        startedAt: true,
        completedAt: true,
      },
    });

    await this.prisma.interestSignal.create({
      data: {
        userId,
        signalType: 'QUEST_STEP',
        targetType: 'QUEST',
        targetId: questId,
      },
    });

    await this.streakService.touch(userId, quest.parallelTypeId);

    let reward: {
      type: typeof quest.rewardType;
      value: string;
    } | null = null;

    if (completed) {
      await this.prisma.interestSignal.create({
        data: {
          userId,
          signalType: 'CHALLENGE_COMPLETE',
          targetType: 'QUEST',
          targetId: questId,
        },
      });

      const grantedReward = await this.prisma.userQuestReward.upsert({
        where: {
          userId_questId: {
            userId,
            questId,
          },
        },
        update: {},
        create: {
          userId,
          questId,
          rewardType: quest.rewardType,
          rewardValue: quest.rewardValue,
        },
        select: {
          rewardType: true,
          rewardValue: true,
        },
      });

      reward = {
        type: grantedReward.rewardType,
        value: grantedReward.rewardValue,
      };
    }

    return {
      progress: updatedProgress,
      reward,
    };
  }

  async startQuest(userId: string, questId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
      select: { id: true },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    return this.prisma.userQuestProgress.upsert({
      where: {
        userId_questId: {
          userId,
          questId,
        },
      },
      update: {},
      create: {
        userId,
        questId,
        status: 'IN_PROGRESS',
        currentStep: 0,
        startedAt: new Date(),
      },
      select: {
        status: true,
        currentStep: true,
        startedAt: true,
        completedAt: true,
      },
    });
  }


}
