import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_METADATA_KEY,
  RedisRateLimitGuard,
  type RateLimitOptions,
} from './rate-limit.guard.js';

function createHttpContext(
  request: Record<string, unknown>,
  headerSpy: ReturnType<typeof vi.fn>,
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ header: headerSpy }),
    }),
  } as unknown as ExecutionContext;
}

describe('RedisRateLimitGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let redis: {
    incr: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    ttl: ReturnType<typeof vi.fn>;
  };
  let guard: RedisRateLimitGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    redis = {
      incr: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
    };
    guard = new RedisRateLimitGuard(
      reflector as unknown as Reflector,
      redis as never,
    );
  });

  it('allows requests when no @RateLimit metadata is set', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const header = vi.fn();

    const allowed = await guard.canActivate(
      createHttpContext({ ip: '127.0.0.1' }, header),
    );

    expect(allowed).toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('increments Redis counter, sets expiry on first hit, and attaches rate-limit headers', async () => {
    const options: RateLimitOptions = {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: 'auth:login',
    };
    reflector.getAllAndOverride.mockReturnValue(options);
    redis.incr.mockResolvedValue(1);
    const header = vi.fn();

    const allowed = await guard.canActivate(
      createHttpContext(
        {
          ip: '10.0.0.1',
          headers: { 'x-forwarded-for': '203.0.113.5' },
        },
        header,
      ),
    );

    expect(allowed).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      RATE_LIMIT_METADATA_KEY,
      expect.any(Array),
    );
    // Uses request.ip, not spoofable x-forwarded-for
    expect(redis.incr).toHaveBeenCalledWith('ratelimit:auth:login:ip:10.0.0.1');
    expect(redis.expire).toHaveBeenCalledWith(
      'ratelimit:auth:login:ip:10.0.0.1',
      60,
    );
    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    expect(header).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
  });

  it('keys authenticated requests by user id and skips redundant expire calls', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      limit: 10,
      windowSeconds: 60,
      keyPrefix: 'cards:create',
    });
    redis.incr.mockResolvedValue(3);
    const header = vi.fn();

    const allowed = await guard.canActivate(
      createHttpContext({ ip: '10.0.0.1', user: { id: 'user-42' } }, header),
    );

    expect(allowed).toBe(true);
    expect(redis.incr).toHaveBeenCalledWith(
      'ratelimit:cards:create:user:user-42',
    );
    expect(redis.expire).not.toHaveBeenCalled();
    expect(header).toHaveBeenCalledWith('X-RateLimit-Remaining', 7);
  });

  it('rejects requests exceeding the limit with 429 Too Many Requests and Retry-After header', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      limit: 5,
      windowSeconds: 60,
      keyPrefix: 'auth:login',
    });
    redis.incr.mockResolvedValue(6);
    redis.ttl.mockResolvedValue(42);
    const header = vi.fn();

    await expect(
      guard.canActivate(createHttpContext({ ip: '10.0.0.9' }, header)),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    try {
      await guard.canActivate(createHttpContext({ ip: '10.0.0.9' }, header));
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    expect(header).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    expect(header).toHaveBeenCalledWith('Retry-After', 42);
  });
});
