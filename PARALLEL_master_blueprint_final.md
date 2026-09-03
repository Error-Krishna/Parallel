# PARALLEL — Master Blueprint (Final)
### From Idea to Production: Product, Design, Engineering & Delivery Plan
*Revised and expanded from "Source of Truth v1.0" • Finalized September 2026*

---

## How to read this document

This is the single reference for building Parallel end to end. It is split into two halves:

- **Part A — The Product** (sections 1–9): the revised thesis, the sharpened feature set, and new mechanics designed specifically to make the app addictive and shareable for a Gen Z audience.
- **Part B — The Build** (sections 10–20): the literal, sequential journey from an empty folder to a deployed, tested, monitored production app — tech stack, dependencies, folder structure, schema, design system, phased engineering plan, testing strategy, CI/CD and deployment, with current (2026) industry best practices woven in.

Nothing here is meant to replace your judgment — treat it as a working document. Update it as decisions get made; that's what a source of truth is for.

---

## PART A — THE PRODUCT

## 1. Refined Thesis

Your original thesis is strong and worth keeping word-for-word: **Parallel is not Instagram with multiple accounts — it's a social discovery platform for exploring different versions of yourself.** That single sentence is your north star and your pitch. Everything below either sharpens it or adds a mechanic that makes it stickier for the audience you're chasing.

The one addition worth making explicit: **identity in Parallel is playful, not clinical.** Every screen, label, and animation should feel like a game you're playing with yourself, not a personality test. That distinction is what separates you from MBTI-core apps and keeps the tone Gen Z will actually engage with — curious and a little chaotic, never therapist-y.

## 2. What Changed and Why

A short list of edits to the original 29-point vision, each with the reasoning:

| # | Original | Revision | Why |
|---|----------|----------|-----|
| 5 | Static percentage map (Builder 42%, etc.) | Add **momentum arrows** (↑↓) next to each percentage, updated weekly | Static numbers are a screenshot once, then forgotten. Momentum is what makes people check back. |
| 9 | Identity Experiments (single challenges) | Chain challenges into **Quests** with streaks and unlockables | A one-off challenge has no retention hook. A streak does — it's the single most proven Gen Z engagement mechanic (Duolingo, Snapchat). |
| 14 | Identity Evolution (monthly/yearly view) | Rebrand as **"Parallel Wrapped"** — a Spotify-Wrapped-style shareable recap, monthly and end-of-year | Borrowing a format Gen Z already associates with fun, shareable self-discovery massively lowers the "what is this" explanation cost. |
| 16 | Friends, Comparisons & Parallel Twin | Add **Parallel Roulette** — an opt-in, low-stakes way to get matched with a stranger who shares an unusual intersection, for a time-boxed chat | Comparison alone is passive. A live, low-commitment connection mechanic is what actually converts curiosity into usage. |
| 17 | Real-World Discovery | Add **Collab Parallels** — two friends can temporarily merge Parallels for a duo challenge or event | Doing identity exploration *with* someone is more fun and more shareable than doing it alone. |
| — | (new) | **Ghost Mode** — explore a brand-new or "What If" Parallel privately before it appears on your public map | Removes the fear of "what if my followers see me exploring something embarrassing," which is a real adoption blocker for a public identity product. |
| — | (new) | **Identity Cards** — auto-generated, aesthetic, story-shaped shareable cards for each Parallel, result, or Wrapped | This is your primary organic growth loop. It needs to be a first-class, beautifully designed artifact, not an afterthought share button. |

## 3. The Sharpened User Promise

Original: *"You are more than one person."*

Keep it as the top-line brand promise. Pair it with a secondary, more actionable line for onboarding and marketing: **"Find the you that hasn't shown up yet."** The first line sells the concept; the second sells the action (open the app, do something, discover something).

## 4. New Mechanic Layer (Gen Z Engagement System)

These sit *on top of* the original 29 points — they don't replace anything, they make the existing systems more game-like and habit-forming.

### 4.1 Parallel Streaks
Each Parallel a user actively engages with (via challenges, content, or real-world check-ins) accumulates a streak counter. Streaks decay if untouched for 3+ days, with a soft warning notification ("Your Builder streak is about to end 👀"). This is the same loss-aversion loop that drives Duolingo and Snapchat retention — but scoped to *identity* instead of language or friendship, which is novel.

### 4.2 Parallel Quests
Chains of 3–5 Identity Experiments (see §9 original) that unlock a badge, a cosmetic profile frame, or a Hidden Parallel hint on completion. Quests should be authored partly by the team (curated, seasonal) and partly generated by AI based on a user's current interest cluster (§18 original — AI role).

### 4.3 Parallel Wrapped
An automatic, monthly and annual recap: biggest evolution, most explored identity, weirdest new intersection, most active streak, who your Parallel Twin was this month. Rendered as a swipeable, story-native card sequence built to be screenshotted or shared directly to Instagram/TikTok/Snap stories. This is arguably the single highest-leverage feature for organic growth — it should get disproportionate design attention.

