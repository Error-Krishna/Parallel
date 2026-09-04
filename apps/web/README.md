# Parallel — Web

Next.js (App Router) frontend for Parallel. See the repo root [`README.md`](../../README.md) and [`PARALLEL_master_blueprint_final.md`](../../PARALLEL_master_blueprint_final.md) for full context.

## Run locally

```bash
pnpm install         # from repo root
pnpm --filter web dev
```

Requires `apps/api` running locally (and its Postgres/Redis via `infra/docker-compose.yml`) for anything beyond static marketing pages — the app talks to the NestJS API through `packages/api-client`.

## Structure

See `CLAUDE.md` / `AGENTS.md` in this folder for the detailed layout and conventions (Server vs. Client Components, feature folders, design system notes).

## Scripts

| Command                                  | Purpose                       |
| ---------------------------------------- | ----------------------------- |
| `pnpm --filter web dev`                  | Start dev server              |
| `pnpm --filter web build`                | Production build              |
| `pnpm --filter web lint`                 | Lint                          |
| `pnpm --filter web test`                 | Unit/component tests (Vitest) |
| `pnpm --filter web exec playwright test` | End-to-end tests              |
