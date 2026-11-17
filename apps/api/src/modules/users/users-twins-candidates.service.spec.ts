import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService.getTwinCandidatePairs (inverted-index pruning)', () => {
  let service: UsersService;
  let prisma: {
    userParallel: { findMany: ReturnType<typeof vi.fn> };
    twin: { findMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    prisma = {
      userParallel: { findMany: vi.fn() },
      twin: { findMany: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: vi.fn() } },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('prunes disjoint and single-parallel pairs and keeps only pairs sharing >= 2 visible Parallels', async () => {
    prisma.userParallel.findMany.mockResolvedValue([
      // user-a & user-b share 2 Parallels (pt-1, pt-2) -> QUALIFIES
      { userId: 'user-a', parallelTypeId: 'pt-1' },
      { userId: 'user-a', parallelTypeId: 'pt-2' },
      { userId: 'user-b', parallelTypeId: 'pt-1' },
      { userId: 'user-b', parallelTypeId: 'pt-2' },
      // user-c shares only 1 Parallel (pt-1) with user-a & user-b -> PRUNED
      { userId: 'user-c', parallelTypeId: 'pt-1' },
      { userId: 'user-c', parallelTypeId: 'pt-9' },
      // user-d is completely disjoint -> PRUNED
      { userId: 'user-d', parallelTypeId: 'pt-99' },
    ]);
    prisma.twin.findMany.mockResolvedValue([]);

    const pairs = await service.getTwinCandidatePairs(2);

    expect(prisma.userParallel.findMany).toHaveBeenCalledWith({
      where: {
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      },
      select: {
        userId: true,
        parallelTypeId: true,
      },
    });
    expect(pairs).toEqual([['user-a', 'user-b']]);
  });

  it('retains existing persisted Twin pairs so diverged matches can be cleaned up', async () => {
    prisma.userParallel.findMany.mockResolvedValue([
      { userId: 'user-a', parallelTypeId: 'pt-1' },
      { userId: 'user-b', parallelTypeId: 'pt-2' },
    ]);
    prisma.twin.findMany.mockResolvedValue([
      { userAId: 'user-b', userBId: 'user-a' },
    ]);

    const pairs = await service.getTwinCandidatePairs(2);

    expect(pairs).toEqual([['user-a', 'user-b']]);
  });
});
