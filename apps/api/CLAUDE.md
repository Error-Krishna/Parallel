# CLAUDE.md — apps/api

NestJS backend for Parallel. Root-level conventions in `../../CLAUDE.md` apply here too — this file adds API-specific detail. **The person building this is new to NestJS** — favor explicit, well-commented code over clever abstractions, and name the pattern (module/controller/service/DI) when it's non-obvious why something is structured the way it is.

## Structure (blueprint §11)

```
src/
  modules/
    auth/
    users/
    onboarding/
    identity-engine/    scoring, embeddings, evolution, hidden parallels — the product's core differentiator
    parallels/            "enter a parallel" context system
    quests/               challenges + streaks
    feed/
    social/                follows, people discovery, twin matching
    communities/
    events/                real-world discovery
    wrapped/
    cards/                 identity card generation (rendered, shareable)
    notifications/
    admin/
  common/                  guards, interceptors, pipes, decorators shared across modules
  config/
  database/                Prisma module + migrations live under ../prisma at app root
  jobs/                    BullMQ processors
  websockets/
  main.ts
  app.module.ts
```

Each module under `modules/` owns its own controllers, services, DTOs, and tests — don't extract a global `services/` or `controllers/` folder. Controllers stay thin (routing + validation only); services hold the actual logic and data access.

## Module pattern (for reference while learning NestJS)

```
modules/quests/
  quests.module.ts       # wires controller + service + any providers together, declared as a NestJS @Module
  quests.controller.ts   # @Controller() — routes, request/response shape, calls into the service
  quests.service.ts      # @Injectable() — the actual logic; gets injected into the controller's constructor
  dto/                    # class-validator DTOs for request bodies
  quests.service.spec.ts # unit test for the service
```

The controller never talks to Prisma directly — it calls the service, the service calls Prisma (via the shared `PrismaService` from `database/`).

## Things that are non-negotiable per the blueprint

- **Identity Engine jobs run in the background (BullMQ), not inline on the request path.** Recomputing `strength_pct`, generating embeddings, and detecting new Parallels are all async jobs (§13, §16 Phase 6).
- **Every AI-generated suggestion needs an explainable "why."** When the identity-engine or quests module calls Claude to generate a description, store and surface the reasoning — never a bare score (§18, §22).
- **New Parallel discoveries default to `is_ghost = true`** until the user explicitly makes them public (§4.5, §22).
- **Rate limiting and input validation are required on every public endpoint**, not just the ones that "need" it — use Redis-backed rate limiting and `class-validator` DTOs consistently (§10.2, Phase 10 Hardening).
- **No synchronous chat endpoint.** The Anthropic SDK is called from BullMQ processors (`jobs/`), not from a controller handling a live user request.

## Testing

This scaffold uses **Vitest** (see `apps/api/package.json` — `test`, `test:e2e` scripts), not Jest, despite the blueprint's original Jest suggestion — use Vitest conventions here. Integration tests (`test:e2e`) should run against real Postgres/Redis (via `infra/docker-compose.yml` or CI service containers), not mocks, per blueprint §15.
