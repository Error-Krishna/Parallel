import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../../jobs/redis.provider.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; toPublicUser: ReturnType<typeof vi.fn> };
  let jwtService: { sign: ReturnType<typeof vi.fn>; verifyAsync: ReturnType<typeof vi.fn> };
  let redis: { set: ReturnType<typeof vi.fn>; exists: ReturnType<typeof vi.fn> };

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

    jwtService = {
      sign: vi.fn(() => 'fake.jwt.token'),
      verifyAsync: vi.fn(),
    };

    redis = {
      set: vi.fn(),
      exists: vi.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        // Low salt rounds here (4, not the production default of 12) purely so this
        // unit test's own bcrypt.hash() calls stay fast — never do this by editing
        // AuthService's own default, only by overriding the mocked config value.
        { provide: ConfigService, useValue: { get: vi.fn(() => ({ bcryptSaltRounds: 4 })) } },
        {
          provide: REDIS_CLIENT,
          useValue: redis,
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
    const passwordHash = await bcrypt.hash('correct-password', 4);
    usersService.findByEmail.mockResolvedValue({ ...fakeUser, passwordHash });

    const result = await service.login({ email: 'a@example.com', password: 'correct-password' });

    expect(result.accessToken).toBe('fake.jwt.token');
  });

  it('rejects login with the wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
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

  describe('verifyToken & validateTokenPayload', () => {
    it('successfully verifies and validates an unrevoked token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-42',
        jti: 'jti-valid',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const user = await service.verifyToken('valid.jwt.token');

      expect(user).toEqual({
        id: 'user-42',
        jti: 'jti-valid',
        exp: expect.any(Number),
      });
      expect(redis.exists).toHaveBeenCalledWith('auth:revoked:jti-valid');
    });

    it('rejects empty or whitespace token', async () => {
      await expect(service.verifyToken('')).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyToken('   ')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects expired token', async () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      jwtService.verifyAsync.mockRejectedValue(error);

      await expect(service.verifyToken('expired.token')).rejects.toThrow('Token has expired');
    });

    it('rejects malformed token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.verifyToken('malformed.token')).rejects.toThrow('Invalid token');
    });

    it('rejects revoked token when Redis reports revoked=1', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-42',
        jti: 'jti-revoked',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      redis.exists.mockResolvedValue(1);

      await expect(service.verifyToken('revoked.jwt.token')).rejects.toThrow('Token has been revoked');
    });

    it('rejects token missing sub claim', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        jti: 'jti-nosub',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      await expect(service.verifyToken('token.nosub')).rejects.toThrow('Invalid token');
    });

    it('rejects token missing jti claim', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-nojti',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      await expect(service.verifyToken('token.nojti')).rejects.toThrow('Invalid token');
    });

    it('rejects token missing exp claim', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-noexp',
        jti: 'jti-noexp',
      });

      await expect(service.verifyToken('token.noexp')).rejects.toThrow('Invalid token');
    });
  });
});
