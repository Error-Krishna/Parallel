import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';
import { StreakService } from '../quests/streak.service.js';
import { ParallelsController } from './parallels.controller.js';
import { ParallelsService } from './parallels.service.js';

describe('ParallelsService — Ghost Mode visibility & ownership', () => {
  let service: ParallelsService;
  let controller: ParallelsController;
  let prisma: {
    userParallel: {
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
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
    userId: 'user-owner',
    strengthPct: 24.5,
    momentum: 1.2,
    streakCount: 3,
    isGhost: true,
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
        update: vi.fn(),
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

  it('allows the owner to publish their own Ghost Parallel and updates only isGhost on that record', async () => {
    const ghostRow = buildRow({ id: 'up-owner-ghost', isGhost: true });
    const publishedRow = buildRow({ id: 'up-owner-ghost', isGhost: false });

    prisma.userParallel.findFirst.mockResolvedValue(ghostRow);
    prisma.userParallel.update.mockResolvedValue(publishedRow);

    const result = await service.makeParallelPublic(
      'user-owner',
      'up-owner-ghost',
    );

    expect(prisma.userParallel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'up-owner-ghost',
          dismissedAt: null,
        },
      }),
    );

    expect(prisma.userParallel.update).toHaveBeenCalledTimes(1);
    expect(prisma.userParallel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'up-owner-ghost' },
        data: { isGhost: false },
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

  it('rejects a non-owner attempting to publish another user’s Parallel with ForbiddenException', async () => {
    const otherUsersGhost = buildRow({
      id: 'up-victim-ghost',
      userId: 'user-victim',
      isGhost: true,
    });

    prisma.userParallel.findFirst.mockResolvedValue(otherUsersGhost);

    await expect(
      service.makeParallelPublic('user-attacker', 'up-victim-ghost'),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.userParallel.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the Parallel ID does not exist or was dismissed', async () => {
    prisma.userParallel.findFirst.mockResolvedValue(null);

    await expect(
      service.makeParallelPublic('user-owner', 'non-existent-id'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.userParallel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'non-existent-id',
          dismissedAt: null,
        },
      }),
    );
    expect(prisma.userParallel.update).not.toHaveBeenCalled();
  });

  it('is idempotent when called on an already-public Parallel', async () => {
    const alreadyPublicRow = buildRow({
      id: 'up-already-public',
      userId: 'user-owner',
      isGhost: false,
    });

    prisma.userParallel.findFirst.mockResolvedValue(alreadyPublicRow);

    const result = await service.makeParallelPublic(
      'user-owner',
      'up-already-public',
    );

    expect(prisma.userParallel.update).not.toHaveBeenCalled();
    expect(result.id).toBe('up-already-public');
    expect(result.isGhost).toBe(false);
    expect(result.isHidden).toBe(false);
  });

  it('does not alter isHidden when publishing a Parallel (keeps Ghost and Hidden distinct)', async () => {
    const hiddenGhostRow = buildRow({
      id: 'up-hidden-ghost',
      isGhost: true,
      isHidden: true,
    });
    const updatedRow = buildRow({
      id: 'up-hidden-ghost',
      isGhost: false,
      isHidden: true,
    });

    prisma.userParallel.findFirst.mockResolvedValue(hiddenGhostRow);
    prisma.userParallel.update.mockResolvedValue(updatedRow);

    const result = await service.makeParallelPublic(
      'user-owner',
      'up-hidden-ghost',
    );

    expect(prisma.userParallel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'up-hidden-ghost' },
        data: { isGhost: false },
      }),
    );
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

  it('controller delegates makeParallelPublic to ParallelsService with authenticated user id', async () => {
    const ghostRow = buildRow({ id: 'up-ctrl', isGhost: true });
    const publishedRow = buildRow({ id: 'up-ctrl', isGhost: false });

    prisma.userParallel.findFirst.mockResolvedValue(ghostRow);
    prisma.userParallel.update.mockResolvedValue(publishedRow);

    const result = await controller.makeParallelPublic(
      { id: 'user-owner' },
      'up-ctrl',
    );

    expect(result.id).toBe('up-ctrl');
    expect(result.isGhost).toBe(false);
  });
});
