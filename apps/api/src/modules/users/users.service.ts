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

    return {
      userId: userBId,
      similarityScore: twin.similarityScore,
      sharedParallelTypeIds: twin.sharedParallelTypeIds as string[],
    };
  }

  async refreshTwinMatches(userId: string): Promise<void> {
    const candidateIds = await this.getTwinCandidateUserIds();

    // getTwinCandidateUserIds() returns every user with at least one visible
    // Parallel — it isn't scoped to "everyone except userId", so this exclusion has
    // to happen here. Without it, calculateTwinMatch(userId, userId) would hit its
    // own self-match guard and throw, aborting the whole refresh on that iteration.
    const others = candidateIds.filter((candidateId) => candidateId !== userId);

    // Sequential, not Promise.all — this is a full table scan of Parallel data per
    // pair; at MVP scale that's fine, but running them concurrently would multiply
    // load on the same rows for no real benefit. Revisit if candidate counts grow
    // large enough for this to matter.
    for (const candidateId of others) {
      await this.saveTwinMatch(userId, candidateId);
    }
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
}
