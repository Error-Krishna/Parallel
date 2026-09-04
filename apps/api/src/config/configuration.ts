// Typed application configuration, loaded via @nestjs/config.
// Add new env-driven settings here rather than reading process.env directly in modules —
// keeps every config value validated and typed in one place.

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  anthropicApiKey?: string;
  embeddingApiKey?: string;
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
      expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    },
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    embeddingApiKey: process.env.EMBEDDING_API_KEY,
  },
});
