# AGENTS.md — Parallel

Instructions for any AI coding agent (Claude Code, Cursor, Codex, Copilot Workspace, etc.) operating in this repository. This file follows the general `AGENTS.md` convention so any agent, not just Claude, picks it up. Claude-specific detail lives in `CLAUDE.md`; the two should never contradict each other.

## Project summary

Parallel — a social identity-discovery platform. Full spec: `PARALLEL_master_blueprint_final.md` at repo root. Read it before proposing product or architecture changes. Original vision doc: `1788281610470_PARALLEL_source_of_truth.pdf`.

## Repo layout

```
apps/
  web/      Next.js frontend (App Router)
  api/      NestJS backend
  mobile/   React Native/Expo — not yet scaffolded, post-MVP
packages/
  shared-types/   DTOs and API contracts shared across apps
  api-client/     typed API hooks generated/maintained from shared-types
  ui/             shared design-system components
  config/         shared eslint/tsconfig/tailwind config
infra/
  docker/, docker-compose.yml, github-actions/
docs/ (create as needed)
  adr/            architecture decision records
```

## Setup / run commands

```bash
pnpm install                    # from repo root, installs all workspaces
docker compose -f infra/docker-compose.yml up -d   # Postgres (pgvector) + Redis
pnpm --filter api prisma migrate dev   # apply DB schema
pnpm --filter api start:dev     # run NestJS in watch mode
pnpm --filter web dev           # run Next.js dev server
```

## Commands to run before finishing a task

```bash
pnpm --filter api lint && pnpm --filter api test
pnpm --filter web lint && pnpm --filter web test
```

Run `test:e2e` (api) or Playwright (web) for anything touching a critical user path (onboarding, Parallel switch, Identity Engine scoring).

## Ground rules

- **Don't add new top-level dependencies or services without checking the blueprint's tech stack (§10) first.** The stack is intentionally locked: Next.js + NestJS/Fastify + Prisma/PostgreSQL(+pgvector) + Redis/BullMQ + Socket.IO. Propose changes via an ADR (`docs/adr/`) rather than silently introducing a new library/service.
- **Feature-module structure is mandatory** in `apps/api/src/modules/*` — controllers stay thin, services hold logic, DTOs/tests live alongside. Mirror that instinct in `apps/web/src/features/*`.
- **No synchronous AI/chat surface.** Claude API calls (identity descriptions, Quest generation, Wrapped copy) run as background jobs (BullMQ), never as an in-request chat endpoint — this product is explicitly not "an AI chatbot with a social feed" (blueprint §18).
- **Privacy defaults are non-negotiable**: new Parallel discoveries default to Ghost Mode (private) until the user opts to make them public; every suggestion needs a plain-language "why" (blueprint §22).
- **Tone**: product copy is playful, never clinical/therapy-toned. No "score," "test," "diagnosis" framing.
- The person maintaining this repo is new to NestJS — prefer explicit, well-commented backend code over clever/implicit patterns, and call out non-obvious NestJS conventions inline.

## Where to look before asking

- Product/feature questions → `PARALLEL_master_blueprint_final.md`, Part A.
- Architecture/stack/folder questions → same file, Part B (§10–§14).
- "What phase are we in / what's next" → §16 (Development Phases), each with an explicit exit condition.
- Schema questions → §13.