### 4.4 Identity Cards
Every meaningful result (a new Parallel discovered, a Quest completed, a Parallel Twin match, a Wrapped recap) generates a shareable card: portrait-oriented, on-brand, minimal text, built for the sharer's ego first and product marketing second. No app UI chrome in the card — it should look like something a designer made for them personally.

### 4.5 Ghost Mode
Any "What If?" exploration (§8 original) starts in Ghost Mode by default: invisible to friends, not reflected on the public map, no notifications sent about it. The user explicitly "goes public" with a new Parallel when ready. This directly protects the vulnerable, embarrassing-to-others moment of trying something new — a real psychological barrier for a public-facing identity product.

### 4.6 Parallel Roulette
A lightweight, opt-in matching queue: pick a Parallel, get matched for a time-boxed (10–15 minute) text or voice chat with someone whose interest intersection is unusual relative to yours. Low commitment, novelty-driven, and a natural home for the "meet people through identity" pillar (§11 original) without becoming a dating app.

### 4.7 Collab Parallels
Two friends can temporarily fuse a chosen Parallel each (e.g., your Explorer + their Foodie) into a joint discovery world with a shared challenge and a shared Identity Card at the end. Built for duos, not groups — keeps it simple and personal.

### 4.8 Ambient Rooms (stretch, post-MVP)
Drop-in, live audio rooms scoped to a single Parallel ("Music Heads — Friday Night") for real-time community moments. Explicitly out of MVP scope (real-time infra heavy) but worth reserving room for in the architecture (see WebSocket plans in Part B).

## 5. Updated Core Loop

Original: *Explore → discover a self → enter that self → meet people/content → experiment → act → learn → evolve → discover another self.*

Revised with the new mechanics inserted at their natural points:

**Explore → discover a self (Ghost Mode optional) → enter that self → build a streak → complete a Quest → meet people (Roulette / Twin) or collab with a friend → act in the real world → get a Wrapped recap → share an Identity Card → evolve → discover another self.**

## 6. Tone & Voice Guidelines

- Copy should read like a sharp, funny friend, not a wellness app. Short sentences. No therapy language ("your journey," "your authentic self"). Use "you" directly and playfully.
- Percentages and labels are always framed as *play*, never as *measurement*. Avoid words like "score," "test," "result" in favor of "vibe," "read," "map."
- Never shame a user for having a small or "boring" percentage in a category. Every Parallel is framed as equally interesting.

## 7. Non-Goals (explicit, to prevent scope creep)

- Not a dating app, even though Roulette and matching exist — no swiping, no romantic framing.
- Not a mental health or personality-testing product — no MBTI/Big Five language, no clinical claims.
- Not a chatbot-first product — AI stays invisible infrastructure (§18 original), never a "talk to Parallel AI" character.
- Not a marketplace or e-commerce platform at MVP — real-world discovery (§17) links out to existing events/places, it doesn't need its own ticketing/booking system on day one.

## 8. Success Metrics (concrete, MVP-scoped)

| Metric | Why it matters | MVP target (first 100 users, 60 days) |
|---|---|---|
| D1 → D7 retention | Proves the core loop has a reason to return | ≥ 40% |
| % users who discover ≥1 unexpected Parallel in first week | Proves the "aha" (§27 original) actually lands | ≥ 60% |
| Identity Cards shared per active user / week | Proxy for organic growth loop health | ≥ 0.5 |
| Streak survival at day 7 | Proxy for habit formation | ≥ 25% of starters |
| Qualitative: "did the app surprise you about yourself?" | The real thesis test | Majority yes, in exit interviews |

## 9. Positioning Statement (final)

> Parallel is a social identity discovery platform for people who know they're more than one thing. It's not about posting your life — it's about discovering the version of you that hasn't shown up yet, and finding the people and moments that belong to it. Explore, evolve, repeat.

---

## PART B — THE BUILD

## 10. Tech Stack (final, with reasoning)

You mentioned NestJS + React as preferred — this section confirms that stack is a strong fit for 2026 and specifies the full picture around it.

