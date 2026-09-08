import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PublicUser } from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

// All Prisma access for the `users` domain lives here — nothing outside this service
// should import PrismaService and query the `user` table directly (see apps/api/CLAUDE.md).
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(data: { email: string; username: string; passwordHash: string }): Promise<User> {
    const [existingEmail, existingUsername] = await Promise.all([
      this.findByEmail(data.email),
      this.findByUsername(data.username),
    ]);
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }
    if (existingUsername) {
      throw new ConflictException('This username is already taken');
    }

    return this.prisma.user.create({ data });
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.username) {
      const existing = await this.findByUsername(dto.username);
      if (existing && existing.id !== id) {
        throw new ConflictException('This username is already taken');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.username && { username: dto.username }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.visibilitySettings !== undefined && {
          // Spread into a plain object — Prisma's Json field expects plain
          // JSON-serializable data, not a class instance.
          visibilitySettings: { ...dto.visibilitySettings },
        }),
      },
    });
  }

  // Strips everything that should never leave the server (passwordHash, email —
  // email is excluded from PublicUser deliberately, not just passwordHash) — every
  // controller response goes through this rather than returning the raw Prisma row.
  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };
  }
}
