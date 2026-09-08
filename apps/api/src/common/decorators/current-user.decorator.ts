import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

// JwtStrategy's validate() (see modules/auth/strategies/jwt.strategy.ts) attaches this
// shape to request.user for every request that passes JwtAuthGuard. Custom param
// decorators are how NestJS lets a controller pull something off the request without
// repeating `req.user` boilerplate in every handler — this is the pattern to reuse for
// any other cross-cutting piece of request data.
//
// Deliberately just `id` — username (or any other mutable profile field) doesn't
// belong in a token's identity claim: a user can rename themselves, and a token
// issued before the rename would otherwise carry a stale username for its entire
// remaining lifetime. Look up anything beyond `id` via UsersService when needed.
export interface AuthenticatedUser {
  id: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthenticatedUser }>();
  return request.user;
});
