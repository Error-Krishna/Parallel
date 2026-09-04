# Parallel

A social identity-discovery platform — explore different versions of yourself, not just post about one of them.

> Full product vision, feature spec, and phased build plan: [`PARALLEL_master_blueprint_final.md`](./PARALLEL_master_blueprint_final.md)
> Original concept doc: [`1788281610470_PARALLEL_source_of_truth.pdf`](./1788281610470_PARALLEL_source_of_truth.pdf)

## Stack

- **Web**: Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui + TanStack Query + Zustand
- **API**: NestJS (Fastify) + TypeScript + Prisma + PostgreSQL (pgvector) + Redis + BullMQ + Socket.IO
- **Mobile**: React Native / Expo (deferred, post-MVP)
- **Monorepo**: pnpm workspaces + Turborepo

See blueprint §10 for full reasoning and §11 for the complete folder structure.

## Getting started

### Prerequisites

- Node.js (current LTS)
- pnpm (`corepack enable` will pick up the pinned version from `package.json`)
- Docker (for local Postgres + Redis)

### Install

```bash
git clone <repo-url>
cd Parallel
pnpm install
```

### Local infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

Brings up Postgres (with pgvector) and Redis for local development.

### Database

```bash
pnpm --filter api prisma migrate dev
```

### Run the apps

```bash
pnpm --filter api start:dev     # NestJS API — http://localhost:3000 (default)
pnpm --filter web dev           # Next.js frontend — http://localhost:3000... check port if conflict, Next defaults to 3000 too
```

Run both in separate terminals during local development.

### Test

```bash
pnpm --filter api test          # API unit tests
pnpm --filter api test:e2e      # API integration tests
pnpm --filter web test          # Web component/unit tests
pnpm --filter web exec playwright test   # Web E2E
```

## Repo structure

```
apps/
  web/      Next.js frontend
  api/      NestJS backend
  mobile/   React Native (Expo) — scaffolded post-MVP
packages/
  shared-types/   shared DTOs / API contracts
  api-client/     typed API hooks
  ui/             shared design-system components
  config/         shared lint/tsconfig/tailwind config
infra/
  docker/, docker-compose.yml, github-actions/
```

## New to NestJS?

If you're building the API and haven't used NestJS before, the blueprint's Phase 4 (§16) includes a short ramp before you touch real code — four concepts (modules, controllers, services, dependency injection), a couple of docs pages, and one disposable toy module before the real thing. Worth doing before you start on `apps/api`.

## Where things are documented

- **What to build & why** → `PARALLEL_master_blueprint_final.md`, Part A
- **How it's built (stack, schema, folder structure, design system)** → same file, Part B §10–§14
- **The literal build order, phase by phase, with exit conditions** → same file, §16
- **Agent/AI coding assistant conventions** → `CLAUDE.md`, `AGENTS.md`