### 10.1 Frontend
- **Next.js 15 (App Router) + TypeScript + React 18/19** — replaces the plain React+Vite SPA choice. Reasoning specific to this product: the Parallel Map and public Identity Card/Wrapped share pages benefit directly from Next.js's server rendering and file-based routing (fast first paint, real per-Parallel URLs, and shareable card pages that render correctly when unfurled in Instagram/TikTok/Snap link previews — something a client-only SPA can't do well). Use Server Components for read-heavy, mostly-static screens (public profile, shared Identity Card page, marketing/landing) and Client Components for the interactive core (onboarding, the Parallel switcher, Quests, Roulette).
- **NestJS stays the system of record** for all business logic, the Identity Engine, auth, and real-time — Next.js is the presentation layer, calling the NestJS API (via the shared `packages/api-client`) rather than reimplementing logic in Next.js API routes. Reserve Next.js Route Handlers only for thin edge concerns (e.g., OG-image generation for Identity Cards, webhook receivers) — keep the real backend in one place.
- **TanStack Query** — server-state caching/sync on the client side, still pairs cleanly with the NestJS API; use React Server Components for the initial data fetch on shareable/public pages and TanStack Query for everything interactive post-hydration.
- **Zustand** — lightweight local/UI state (current Parallel, Ghost Mode toggle, active streak animations) without Redux boilerplate.
- **Tailwind CSS** + **shadcn/ui** — utility-first styling with accessible, themeable primitives; shadcn's copy-in-your-repo model means full control over the identity-card and map visuals rather than fighting a component library. Both work natively with Next.js's App Router.
- **Framer Motion** — the map, the Parallel-switch transition, and streak/quest animations are core to the product feel and need real animation primitives, not CSS transitions alone; use it inside Client Components.
- **React Native (Expo)** for mobile, sharing types and API client with web — deferred to post-MVP phase but architected for from day one (see §11 API layer).

### 10.2 Backend
- **NestJS + TypeScript** — modular, DI-based structure scales cleanly as Identity Engine, Social, and Real-time domains grow independently. Controllers stay thin, orchestrating requests to services; business logic and data-source interaction live in the service layer; a repository/data-access layer abstracts persistence — following Clean Architecture, where outer layers depend on inner ones and not vice versa.
- **Fastify adapter** for NestJS (instead of default Express) — lower overhead, matches the original doc's preference.
- **PostgreSQL** — relational core (users, Parallels, challenges, communities, events).
- **pgvector extension on Postgres** — for interest-embedding similarity search (emerging-identity detection, Parallel Twin matching, recommendation). The most common production architecture in 2026 is a hybrid: PostgreSQL for transactional data, a vector store — often pgvector — for semantic retrieval, and Redis for caching. HNSW is the default index type for 2026, keeping query latency low even as the vector table grows. Running everything inside one Postgres instance also means vector embeddings live in the same transaction as the relational data they describe, and there's a single database to provision, monitor, back up and secure instead of two.
- **Redis** — caching, rate limiting, session/presence state, pub/sub for real-time features, and as the backing store for BullMQ.
- **BullMQ** — background jobs: embedding generation, identity-score recalculation, Wrapped generation, notification fan-out.
- **Socket.IO** — real-time presence, live notifications, and (post-MVP) Ambient Rooms signaling.
- **Prisma** as ORM — type-safe schema-to-TypeScript, strong migration tooling, integrates cleanly with NestJS via a custom `PrismaModule`.

### 10.3 AI / Identity Engine
- Embedding model: any current general-purpose text embedding model (OpenAI `text-embedding-3-small`, Voyage, or Cohere Embed) called at two points — ingestion (when a user interacts with content/tags) and periodically for re-scoring. Store the vector alongside the user-interest row in Postgres via pgvector rather than standing up a separate vector database — simpler ops at MVP scale, and it stays "indistinguishable in latency terms" from a dedicated vector service for any workload under roughly 50 queries per second, which comfortably covers an early-stage app.
- Claude (Anthropic API) for: identity-description generation ("why we think you might be an Urbanist"), Quest generation, and the Wrapped narrative copy — always as an async batch/background job, never a synchronous chat surface.

### 10.4 Infrastructure
- **Docker** for local dev parity and deployment images.
- **GitHub Actions** for CI/CD.
- **Turborepo** (or Nx — see §11) to manage the monorepo, cache builds, and run affected-only tests.
- **Object storage + CDN** (S3-compatible, e.g. Cloudflare R2 or AWS S3 + CloudFront) for media (identity card renders, profile images, Wrapped video/image assets).
- **Observability**: OpenTelemetry for tracing, Pino for structured logs, a hosted target (e.g. Grafana Cloud / Axiom) for metrics and log aggregation — cheap at low volume, scales later.

### 10.5 Why not microservices at MVP
A NestJS codebase is fine as a single service well past the point most teams assume it isn't — the point where structure starts to matter is around 20+ controllers or multiple contributing teams, not day one. Start modular-monolith, feature-organized, and only split into services if a specific domain (e.g., the Identity Engine, or real-time) genuinely needs independent scaling or deploy cadence. This matches the original doc's Phase 23 guidance and current practice.

## 11. Monorepo & Folder Structure

Use **Turborepo with pnpm workspaces** — lighter-weight than Nx for a small team, still gives you shared code across projects, consistent tooling, and no dependency-hell between packages. If the team grows past ~6 engineers or you split into real microservices, Nx's generators and dependency graph become worth the extra ceremony — Nx plus NestJS is a proven combination for independent deployment, builds and testing per service while sharing common infrastructure libraries like caching and persistence. Revisit that decision at Phase 7 (Social) if the backend has split into more than two deployable services.

