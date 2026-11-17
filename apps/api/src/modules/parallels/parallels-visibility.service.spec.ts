import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';
import { StreakService } from '../quests/streak.service.js';
import { ParallelsController } from './parallels.controller.js';
import { ParallelsService } from './parallels.service.js';

describe('ParallelsService — Ghost Mode visibility, atomicity & ownership', () => {
  let service: ParallelsService;
  let controller: ParallelsController;
  let prisma: {
    userParallel: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  const discoveredAt = new Date('2026-10-15T12:00:00.000Z');
  const parallelType = {
    id: 'pt-urbanist',
    name: 'The Urbanist',
    description: 'You are drawn to architecture and city exploration.',
    icon: 'compass',
  };

  const buildRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'up-owner-ghost',
    strengthPct: 24.5,
    momentum: 1.2,
    streakCount: 3,
    isGhost: false,
    isHidden: false,
    dismissedAt: null,
    suggestionReason: 'Emerged from your recent architecture saves.',
    discoveredAt,
    parallelType,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      userParallel: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParallelsController],
      providers: [
        ParallelsService,
        { provide: PrismaService, useValue: prisma },
        { provide: IdentityEngineService, useValue: {} },
        { provide: StreakService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get(ParallelsService);
    controller = module.get(ParallelsController);
  });

  it('atomically publishes the owner’s active Ghost Parallel and updates only isGhost', async () => {
    const publishedRow = buildRow({ id: 'up-owner-ghost', isGhost: false });

    prisma.userParallel.updateMany.mockResolvedValue({ count: 1 });
    prisma.userParallel.findFirst.mockResolvedValue(publishedRow);

    const result = await service.makeParallelPublic(
      'user-owner',
      'up-owner-ghost',
    );

    expect(prisma.userParallel.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.userParallel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'up-owner-ghost',
        userId: 'user-owner',
        dismissedAt: null,
        isGhost: true,
      },
      data: {
        isGhost: false,
      },
    });
    expect(prisma.userParallel.update).not.toHaveBeenCalled();

    expect(prisma.userParallel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'up-owner-ghost',
          userId: 'user-owner',
          dismissedAt: null,
        },
      }),
    );

    expect(result).toEqual({
      id: 'up-owner-ghost',
      parallelType,
      strengthPct: 24.5,
      momentum: 1.2,
      streakCount: 3,
      isGhost: false,
      isHidden: false,
      dismissedAt: null,
      suggestionReason: 'Emerged from your recent architecture saves.',
      discoveredAt: discoveredAt.toISOString(),
    });
  });

  it('returns NotFoundException (404) for a non-owner without revealing existence or mutating DB', async () => {
    prisma.userParallel.updateMany.mockResolvedValue({ count: 0 });
    prisma.userParallel.findFirst.mockResolvedValue(null);

    await expect(
      service.makeParallelPublic('user-attacker', 'up-victim-ghost'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.userParallel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'up-victim-ghost',
        userId: 'user-attacker',
        dismissedAt: null,
        isGhost: true,
      },
      data: {
        isGhost: false,
      },
    });
    expect(prisma.userParallel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'up-victim-ghost',
          userId: 'user-attacker',
          dismissedAt: null,
          isGhost: false,
        },
      }),
    );
  });

  it('returns NotFoundException (404) for nonexistent or dismissed Parallels', async () => {
    prisma.userParallel.updateMany.mockResolvedValue({ count: 0 });
    prisma.userParallel.findFirst.mockResolvedValue(null);

    await expect(
      service.makeParallelPublic('user-owner', 'non-existent-or-dismissed'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.userParallel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'non-existent-or-dismissed',
        userId: 'user-owner',
        dismissedAt: null,
        isGhost: true,
      },
      data: {
        isGhost: false,
      },
    });
  });

  it('returns NotFoundException (404) if the Parallel is concurrently dismissed before post-update read', async () => {
    prisma.userParallel.updateMany.mockResolvedValue({ count: 1 });
    prisma.userParallel.findFirst.mockResolvedValue(null);

    await expect(
      service.makeParallelPublic('user-owner', 'up-concurrently-dismissed'),
    ).rejects.toThrow(NotFoundException);
  });

  it('is idempotent for an already-public Parallel owned by caller (0 rows updated, returns 200 DTO)', async () => {
    const alreadyPublicRow = buildRow({
      id: 'up-already-public',
      isGhost: false,
    });

    prisma.userParallel.updateMany.mockResolvedValue({ count: 0 });
    prisma.userParallel.findFirst.mockResolvedValue(alreadyPublicRow);

    const result = await service.makeParallelPublic(
      'user-owner',
      'up-already-public',
    );

    expect(prisma.userParallel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'up-already-public',
        userId: 'user-owner',
        dismissedAt: null,
        isGhost: true,
      },
      data: {
        isGhost: false,
      },
    });
    expect(prisma.userParallel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'up-already-public',
          userId: 'user-owner',
          dismissedAt: null,
          isGhost: false,
        },
      }),
    );
    expect(result.id).toBe('up-already-public');
    expect(result.isGhost).toBe(false);
    expect(result.isHidden).toBe(false);
  });

  it('handles concurrent publication calls idempotently when one updates and the other sees 0 rows', async () => {
    const publicRow = buildRow({ id: 'up-race', isGhost: false });

    prisma.userParallel.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.userParallel.findFirst.mockResolvedValue(publicRow);

    const [res1, res2] = await Promise.all([
      service.makeParallelPublic('user-owner', 'up-race'),
      service.makeParallelPublic('user-owner', 'up-race'),
    ]);

    expect(res1.isGhost).toBe(false);
    expect(res2.isGhost).toBe(false);
    expect(res1.id).toBe('up-race');
    expect(res2.id).toBe('up-race');
  });

  it('preserves isHidden when publishing a hidden Parallel (keeps Ghost and Hidden distinct)', async () => {
    const updatedHiddenRow = buildRow({
      id: 'up-hidden-ghost',
      isGhost: false,
      isHidden: true,
    });

    prisma.userParallel.updateMany.mockResolvedValue({ count: 1 });
    prisma.userParallel.findFirst.mockResolvedValue(updatedHiddenRow);

    const result = await service.makeParallelPublic(
      'user-owner',
      'up-hidden-ghost',
    );

    expect(prisma.userParallel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'up-hidden-ghost',
        userId: 'user-owner',
        dismissedAt: null,
        isGhost: true,
      },
      data: {
        isGhost: false,
      },
    });
    expect(result.isGhost).toBe(false);
    expect(result.isHidden).toBe(true);
  });

  it('hideParallel only sets isHidden: true without conflating Ghost Mode', async () => {
    prisma.userParallel.findFirst.mockResolvedValue({ id: 'up-owner-public' });
    prisma.userParallel.update.mockResolvedValue({ id: 'up-owner-public' });

    await service.hideParallel('user-owner', 'up-owner-public');

    expect(prisma.userParallel.update).toHaveBeenCalledWith({
      where: { id: 'up-owner-public' },
      data: { isHidden: true },
    });
  });

  it('controller binds JwtAuthGuard and delegates makeParallelPublic with authenticated user id', async () => {
    const guards = Reflect.getMetadata('__guards__', ParallelsController) as
      | unknown[]
      | undefined;
    expect(guards).toContain(JwtAuthGuard);

    const publishedRow = buildRow({ id: 'up-ctrl', isGhost: false });
    prisma.userParallel.updateMany.mockResolvedValue({ count: 1 });
    prisma.userParallel.findFirst.mockResolvedValue(publishedRow);

    const result = await controller.makeParallelPublic(
      { id: 'user-owner' },
      'up-ctrl',
    );

    expect(result.id).toBe('up-ctrl');
    expect(result.isGhost).toBe(false);
  });

  it('listManageableParallels returns all non-dismissed Parallels including Ghost and Hidden', async () => {
    prisma.userParallel.findMany.mockResolvedValue([
      buildRow({ id: 'up-public', isGhost: false, isHidden: false }),
      buildRow({ id: 'up-ghost', isGhost: true, isHidden: false }),
      buildRow({ id: 'up-hidden', isGhost: false, isHidden: true }),
    ]);

    const result = await service.listManageableParallels('user-owner');

    expect(prisma.userParallel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-owner', dismissedAt: null },
      }),
    );
    expect(result.map((item) => item.id)).toEqual([
      'up-public',
      'up-ghost',
      'up-hidden',
    ]);
  });

  it('unhideParallel atomically restores a hidden Parallel without altering isGhost', async () => {
    prisma.userParallel.updateMany.mockResolvedValue({ count: 1 });
    prisma.userParallel.findFirst.mockResolvedValue(
      buildRow({ id: 'up-hidden-ghost', isGhost: true, isHidden: false }),
    );

    const result = await service.unhideParallel('user-owner', 'up-hidden-ghost');

    expect(prisma.userParallel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'up-hidden-ghost',
        userId: 'user-owner',
        dismissedAt: null,
        isHidden: true,
      },
      data: { isHidden: false },
    });
    expect(result.isHidden).toBe(false);
    expect(result.isGhost).toBe(true);
  });

  it('unhideParallel returns NotFoundException (404) for non-owner or dismissed records', async () => {
    prisma.userParallel.updateMany.mockResolvedValue({ count: 0 });
    prisma.userParallel.findFirst.mockResolvedValue(null);

    await expect(
      service.unhideParallel('user-attacker', 'up-victim'),
    ).rejects.toThrow(NotFoundException);
  });

  it('dismissParallel sets dismissedAt atomically and is idempotent for already-dismissed owner records', async () => {
    prisma.userParallel.updateMany.mockResolvedValueOnce({ count: 1 });
    await service.dismissParallel('user-owner', 'up-dismiss-1');

    expect(prisma.userParallel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'up-dismiss-1',
        userId: 'user-owner',
        dismissedAt: null,
      },
      data: {
        dismissedAt: expect.any(Date),
      },
    });

    // Repeat call: count === 0, owner record exists -> idempotent void
    prisma.userParallel.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.userParallel.findFirst.mockResolvedValueOnce({ id: 'up-dismiss-1' });
    await expect(
      service.dismissParallel('user-owner', 'up-dismiss-1'),
    ).resolves.toBeUndefined();

    // Non-owner: count === 0, owner record does not exist -> 404
    prisma.userParallel.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.userParallel.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.dismissParallel('user-attacker', 'up-dismiss-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
