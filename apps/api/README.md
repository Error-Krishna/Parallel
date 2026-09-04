# Parallel — API

NestJS (Fastify) backend for Parallel. See the repo root [`README.md`](../../README.md) and [`PARALLEL_master_blueprint_final.md`](../../PARALLEL_master_blueprint_final.md) for full context.

This is the system of record for all business logic: auth, the Identity Engine, Quests, Social, real-time, and the AI/growth jobs (Wrapped, Identity Cards, Quest generation). The Next.js frontend (`apps/web`) calls this API — it does not reimplement logic itself.

## Run locally

```bash
pnpm install                                        # from repo root
docker compose -f ../../infra/docker-compose.yml up -d   # Postgres (pgvector) + Redis
pnpm --filter api prisma migrate dev
pnpm --filter api start:dev
```

## New to NestJS?

See the root `README.md`'s "New to NestJS?" section and `CLAUDE.md` in this folder — there's a short concept ramp (modules, controllers, services, dependency injection) worth doing before diving into `src/modules/`.

## Structure

See `CLAUDE.md` / `AGENTS.md` in this folder for the module layout and conventions.

## Scripts

| Command                                | Purpose                                          |
| -------------------------------------- | ------------------------------------------------ |
| `pnpm --filter api start:dev`          | Start in watch mode                              |
| `pnpm --filter api build`              | Production build                                 |
| `pnpm --filter api lint`               | Lint (oxlint)                                    |
| `pnpm --filter api test`               | Unit tests (Vitest)                              |
| `pnpm --filter api test:e2e`           | Integration tests — needs Postgres/Redis running |
| `pnpm --filter api prisma migrate dev` | Apply schema migrations                          |
| `pnpm --filter api prisma studio`      | Inspect the database                             |
