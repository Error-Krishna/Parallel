import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import type { PublicUser } from '@parallel/shared-types';
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
