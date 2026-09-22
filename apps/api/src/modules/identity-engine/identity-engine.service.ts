import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { ParallelMapResponse } from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { UsersService } from '../users/users.service.js';

interface OnboardingAnswer {
  questionKey: string;
  answerValue: string;
}

interface ScoreMap {
  builder: number;
  musicHead: number;
  gamer: number;
  explorer: number;
}

const PARALLEL_TYPES = [
  {
    key: 'builder',
    name: 'Builder',
    description: 'You like turning ideas into something real.',
    icon: 'plus',
  },
  {
    key: 'musicHead',
    name: 'Music Head',
    description: 'Music and creative energy pull you in.',
    icon: 'music',
  },
  {
    key: 'gamer',
    name: 'Gamer',
    description: 'You enjoy systems, challenges and figuring things out.',
    icon: 'gamepad',
  },
  {
    key: 'explorer',
    name: 'Explorer',
    description: 'You are drawn toward new places, ideas and experiences.',
    icon: 'compass',
  },
] as const;

@Injectable()
export class IdentityEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @InjectQueue('embedding') private readonly embeddingQueue: Queue,
  ) {}

  async generateInitialMap(userId: string): Promise<ParallelMapResponse> {
    const existingParallels = await this.prisma.userParallel.findFirst({ where: { userId } });

    // Idempotency guard: this should only ever run the actual scoring pass once,
    // right after onboarding finishes. Without this check, any repeat call (a
    // second reveal-page visit via the back button, a retried request, or any
    // future call site) would silently overwrite strengthPct/momentum/
    // suggestionReason back to their initial onboarding-derived values — wiping
    // out anything real usage changes later. Callers that just need the current
    // map, not a fresh generation, should call getMap() directly instead.
    if (existingParallels) {
      const existingSnapshot = await this.prisma.parallelEvolutionSnapshot.findFirst({
        where: { userId },
        select: { id: true },
      });

      if (!existingSnapshot) {
        await this.captureEvolutionSnapshot(userId);
      }

      return this.getMap(userId);
    }

    const answers = await this.prisma.onboardingResponse.findMany({
      where: { userId },
      select: {
        questionKey: true,
        answerValue: true,
      },
    });

    if (answers.length < 4) {
      throw new BadRequestException(
        'Complete onboarding before generating your Parallel map',
      );
    }

    const scores = this.calculateScores(answers);

    const total = Object.values(scores).reduce(
      (sum, value) => sum + value,
      0,
    );

    const types = await Promise.all(
      PARALLEL_TYPES.map((type) =>
        this.prisma.parallelType.upsert({
          where: { name: type.name },
          update: {
            description: type.description,
            icon: type.icon,
          },
          create: {
            name: type.name,
            description: type.description,
            icon: type.icon,
            isSystemGenerated: true,
          },
        }),
      ),
    );

    await Promise.all(
      types.map((type) => {
        const key = PARALLEL_TYPES.find(
          (item) => item.name === type.name,
        )!.key;

        const strengthPct = Number(
          ((scores[key] / total) * 100).toFixed(1),
        );

        return this.prisma.userParallel.upsert({
          where: {
            userId_parallelTypeId: {
              userId,
              parallelTypeId: type.id,
            },
          },
          update: {
            strengthPct,
            momentum: 0,
            suggestionReason:
              'Based on your onboarding choices.',
          },
          create: {
            userId,
            parallelTypeId: type.id,
            strengthPct,
            momentum: 0,
            isGhost: true,
            isHidden: false,
            suggestionReason:
              'Based on your onboarding choices.',
          },
        });
      }),
    );

    await this.captureEvolutionSnapshot(userId);

    return this.getMap(userId);
  }

  // No optional pre-fetched `user` parameter, deliberately — accepting one here
  // once let a raw Prisma `User` (passwordHash, email, everything) get passed
  // straight into a client-facing response instead of a sanitized PublicUser (a
  // real bug this class was shipped with, found and fixed when it briefly
  // leaked in generateInitialMap's response). Always fetching and sanitizing
  // internally makes that class of bug structurally impossible here again.
  async getMap(userId: string): Promise<ParallelMapResponse> {
    const user = this.usersService.toPublicUser(await this.usersService.findById(userId));

    const parallels = await this.prisma.userParallel.findMany({
      where: {
        userId,
        isHidden: false,
        dismissedAt: null,
      },
      include: {
        parallelType: true,
      },
      orderBy: {
        strengthPct: 'desc',
      },
    });

    return {
      user,
      parallels: parallels.map((parallel) => ({
        id: parallel.id,
        parallelType: {
          id: parallel.parallelType.id,
          name: parallel.parallelType.name,
          description: parallel.parallelType.description,
          icon: parallel.parallelType.icon,
        },
        strengthPct: parallel.strengthPct,
        momentum: parallel.momentum,
        streakCount: parallel.streakCount,
        isGhost: parallel.isGhost,
        isHidden: parallel.isHidden,
        dismissedAt: parallel.dismissedAt?.toISOString() ?? null,
        suggestionReason: parallel.suggestionReason,
        discoveredAt: parallel.discoveredAt.toISOString(),
      })),
    };
  }

  async getEvolution(userId: string) {
    const snapshots = await this.prisma.parallelEvolutionSnapshot.findMany({
      where: { userId },
      orderBy: {
        capturedAt: 'desc',
      },
      select: {
        parallelTypeId: true,
        strengthPct: true,
        capturedAt: true,
      },
    });

    const grouped = new Map<
      string,
      Array<{ strengthPct: number; capturedAt: Date }>
    >();

    for (const snapshot of snapshots) {
      const existing = grouped.get(snapshot.parallelTypeId) ?? [];
      existing.push({
        strengthPct: snapshot.strengthPct,
        capturedAt: snapshot.capturedAt,
      });
      grouped.set(snapshot.parallelTypeId, existing);
    }

    return Array.from(grouped.entries()).map(
      ([parallelTypeId, parallelSnapshots]) => {
        const current = parallelSnapshots[0];
        const previous = parallelSnapshots[1];

        return {
          parallelTypeId,
          currentStrengthPct: current.strengthPct,
          previousStrengthPct: previous?.strengthPct ?? null,
          deltaPct:
            previous === undefined
              ? null
              : Number(
                  (current.strengthPct - previous.strengthPct).toFixed(1),
                ),
          history: parallelSnapshots
            .slice()
            .reverse()
            .map((snapshot) => ({
              strengthPct: snapshot.strengthPct,
              capturedAt: snapshot.capturedAt.toISOString(),
            })),
        };
      },
    );
  }

  async captureEvolutionSnapshot(userId: string): Promise<void> {
    const parallels = await this.prisma.userParallel.findMany({
      where: {
        userId,
        isHidden: false,
        dismissedAt: null,
      },
      select: {
        parallelTypeId: true,
        strengthPct: true,
      },
    });

    if (parallels.length === 0) {
      return;
    }

    const latestSnapshots = await this.prisma.parallelEvolutionSnapshot.findMany({
      where: { userId },
      orderBy: {
        capturedAt: 'desc',
      },
      distinct: ['parallelTypeId'],
      select: {
        parallelTypeId: true,
        strengthPct: true,
      },
    });

    const latestByParallel = new Map(
      latestSnapshots.map((snapshot) => [
        snapshot.parallelTypeId,
        snapshot.strengthPct,
      ]),
    );

    const hasChanged =
      latestSnapshots.length !== parallels.length ||
      parallels.some(
        (parallel) =>
          latestByParallel.get(parallel.parallelTypeId) !==
          parallel.strengthPct,
      );

    if (!hasChanged) {
      return;
    }

    await this.prisma.parallelEvolutionSnapshot.createMany({
      data: parallels.map((parallel) => ({
        userId,
        parallelTypeId: parallel.parallelTypeId,
        strengthPct: parallel.strengthPct,
      })),
    });
  }

  async recalculateScores(userId: string): Promise<void> {
    const answers = await this.prisma.onboardingResponse.findMany({
      where: { userId },
      select: {
        questionKey: true,
        answerValue: true,
      },
    });

    const onboardingScores = this.calculateScores(answers);

    const signals = await this.prisma.interestSignal.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        signalType: true,
        targetType: true,
        targetId: true,
        weight: true,
      },
    });

    const contentSignals = signals.filter(
      (signal) => signal.targetType === 'content',
    );

    const questSignals = signals.filter(
      (signal) => signal.targetType === 'QUEST',
    );

    const [contents, quests, parallels] = await Promise.all([
      contentSignals.length > 0
        ? this.prisma.contentItem.findMany({
            where: {
              id: {
                in: contentSignals.map((signal) => signal.targetId),
              },
            },
            select: {
              id: true,
              parallelTypeId: true,
            },
          })
        : [],
      questSignals.length > 0
        ? this.prisma.quest.findMany({
            where: {
              id: {
                in: questSignals.map((signal) => signal.targetId),
              },
            },
            select: {
              id: true,
              parallelTypeId: true,
            },
          })
        : [],
      this.prisma.userParallel.findMany({
        where: {
          userId,
          isHidden: false,
          dismissedAt: null,
        },
        select: {
          parallelTypeId: true,
          parallelType: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    const contentMap = new Map(
      contents.map((content) => [content.id, content.parallelTypeId]),
    );

    const questMap = new Map(
      quests.map((quest) => [quest.id, quest.parallelTypeId]),
    );

    const keyByName: Record<string, keyof ScoreMap> = {
      Builder: 'builder',
      'Music Head': 'musicHead',
      Gamer: 'gamer',
      Explorer: 'explorer',
    };

    const parallelIdToKey = new Map(
      parallels
        .map((parallel) => [
          parallel.parallelTypeId,
          keyByName[parallel.parallelType.name],
        ])
        .filter(
          (entry): entry is [string, keyof ScoreMap] =>
            Boolean(entry[1]),
        ),
    );

    const signalWeights: Record<string, number> = {
      VIEW: 1,
      LIKE: 3,
      SAVE: 4,
      SEARCH: 2,
      PARALLEL_ENTER: 2,
      QUEST_STEP: 3,
      CHALLENGE_COMPLETE: 5,
      SHARE: 3,
      COMMUNITY_JOIN: 4,
    };

    const behaviorScores: ScoreMap = {
      builder: 0,
      musicHead: 0,
      gamer: 0,
      explorer: 0,
    };

    for (const signal of signals) {
      if (signal.targetType === 'user') {
        continue;
      }

      let parallelId: string | undefined;

      if (signal.targetType === 'parallel_type') {
        parallelId = signal.targetId;
      } else if (signal.targetType === 'content') {
        parallelId = contentMap.get(signal.targetId);
      } else if (signal.targetType === 'QUEST') {
        parallelId = questMap.get(signal.targetId);
      }

      const key = parallelId
        ? parallelIdToKey.get(parallelId)
        : undefined;

      if (key) {
        behaviorScores[key] +=
          (signalWeights[signal.signalType] ?? 0) * signal.weight;
      }
    }

    const onboardingTotal = Object.values(onboardingScores).reduce(
      (sum, value) => sum + value,
      0,
    );

    const behaviorTotal = Object.values(behaviorScores).reduce(
      (sum, value) => sum + value,
      0,
    );

    const ONBOARDING_WEIGHT = 0.8;
    const BEHAVIOR_WEIGHT = 0.2;

    const finalScores: ScoreMap = {
      builder: 0,
      musicHead: 0,
      gamer: 0,
      explorer: 0,
    };

    for (const key of Object.keys(finalScores) as Array<keyof ScoreMap>) {
      const onboardingPct =
        (onboardingScores[key] / onboardingTotal) * 100;

      const behaviorPct =
        behaviorTotal > 0
          ? (behaviorScores[key] / behaviorTotal) * 100
          : 0;

      finalScores[key] =
        onboardingPct * ONBOARDING_WEIGHT +
        behaviorPct * BEHAVIOR_WEIGHT;
    }

    await Promise.all(
      parallels.map((parallel) => {
        const key = keyByName[parallel.parallelType.name];

        if (!key) {
          return Promise.resolve();
        }

        return this.prisma.userParallel.update({
          where: {
            userId_parallelTypeId: {
              userId,
              parallelTypeId: parallel.parallelTypeId,
            },
          },
          data: {
            strengthPct: Number(finalScores[key].toFixed(1)),
          },
        });
      }),
    );

    await this.captureEvolutionSnapshot(userId);

    await this.embeddingQueue.add('generate-user-embeddings', {
      userId,
    });
  }

  private calculateScores(answers: OnboardingAnswer[]): ScoreMap {
    const scores: ScoreMap = {
      builder: 1,
      musicHead: 1,
      gamer: 1,
      explorer: 1,
    };

    for (const answer of answers) {
      switch (answer.questionKey) {
        case 'friday_night':
          if (answer.answerValue === 'create') scores.builder += 5;
          if (answer.answerValue === 'home') {
            scores.musicHead += 2;
            scores.gamer += 3;
          }
          if (answer.answerValue === 'explore') scores.explorer += 5;
          if (answer.answerValue === 'friends') scores.gamer += 3;
          break;

        case 'learn_or_make':
          if (answer.answerValue === 'make') scores.builder += 4;
          if (answer.answerValue === 'learn') {
            scores.gamer += 3;
            scores.explorer += 2;
          }
          if (answer.answerValue === 'both') {
            scores.builder += 2;
            scores.gamer += 2;
          }
          break;

        case 'plan_or_improvise':
          if (answer.answerValue === 'plan') scores.builder += 2;
          if (answer.answerValue === 'improvise') {
            scores.explorer += 3;
            scores.gamer += 2;
          }
          if (answer.answerValue === 'mix') {
            scores.builder += 1;
            scores.explorer += 1;
            scores.gamer += 1;
          }
          break;

        case 'natural_activity':
          if (answer.answerValue === 'building') scores.builder += 6;
          if (answer.answerValue === 'music') scores.musicHead += 6;
          if (answer.answerValue === 'people') scores.gamer += 3;
          if (answer.answerValue === 'exploring') scores.explorer += 6;
          break;
      }
    }

    return scores;
  }
}
