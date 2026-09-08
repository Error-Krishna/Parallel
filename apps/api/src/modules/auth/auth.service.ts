import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import type { PublicUser } from '@parallel/shared-types';
import { UsersService } from '../users/users.service.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { LoginDto } from './dto/login.dto.js';

const BCRYPT_SALT_ROUNDS = 12;

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    // UsersService.create() already checks for existing email/username and throws
    // ConflictException — nothing else to duplicate here.
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
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

  private buildAuthResult(user: User): AuthResult {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      username: user.username,
    });

    return {
      user: this.usersService.toPublicUser(user),
      accessToken,
    };
  }
}
