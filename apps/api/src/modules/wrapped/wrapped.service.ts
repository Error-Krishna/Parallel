import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, WrappedPeriod } from '@prisma/client';
import type { WrappedHighlights, WrappedRecapDto } from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const MONTHLY_LOOKBACK_DAYS = 30;
const ANNUAL_LOOKBACK_DAYS = 365;

@Injectable()
export class WrappedService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async generateForUser(
    userId: string,
    period: WrappedPeriod = WrappedPeriod.MONTHLY,
  ): Promise<WrappedRecapDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const periodEnd = new Date();
    const lookbackDays =
      period === WrappedPeriod.ANNUAL
        ? ANNUAL_LOOKBACK_DAYS
        : MONTHLY_LOOKBACK_DAYS;
    const periodStart = new Date(
      periodEnd.getTime() - lookbackDays * 24 * 60 * 60 * 1000,
    );

    // Privacy invariant: only include public, non-ghost, non-hidden, active Parallels.
    const publicParallels = await this.prisma.userParallel.findMany({
      where: {
        userId,
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      },
      orderBy: { strengthPct: 'desc' },
      include: {
        parallelType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const publicTypeIds = publicParallels.map((item) => item.parallelTypeId);
    const parallelNameById = new Map<string, string>(
      publicParallels.map((item) => [item.parallelTypeId, item.parallelType.name]),
    );

    const [snapshots, signals, topTwin] = await Promise.all([
      publicTypeIds.length > 0
        ? this.prisma.parallelEvolutionSnapshot.findMany({
            where: {
              userId,
              parallelTypeId: { in: publicTypeIds },
              capturedAt: { gte: periodStart, lte: periodEnd },
            },
            orderBy: { capturedAt: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.interestSignal.findMany({
        where: {
          userId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        select: {
          targetType: true,
          targetId: true,
        },
      }),
      this.prisma.twin.findFirst({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        orderBy: { similarityScore: 'desc' },
        select: { id: true },
      }),
    ]);

    const biggestEvolution = this.computeBiggestEvolution(snapshots);
    const mostExplored = await this.computeMostExplored(
      signals,
      new Set(publicTypeIds),
    );
    const weirdestIntersection = this.computeIntersection(
      publicParallels.map((item) => ({
        id: item.parallelTypeId,
        name: item.parallelType.name,
      })),
    );
    const streakHighlight = this.computeStreakHighlight(publicParallels);

    const narrativeCopy = this.buildNarrative({
      period,
      biggestEvolution,
      mostExplored,
      weirdestIntersection,
      streakHighlight,
      parallelNameById,
    });

    const highlights: WrappedHighlights = {
      biggestEvolution,
      mostExplored,
      weirdestIntersection,
      streakHighlight,
      twinId: topTwin?.id ?? null,
      narrativeCopy,
    };

    const created = await this.prisma.parallelWrapped.create({
      data: {
        userId,
        period,
        periodStart,
        periodEnd,
        highlights: highlights as unknown as Prisma.InputJsonValue,
      },
    });

    if (this.notifications) {
      await this.notifications.create(userId, 'WRAPPED_READY', {
        wrappedId: created.id,
        period: created.period,
      });
    }

    return {
      id: created.id,
      period: created.period,
      periodStart: created.periodStart.toISOString(),
      periodEnd: created.periodEnd.toISOString(),
      highlights,
      createdAt: created.createdAt.toISOString(),
      username: user.username,
      parallelNames: Object.fromEntries(parallelNameById),
    };
  }

  async getLatest(userId: string): Promise<WrappedRecapDto | null> {
    const latest = await this.prisma.parallelWrapped.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true } },
      },
    });

    if (!latest) {
      return null;
    }

    return this.formatRecap(latest);
  }

  async getPublicById(id: string): Promise<WrappedRecapDto> {
    const recap = await this.prisma.parallelWrapped.findUnique({
      where: { id },
      include: {
        user: { select: { username: true } },
      },
    });

    if (!recap) {
      throw new NotFoundException('Parallel Wrapped recap not found');
    }

    return this.formatRecap(recap);
  }

  private computeBiggestEvolution(
    snapshots: Array<{
      parallelTypeId: string;
      strengthPct: number;
    }>,
  ): WrappedHighlights['biggestEvolution'] {
    const boundsByType = new Map<string, { first: number; last: number }>();

    for (const snap of snapshots) {
      const existing = boundsByType.get(snap.parallelTypeId);
      if (!existing) {
        boundsByType.set(snap.parallelTypeId, {
          first: snap.strengthPct,
          last: snap.strengthPct,
        });
      } else {
        existing.last = snap.strengthPct;
      }
    }

    let best: { parallelTypeId: string; deltaPct: number } | null = null;
    for (const [parallelTypeId, bounds] of boundsByType.entries()) {
      const deltaPct = Number((bounds.last - bounds.first).toFixed(1));
      if (
        deltaPct !== 0 &&
        (!best || Math.abs(deltaPct) > Math.abs(best.deltaPct))
      ) {
        best = { parallelTypeId, deltaPct };
      }
    }

    return best;
  }

  private async computeMostExplored(
    signals: Array<{ targetType: string; targetId: string }>,
    publicTypeIds: Set<string>,
  ): Promise<WrappedHighlights['mostExplored']> {
    if (signals.length === 0 || publicTypeIds.size === 0) {
      return null;
    }

    const counts = new Map<string, number>();
    const contentIds: string[] = [];
    const questIds: string[] = [];

    for (const signal of signals) {
      const normalizedType = signal.targetType.toUpperCase();
      if (normalizedType === 'PARALLEL' && publicTypeIds.has(signal.targetId)) {
        counts.set(signal.targetId, (counts.get(signal.targetId) ?? 0) + 1);
      } else if (normalizedType === 'CONTENT') {
        contentIds.push(signal.targetId);
      } else if (normalizedType === 'QUEST') {
        questIds.push(signal.targetId);
      }
    }

    const [contentRows, questRows] = await Promise.all([
      contentIds.length > 0
        ? this.prisma.contentItem.findMany({
            where: { id: { in: [...new Set(contentIds)] } },
            select: { id: true, parallelTypeId: true },
          })
        : Promise.resolve([]),
      questIds.length > 0
        ? this.prisma.quest.findMany({
            where: { id: { in: [...new Set(questIds)] } },
            select: { id: true, parallelTypeId: true },
          })
        : Promise.resolve([]),
    ]);

    const contentToParallel = new Map(
      contentRows.map((row) => [row.id, row.parallelTypeId]),
    );
    const questToParallel = new Map(
      questRows.map((row) => [row.id, row.parallelTypeId]),
    );

    for (const id of contentIds) {
      const ptId = contentToParallel.get(id);
      if (ptId && publicTypeIds.has(ptId)) {
        counts.set(ptId, (counts.get(ptId) ?? 0) + 1);
      }
    }

    for (const id of questIds) {
      const ptId = questToParallel.get(id);
      if (ptId && publicTypeIds.has(ptId)) {
        counts.set(ptId, (counts.get(ptId) ?? 0) + 1);
      }
    }

    let top: { parallelTypeId: string; interactionCount: number } | null = null;
    for (const [parallelTypeId, interactionCount] of counts.entries()) {
      if (!top || interactionCount > top.interactionCount) {
        top = { parallelTypeId, interactionCount };
      }
    }

    return top;
  }

  private computeIntersection(
    parallels: Array<{ id: string; name: string }>,
  ): WrappedHighlights['weirdestIntersection'] {
    if (parallels.length < 2) {
      return null;
    }

    const first = parallels[0]!;
    const second = parallels[1]!;

    return {
      parallelTypeIds: [first.id, second.id],
      note: `${first.name} × ${second.name} — an unexpected mix that makes your map unmistakably yours.`,
    };
  }

  private computeStreakHighlight(
    parallels: Array<{ parallelTypeId: string; streakCount: number }>,
  ): WrappedHighlights['streakHighlight'] {
    let best: { parallelTypeId: string; streakCount: number } | null = null;

    for (const item of parallels) {
      if (item.streakCount > 0 && (!best || item.streakCount > best.streakCount)) {
        best = {
          parallelTypeId: item.parallelTypeId,
          streakCount: item.streakCount,
        };
      }
    }

    return best;
  }

  private buildNarrative(input: {
    period: WrappedPeriod;
    biggestEvolution: WrappedHighlights['biggestEvolution'];
    mostExplored: WrappedHighlights['mostExplored'];
    weirdestIntersection: WrappedHighlights['weirdestIntersection'];
    streakHighlight: WrappedHighlights['streakHighlight'];
    parallelNameById: Map<string, string>;
  }): string {
    const periodLabel = input.period === WrappedPeriod.ANNUAL ? 'year' : 'month';
    const parts: string[] = [];

    if (input.mostExplored) {
      const name =
        input.parallelNameById.get(input.mostExplored.parallelTypeId) ??
        'your favorite Parallel';
      parts.push(
        `You spent the most energy wandering through ${name} (${input.mostExplored.interactionCount} moments).`,
      );
    }

    if (input.biggestEvolution) {
      const name =
        input.parallelNameById.get(input.biggestEvolution.parallelTypeId) ??
        'one of your Parallels';
      const direction = input.biggestEvolution.deltaPct > 0 ? 'grew' : 'shifted';
      const magnitude = Math.abs(input.biggestEvolution.deltaPct);
      parts.push(`${name} ${direction} by ${magnitude}% over the ${periodLabel}.`);
    }

    if (input.streakHighlight) {
      const name =
        input.parallelNameById.get(input.streakHighlight.parallelTypeId) ??
        'a Parallel';
      parts.push(
        `Your longest rhythm was a ${input.streakHighlight.streakCount}-day streak in ${name}.`,
      );
    }

    if (parts.length === 0) {
      if (input.weirdestIntersection) {
        return `A quieter ${periodLabel} on your map — ${input.weirdestIntersection.note} Whenever curiosity sparks next, your Parallels are ready.`;
      }

      return `A quieter ${periodLabel} on the map — your Parallels are still here whenever curiosity sparks next.`;
    }

    return parts.join(' ');
  }

  private async formatRecap(row: {
    id: string;
    period: WrappedPeriod;
    periodStart: Date;
    periodEnd: Date;
    highlights: Prisma.JsonValue;
    createdAt: Date;
    user: { username: string };
  }): Promise<WrappedRecapDto> {
    const highlights = row.highlights as unknown as WrappedHighlights;

    const referencedIds = new Set<string>();
    if (highlights.biggestEvolution?.parallelTypeId) {
      referencedIds.add(highlights.biggestEvolution.parallelTypeId);
    }
    if (highlights.mostExplored?.parallelTypeId) {
      referencedIds.add(highlights.mostExplored.parallelTypeId);
    }
    if (highlights.streakHighlight?.parallelTypeId) {
      referencedIds.add(highlights.streakHighlight.parallelTypeId);
    }
    for (const id of highlights.weirdestIntersection?.parallelTypeIds ?? []) {
      referencedIds.add(id);
    }

    const parallelTypes =
      referencedIds.size > 0
        ? await this.prisma.parallelType.findMany({
            where: { id: { in: [...referencedIds] } },
            select: { id: true, name: true },
          })
        : [];

    const parallelNames = Object.fromEntries(
      parallelTypes.map((pt) => [pt.id, pt.name]),
    );

    return {
      id: row.id,
      period: row.period,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      highlights,
      createdAt: row.createdAt.toISOString(),
      username: row.user.username,
      parallelNames,
    };
  }
}
