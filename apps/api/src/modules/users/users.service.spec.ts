import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../../database/prisma.service.js';

// PrismaService is mocked here — this is a *unit* test (fast, no real DB). Integration
// tests against a real Postgres instance belong in test:e2e (see apps/api/CLAUDE.md).
describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: Record<string, ReturnType<typeof vi.fn>> };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
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
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' }); // findByEmail hit

    await expect(
      service.create({ email: 'taken@example.com', username: 'newname', passwordHash: 'x' }),
    ).rejects.toThrow(ConflictException);
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
