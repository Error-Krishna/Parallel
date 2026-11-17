import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  NotificationDto,
  NotificationsListResponse,
} from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<NotificationDto> {
    const created = await this.prisma.notification.create({
      data: {
        userId,
        type,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    return this.toDto(created);
  }

  async listForUser(
    userId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<NotificationsListResponse> {
    const rawLimit = options.limit ?? DEFAULT_LIMIT;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
      : DEFAULT_LIMIT;

    const [rows, unreadCount] = await Promise.all([
      this.fetchPage(userId, options.cursor, limit),
      this.prisma.notification.count({
        where: {
          userId,
          readAt: null,
        },
      }),
    ]);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

    return {
      items: pageRows.map((row) => this.toDto(row)),
      nextCursor,
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    // Enumeration-safe lookup scoped to the authenticated user so another
    // user's notification ID yields the same 404 as a nonexistent ID.
    const existing = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
      select: {
        id: true,
        readAt: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (existing.readAt) {
      return;
    }

    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  async markAllRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  private async fetchPage(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ) {
    if (!cursor) {
      return this.prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
    }

    // Verify cursor belongs to this user before paginating so an invalid or
    // foreign cursor cleanly returns an empty tail instead of leaking records.
    const anchor = await this.prisma.notification.findFirst({
      where: { id: cursor, userId },
      select: { id: true },
    });

    if (!anchor) {
      return [];
    }

    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: { id: anchor.id },
      skip: 1,
      take: limit + 1,
    });
  }

  private toDto(row: {
    id: string;
    type: string;
    payload: Prisma.JsonValue;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    const payload =
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};

    return {
      id: row.id,
      type: row.type,
      payload,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
