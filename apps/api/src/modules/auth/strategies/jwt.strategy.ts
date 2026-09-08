import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Redis } from 'ioredis';
import type { AppConfig } from '../../../config/configuration.js';
import { REDIS_CLIENT } from '../../../jobs/redis.provider.js';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator.js';

interface JwtPayload {
  sub?: unknown;
  jti?: unknown;
  exp?: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const appConfig = config.get<AppConfig>('app');

    if (!appConfig) {
      throw new Error('Application configuration is unavailable');
    }

    const { jwt } = appConfig;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.secret,
      issuer: jwt.issuer,
      audience: jwt.audience,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (
      typeof payload.sub !== 'string' ||
      payload.sub.trim().length === 0
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    if (
      typeof payload.jti !== 'string' ||
      payload.jti.trim().length === 0
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    if (
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp)
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    try {
      const revoked = await this.redis.exists(`auth:revoked:${payload.jti}`);

      if (revoked === 1) {
        throw new UnauthorizedException('Token has been revoked');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Authentication service is temporarily unavailable',
      );
    }

    return {
      id: payload.sub,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
