# CLAUDE.md — Parallel

Guidance for Claude (Claude Code / any Claude-based coding agent) working in this repository.

## What this project is

Parallel is a social identity-discovery platform — not "Instagram with multiple accounts." The core product is helping users discover, explore, and evolve different versions of themselves ("Parallels"); feeds, people, communities, and real-world activities all support that core loop. The full product and engineering spec lives in **`PARALLEL_master_blueprint_final.md`** at the repo root — read it before making any non-trivial product or architecture decision. If a change doesn't trace back to that document's core thesis (identity discovery, exploration, identity-based connection, or the evolve loop), treat it as optional, not core.

## Source of truth hierarchy

1. `PARALLEL_master_blueprint_final.md` — product vision, feature spec, phased build plan, schema outline, design direction. This wins on _what_ to build and _why_.
2. This file (`CLAUDE.md`) and the per-app `CLAUDE.md` files — _how_ to work in the codebase day to day.
3. `docs/adr/` (create as needed) — architecture decision records for anything that deviates from or extends the blueprint. If you make a non-obvious architectural call, write a short ADR rather than only leaving it in code.

Keep all of these in sync. If you implement something that contradicts the blueprint, either fix the code or update the blueprint — don't let them drift silently.

## Tech stack (locked — see blueprint §10)

- **Frontend (`apps/web`)**: Next.js 16 (App Router), React 19, TypeScript, TanStack Query, Zustand, Tailwind CSS 4, Framer Motion, shadcn/ui.
- **Backend (`apps/api`)**: NestJS 12 on the Fastify adapter, TypeScript, Prisma + PostgreSQL (pgvector extension), Redis + BullMQ (jobs), Socket.IO (real-time), `@anthropic-ai/sdk` (identity descriptions, Quest generation, Wrapped copy — always async/background, never a synchronous chat surface).
- **Mobile (`apps/mobile`)**: React Native / Expo — deferred, scaffold only until Phase 12+.
- **Shared (`packages/`)**: `shared-types` (DTOs/API contracts), `api-client` (typed hooks over the API), `ui` (shared design-system components), `config` (eslint/tsconfig/tailwind presets).
- Package manager is **pnpm** with workspaces (`pnpm-workspace.yaml`). Use `pnpm --filter <app>` for per-app commands from the root, or `cd` into the app.

## The person building this is new to NestJS

Be extra explicit when writing or explaining backend code: name the four core concepts as you use them (module, controller, service, dependency injection), keep controllers thin (routing + validation only, no business logic), and prefer small, well-commented services over clever abstractions. Don't assume familiarity with decorators or DI conventions — a one-line "why" comment on non-obvious NestJS patterns (guards, pipes, custom providers) is worth including.

## Architectural conventions

- **Feature-first modules, not layer-first.** Inside `apps/api/src/modules/`, each feature (auth, identity-engine, parallels, quests, social, wrapped, cards, etc. — see blueprint §11) owns its own controllers, services, DTOs, and tests together. Don't introduce a global `services/` or `controllers/` folder.
- **NestJS is the system of record.** Business logic, the Identity Engine, auth, and real-time all live in `apps/api`. Next.js Route Handlers (`apps/web/src/app/api/`) are for thin edge concerns only (OG-image generation, webhook receivers) — never reimplement backend logic there.
- **Ghost Mode and privacy defaults are not optional.** Any new "discover a Parallel" or "What If" code path defaults new discoveries to `is_ghost = true` and must be explainable (blueprint §22 / §18 — no opaque scoring, always a plain-language "why").
- **Copy tone matters.** No clinical/therapy language ("your journey," "your authentic self," "score," "test," "result" as measurement). See blueprint §6.

## Testing (see blueprint §15)

- Backend: Vitest (this scaffold uses Vitest, not Jest, for `apps/api` — check `apps/api/package.json` before assuming Jest) for unit tests, plus `test:e2e` for integration coverage against real Postgres/Redis service containers.
- Frontend: Vitest + Testing Library for components, Playwright for the critical-path E2E flow (sign up → onboarding → map → enter a Parallel → complete a challenge → see evolution).
- Don't merge a feature module without at least one test file alongside it in the same module folder.

## Before you start coding in a new area

1. Check which Phase (blueprint §16) the work belongs to, and don't jump ahead of its exit condition without a good reason.
2. Check `packages/shared-types` first — if the DTO/type you need should be shared between `web` and `api`, define it there, not locally in one app.
3. Run `pnpm lint` and the relevant `pnpm test` before considering a change done.