```
parallel/
├── apps/
│   ├── web/                      # Next.js (App Router) frontend
│   │   ├── src/
│   │   │   ├── app/                # Next.js App Router: routes, layouts, route groups
│   │   │   │   ├── (marketing)/     # public landing, unauthenticated
│   │   │   │   ├── (app)/           # authenticated app shell: map, parallels, quests...
│   │   │   │   ├── card/[id]/       # public, server-rendered Identity Card share pages
│   │   │   │   ├── wrapped/[id]/    # public, server-rendered Wrapped share pages
│   │   │   │   ├── api/             # thin Route Handlers only (OG images, webhooks)
│   │   │   │   └── layout.tsx
│   │   │   ├── features/           # onboarding, map, parallels, quests, wrapped, roulette...
│   │   │   ├── components/         # shared UI (shadcn-based)
│   │   │   ├── hooks/
│   │   │   ├── stores/              # zustand stores
│   │   │   ├── lib/                  # api client, query client, utils
│   │   │   └── styles/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   └── package.json
│   ├── api/                       # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── identity-engine/    # scoring, embeddings, evolution, hidden parallels
│   │   │   │   ├── parallels/          # the "enter a parallel" context system
│   │   │   │   ├── quests/             # challenges + streaks
│   │   │   │   ├── feed/
│   │   │   │   ├── social/             # follows, people discovery, twin matching
│   │   │   │   ├── communities/
│   │   │   │   ├── events/             # real-world discovery
│   │   │   │   ├── wrapped/
│   │   │   │   ├── cards/              # identity card generation
│   │   │   │   ├── notifications/
│   │   │   │   └── admin/
│   │   │   ├── common/                 # guards, interceptors, pipes, decorators
│   │   │   ├── config/
│   │   │   ├── database/               # prisma module, migrations
│   │   │   ├── jobs/                   # BullMQ processors
│   │   │   ├── websockets/
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/
│   │   └── package.json
│   └── mobile/                    # React Native (Expo) — scaffolded, built out post-MVP
├── packages/
│   ├── shared-types/               # DTOs / API contracts shared between web, api, mobile
│   ├── ui/                         # shared design-system components (shadcn-based)
│   ├── config/                     # eslint, tsconfig, tailwind presets
│   └── api-client/                 # typed fetch/query hooks generated from shared-types
├── infra/
│   ├── docker/                     # Dockerfiles per app
│   ├── docker-compose.yml          # local dev: postgres, redis, api, web
│   └── github-actions/             # reusable workflow snippets
├── docs/
│   ├── parallel_blueprint.md       # this document, versioned
│   ├── adr/                        # architecture decision records
│   └── api/                        # OpenAPI / generated docs
├── .github/workflows/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

Key structural rule carried over from research: group by feature, not by technical layer, inside the NestJS app — each feature module owns its controllers, services, DTOs and tests together, which is what keeps a 50-controller backend navigable instead of becoming a regretted layered structure. Apply the same feature-first instinct inside `apps/web/src/features/`.

## 12. Dependencies (exact package lists)

These are the concrete packages to install at project bootstrap (Phase 4 in §16). Versions aren't pinned here since they'll drift — install `latest` at bootstrap time and let the lockfile pin it.

### 12.1 Root
```
pnpm add -D -w turbo typescript eslint prettier eslint-config-prettier husky lint-staged
```

### 12.2 `apps/web` (Next.js)
```
pnpm create next-app@latest web --typescript --tailwind --eslint --app --src-dir
pnpm add @tanstack/react-query zustand
pnpm add framer-motion lucide-react
pnpm add react-hook-form zod @hookform/resolvers
pnpm add socket.io-client axios date-fns clsx
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest
pnpm add -D playwright @playwright/test
```
`create-next-app` scaffolds Next.js, React, TypeScript, Tailwind, and ESLint together — no separate Vite/router install needed. Vitest is still used for component/unit tests (Next.js's own test runner story is thinner than Vite's), Playwright covers E2E as before.
shadcn/ui components are added individually via its CLI as needed (`pnpm dlx shadcn@latest add button card dialog ...`) rather than installed as one dependency — this keeps the bundle lean and the components fully owned/editable in-repo.

### 12.3 `apps/api` (NestJS)
```
pnpm add @nestjs/core @nestjs/common @nestjs/platform-fastify @nestjs/config
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
pnpm add @nestjs/bullmq bullmq ioredis
pnpm add @prisma/client prisma
pnpm add class-validator class-transformer
pnpm add @anthropic-ai/sdk
pnpm add pino nestjs-pino
pnpm add -D @nestjs/cli @nestjs/testing @nestjs/schematics
pnpm add -D jest ts-jest supertest @types/supertest
```

### 12.4 Infra / local dev
```
docker, docker-compose (postgres:16, redis:7, pgvector/pgvector:pg16 image or the pgvector extension enabled on the postgres image)
```

### 12.5 `apps/mobile` (deferred — Phase 12+)
```
pnpm create expo-app
pnpm add @tanstack/react-query zustand nativewind
```

## 13. Database Schema (core outline)

This is a starting schema, not the final one — expect it to evolve through Phase 3 (Architecture). It captures the entities the product actually needs.

```
users
  id, email, username, password_hash, created_at, avatar_url, bio, visibility_settings (jsonb)

