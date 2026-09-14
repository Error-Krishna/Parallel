import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '@prisma/client';

// PrismaService is mocked here — this is a *unit* test (fast, no real DB). Integration
// tests against a real Postgres instance belong in test:e2e (see apps/api/CLAUDE.md).
describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: Record<string, ReturnType<typeof vi.fn>>;
    userParallel: Record<string, ReturnType<typeof vi.fn>>;
    follow: Record<string, ReturnType<typeof vi.fn>>;
    twin: Record<string, ReturnType<typeof vi.fn>>;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      userParallel: {
        findMany: vi.fn(),
      },
      follow: {
        deleteMany: vi.fn(),
      },
      twin: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  it('creates a user when email and username are free', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: '1',
      email: 'a@example.com',
      username: 'alex',
      passwordHash: 'hashed',
      avatarUrl: null,
      bio: null,
    });

    const user = await service.create({
      email: 'a@example.com',
      username: 'alex',
      passwordHash: 'hashed',
    });

    expect(user.id).toBe('1');
    expect(prisma.user.create).toHaveBeenCalledOnce();
  });

  it('rejects signup with a duplicate email', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.19.0',
          meta: {
            target: ['email'],
          },
        },
      ),
    );

    await expect(
      service.create({
        email: 'taken@example.com',
        username: 'newname',
        passwordHash: 'x',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('unfollows an existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '2' });
    prisma.follow.deleteMany.mockResolvedValue({ count: 1 });

    await service.unfollowUser('1', '2');

    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
      where: {
        followerId: '1',
        followeeId: '2',
      },
    });
  });

  it('rejects unfollowing yourself', async () => {
    await expect(service.unfollowUser('1', '1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects unfollowing a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.unfollowUser('1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('calculates Twin similarity from shared visible Parallels', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: '1' },
      { id: '2' },
    ]);

    prisma.userParallel.findMany.mockResolvedValue([
      {
        userId: '1',
        parallelTypeId: 'builder',
        strengthPct: 80,
      },
      {
        userId: '1',
        parallelTypeId: 'gamer',
        strengthPct: 60,
      },
      {
        userId: '2',
        parallelTypeId: 'builder',
        strengthPct: 70,
      },
      {
        userId: '2',
        parallelTypeId: 'gamer',
        strengthPct: 50,
      },
    ]);

    const result = await service.calculateTwinMatch('1', '2');

    expect(result).toEqual({
      userId: '2',
      similarityScore: 90,
      sharedParallelTypeIds: ['builder', 'gamer'],
    });

    expect(prisma.userParallel.findMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: ['1', '2'],
        },
        isGhost: false,
        isHidden: false,
        dismissedAt: null,
      },
      select: {
        userId: true,
        parallelTypeId: true,
        strengthPct: true,
      },
    });
  });

  it('returns zero similarity when users share no visible Parallels', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: '1' },
      { id: '2' },
    ]);

    prisma.userParallel.findMany.mockResolvedValue([
      {
        userId: '1',
        parallelTypeId: 'builder',
        strengthPct: 80,
      },
      {
        userId: '2',
        parallelTypeId: 'gamer',
        strengthPct: 80,
      },
    ]);

    await expect(service.calculateTwinMatch('1', '2')).resolves.toEqual({
      userId: '2',
      similarityScore: 0,
      sharedParallelTypeIds: [],
    });
  });

  it('rejects calculating a Twin match for the same user', async () => {
    await expect(service.calculateTwinMatch('1', '1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects a Twin match when either user does not exist', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: '1' }]);

    await expect(service.calculateTwinMatch('1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns Twin matches with the other user first', async () => {
    prisma.twin = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'twin-1',
          userAId: '1',
          userBId: '2',
          sharedParallelTypeIds: ['builder'],
          similarityScore: 90,
          computedAt: new Date('2026-09-14T10:00:00.000Z'),
          userA: {
            id: '1',
            username: 'alex',
            email: 'a@example.com',
            passwordHash: 'x',
            avatarUrl: null,
            bio: null,
          },
          userB: {
            id: '2',
            username: 'sam',
            email: 's@example.com',
            passwordHash: 'x',
            avatarUrl: null,
            bio: 'builder',
          },
        },
      ]),
    };

    await expect(service.getTwinMatches('1')).resolves.toEqual([
      {
        id: 'twin-1',
        user: {
          id: '2',
          username: 'sam',
          avatarUrl: null,
          bio: 'builder',
        },
        similarityScore: 90,
        sharedParallelTypeIds: ['builder'],
        computedAt: '2026-09-14T10:00:00.000Z',
      },
    ]);

    expect(prisma.twin.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userAId: '1' },
          { userBId: '1' },
        ],
      },
      orderBy: {
        similarityScore: 'desc',
      },
      include: {
        userA: true,
        userB: true,
      },
    });
  });

  it('finds users with visible Parallels as Twin candidates', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-a' },
      { id: 'user-b' },
    ]);

    await expect(service.getTwinCandidateUserIds()).resolves.toEqual([
      'user-a',
      'user-b',
    ]);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        parallels: {
          some: {
            isGhost: false,
            isHidden: false,
            dismissedAt: null,
          },
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  });

  it('saves a Twin match when similarity reaches the threshold', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-z' },
      { id: 'user-a' },
    ]);

    prisma.userParallel.findMany.mockResolvedValue([
      {
        userId: 'user-z',
        parallelTypeId: 'builder',
        strengthPct: 80,
      },
      {
        userId: 'user-a',
        parallelTypeId: 'builder',
        strengthPct: 70,
      },
    ]);

    prisma.twin.upsert.mockResolvedValue({
      similarityScore: 90,
      sharedParallelTypeIds: ['builder'],
    });

    const result = await service.saveTwinMatch('user-z', 'user-a');

    expect(result).toEqual({
      userId: 'user-a',
      similarityScore: 90,
      sharedParallelTypeIds: ['builder'],
    });

    expect(prisma.twin.upsert).toHaveBeenCalledWith({
      where: {
        userAId_userBId: {
          userAId: 'user-a',
          userBId: 'user-z',
        },
      },
      create: {
        userAId: 'user-a',
        userBId: 'user-z',
        sharedParallelTypeIds: ['builder'],
        similarityScore: 90,
      },
      update: {
        sharedParallelTypeIds: ['builder'],
        similarityScore: 90,
        computedAt: expect.any(Date),
      },
    });
  });

  it('does not save a Twin match below the threshold', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: '1' },
      { id: '2' },
    ]);

    prisma.userParallel.findMany.mockResolvedValue([
      {
        userId: '1',
        parallelTypeId: 'builder',
        strengthPct: 80,
      },
      {
        userId: '2',
        parallelTypeId: 'builder',
        strengthPct: 10,
      },
    ]);

    const result = await service.saveTwinMatch('1', '2');

    expect(result).toBeNull();
    expect(prisma.twin.upsert).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when finding a missing user by id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('strips passwordHash and email from the public representation', () => {
    const publicUser = service.toPublicUser({
      id: '1',
      email: 'a@example.com',
      username: 'alex',
      passwordHash: 'hashed',
      avatarUrl: null,
      bio: 'hi',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(publicUser).toEqual({ id: '1', username: 'alex', avatarUrl: null, bio: 'hi' });
    expect(publicUser).not.toHaveProperty('email');
    expect(publicUser).not.toHaveProperty('passwordHash');
  });
});
