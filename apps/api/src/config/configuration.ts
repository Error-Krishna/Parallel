// Typed application configuration, loaded via @nestjs/config.
// Add new env-driven settings here rather than reading process.env directly in modules —
// keeps every config value validated and typed in one place.
import type { JwtSignOptions } from '@nestjs/jwt';
export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    secret: string;
    expiresIn: JwtSignOptions['expiresIn'];
    issuer: string;
    audience: string;
  };
  anthropicApiKey?: string;
  embeddingApiKey?: string;
  bcryptSaltRounds: number;
}

export default (): { app: AppConfig } => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3001', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    jwt: {
      secret: process.env.JWT_SECRET ?? '',
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as JwtSignOptions['expiresIn'],
      issuer: process.env.JWT_ISSUER ?? 'parallel-api',
      audience: process.env.JWT_AUDIENCE ?? 'parallel-app',
    },
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    embeddingApiKey: process.env.EMBEDDING_API_KEY,
    // 12 is the production default (current standard baseline for 2026 hardware).
    // Override to something lower (e.g. 4) only in test/CI env — never lower the
    // in-source default just to make a slow test suite feel faster.
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
  },
});

// Minimum acceptable length for JWT_SECRET — checked at startup in main.ts. Anything
// shorter is either a placeholder that was never replaced or too weak to sign real
// tokens with; refusing to boot is deliberate (fail loud at startup, not silently at
// the first forged-token attempt).
export const MIN_JWT_SECRET_LENGTH = 32;
