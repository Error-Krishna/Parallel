import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import type { PublicUser } from '@parallel/shared-types';
import { UsersService } from '../users/users.service.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { REDIS_CLIENT } from '../../jobs/redis.provider.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { AppConfig } from '../../config/configuration.js';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  private readonly bcryptSaltRounds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    // Configurable so CI/test envs can lower it for speed via BCRYPT_SALT_ROUNDS —
    // the in-source default must stay at the real production value (12) regardless.
    this.bcryptSaltRounds = this.configService.get<AppConfig>('app')!.bcryptSaltRounds;
  }

  async signup(dto: SignupDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);

    const user = await this.usersService.create({
      email,
      username,
      passwordHash,
    });

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.usersService.findByEmail(email);

    // Deliberately the same error for "no such email" and "wrong password" — never
    // reveal which one was wrong (standard auth hygiene, prevents email enumeration).
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResult(user);
  }

  // Real server-side revocation: blocklist this specific token's `jti` in Redis for
  // exactly as long as it would otherwise remain valid. JwtStrategy checks this key
  // on every subsequent request (see strategies/jwt.strategy.ts) — this is what makes
  // a stolen-but-logged-out token actually stop working instead of staying valid
  // until natural expiry.
  async logout(user: AuthenticatedUser): Promise<void> {
    const remainingSeconds = user.exp - Math.floor(Date.now() / 1000);

    if (remainingSeconds <= 0) {
      return;
    }

    await this.redis.set(`auth:revoked:${user.jti}`, '1', 'EX', remainingSeconds);
  }

  private buildAuthResult(user: User): AuthResult {
    // Deliberately just `sub` + `jti` — no username (see AuthenticatedUser's doc
    // comment for why a mutable field doesn't belong in a token's identity claim).
    // `jti` (JWT ID) is what logout() above revokes — without a per-token identifier,
    // revocation could only ever blocklist a whole user, not a single session.
    const accessToken = this.jwtService.sign({
      sub: user.id,
      jti: randomUUID(),
    });

    return {
      user: this.usersService.toPublicUser(user),
      accessToken,
    };
  }
}
