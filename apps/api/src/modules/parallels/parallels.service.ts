import { Injectable, NotFoundException } from '@nestjs/common';
import { SignalType } from '@prisma/client';
import type {
  ContentItemDto,
  PublicUser,
  ParallelFeedResponse,
  ParallelMapResponse,
  ParallelTypeDto,
} from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';

@Injectable()
export class ParallelsService {
  constructor(
    private readonly identityEngine: IdentityEngineService,
    private readonly prisma: PrismaService,
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
      select: { id: true },
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
  }

  async getPeople(
    userId: string,
    parallelId: string,
  ): Promise<PublicUser[]> {
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
          },
        },
      },
    });

    return users.map(({ user }) => user);
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

    return {
      items: page.map((item) => ({
        id: item.id,
        parallelTypeId: item.parallelTypeId,
        type: item.type,
        payload: item.payload,
        createdAt: item.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
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
