// Minimal health check — verifies the API process is up and can reach Postgres + Redis.
// No @nestjs/terminus dependency yet (keep the dependency list lean at Phase 4); swap in
// Terminus later if richer health/readiness checks are needed for deployment (blueprint §17).
import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../jobs/redis.provider.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbOk ? 'ok' : 'unreachable',
        redis: redisOk ? 'ok' : 'unreachable',
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