onboarding_responses
  id, user_id, question_key, answer_value, created_at

interest_signals            -- the raw behavioral event log (§21 original: data flywheel)
  id, user_id, signal_type (view|like|save|search|follow|challenge_complete|...),
  target_type, target_id, weight, created_at

parallel_types               -- the catalog: Builder, Music Head, Gamer, Explorer, Urbanist...
  id, name, description, icon, is_system_generated (bool), created_by_user_id (nullable, for future user-suggested types)

user_parallels                -- a user's current map
  id, user_id, parallel_type_id, strength_pct, momentum, streak_count, streak_last_touched_at,
  is_ghost (bool), is_hidden (bool), discovered_at, embedding (vector)

parallel_evolution_snapshots   -- monthly/yearly history for Wrapped + evolution view
  id, user_id, parallel_type_id, strength_pct, captured_at

quests
  id, parallel_type_id, title, description, steps (jsonb), reward_type, reward_value, season, is_ai_generated

user_quest_progress
  id, user_id, quest_id, status, current_step, started_at, completed_at

content_items                  -- feed content per Parallel
  id, parallel_type_id, type (post|article|event|challenge_prompt), payload (jsonb), embedding (vector)

follows
  follower_id, followee_id, created_at

parallel_twins                 -- computed matches, cached
  id, user_a_id, user_b_id, shared_parallel_type_ids (jsonb), similarity_score, computed_at

communities
  id, name, description, originating_parallel_type_ids (jsonb), auto_generated (bool)

community_members
  community_id, user_id, joined_at

real_world_events
  id, parallel_type_id, title, location (postgis point), starts_at, source_url

identity_cards                 -- rendered shareable assets
  id, user_id, card_type (parallel|quest|wrapped|twin), image_url, created_at

collab_sessions                -- friend pairing / Collab Parallels
  id, user_a_id, user_b_id, parallel_type_a_id, parallel_type_b_id, status, created_at

roulette_matches
  id, user_a_id, user_b_id, matched_parallel_context, status, started_at, ended_at

notifications
  id, user_id, type, payload (jsonb), read_at, created_at
