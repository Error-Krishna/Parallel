import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '../../../config/configuration.js';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator.js';
import { AuthService } from '../auth.service.js';

interface JwtPayload {
  sub?: unknown;
  jti?: unknown;
  exp?: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const appConfig = config.get<AppConfig>('app');

    if (!appConfig) {
      throw new Error('Application configuration is unavailable');
    }

    const { jwt } = appConfig;

    super({
      jwtFromRequest: (request) =>
        ExtractJwt.fromAuthHeaderAsBearerToken()(request) ??
        (request as typeof request & {
          cookies?: { accessToken?: string };
        }).cookies?.accessToken,
      ignoreExpiration: false,
      secretOrKey: jwt.secret,
      issuer: jwt.issuer,
      audience: jwt.audience,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return this.authService.validateTokenPayload(payload);
  }
}
