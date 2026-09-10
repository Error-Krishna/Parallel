import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import configuration from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { RedisProviderModule } from './jobs/redis.provider.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { OnboardingModule } from './modules/onboarding/onboarding.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    DatabaseModule,
    JobsModule,
    RedisProviderModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OnboardingModule,
    // Feature modules land here as they're built (blueprint §16):
    // IdentityEngineModule, ParallelsModule, QuestsModule, FeedModule,
    // SocialModule, CommunitiesModule, EventsModule, WrappedModule, CardsModule,
    // NotificationsModule, AdminModule.
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
