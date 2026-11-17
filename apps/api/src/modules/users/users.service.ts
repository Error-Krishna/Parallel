import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import type {
  PublicUser,
  TwinMatchDto,
  UserVisibleParallelDto,
} from '@parallel/shared-types';

export interface TwinMatch {
  userId: string;
  similarityScore: number;
  sharedParallelTypeIds: string[];
}
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

interface CreateUserInput {
  email: string;
  username: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        username: username.trim().toLowerCase(),
      },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(data: CreateUserInput): Promise<User> {
    const email = data.email.trim().toLowerCase();
    const username = data.username.trim().toLowerCase();

    try {
      return await this.prisma.user.create({
        data: {
          email,
          username,
          passwordHash: data.passwordHash,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;

        const fields = Array.isArray(target)
          ? target.map(String)
          : [String(target ?? '')];

        if (fields.some((field) => field.includes('email'))) {
          throw new ConflictException(
            'An account with this email already exists',
          );
        }

        if (fields.some((field) => field.includes('username'))) {
          throw new ConflictException('This username is already taken');
        }

        throw new ConflictException('User already exists');
      }

      throw error;
    }
  }

  async followUser(
    followerId: string,
    followeeId: string,
  ): Promise<void> {
    if (followerId === followeeId) {
      throw new ConflictException('You cannot follow yourself');
    }

    const followee = await this.prisma.user.findUnique({
      where: { id: followeeId },
      select: { id: true },
    });

    if (!followee) {
      throw new NotFoundException('User not found');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId,
        },
      },
      select: {
        followerId: true,
      },
    });

    if (existingFollow) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.follow.create({
        data: {
          followerId,
          followeeId,
        },
      }),
      this.prisma.interestSignal.create({
        data: {
          userId: followerId,
          signalType: 'FOLLOW',
          targetType: 'user',
          targetId: followeeId,
          weight: 1.0,
        },
      }),
    ]);

    if (this.notifications) {
      const follower = await this.prisma.user.findUnique({
        where: { id: followerId },
        select: { username: true },
      });

      await this.notifications.create(followeeId, 'NEW_FOLLOWER', {
        followerId,
        followerUsername: follower?.username ?? null,
      });
    }
  }

  async getFollowingIds(userId: string): Promise<string[]> {
    const follows = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
      },
      select: {
        followeeId: true,
      },
    });

    return follows.map((follow) => follow.followeeId);
  }

  async unfollowUser(
    followerId: string,
    followeeId: string,
  ): Promise<void> {
    if (followerId === followeeId) {
      throw new ConflictException('You cannot unfollow yourself');
    }

    const followee = await this.prisma.user.findUnique({
      where: { id: followeeId },
      select: { id: true },
    });

    if (!followee) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.follow.deleteMany({
      where: {
        followerId,
        followeeId,
      },
    });
  }

  async calculateTwinMatch(
    userAId: string,
    userBId: string,
  ): Promise<TwinMatch> {
    if (userAId === userBId) {
      throw new ConflictException('You cannot match a user with yourself');
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: [userAId, userBId],
        },
      },
      select: {
        id: true,
      },
    });

    if (users.length !== 2) {
      throw new NotFoundException('User not found');
    }

    const userParallels = await this.prisma.userParallel.findMany({
      where: {
        userId: {
          in: [userAId, userBId],
        },
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      },
      select: {
        userId: true,
        parallelTypeId: true,
        strengthPct: true,
      },
    });

    const userAScores = new Map(
      userParallels
        .filter((parallel) => parallel.userId === userAId)
        .map((parallel) => [parallel.parallelTypeId, parallel.strengthPct]),
    );

    const userBScores = new Map(
      userParallels
        .filter((parallel) => parallel.userId === userBId)
        .map((parallel) => [parallel.parallelTypeId, parallel.strengthPct]),
    );

    const sharedParallelTypeIds = [...userAScores.keys()].filter((id) =>
      userBScores.has(id),
    );

    if (sharedParallelTypeIds.length === 0) {
      return {
        userId: userBId,
        similarityScore: 0,
        sharedParallelTypeIds: [],
      };
    }

    const totalMatch = sharedParallelTypeIds.reduce((sum, parallelTypeId) => {
      const scoreA = userAScores.get(parallelTypeId)!;
      const scoreB = userBScores.get(parallelTypeId)!;
      const difference = Math.abs(scoreA - scoreB);

      return sum + (1 - difference / 100);
    }, 0);

    const similarityScore =
      (totalMatch / sharedParallelTypeIds.length) * 100;

    return {
      userId: userBId,
      similarityScore: Number(similarityScore.toFixed(2)),
      sharedParallelTypeIds,
    };
  }

  async getTwinMatches(userId: string): Promise<TwinMatchDto[]> {
    const twins = await this.prisma.twin.findMany({
      where: {
        OR: [
          { userAId: userId },
          { userBId: userId },
        ],
      },
      orderBy: {
        similarityScore: 'desc',
      },
      include: {
        userA: true,
        userB: true,
      },
    });

    return twins.map((twin) => {
      const otherUser =
        twin.userAId === userId ? twin.userB : twin.userA;

      return {
        id: twin.id,
        user: this.toPublicUser(otherUser),
        similarityScore: twin.similarityScore,
        sharedParallelTypeIds: twin.sharedParallelTypeIds as string[],
        computedAt: twin.computedAt.toISOString(),
      };
    });
  }

  async getVisibleParallels(
    userId: string,
  ): Promise<UserVisibleParallelDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const parallels = await this.prisma.userParallel.findMany({
      where: {
        userId,
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      },
      orderBy: {
        strengthPct: 'desc',
      },
      select: {
        id: true,
        strengthPct: true,
        parallelType: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
          },
        },
      },
    });

    return parallels;
  }

  async getEvolutionUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        parallels: {
          some: {},
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return users.map((user) => user.id);
  }

  async getEmergingParallelUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        interestSignals: {
          some: {},
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return users.map((user) => user.id);
  }

  async getTwinCandidateUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        parallels: {
          some: {
            isGhost: false,
            isHidden: false,
            dismissedAt: null,
          },
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return users.map((user) => user.id);
  }

  async saveTwinMatch(
    userAId: string,
    userBId: string,
  ): Promise<TwinMatch | null> {
    const match = await this.calculateTwinMatch(userAId, userBId);

    if (match.similarityScore < 70) {
      return null;
    }

    const [userAIdSorted, userBIdSorted] = [userAId, userBId].sort();

    const existingTwin = this.notifications
      ? await this.prisma.twin.findUnique({
          where: {
            userAId_userBId: {
              userAId: userAIdSorted,
              userBId: userBIdSorted,
            },
          },
          select: { id: true },
        })
      : null;

    const twin = await this.prisma.twin.upsert({
      where: {
        userAId_userBId: {
          userAId: userAIdSorted,
          userBId: userBIdSorted,
        },
      },
      create: {
        userAId: userAIdSorted,
        userBId: userBIdSorted,
        sharedParallelTypeIds: match.sharedParallelTypeIds,
        similarityScore: match.similarityScore,
      },
      update: {
        sharedParallelTypeIds: match.sharedParallelTypeIds,
        similarityScore: match.similarityScore,
        computedAt: new Date(),
      },
    });

    if (this.notifications && !existingTwin) {
      const [userA, userB] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userAIdSorted },
          select: { username: true },
        }),
        this.prisma.user.findUnique({
          where: { id: userBIdSorted },
          select: { username: true },
        }),
      ]);

      await Promise.all([
        this.notifications.create(userAIdSorted, 'TWIN_MATCHED', {
          twinId: twin.id,
          otherUserId: userBIdSorted,
          otherUsername: userB?.username ?? null,
          similarityScore: twin.similarityScore,
        }),
        this.notifications.create(userBIdSorted, 'TWIN_MATCHED', {
          twinId: twin.id,
          otherUserId: userAIdSorted,
          otherUsername: userA?.username ?? null,
          similarityScore: twin.similarityScore,
        }),
      ]);
    }

    return {
      userId: userBId,
      similarityScore: twin.similarityScore,
      sharedParallelTypeIds: twin.sharedParallelTypeIds as string[],
    };
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<User> {
    const username =
      dto.username !== undefined
        ? dto.username.trim().toLowerCase()
        : undefined;

    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(username !== undefined && {
            username,
          }),
          ...(dto.bio !== undefined && {
            bio: dto.bio,
          }),
          ...(dto.avatarUrl !== undefined && {
            avatarUrl: dto.avatarUrl,
          }),
          ...(dto.visibilitySettings !== undefined && {
            visibilitySettings: {
              ...dto.visibilitySettings,
            },
          }),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('This username is already taken');
        }

        if (error.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
      }

      throw error;
    }
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };
  }

  /**
   * Builds candidate Twin pairs via an inverted index on visible Parallels so the
   * scheduled TwinsProcessor only evaluates pairs sharing >= minSharedParallels
   * (plus existing persisted Twin pairs so diverged matches are pruned), avoiding
   * an unbounded O(N^2) global user cross-product.
   */
  async getTwinCandidatePairs(
    minSharedParallels = 2,
  ): Promise<Array<[string, string]>> {
    const [visibleParallels, existingTwins] = await Promise.all([
      this.prisma.userParallel.findMany({
        where: {
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
        select: {
          userId: true,
          parallelTypeId: true,
        },
      }),
      this.prisma.twin.findMany({
        select: {
          userAId: true,
          userBId: true,
        },
      }),
    ]);

    // Inverted index: parallelTypeId -> unique users exploring it visibly
    const usersByParallel = new Map<string, string[]>();
    for (const row of visibleParallels) {
      const bucket = usersByParallel.get(row.parallelTypeId);
      if (bucket) {
        bucket.push(row.userId);
      } else {
        usersByParallel.set(row.parallelTypeId, [row.userId]);
      }
    }

    const sharedCounts = new Map<string, number>();
    for (const userIds of usersByParallel.values()) {
      const uniqueSorted = [...new Set(userIds)].sort();
      for (let i = 0; i < uniqueSorted.length; i += 1) {
        for (let j = i + 1; j < uniqueSorted.length; j += 1) {
          const key = `${uniqueSorted[i]}::${uniqueSorted[j]}`;
          sharedCounts.set(key, (sharedCounts.get(key) ?? 0) + 1);
        }
      }
    }

    const candidateKeys = new Set<string>();
    for (const [key, count] of sharedCounts.entries()) {
      if (count >= minSharedParallels) {
        candidateKeys.add(key);
      }
    }

    // Keep existing persisted Twins in the candidate set so diverged pairs can be
    // re-scored and cleaned up if their overlap drops below threshold.
    for (const twin of existingTwins) {
      const [uA, uB] = [twin.userAId, twin.userBId].sort();
      candidateKeys.add(`${uA}::${uB}`);
    }

    return [...candidateKeys]
      .sort()
      .map((key) => key.split('::') as [string, string]);
  }

  /**
   * Self-serve personal data export (Blueprint §18 / USER_FLOW.md Flow 14).
   * Explicitly omits passwordHash and internal vector columns.
   */
  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        visibilitySettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [
      onboardingResponses,
      parallels,
      evolutionSnapshots,
      interestSignals,
      questProgress,
      questRewards,
      communityMemberships,
      following,
      followers,
      notifications,
      wrappedRecaps,
      identityCards,
    ] = await Promise.all([
      this.prisma.onboardingResponse.findMany({
        where: { userId },
        select: { questionKey: true, answerValue: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.userParallel.findMany({
        where: { userId },
        select: {
          id: true,
          strengthPct: true,
          momentum: true,
          streakCount: true,
          streakLastTouchedAt: true,
          isGhost: true,
          isHidden: true,
          dismissedAt: true,
          suggestionReason: true,
          discoveredAt: true,
          parallelType: {
            select: { id: true, name: true, description: true, icon: true },
          },
        },
        orderBy: { discoveredAt: 'asc' },
      }),
      this.prisma.parallelEvolutionSnapshot.findMany({
        where: { userId },
        select: { parallelTypeId: true, strengthPct: true, capturedAt: true },
        orderBy: { capturedAt: 'asc' },
      }),
      this.prisma.interestSignal.findMany({
        where: { userId },
        select: {
          id: true,
          signalType: true,
          targetType: true,
          targetId: true,
          weight: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.prisma.userQuestProgress.findMany({
        where: { userId },
        select: {
          questId: true,
          status: true,
          currentStep: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      this.prisma.userQuestReward.findMany({
        where: { userId },
        select: {
          questId: true,
          rewardType: true,
          rewardValue: true,
          grantedAt: true,
        },
      }),
      this.prisma.communityMember.findMany({
        where: { userId },
        select: {
          communityId: true,
          joinedAt: true,
          community: { select: { name: true, description: true } },
        },
      }),
      this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followeeId: true, createdAt: true },
      }),
      this.prisma.follow.findMany({
        where: { followeeId: userId },
        select: { followerId: true, createdAt: true },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.parallelWrapped.findMany({
        where: { userId },
        select: {
          id: true,
          period: true,
          periodStart: true,
          periodEnd: true,
          highlights: true,
          createdAt: true,
        },
      }),
      this.prisma.identityCard.findMany({
        where: { userId },
        select: {
          id: true,
          cardType: true,
          sourceType: true,
          sourceId: true,
          imageUrl: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      onboardingResponses,
      parallels,
      evolutionSnapshots,
      interestSignals,
      questProgress,
      questRewards,
      communityMemberships,
      following,
      followers,
      notifications,
      wrappedRecaps,
      identityCards,
    };
  }

  /**
   * Irreversible self-serve account deletion (Blueprint §18 / USER_FLOW.md Flow 14).
   * Prisma schema defines onDelete: Cascade on all User relations.
   */
  async deleteAccount(userId: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id: userId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }
}
