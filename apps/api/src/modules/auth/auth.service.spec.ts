import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '../../jobs/redis.provider.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; toPublicUser: ReturnType<typeof vi.fn> };

  const fakeUser = {
    id: '1',
    email: 'a@example.com',
    username: 'alex',
    passwordHash: '', // set per-test below
    avatarUrl: null,
    bio: null,
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      toPublicUser: vi.fn((u) => ({ id: u.id, username: u.username, avatarUrl: u.avatarUrl, bio: u.bio })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: { sign: vi.fn(() => 'fake.jwt.token') } },
        {
          provide: REDIS_CLIENT,
          useValue: {
            set: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('signs up a new user and returns a token', async () => {
    usersService.create.mockResolvedValue({ ...fakeUser, passwordHash: 'irrelevant' });

    const result = await service.signup({ email: 'a@example.com', username: 'alex', password: 'password123' });

    expect(result.accessToken).toBe('fake.jwt.token');
    expect(result.user.username).toBe('alex');
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@example.com', username: 'alex' }),
    );
  });

  it('logs in with correct credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    usersService.findByEmail.mockResolvedValue({ ...fakeUser, passwordHash });

    const result = await service.login({ email: 'a@example.com', password: 'correct-password' });

    expect(result.accessToken).toBe('fake.jwt.token');
  });

  it('rejects login with the wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    usersService.findByEmail.mockResolvedValue({ ...fakeUser, passwordHash });

    await expect(service.login({ email: 'a@example.com', password: 'wrong-password' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects login for a nonexistent email with the same error as a wrong password', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(service.login({ email: 'nobody@example.com', password: 'anything' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
