import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IdentityCardType } from '@prisma/client';
import type {
  CreateIdentityCardResponse,
  IdentityCardDto,
  IdentityCardMetadataDto,
  WrappedHighlights,
} from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateIdentityCardBodyDto } from './dto/create-identity-card.dto.js';
import { renderIdentityCardSvg } from './card-svg.renderer.js';

const ACCENT_BY_TYPE: Record<IdentityCardType, string> = {
  PARALLEL: '#7C5CFF',
  QUEST: '#F59E0B',
  WRAPPED: '#EC4899',
  TWIN: '#06B6D4',
  COLLAB: '#10B981',
};

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCard(
    userId: string,
    dto: CreateIdentityCardBodyDto,
  ): Promise<CreateIdentityCardResponse> {
    const resolvedSource = await this.validateAndResolveSource(
      userId,
      dto.cardType,
      dto.sourceId,
    );

    const cardId = randomUUID();
    const imageUrl = `/v1/cards/${cardId}/image`;

    const created = await this.prisma.identityCard.create({
      data: {
        id: cardId,
        userId,
        cardType: dto.cardType,
        sourceType: resolvedSource.sourceType,
        sourceId: resolvedSource.sourceId,
        imageUrl,
      },
    });

    const card: IdentityCardDto = {
      id: created.id,
      cardType: created.cardType,
      sourceType: created.sourceType,
      sourceId: created.sourceId,
      imageUrl: created.imageUrl,
      createdAt: created.createdAt.toISOString(),
      metadata: resolvedSource.metadata,
    };

    return {
      id: created.id,
      jobId: created.id,
      card,
    };
  }

  async listMine(userId: string): Promise<IdentityCardDto[]> {
    const cards = await this.prisma.identityCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { username: true } },
      },
    });

    return Promise.all(
      cards.map(async (card) => ({
        id: card.id,
        cardType: card.cardType,
        sourceType: card.sourceType,
        sourceId: card.sourceId,
        imageUrl: card.imageUrl,
        createdAt: card.createdAt.toISOString(),
        metadata: await this.buildPublicMetadata(
          card.userId,
          card.user.username,
          card.cardType,
          card.sourceId,
        ),
      })),
    );
  }

  async getPublicCard(cardId: string): Promise<IdentityCardDto> {
    const card = await this.prisma.identityCard.findUnique({
      where: { id: cardId },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException('Identity Card not found');
    }

    const metadata = await this.buildPublicMetadata(
      card.userId,
      card.user.username,
      card.cardType,
      card.sourceId,
    );

    return {
      id: card.id,
      cardType: card.cardType,
      sourceType: card.sourceType,
      sourceId: card.sourceId,
      imageUrl: card.imageUrl,
      createdAt: card.createdAt.toISOString(),
      metadata,
    };
  }

  async getCardSvg(cardId: string): Promise<string> {
    const card = await this.getPublicCard(cardId);
    const metadata: IdentityCardMetadataDto = card.metadata ?? {
      username: 'parallel',
      title: 'Parallel Identity Card',
      subtitle: 'Discover every side of you.',
      eyebrow: card.cardType,
      accentHex: ACCENT_BY_TYPE[card.cardType],
      stats: [],
    };

    return renderIdentityCardSvg({
      cardId: card.id,
      cardType: card.cardType,
      metadata,
    });
  }

  private async validateAndResolveSource(
    userId: string,
    cardType: IdentityCardType,
    sourceId: string,
  ): Promise<{
    sourceType: string;
    sourceId: string;
    metadata: IdentityCardMetadataDto;
  }> {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (!owner) {
      throw new NotFoundException('User not found');
    }

    switch (cardType) {
      case IdentityCardType.PARALLEL: {
        const userParallel = await this.prisma.userParallel.findFirst({
          where: {
            userId,
            dismissedAt: null,
            OR: [{ id: sourceId }, { parallelTypeId: sourceId }],
          },
          include: {
            parallelType: {
              select: { name: true, description: true },
            },
          },
        });

        if (!userParallel) {
          throw new NotFoundException('Parallel not found');
        }

        // Enforce Ghost Mode & privacy invariant: never generate a public card
        // from a private Ghost or hidden Parallel.
        if (userParallel.isGhost || userParallel.isHidden) {
          throw new BadRequestException(
            'Make this Parallel public before creating a shareable Identity Card',
          );
        }

        return {
          sourceType: 'USER_PARALLEL',
          sourceId: userParallel.id,
          metadata: {
            username: owner.username,
            eyebrow: 'PARALLEL IDENTITY',
            title: userParallel.parallelType.name,
            subtitle: userParallel.parallelType.description,
            accentHex: ACCENT_BY_TYPE.PARALLEL,
            stats: [
              {
                label: 'Strength',
                value: `${Math.round(userParallel.strengthPct)}%`,
              },
              {
                label: 'Streak',
                value: `${userParallel.streakCount}d`,
              },
              {
                label: 'Visibility',
                value: 'Public',
              },
            ],
          },
        };
      }

      case IdentityCardType.QUEST: {
        const progress = await this.prisma.userQuestProgress.findUnique({
          where: {
            userId_questId: {
              userId,
              questId: sourceId,
            },
          },
          include: {
            quest: {
              include: {
                parallelType: { select: { name: true } },
              },
            },
          },
        });

        if (!progress || progress.status !== 'COMPLETED') {
          throw new NotFoundException('Completed Quest not found');
        }

        return {
          sourceType: 'QUEST',
          sourceId: progress.questId,
          metadata: {
            username: owner.username,
            eyebrow: 'QUEST COMPLETED',
            title: progress.quest.title,
            subtitle: progress.quest.description,
            accentHex: ACCENT_BY_TYPE.QUEST,
            stats: [
              { label: 'Parallel', value: progress.quest.parallelType.name },
              { label: 'Reward', value: progress.quest.rewardValue },
            ],
          },
        };
      }

      case IdentityCardType.WRAPPED: {
        const wrapped = await this.prisma.parallelWrapped.findFirst({
          where: { id: sourceId, userId },
        });

        if (!wrapped) {
          throw new NotFoundException('Wrapped recap not found');
        }

        const highlights = wrapped.highlights as unknown as WrappedHighlights;

        return {
          sourceType: 'WRAPPED',
          sourceId: wrapped.id,
          metadata: {
            username: owner.username,
            eyebrow: `${wrapped.period} WRAPPED`,
            title: 'Parallel Wrapped',
            subtitle:
              highlights?.narrativeCopy ||
              'A snapshot of how your Parallels evolved.',
            accentHex: ACCENT_BY_TYPE.WRAPPED,
            stats: [
              { label: 'Period', value: wrapped.period },
              ...(highlights?.streakHighlight
                ? [
                    {
                      label: 'Top Streak',
                      value: `${highlights.streakHighlight.streakCount}d`,
                    },
                  ]
                : []),
            ],
          },
        };
      }

      case IdentityCardType.TWIN: {
        const twin = await this.prisma.twin.findFirst({
          where: {
            id: sourceId,
            OR: [{ userAId: userId }, { userBId: userId }],
          },
          include: {
            userA: { select: { username: true } },
            userB: { select: { username: true } },
          },
        });

        if (!twin) {
          throw new NotFoundException('Parallel Twin match not found');
        }

        const otherUsername =
          twin.userAId === userId ? twin.userB.username : twin.userA.username;
        const sharedIds = Array.isArray(twin.sharedParallelTypeIds)
          ? twin.sharedParallelTypeIds
          : [];

        return {
          sourceType: 'TWIN',
          sourceId: twin.id,
          metadata: {
            username: owner.username,
            eyebrow: 'PARALLEL TWIN',
            title: `@${owner.username} × @${otherUsername}`,
            subtitle: 'Two people exploring a rare overlap of Parallels.',
            accentHex: ACCENT_BY_TYPE.TWIN,
            stats: [
              {
                label: 'Overlap',
                value: `${Math.round(twin.similarityScore)}%`,
              },
              {
                label: 'Shared',
                value: `${sharedIds.length} Parallels`,
              },
            ],
          },
        };
      }

      case IdentityCardType.COLLAB: {
        const collab = await this.prisma.collabSession.findFirst({
          where: {
            id: sourceId,
            OR: [{ userAId: userId }, { userBId: userId }],
          },
          include: {
            userA: { select: { username: true } },
            userB: { select: { username: true } },
            parallelTypeA: { select: { name: true } },
            parallelTypeB: { select: { name: true } },
          },
        });

        if (!collab) {
          throw new NotFoundException('Collab session not found');
        }

        const pairTitle =
          collab.challengeTitle ||
          `${collab.parallelTypeA.name} × ${collab.parallelTypeB?.name ?? 'Parallel'}`;

        return {
          sourceType: 'COLLAB',
          sourceId: collab.id,
          metadata: {
            username: `${collab.userA.username} × @${collab.userB.username}`,
            eyebrow: 'COLLAB PARALLEL',
            title: pairTitle,
            subtitle:
              collab.challengeDescription ||
              'A creative intersection forged between two Parallels.',
            accentHex: ACCENT_BY_TYPE.COLLAB,
            stats: [
              { label: 'Status', value: collab.status },
              { label: 'Side A', value: collab.parallelTypeA.name },
              ...(collab.parallelTypeB
                ? [{ label: 'Side B', value: collab.parallelTypeB.name }]
                : []),
            ],
          },
        };
      }
    }
  }

  private async buildPublicMetadata(
    userId: string,
    username: string,
    cardType: IdentityCardType,
    sourceId: string | null,
  ): Promise<IdentityCardMetadataDto> {
    if (sourceId) {
      try {
        const resolved = await this.validateAndResolveSource(
          userId,
          cardType,
          sourceId,
        );
        return resolved.metadata;
      } catch {
        // Source may have been hidden, dismissed, or deleted after the card was
        // created — fall back to a safe public summary without leaking hidden data.
      }
    }

    return {
      username,
      eyebrow: `${cardType} CARD`,
      title: 'Parallel Identity Card',
      subtitle: 'A moment captured from a Parallel journey.',
      accentHex: ACCENT_BY_TYPE[cardType],
      stats: [],
    };
  }
}
