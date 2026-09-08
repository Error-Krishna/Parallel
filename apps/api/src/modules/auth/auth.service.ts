import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

const BCRYPT_SALT_ROUNDS = 10;

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    const passwordHash = await bcrypt.hash(
      dto.password,
      BCRYPT_SALT_ROUNDS,
    );

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

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResult(user);
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    const remainingSeconds =
      user.exp - Math.floor(Date.now() / 1000);

    if (remainingSeconds <= 0) {
      return;
    }

    await this.redis.set(
      `auth:revoked:${user.jti}`,
      '1',
      'EX',
      remainingSeconds,
    );
  }

  private buildAuthResult(user: User): AuthResult {
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
