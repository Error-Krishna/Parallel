import { WrappedPeriod } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { WrappedService } from './wrapped.service.js';

describe('WrappedService', () => {
  let service: WrappedService;
  let notifications: { create: ReturnType<typeof vi.fn> };
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    userParallel: { findMany: ReturnType<typeof vi.fn> };
    parallelEvolutionSnapshot: { findMany: ReturnType<typeof vi.fn> };
    interestSignal: { findMany: ReturnType<typeof vi.fn> };
    contentItem: { findMany: ReturnType<typeof vi.fn> };
    quest: { findMany: ReturnType<typeof vi.fn> };
    twin: { findFirst: ReturnType<typeof vi.fn> };
    parallelWrapped: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    parallelType: { findMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    notifications = { create: vi.fn() };
    prisma = {
      user: { findUnique: vi.fn() },
      userParallel: { findMany: vi.fn() },
      parallelEvolutionSnapshot: { findMany: vi.fn() },
      interestSignal: { findMany: vi.fn() },
      contentItem: { findMany: vi.fn() },
      quest: { findMany: vi.fn() },
      twin: { findFirst: vi.fn() },
      parallelWrapped: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      parallelType: { findMany: vi.fn() },
    };

    service = new WrappedService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('generates a Wrapped recap exclusively from public non-ghost Parallels and notifies the user', async () => {
    const now = new Date('2026-11-18T10:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', username: 'maya' });
    prisma.userParallel.findMany.mockResolvedValue([
      {
        parallelTypeId: 'pt-1',
        strengthPct: 80,
        streakCount: 6,
        parallelType: { id: 'pt-1', name: 'Builder' },
      },
      {
        parallelTypeId: 'pt-2',
        strengthPct: 55,
        streakCount: 2,
        parallelType: { id: 'pt-2', name: 'Stargazer' },
      },
    ]);
    prisma.parallelEvolutionSnapshot.findMany.mockResolvedValue([
      { parallelTypeId: 'pt-1', strengthPct: 62 },
      { parallelTypeId: 'pt-1', strengthPct: 80 },
    ]);
    prisma.interestSignal.findMany.mockResolvedValue([
      { targetType: 'PARALLEL', targetId: 'pt-1' },
      { targetType: 'PARALLEL', targetId: 'pt-1' },
      { targetType: 'PARALLEL', targetId: 'pt-ghost' },
    ]);
    prisma.twin.findFirst.mockResolvedValue({ id: 'twin-9' });
    prisma.parallelWrapped.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'wrap-1',
        ...data,
        createdAt: now,
      }),
    );

    const recap = await service.generateForUser('u-1', WrappedPeriod.MONTHLY);

    // Query must filter out ghost/hidden/dismissed Parallels.
    expect(prisma.userParallel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u-1',
          isGhost: false,
          isHidden: false,
          dismissedAt: null,
        },
      }),
    );

    expect(recap.id).toBe('wrap-1');
    expect(recap.highlights.biggestEvolution).toEqual({
      parallelTypeId: 'pt-1',
      deltaPct: 18,
    });
    expect(recap.highlights.mostExplored).toEqual({
      parallelTypeId: 'pt-1',
      interactionCount: 2,
    });
    expect(recap.highlights.streakHighlight).toEqual({
      parallelTypeId: 'pt-1',
      streakCount: 6,
    });
    expect(recap.highlights.twinId).toBe('twin-9');
    expect(recap.highlights.weirdestIntersection?.parallelTypeIds).toEqual([
      'pt-1',
      'pt-2',
    ]);
    expect(notifications.create).toHaveBeenCalledWith('u-1', 'WRAPPED_READY', {
      wrappedId: 'wrap-1',
      period: WrappedPeriod.MONTHLY,
    });
  });

  it('produces honest quiet-month copy when activity is sparse', async () => {
    const now = new Date('2026-11-18T10:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', username: 'maya' });
    prisma.userParallel.findMany.mockResolvedValue([]);
    prisma.interestSignal.findMany.mockResolvedValue([]);
    prisma.twin.findFirst.mockResolvedValue(null);
    prisma.parallelWrapped.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'wrap-quiet',
        ...data,
        createdAt: now,
      }),
    );

    const recap = await service.generateForUser('u-1', WrappedPeriod.MONTHLY);

    expect(recap.highlights.biggestEvolution).toBeNull();
    expect(recap.highlights.mostExplored).toBeNull();
    expect(recap.highlights.streakHighlight).toBeNull();
    expect(recap.highlights.narrativeCopy).toContain('quieter month');
  });
});
