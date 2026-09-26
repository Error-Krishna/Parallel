import { Injectable, NotFoundException } from '@nestjs/common';
import { SignalType } from '@prisma/client';
import type {
  ContentItemDto,
  PublicUser,
  PeopleDiscoveryDto,
  ParallelFeedResponse,
  ParallelMapResponse,
  ParallelTypeDto,
} from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';
import { StreakService } from '../quests/streak.service.js';

@Injectable()
export class ParallelsService {
  constructor(
    private readonly identityEngine: IdentityEngineService,
    private readonly prisma: PrismaService,
    private readonly streakService: StreakService,
  ) {}

  getMap(userId: string): Promise<ParallelMapResponse> {
    return this.identityEngine.getMap(userId);
  }

  async getParallel(parallelId: string): Promise<ParallelTypeDto> {
    const parallel = await this.prisma.parallelType.findUnique({
      where: { id: parallelId },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
      },
    });

    if (!parallel) {
      throw new NotFoundException('Parallel not found');
    }

    return parallel;
  }

  async createContentInteraction(
    userId: string,
    contentId: string,
    signalType: SignalType,
  ): Promise<void> {
    const content = await this.prisma.contentItem.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        parallelTypeId: true,
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    await this.prisma.interestSignal.create({
      data: {
        userId,
        signalType,
        targetType: 'content',
        targetId: content.id,
        weight: 1.0,
      },
    });

    await this.streakService.touch(userId, content.parallelTypeId);
  }

  async hideParallel(
    userId: string,
    parallelId: string,
  ): Promise<void> {
    const parallel = await this.prisma.userParallel.findFirst({
      where: {
        id: parallelId,
        userId,
        isHidden: false,
        dismissedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!parallel) {
      throw new NotFoundException('Parallel not found');
    }

    await this.prisma.userParallel.update({
      where: {
        id: parallel.id,
      },
      data: {
        isHidden: true,
      },
    });
  }

  async getPeople(
    userId: string,
    parallelId: string,
  ): Promise<PeopleDiscoveryDto[]> {
    const parallel = await this.prisma.parallelType.findUnique({
      where: { id: parallelId },
      select: { id: true },
    });

    if (!parallel) {
      throw new NotFoundException('Parallel not found');
    }

    const users = await this.prisma.userParallel.findMany({
      where: {
        parallelTypeId: parallelId,
        userId: { not: userId },
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      },
      orderBy: [
        { strengthPct: 'desc' },
        { discoveredAt: 'desc' },
      ],
      take: 20,
      select: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
            parallels: {
              where: {
                parallelTypeId: { not: parallelId },
                isGhost: false,
                isHidden: false,
                dismissedAt: null,
              },
              orderBy: {
                strengthPct: 'desc',
              },
              take: 4,
              select: {
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

    return users.map(({ user }) => ({
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
      parallels: user.parallels.map(
        ({ parallelType }) => parallelType,
      ),
    }));
  }

  async getContent(contentId: string): Promise<ContentItemDto> {
    const content = await this.prisma.contentItem.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        parallelTypeId: true,
        type: true,
        payload: true,
        createdAt: true,
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    return {
      id: content.id,
      parallelTypeId: content.parallelTypeId,
      type: content.type,
      payload: content.payload,
      createdAt: content.createdAt.toISOString(),
    };
  }

  async getFeed(
    userId: string,
    parallelId: string,
    cursor?: string,
    limit = 10,
  ): Promise<ParallelFeedResponse> {
    const parallel = await this.prisma.parallelType.findUnique({
      where: { id: parallelId },
      select: { id: true },
    });

    if (!parallel) {
      throw new NotFoundException('Parallel not found');
    }

    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const items = await this.prisma.contentItem.findMany({
      where: {
        parallelTypeId: parallelId,
      },
      orderBy: {
        id: 'desc',
      },
      take: safeLimit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        parallelTypeId: true,
        type: true,
        payload: true,
        createdAt: true,
      },
    });

    const hasMore = items.length > safeLimit;
    const page = hasMore ? items.slice(0, safeLimit) : items;

    const likedSignals = await this.prisma.interestSignal.findMany({
      where: {
        userId,
        signalType: SignalType.LIKE,
        targetType: 'content',
        targetId: {
          in: page.map((item) => item.id),
        },
      },
      select: {
        targetId: true,
      },
    });

    const likedIds = new Set(likedSignals.map((signal) => signal.targetId));

    const savedSignals = await this.prisma.interestSignal.findMany({
      where: {
        userId,
        signalType: SignalType.SAVE,
        targetType: 'content',
        targetId: {
          in: page.map((item) => item.id),
        },
      },
      select: {
        targetId: true,
      },
    });

    const savedIds = new Set(savedSignals.map((signal) => signal.targetId));

    return {
      items: page.map((item) => ({
        id: item.id,
        parallelTypeId: item.parallelTypeId,
        type: item.type,
        payload: item.payload,
        createdAt: item.createdAt.toISOString(),
        liked: likedIds.has(item.id),
        saved: savedIds.has(item.id),
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  }

  async removeContentInteraction(
    userId: string,
    contentId: string,
    signalType: SignalType,
  ): Promise<void> {
    await this.prisma.interestSignal.deleteMany({
      where: {
        userId,
        signalType,
        targetType: 'content',
        targetId: contentId,
      },
    });
  }

  async enterParallel(
    userId: string,
    parallelId: string,
  ): Promise<ParallelTypeDto> {
    const parallel = await this.prisma.parallelType.findUnique({
      where: { id: parallelId },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
      },
    });

    if (!parallel) {
      throw new NotFoundException('Parallel not found');
    }

    await this.prisma.interestSignal.create({
      data: {
        userId,
        signalType: 'PARALLEL_ENTER',
        targetType: 'parallel_type',
        targetId: parallel.id,
        weight: 1.0,
      },
    });

    return parallel;
  }
}
