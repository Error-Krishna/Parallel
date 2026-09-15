import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service.js';
import { StreakService } from './streak.service.js';

describe('StreakService', () => {
  let service: StreakService;
  let prisma: {
    userParallel: Record<string, ReturnType<typeof vi.fn>>;
  };

  beforeEach(async () => {
    prisma = {
      userParallel: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(StreakService);
  });

  it('starts a streak at 1 when there is no previous touch', async () => {
    prisma.userParallel.findUnique.mockResolvedValue({
      id: 'user-parallel-1',
      streakCount: 0,
      streakLastTouchedAt: null,
    });

    prisma.userParallel.update.mockResolvedValue({
      streakCount: 1,
      streakLastTouchedAt: expect.any(Date),
    });

    await service.touch('user-1', 'parallel-1');

    expect(prisma.userParallel.update).toHaveBeenCalledWith({
      where: { id: 'user-parallel-1' },
      data: {
        streakCount: 1,
        streakLastTouchedAt: expect.any(Date),
      },
      select: {
        streakCount: true,
        streakLastTouchedAt: true,
      },
    });
  });

  it('does not increment the streak when touched again on the same day', async () => {
    const today = new Date('2026-09-15T20:00:00.000Z');

    prisma.userParallel.findUnique.mockResolvedValue({
      id: 'up1',
      streakCount: 3,
      streakLastTouchedAt: new Date('2026-09-15T08:00:00.000Z'),
    });

    prisma.userParallel.update.mockResolvedValue({
      streakCount: 3,
      streakLastTouchedAt: today,
    });

    await expect(service.touch('u1', 'builder')).resolves.toEqual({
      streakCount: 3,
      streakLastTouchedAt: today,
    });

    expect(prisma.userParallel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          streakCount: 3,
          streakLastTouchedAt: expect.any(Date),
        },
      }),
    );
  });

  it('increments the streak when last touched within 48 hours', async () => {
    prisma.userParallel.findUnique.mockResolvedValue({
      id: 'user-parallel-1',
      streakCount: 3,
      streakLastTouchedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    prisma.userParallel.update.mockResolvedValue({
      streakCount: 4,
      streakLastTouchedAt: expect.any(Date),
    });

    await service.touch('user-1', 'parallel-1');

    expect(prisma.userParallel.update).toHaveBeenCalledWith({
      where: { id: 'user-parallel-1' },
      data: {
        streakCount: 4,
        streakLastTouchedAt: expect.any(Date),
      },
      select: {
        streakCount: true,
        streakLastTouchedAt: true,
      },
    });
  });

  it('resets the streak to 1 when last touched more than 48 hours ago', async () => {
    prisma.userParallel.findUnique.mockResolvedValue({
      id: 'user-parallel-1',
      streakCount: 7,
      streakLastTouchedAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
    });

    prisma.userParallel.update.mockResolvedValue({
      streakCount: 1,
      streakLastTouchedAt: expect.any(Date),
    });

    await service.touch('user-1', 'parallel-1');

    expect(prisma.userParallel.update).toHaveBeenCalledWith({
      where: { id: 'user-parallel-1' },
      data: {
        streakCount: 1,
        streakLastTouchedAt: expect.any(Date),
      },
      select: {
        streakCount: true,
        streakLastTouchedAt: true,
      },
    });
  });

  it('does nothing when the user has no matching Parallel', async () => {
    prisma.userParallel.findUnique.mockResolvedValue(null);

    await expect(
      service.touch('user-1', 'missing-parallel'),
    ).resolves.toBeNull();

    expect(prisma.userParallel.update).not.toHaveBeenCalled();
  });
});
