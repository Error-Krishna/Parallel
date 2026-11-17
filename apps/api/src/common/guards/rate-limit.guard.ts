import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../jobs/redis.provider.js';

export const RATE_LIMIT_METADATA_KEY = 'parallel:rate_limit';

export interface RateLimitOptions {
  /** Maximum requests allowed within `windowSeconds`. */
  limit: number;
  /** Fixed window length in seconds. */
  windowSeconds: number;
  /** Logical route bucket name (e.g. 'auth:login'). */
  keyPrefix: string;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);

interface FastifyLikeRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: { id?: string };
}

interface FastifyLikeReply {
  header?: (name: string, value: string | number) => unknown;
}

/**
 * Redis-backed fixed-window rate limiter using the shared REDIS_CLIENT provider.
 * Applies only to handlers/controllers annotated with `@RateLimit(...)`.
 */
@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyLikeRequest>();
    const reply = http.getResponse<FastifyLikeReply>();

    const identifier = this.resolveIdentifier(request);
    const key = `ratelimit:${options.keyPrefix}:${identifier}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, options.windowSeconds);
    }

    const remaining = Math.max(0, options.limit - count);
    reply?.header?.('X-RateLimit-Limit', options.limit);
    reply?.header?.('X-RateLimit-Remaining', remaining);

    if (count > options.limit) {
      const ttl = await this.redis.ttl(key);
      const retryAfter = ttl > 0 ? ttl : options.windowSeconds;
      reply?.header?.('Retry-After', retryAfter);

      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveIdentifier(request: FastifyLikeRequest): string {
    if (request.user?.id) {
      return `user:${request.user.id}`;
    }

    // Use Fastify's resolved request.ip rather than raw x-forwarded-for so clients
    // cannot trivially spoof headers to bypass IP rate limits.
    return `ip:${request.ip ?? 'unknown'}`;
  }
}
