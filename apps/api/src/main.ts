// Boots the API on Fastify (only @nestjs/platform-fastify is installed — no Express
// fallback, so the adapter must be passed explicitly here).
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { MIN_JWT_SECRET_LENGTH, type AppConfig } from './config/configuration.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const { port, corsOrigin, jwt } = config.get<AppConfig>('app')!;

  // Fail fast rather than silently signing tokens with an empty or placeholder
  // secret — this would otherwise only surface as a security problem, not a
  // startup error, which is far worse to discover late.
  if (!jwt.secret || jwt.secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is missing or too short (must be at least ${MIN_JWT_SECRET_LENGTH} characters). ` +
        'Set a strong value in apps/api/.env before starting the server.',
    );
  }

  app.enableCors({ origin: corsOrigin, credentials: true });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Lets Nest respond to SIGTERM/SIGINT by calling app.close(), which in turn runs
  // onModuleDestroy() on every provider that implements it (PrismaService,
  // RedisClientService — see jobs/redis.provider.ts) instead of the process dying
  // with open DB/Redis connections still attached.
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`Parallel API listening on http://localhost:${port}`);
}

await bootstrap();
