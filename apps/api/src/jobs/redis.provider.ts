// A raw ioredis client, provided via DI, for anything that needs Redis directly
// (health checks, presence, rate limiting) outside of BullMQ's own connection handling.
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '../config/configuration.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { redisUrl } = config.get<AppConfig>('app')!;
        return new Redis(redisUrl, { maxRetriesPerRequest: null });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisProviderModule {}