```

Notes:
- `embedding` columns use `pgvector`'s `vector(N)` type, indexed with **HNSW** once the table has meaningful volume (IVFFlat is acceptable pre-scale, per current guidance).
- `interest_signals` is intentionally an append-only event log — it's the raw material the Identity Engine (BullMQ jobs) periodically reprocesses into `user_parallels.strength_pct` and embeddings, following the rules-based → behavioral-weighting → collaborative-filtering progression from the original doc's §21.

## 14. Design System Direction

- **Visual identity**: the map/percentage visuals are the brand — invest disproportionately here. Think generative, soft-gradient "blob" or radar-style visualizations per Parallel rather than generic pie/bar charts; each Parallel type gets a distinct color and motion signature so switching contexts *feels* different, reinforcing "different world" from §6 original.
- **Typography**: one expressive display face for headlines/percentages (personality, a bit of attitude) + one highly legible workhorse face for body/UI text. Avoid anything that reads corporate.
- **Motion**: the Parallel-switch transition (§6 original) is the single most important animation in the app — it should feel like a scene change, not a tab switch. Budget real design + engineering time here; it's doing narrative work.
- **Dark-first**: default to a dark theme with vibrant per-Parallel accent colors — matches both the aesthetic Gen Z social apps converge on and makes Identity Cards pop when screenshotted/shared.
- **Component system**: shadcn/ui primitives, restyled via Tailwind theme tokens, so accessibility (focus states, contrast, keyboard nav) comes for free rather than being retrofitted.
- **Identity Cards** are effectively a second, tighter design system of their own (portrait 1080×1920, safe zones for Instagram/Snap story UI, minimal branding) — treat them as a distinct deliverable in the Figma file, not a variant of the app UI.

## 15. Testing Strategy

- **Unit tests**: Jest (backend, NestJS's default) and Vitest (frontend) for business logic — identity-scoring functions, streak calculations, quest progression, DTO validation. Target meaningful coverage on the Identity Engine specifically; it's the product's core differentiator and the place bugs are least visible to users but most damaging to trust.
- **Integration tests**: NestJS's `@nestjs/testing` + Supertest against a real Postgres instance run as a CI service container — per current best practice, service containers give far more reliable integration coverage than mocked database calls.
- **Component tests**: React Testing Library for interaction-heavy components (onboarding flow, Parallel switcher, quest cards) — assert on user-visible behavior, not implementation detail.
- **End-to-end tests**: Playwright covering the critical path only — sign up → onboarding → see map → enter a Parallel → complete a challenge → see an evolution update. This is the "Holy Shit Demo" from §27 original, codified as a test.
- **Load/perf smoke test**: a lightweight k6 or Artillery script against the feed and identity-scoring endpoints before each production deploy past MVP — cheap insurance against a viral spike.
- **CI gate**: lint → typecheck → unit → integration → build, required to pass before merge; E2E runs on a schedule and pre-release rather than every PR, to keep the feedback loop fast — a pipeline that creeps past ~5–10 minutes is the point teams start bypassing it, so protect that budget deliberately.

## 16. Development Phases — the literal journey

This expands the original doc's Phase 0–13 outline into an actionable, sequential build plan. Each phase lists concrete deliverables and a rough exit condition — you don't move on until the exit condition is true.

### Phase 0 — Validation (pre-code)
- Run 8–12 informal interviews describing the core loop (§5) to people in your target demo; test the *concept*, not the UI.
- Concept-test the name and the Identity Card format specifically — these are the growth engine, worth validating early.
- **Exit condition**: you can describe the app in one sentence and get a genuine "wait, that's kind of cool" reaction, unprompted.

### Phase 1 — Product Definition
- Write a one-page PRD: problem, thesis, target user, MVP feature list (§26), success metrics (§8).
- Lock the MVP scope explicitly against the Non-Goals list (§7).
- **Exit condition**: PRD reviewed and signed off (even if it's just you signing off on yourself — write it down anyway).

### Phase 2 — UX / Design
- Figma: full onboarding flow, the Parallel Map (aha screen), entering a Parallel, one Quest flow, one Identity Card, Wrapped recap, empty/error/loading states for each.
- Prototype the Parallel-switch transition in Figma or a quick code spike — this interaction needs to be felt, not just described.
- **Exit condition**: a clickable prototype that a stranger can complete the "Holy Shit Demo" path in, unassisted.

### Phase 3 — Architecture
- Finalize the schema (§13) as an actual `schema.prisma` file.
- Write ADRs (Architecture Decision Records, stored in `docs/adr/`) for: monolith-vs-microservices call, embedding model choice, auth strategy, real-time transport.
- Define the REST/WebSocket API surface as an OpenAPI spec, shared into `packages/shared-types`.
- **Exit condition**: a new engineer could read `docs/` and `schema.prisma` and understand the system without asking you anything.

### Phase 4 — Foundation

**If you're new to NestJS, start here (2–5 days, before step 1 below):** you only need four ideas before touching the real codebase — **modules** (a folder that groups related code), **controllers** (handle the incoming HTTP request, stay thin), **services** (do the actual work — DB calls, business logic), and **dependency injection** (NestJS hands your service to your controller automatically via the constructor, instead of you `import`-ing and instantiating it yourself). Everything else in NestJS is a variation on those four. Concretely:
1. Run through the official NestJS "First Steps" + "Controllers" + "Providers" + "Modules" docs pages in order — they're short and hands-on.
2. Do one free interactive intro course (e.g. Scrimba's Intro to NestJS) rather than a long video course — you retain more from typing the code yourself than watching someone else type it.
3. Build one disposable toy module on the side (e.g. a `todos` module: controller + service + in-memory array, no database yet) before touching the real `apps/api` — get the modules/controllers/services/DI loop into your hands once, painlessly, before it matters.
4. Only once that toy module works, move to step 1 below with the real Prisma-backed `auth` module — you'll recognize the pattern immediately.

This ramp is worth the few days — the module-per-feature structure the whole backend uses (§11 folder structure) *is* the NestJS mental model, so this investment pays off in every phase after this one, not just Phase 4.

1. `mkdir parallel && cd parallel && git init && pnpm init`
2. Set up `pnpm-workspace.yaml`, `turbo.json`, root `tsconfig.json`, ESLint/Prettier configs in `packages/config`.
3. Scaffold `apps/web` (`pnpm create next-app@latest web --typescript --tailwind --eslint --app --src-dir`) and `apps/api` (`pnpm dlx @nestjs/cli new api`).
4. Install dependency lists from §12 into each app.
5. Stand up `infra/docker-compose.yml` with Postgres (pgvector-enabled image) + Redis; verify `docker compose up` gives a working local DB.
6. Run first Prisma migration against local Postgres; confirm `prisma studio` shows the schema.
7. Implement auth module (JWT, passport strategy) end-to-end: register → login → protected route, with a passing integration test.
8. Set up Husky + lint-staged pre-commit hooks; first GitHub Actions workflow that just lints and typechecks on PR.
9. Write the root `README.md`: how to clone, install, run locally, run tests.
- **Exit condition**: a second machine can clone the repo, run three commands, and have web + api + db running locally.

### Phase 5 — Core (MVP skeleton)
- Onboarding flow (questions → answers persisted) end-to-end, web UI wired to real API.
- Parallel Map screen rendering real (even if rules-based) `strength_pct` values.
- Basic profile + visibility settings.
- Enter-a-Parallel context switch (URL/state change + at least a placeholder feed filtered by Parallel type).
- **Exit condition**: a fresh signup can complete onboarding and see their own (real, if simple) identity map.

### Phase 6 — Identity Engine
- `interest_signals` event logging wired into every meaningful frontend interaction.
- BullMQ job: recompute `strength_pct` + momentum from recent signals (rules-based first, per §21 original).
- Embedding generation job (Claude/OpenAI embeddings → pgvector column) for content and user interest vectors.
- New-Parallel detection: cluster/similarity job that proposes a new `user_parallels` row with an explainable "why we think this" description (Claude-generated, per §22 original's explainability requirement).
- Ghost Mode flag respected throughout (new discoveries default to `is_ghost = true`).
- Hidden Parallels unlock logic tied into Quest completion.
- **Exit condition**: a test account that interacts with a consistent interest cluster gets a genuinely surprising, correctly-labeled new Parallel suggested within the session.

### Phase 7 — Social
- Feed content per Parallel (`content_items`, seeded/curated initially, per §19 original's cold-start guidance).
- Follows, people discovery via unusual intersections (§11 original).
- Parallel Twin computation job + UI.
- Communities: emergent detection job + manual seed communities for early cohorts.
- Collab Parallels flow (§4.7).
- **Exit condition**: two test accounts can discover each other via an unusual shared intersection and see a Twin match.

### Phase 8 — Real-time
- Socket.IO gateway: presence, live notifications (streak warnings, quest completions, new match).
- Redis pub/sub wired for cross-instance real-time delivery.
- Notification center in the frontend.
- **Exit condition**: an action by user A (e.g., becoming someone's Twin) produces a real-time notification for user B without a page refresh.

### Phase 9 — AI & Growth Mechanics
- Quest generation via Claude, gated behind human review initially.
- Wrapped generation job (monthly snapshot → narrative copy → rendered card sequence).
- Identity Card rendering pipeline (server-side image generation → object storage → shareable URL).
- Parallel Roulette matching queue.
- **Exit condition**: a full Wrapped recap generates correctly for a seeded test account and produces a shareable, on-brand card.

### Phase 10 — Hardening
- Security pass: rate limiting (Redis-backed), input validation coverage, auth edge cases, dependency audit.
- Privacy pass against §22 original explicitly: reject/remove Parallel flow, hide-interest flow, data export/delete flow.
- Abuse prevention: report/block, Roulette safety timeouts, content moderation hook (even a simple keyword/Claude-moderation pass at MVP).
- Full test-suite pass per §15.
- **Exit condition**: a written checklist against §22's privacy bullets, each one demonstrably true in the running app.

### Phase 11 — Production Readiness
- Observability wired (structured logs, tracing, dashboards, alerting on error rate/latency).
- Load smoke test run against staging.
- Production Docker images, environment configs, secrets management finalized.
- **Exit condition**: a simulated incident (kill the API pod) triggers an alert and the system recovers without manual DB intervention.

### Phase 12 — Beta
- Invite-only rollout: 20 → 50 → 100 users, ideally one tight community (§19 original's campus/cohort strategy).
- Daily metrics review against §8 targets.
- **Exit condition**: retention and sharing metrics hit or credibly trend toward the §8 targets.

### Phase 13 — Iterate
- Kill or fix underperforming mechanics; double down on whichever of Streaks / Wrapped / Roulette / Collab actually drove the behavior in Phase 12.
- Revisit the monolith-vs-split decision only if a specific domain is genuinely bottlenecking.

## 17. CI/CD & Deployment

### 17.1 Pipeline shape (GitHub Actions)
1. **On every PR**: lint → typecheck → unit tests → integration tests (Postgres + Redis as service containers) → build. Use Turborepo's affected-only mode so a frontend-only PR doesn't rerun backend tests.
2. **On merge to `main`**: everything above, plus Docker image build for `web` and `api`, pushed to a container registry (GHCR is the simplest default — prefer the built-in `GITHUB_TOKEN` over a personal access token wherever possible, following least-privilege practice), then auto-deploy to a **staging** environment.
3. **Production release**: a manual approval gate (GitHub Environments with required reviewers) promotes the staging image to production — deliberate, not automatic, until the team trusts the pipeline.
4. Use `npm ci` (not `npm install`) in CI for reproducible installs, and cache dependencies keyed on the lockfile hash — this is what keeps install time under a few seconds on repeat runs instead of a couple of minutes.
5. Run a matrix across at least two Node.js LTS versions for the API package to catch version-specific issues early.

### 17.2 Environments
- **Local**: Docker Compose, seeded test data.
- **Staging**: mirrors production infra at smaller scale, auto-deployed from `main`, used for QA and the pre-release Playwright run.
- **Production**: manually promoted, behind the approval gate above.

### 17.3 Hosting suggestions (MVP-appropriate, not prescriptive)
- **API + workers**: a managed container platform (Render, Railway, Fly.io, or ECS Fargate once traffic justifies it) — avoid standing up Kubernetes at MVP scale; it's real operational overhead for a pre-product-market-fit app.
- **Web**: **Vercel** is the natural default now that the frontend is Next.js — first-class support for the App Router, Server Components, ISR, and edge OG-image generation for the Identity Card/Wrapped share pages, with zero config beyond connecting the repo. Cloudflare Pages or a self-hosted `next start` behind a CDN remain fallback options if you outgrow Vercel's pricing later, but don't over-engineer this away from Vercel at MVP.
- **Postgres**: a managed provider with pgvector support out of the box (Supabase or Neon are both reasonable, well-supported choices for 2026) rather than self-managing early.
- **Redis**: managed (Upstash, Redis Cloud) to avoid another piece of infra to babysit pre-launch.

### 17.4 Release hygiene
- Trunk-based development: short-lived feature branches, frequent merges to `main`, feature flags for anything not ready for all users — this pairs naturally with continuous deployment to staging.
- Semantic versioning on the API; OpenAPI spec regenerated and diffed in CI so frontend/mobile break loudly, not silently, on a breaking API change.
- Rollback plan: keep the previous production image tagged and one-command deployable; treat "can we roll back in under 5 minutes" as a Phase 11 exit condition, not a someday nice-to-have.

## 18. Privacy & Trust Checklist (operationalizing §22 original)

- [ ] Every suggested Parallel shows a plain-language "why" (no black-box scores).
- [ ] Reject / remove / hide flows exist for every Parallel and every individual interest signal.
- [ ] Visibility controls: per-Parallel public/friends/private, and a global Ghost Mode default for new discoveries.
- [ ] Data export (JSON download of a user's own signals, map, and history) and full account/data deletion, both self-serve.
- [ ] No psychological or clinical language anywhere in product copy, notifications, or AI-generated descriptions — enforce via a copy-review pass on all AI-generated text before it ships.

## 19. Risks & Open Questions

- **Cold start content**: the Identity Engine needs real interest signal to work, but new users have none — mitigate with the onboarding questions (§4 original) providing first-party signal before any behavioral data exists, and curated seed content per Parallel type (§19 original).
- **Novelty decay**: Streaks/Quests/Wrapped are proven mechanics elsewhere, but Parallel is combining several at once — watch for mechanic fatigue in Phase 12 beta feedback and be willing to cut, not just add.
- **Explainability at scale**: AI-generated "why we suggested this" copy needs to stay accurate as the scoring model gets more sophisticated (rules → collaborative filtering → embeddings) — build a lightweight internal audit tool early rather than trusting it blindly.
- **Roulette safety**: any stranger-matching feature needs moderation and reporting from day one, not retrofitted post-incident — this is called out explicitly in Phase 10 for that reason.

## 20. Document Ownership

This is a living document. When a decision here changes, update this file and note it — treat `docs/adr/` for the *why* behind bigger pivots and this file for the current, agreed-on state of the plan. Everything in Part A should still trace back to the one-sentence thesis in §1; if a new feature idea doesn't strengthen identity discovery, exploration, identity-based connection, or the evolve loop, it's optional, not core — same rule the original source-of-truth laid down, and still the right one.

---

## References (research consulted for Part B)

- Encore Cloud — *NestJS Project Structure Best Practices 2026*
- Medium (S. P. S. Shekhawat) — *Large-Scale React & Nest.js Project Structure and Best Practices*
- Medium (S. Tomar) — *The Ultimate Guide to Building a Monorepo in 2026*
- Medium (arg-software) — *Practical Nx + NestJS Monorepo Boilerplate*
- Instaclustr — *pgvector: Key features, tutorial, and pros and cons [2026 guide]*
- Kreante — *Supabase Vector & pgvector: Best Setup for 2026*
- ArchitectureDiagram.ai — *pgvector Architecture Diagram: Postgres as Your Vector Database (2026)*
- Precision AI Academy — *Vector Databases and Embeddings in 2026: The Complete Guide*
- Markaicode — *Supabase Vector Database Architecture: Production Best Practices [2026]*
- DEV Community — *GitHub Actions CI/CD: Build a Complete Node.js Pipeline (2026)*
- The Good Shell — *GitHub Actions CI/CD Pipeline: The Complete Practical Guide for 2026*
- OneUptime — *How to Implement CI/CD Pipelines for React with GitHub Actions*

*Final Version • September 3, 2026*
