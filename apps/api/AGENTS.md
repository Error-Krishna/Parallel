# AGENTS.md — apps/api

Agent instructions for the NestJS backend. See root `AGENTS.md` for repo-wide rules; this file is API-specific.

## Commands

```bash
pnpm --filter api start:dev        # watch mode
pnpm --filter api build
pnpm --filter api lint             # oxlint
pnpm --filter api test             # vitest, unit
pnpm --filter api test:e2e         # vitest, integration — needs Postgres/Redis running
pnpm --filter api prisma migrate dev   # apply schema changes locally
pnpm --filter api prisma studio        # inspect DB
```

## Rules specific to this app

- Add new domains as a module under `src/modules/<name>/` following the existing module/controller/service/DTO pattern — don't bypass it for "quick" endpoints.
- Controllers stay thin. If you find business logic in a controller, move it to the service.
- All Prisma access goes through the shared `PrismaService`, not `new PrismaClient()` scattered around modules.
- Background/async work (embedding generation, identity re-scoring, Wrapped generation, notification fan-out) goes through BullMQ processors in `src/jobs/`, not inline in a request handler.
- Anthropic API calls (`@anthropic-ai/sdk`) happen inside jobs, never inside a synchronous controller path.
- Every new public endpoint needs: a `class-validator` DTO, an auth guard where appropriate, and rate limiting — check `common/guards` and `common/interceptors` before writing a new one from scratch.
- Test framework is **Vitest**, not Jest — match existing `*.spec.ts` conventions in the repo.
- Schema changes go through a Prisma migration (`prisma migrate dev`), committed alongside the code that needs it — never hand-edit the database.
