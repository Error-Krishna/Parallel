import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter.js';

// Builds the app the same way main.ts's bootstrap() does — Fastify adapter, URI
// versioning, the global ValidationPipe, and AllExceptionsFilter — so e2e tests
// exercise the real request pipeline instead of a bare TestingModule default
// (which is what the original stale app.e2e-spec.ts did, and why it silently
// tested nothing real: no Fastify adapter, no /v1 prefix, no filters).
//
// Keep this in sync with main.ts by hand — it's the one place e2e setup and
// production bootstrap can drift if main.ts changes and this doesn't.
export async function createTestApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  // Fastify requires an explicit ready() before its underlying server is safe to
  // hand to supertest — app.init() alone isn't enough for the Fastify adapter.
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

// supertest needs the raw Node HTTP server, not the Nest/Fastify app wrapper.
export function getHttpServer(app: NestFastifyApplication) {
  return app.getHttpAdapter().getInstance().server;
}
