import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type { PublicUser, ParallelMapResponse } from '@parallel/shared-types';
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
  ) {}

  async generateInitialMap(userId: string): Promise<ParallelMapResponse> {
    const [user, answers] = await Promise.all([
      this.usersService.findById(userId),
      this.prisma.onboardingResponse.findMany({
        where: { userId },
        select: {
          questionKey: true,
          answerValue: true,
        },
      }),
    ]);

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

    return this.getMap(userId, user);
  }

  async getMap(userId: string, user?: PublicUser): Promise<ParallelMapResponse> {
    const currentUser =
      user ?? this.usersService.toPublicUser(await this.usersService.findById(userId));

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
      user: currentUser,
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
