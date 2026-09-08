import { Global, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '../config/configuration.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

// Extending Redis directly (rather than a factory returning a plain `new Redis(...)`)
// is what lets Nest's lifecycle hooks apply here — a raw ioredis instance has no
// onModuleDestroy(), so it would never get cleaned up when app.close() runs (see
// enableShutdownHooks() in main.ts). This class does.
@Injectable()
export class RedisClientService extends Redis implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const { redisUrl } = config.get<AppConfig>('app')!;
    super(redisUrl, { maxRetriesPerRequest: null });
  }

  async onModuleDestroy() {
    await this.quit();
  }
}

@Global()
@Module({
  providers: [{ provide: REDIS_CLIENT, useClass: RedisClientService }],
  exports: [REDIS_CLIENT],
})
export class RedisProviderModule {}
