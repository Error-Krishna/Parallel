import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class QuestsService {
  constructor(private readonly prisma: PrismaService) {}

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
