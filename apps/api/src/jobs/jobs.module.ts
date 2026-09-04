// Root BullMQ connection, shared by every queue/processor added in later phases
// (embedding generation, identity re-scoring, Wrapped generation, notification fan-out —
// see blueprint §16 Phase 6/9). Import this once in AppModule; individual feature modules
// register their own queues with BullModule.registerQueue({ name: '...' }) and get this
// connection for free.
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { redisUrl } = config.get<AppConfig>('app')!;
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
