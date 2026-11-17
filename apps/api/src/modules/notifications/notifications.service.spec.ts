import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('lists paginated notifications with nextCursor and unreadCount', async () => {
    const t1 = new Date('2026-11-18T10:00:00.000Z');
    const t2 = new Date('2026-11-18T09:00:00.000Z');
    const t3 = new Date('2026-11-18T08:00:00.000Z');

    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n-1',
        userId: 'u-1',
        type: 'NEW_FOLLOWER',
        payload: { followerUsername: 'maya' },
        readAt: null,
        createdAt: t1,
      },
      {
        id: 'n-2',
        userId: 'u-1',
        type: 'QUEST_COMPLETED',
        payload: { questTitle: 'First Sketch' },
        readAt: t1,
        createdAt: t2,
      },
      {
        id: 'n-3',
        userId: 'u-1',
        type: 'TWIN_MATCHED',
        payload: { otherUsername: 'alex' },
        readAt: null,
        createdAt: t3,
      },
    ]);
    prisma.notification.count.mockResolvedValue(2);

    const result = await service.listForUser('u-1', { limit: 2 });

    expect(result).toEqual({
      items: [
        {
          id: 'n-1',
          type: 'NEW_FOLLOWER',
          payload: { followerUsername: 'maya' },
          readAt: null,
          createdAt: t1.toISOString(),
        },
        {
          id: 'n-2',
          type: 'QUEST_COMPLETED',
          payload: { questTitle: 'First Sketch' },
          readAt: t1.toISOString(),
          createdAt: t2.toISOString(),
        },
      ],
      nextCursor: 'n-2',
      unreadCount: 2,
    });
  });

  it('returns empty items when a foreign or missing cursor is supplied', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.count.mockResolvedValue(0);

    const result = await service.listForUser('u-1', { cursor: 'foreign-id' });

    expect(result).toEqual({
      items: [],
      nextCursor: null,
      unreadCount: 0,
    });
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('marks an owned unread notification as read atomically', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'n-1', readAt: null });
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await service.markRead('u-1', 'n-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n-1', userId: 'u-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('is idempotent when marking an already-read notification as read', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      id: 'n-1',
      readAt: new Date('2026-11-18T10:00:00.000Z'),
    });

    await service.markRead('u-1', 'n-1');

    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('throws 404 when marking a nonexistent or non-owned notification', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead('u-1', 'other-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('marks all unread notifications for the user as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 4 });

    await expect(service.markAllRead('u-1')).resolves.toEqual({
      updatedCount: 4,
    });
  });
});
