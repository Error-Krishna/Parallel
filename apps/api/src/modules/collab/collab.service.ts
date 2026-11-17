import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CollabSessionDto,
  CollabStatus,
  PublicUser,
  ParallelTypeDto,
} from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { apiError } from '../../common/utils/api-error.js';
import { StreakService } from '../quests/streak.service.js';
import { CreateCollabDto } from './dto/create-collab.dto.js';
import { AcceptCollabDto } from './dto/accept-collab.dto.js';
import { generateCollabChallenge } from './collab-challenge-generator.js';

@Injectable()
export class CollabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streakService: StreakService,
  ) {}

  private readonly sessionInclude = {
    userA: {
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
      },
    },
    userB: {
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
      },
    },
    parallelTypeA: {
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
      },
    },
    parallelTypeB: {
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
      },
    },
  } as const;

  /**
   * Initiates a new Collab session invite from user A to user B.
   */
  async invite(
    userId: string,
    dto: CreateCollabDto,
  ): Promise<CollabSessionDto> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Resolve recipient user
      let targetUser: PublicUser | null = null;
        if (dto.toUsername) {
          targetUser = await tx.user.findFirst({
            where: {
              username: {
                equals: dto.toUsername.trim(),
                mode: 'insensitive',
              },
            },
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              bio: true,
            },
          });
        } else if (dto.targetUserId) {
          targetUser = await tx.user.findUnique({
            where: { id: dto.targetUserId },
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              bio: true,
            },
          });
        } else {
          apiError(
            'Either targetUserId or toUsername must be provided',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (!targetUser) {
          apiError('User not found', HttpStatus.NOT_FOUND);
        }

        // 2. Reject self-collab
        if (targetUser.id === userId) {
          apiError(
            'You cannot start a collab with yourself',
            HttpStatus.BAD_REQUEST,
          );
        }

        // 3. Validate user A's selected Parallel: must be active & visible
        const userParallel = await tx.userParallel.findUnique({
          where: {
            userId_parallelTypeId: {
              userId,
              parallelTypeId: dto.myParallelTypeId,
            },
          },
        });

        if (
          !userParallel ||
          userParallel.isGhost ||
          userParallel.isHidden ||
          userParallel.dismissedAt !== null
        ) {
          apiError(
            'Selected Parallel is not visible or not found in your profile',
            HttpStatus.BAD_REQUEST,
          );
        }

      // 4. Invariant: Prevent concurrent duplicate pending/active sessions between the same pair
      // Use PostgreSQL advisory transaction lock for the pair to eliminate race conditions
      const [u1, u2] = [userId, targetUser.id].sort();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`collab:${u1}:${u2}`}))`;

      const existingOngoing = await tx.collabSession.findFirst({
        where: {
          OR: [
            { userAId: userId, userBId: targetUser.id },
            { userAId: targetUser.id, userBId: userId },
          ],
          status: { in: ['PENDING', 'ACTIVE'] },
        },
      });

      if (existingOngoing) {
        apiError(
          'You already have an active or pending collab session with this user',
          HttpStatus.CONFLICT,
        );
      }

      // 5. Create session in PENDING state
      const session = await tx.collabSession.create({
        data: {
          userAId: userId,
          userBId: targetUser.id,
          parallelTypeAId: dto.myParallelTypeId,
          status: 'PENDING',
        },
        include: this.sessionInclude,
      });

      return this.toCollabSessionDto(session);
    });
  }

  /**
   * User B accepts the collab invite and selects their own visible Parallel.
   */
  async accept(
    userId: string,
    sessionId: string,
    dto: AcceptCollabDto,
  ): Promise<CollabSessionDto> {
    return await this.prisma.$transaction(async (tx) => {
      // Row-level lock to prevent concurrent accept/cancel race conditions
      await tx.$executeRaw`SELECT id FROM collab_sessions WHERE id = ${sessionId} FOR UPDATE`;

      const session = await tx.collabSession.findUnique({
        where: { id: sessionId },
        include: this.sessionInclude,
      });

      if (!session) {
        apiError('Collab session not found', HttpStatus.NOT_FOUND);
      }

      if (session.userBId !== userId) {
        apiError(
          'You are not authorized to accept this collab invitation',
          HttpStatus.FORBIDDEN,
        );
      }

      if (session.status !== 'PENDING') {
        apiError(
          'Collab session is not in pending status',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate user B's chosen Parallel
      const userParallel = await tx.userParallel.findUnique({
        where: {
          userId_parallelTypeId: {
            userId,
            parallelTypeId: dto.myParallelTypeId,
          },
        },
        include: {
          parallelType: true,
        },
      });

      if (
        !userParallel ||
        userParallel.isGhost ||
        userParallel.isHidden ||
        userParallel.dismissedAt !== null
      ) {
        apiError(
          'Selected Parallel is not visible or not found in your profile',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Generate shared challenge combining user A's and user B's chosen Parallels
      const challenge = generateCollabChallenge(
        session.parallelTypeA.name,
        userParallel.parallelType.name,
      );

      const updatedSession = await tx.collabSession.update({
        where: { id: sessionId },
        data: {
          parallelTypeBId: dto.myParallelTypeId,
          status: 'ACTIVE',
          challengeTitle: challenge.challengeTitle,
          challengeDescription: challenge.challengeDescription,
          challengeContext: challenge.challengeContext,
        },
        include: this.sessionInclude,
      });

      return this.toCollabSessionDto(updatedSession);
    });
  }

  /**
   * Cancels, declines, or leaves an ongoing session.
   */
  async cancel(userId: string, sessionId: string): Promise<CollabSessionDto> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM collab_sessions WHERE id = ${sessionId} FOR UPDATE`;

      const session = await tx.collabSession.findUnique({
        where: { id: sessionId },
        include: this.sessionInclude,
      });

      if (!session) {
        apiError('Collab session not found', HttpStatus.NOT_FOUND);
      }

      if (session.userAId !== userId && session.userBId !== userId) {
        apiError(
          'You are not authorized to cancel this collab session',
          HttpStatus.FORBIDDEN,
        );
      }

      if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
        apiError(
          'Collab session is already completed or cancelled',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await tx.collabSession.update({
        where: { id: sessionId },
        data: { status: 'CANCELLED' },
        include: this.sessionInclude,
      });

      return this.toCollabSessionDto(updated);
    });
  }

  /**
   * Participant marks their part of the challenge completed.
   * If both participants have completed, session transitions to COMPLETED.
   */
  async complete(userId: string, sessionId: string): Promise<CollabSessionDto> {
    return await this.prisma.$transaction(async (tx) => {
      // Row-level lock ensures atomic evaluation and prevents lost updates
      await tx.$executeRaw`SELECT id FROM collab_sessions WHERE id = ${sessionId} FOR UPDATE`;

      const session = await tx.collabSession.findUnique({
        where: { id: sessionId },
        include: this.sessionInclude,
      });

      if (!session) {
        apiError('Collab session not found', HttpStatus.NOT_FOUND);
      }

      if (session.userAId !== userId && session.userBId !== userId) {
        apiError(
          'You are not authorized to interact with this collab session',
          HttpStatus.FORBIDDEN,
        );
      }

      if (session.status !== 'ACTIVE') {
        apiError(
          'Collab session is not active',
          HttpStatus.BAD_REQUEST,
        );
      }

      const isUserA = session.userAId === userId;
      const nextUserACompleted = isUserA ? true : session.userACompleted;
      const nextUserBCompleted = !isUserA ? true : session.userBCompleted;
      const bothCompleted = nextUserACompleted && nextUserBCompleted;
      const wasAlreadyBothCompleted =
        session.userACompleted && session.userBCompleted;

      const updated = await tx.collabSession.update({
        where: { id: sessionId },
        data: {
          userACompleted: nextUserACompleted,
          userBCompleted: nextUserBCompleted,
          status: bothCompleted ? 'COMPLETED' : 'ACTIVE',
          completedAt: bothCompleted ? (session.completedAt ?? new Date()) : null,
        },
        include: this.sessionInclude,
      });

      if (bothCompleted && !wasAlreadyBothCompleted) {
        // 1. Log CHALLENGE_COMPLETE interest signals for both participants
        await tx.interestSignal.createMany({
          data: [
            {
              userId: session.userAId,
              signalType: 'CHALLENGE_COMPLETE',
              targetType: 'COLLAB',
              targetId: session.id,
              weight: 5.0,
            },
            {
              userId: session.userBId,
              signalType: 'CHALLENGE_COMPLETE',
              targetType: 'COLLAB',
              targetId: session.id,
              weight: 5.0,
            },
          ],
        });

        // 2. Touch streaks for both participants
        await this.streakService.touch(session.userAId, session.parallelTypeAId);
        if (session.parallelTypeBId) {
          await this.streakService.touch(session.userBId, session.parallelTypeBId);
        }
      }

      return this.toCollabSessionDto(updated);
    });
  }

  /**
   * Retrieves single Collab session details.
   */
  async getSession(userId: string, sessionId: string): Promise<CollabSessionDto> {
    const session = await this.prisma.collabSession.findUnique({
      where: { id: sessionId },
      include: this.sessionInclude,
    });

    if (!session) {
      apiError('Collab session not found', HttpStatus.NOT_FOUND);
    }

    if (session.userAId !== userId && session.userBId !== userId) {
      apiError(
        'You are not authorized to view this collab session',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.toCollabSessionDto(session);
  }

  /**
   * Retrieves user's collab sessions, optionally filtered by status.
   */
  async getSessions(
    userId: string,
    status?: CollabStatus,
  ): Promise<CollabSessionDto[]> {
    const where: Prisma.CollabSessionWhereInput = {
      OR: [{ userAId: userId }, { userBId: userId }],
    };

    if (status) {
      where.status = status;
    }

    const sessions = await this.prisma.collabSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.sessionInclude,
    });

    return sessions.map((s) => this.toCollabSessionDto(s));
  }

  private toCollabSessionDto(session: {
    id: string;
    userAId: string;
    userBId: string;
    userA: PublicUser;
    userB: PublicUser;
    parallelTypeAId: string;
    parallelTypeA: ParallelTypeDto;
    parallelTypeBId: string | null;
    parallelTypeB: ParallelTypeDto | null;
    status: CollabStatus;
    challengeTitle: string | null;
    challengeDescription: string | null;
    challengeContext: unknown;
    userACompleted: boolean;
    userBCompleted: boolean;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): CollabSessionDto {
    return {
      id: session.id,
      userAId: session.userAId,
      userBId: session.userBId,
      userA: session.userA,
      userB: session.userB,
      parallelTypeAId: session.parallelTypeAId,
      parallelTypeA: session.parallelTypeA,
      parallelTypeBId: session.parallelTypeBId,
      parallelTypeB: session.parallelTypeB,
      status: session.status,
      challengeTitle: session.challengeTitle,
      challengeDescription: session.challengeDescription,
      challengeContext:
        session.challengeContext && typeof session.challengeContext === 'object'
          ? (session.challengeContext as Record<string, unknown>)
          : null,
      userACompleted: session.userACompleted,
      userBCompleted: session.userBCompleted,
      completedAt: session.completedAt ? session.completedAt.toISOString() : null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }
}
