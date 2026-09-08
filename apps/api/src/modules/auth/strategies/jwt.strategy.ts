import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '../../../config/configuration.js';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator.js';

interface JwtPayload {
  sub: string;
}

// Passport strategies are how NestJS's auth guards actually verify a token: this
// class tells passport-jwt *how* to extract and verify the token (via the constructor
// config below), and *what to attach to the request* once it's verified (the return
// value of validate() becomes `request.user` — see CurrentUser decorator).
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const { jwt } = config.get<AppConfig>('app')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.secret,
      // Rejects a token that's structurally valid and correctly signed but wasn't
      // actually meant for this app (e.g. issued by a different environment sharing
      // an accidentally-reused secret) — an extra check beyond the signature alone.
      issuer: jwt.issuer,
      audience: jwt.audience,
    });
  }

  // Called automatically once the token's signature, expiry, issuer, and audience all
  // check out. Kept deliberately thin — a DB lookup here would run on every single
  // authenticated request; the token payload already has everything CurrentUser needs.
  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub };
  }
}
