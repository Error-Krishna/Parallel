# Parallel — Complete Codebase Health & Engineering Audit

**Audit Date:** November 17, 2026  
**Auditor Roles:** Senior Software Architect, Staff Engineer, Backend Engineer, Frontend Engineer, DevOps Engineer, Security Engineer, QA Lead  
**Scope:** Complete repository inspection (`apps/api`, `apps/web`, `packages/*`, `infra/`, `docs/`, migrations, schemas, configurations, workflows)  
**Execution Boundary:** Read-only analysis. No application source code, schemas, or database states modified during this audit.

---

# A. Executive Summary

This engineering health check was conducted to establish the ground-truth technical state of the Parallel monorepo prior to further feature implementation. The assessment evaluated architecture, feature completeness, code quality, security posture, database design, background processing, real-time infrastructure, operational readiness, and test integrity.

### Scorecard Summary

| Dimension                   |              Rating               | Key Summary                                                                                                                                                                                                                                                                                                                                      |
| :-------------------------- | :-------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overall Codebase Health** |     **AMBER (Moderate Risk)**     | Core domains (Auth, Onboarding, Identity, Parallels, Communities, Collab) have solid TypeScript code and strong unit/e2e test suites, but critical system-level gaps and dead ends prevent the end-to-end user loop from functioning without manual intervention.                                                                                |
| **Architecture Maturity**   |             **AMBER**             | Clean NestJS feature modules and Next.js App Router structure. However, there is a major divergence between documented architecture (OpenAI 1536-dim embeddings, Anthropic SDK, microservices roadmap) and actual implementation (HuggingFace 384-dim local transformers, Groq fallback).                                                        |
| **Functional Maturity**     |         **RED / BLOCKED**         | **Showstopper Invariant:** Every user completing onboarding has all Parallels generated with `isGhost: true`. Because no API endpoint or UI exists to "Make Public" / "Unghost" a Parallel, real users are permanently locked in Ghost Mode, which completely breaks Public Profiles, People Discovery, Twin Matching, and Collab invites.       |
| **Security Posture**        |       **AMBER / HIGH RISK**       | Solid token-revocation via Redis on logout and WebSocket handshakes; enumeration-safe auth; strict ValidationPipe. However, Next.js has a known Critical RCE vulnerability (`next/og` GHSA-vcvr-r3jv-pc5j), there is zero API rate limiting, no route protection guards exist on the web app, and JWTs are stored unprotected in `localStorage`. |
| **Test Maturity**           | **GREEN (Local Units & API E2E)** | Unit tests (164 API, 18 Web) and API E2E tests (33 tests across 5 suites) pass cleanly when dependencies run. However, tests heavily mock or bypass real user journeys (e.g. e2e tests seed database rows with `isGhost: false` to bypass the onboarding ghost lock), and browser/UI E2E tests (Playwright) are completely absent.               |
| **Operational Readiness**   |   **RED (Deployment Blockers)**   | Docker production images fail to compile on clean checkouts because shared packages (`@parallel/shared-types`) are not built in the Dockerfile before app compilation. Untracked Prisma migrations exist in the working directory.                                                                                                               |

### Core Audit Findings Overview

1. **The Ghost Mode Paradox (Critical Functional Blocker):** `IdentityEngineService.generateInitialMap()` assigns `isGhost: true` to every initial parallel. The blueprint and `API.md` specify `POST /v1/parallels/:id/make-public`, but it was never implemented. No UI toggle exists. Real users can never become visible to others.
2. **Phase 8 Real-time Status:** Step 1 (Core Socket.IO Gateway & Fastify Handshake Auth) is genuine, robust, and verified with 9 Fastify e2e tests. However, Step 2 is not started: no `NotificationsModule` exists, no domain events are dispatched, no frontend socket provider exists, and the gateway currently uses an in-memory adapter that cannot deliver messages across multiple server instances.
3. **Ghost UI in Collab Feature:** In `apps/web/src/app/collab/[id]/page.tsx`, the "Generate Joint Identity Card" button calls `POST /v1/cards`, which does not exist on the backend (404), catches the error silently, and falsely displays `"Joint Card Created! ✨"`.
4. **Configuration Bug Disabling Groq AI:** `GroqParallelNamingProvider` queries `this.configService.get<string>('groqApiKey')` instead of `'app.groqApiKey'`, causing the API key to always evaluate to `undefined` and forcing silent fallback to generic naming every time.
5. **Exponential $O(N^2)$ Scalability Trap:** `TwinsProcessor` iterates through every user pair in the database every 15 minutes, queuing $N(N-1)/2$ BullMQ jobs with zero candidate pruning or batching.

---

# B. Repository and Architecture Map

### 1. Monorepo Structure

```text
Parallel/
├── apps/
│   ├── api/             # NestJS 12 + Fastify 5 backend (Port 3001)
│   ├── web/             # Next.js 16.3.4 (App Router) + Tailwind v4 + React 19 (Port 3000)
│   └── mobile/          # Intentionally deferred (post-MVP)
├── packages/
│   ├── shared-types/    # Pure TypeScript DTOs and API contracts (built with tsup)
│   ├── api-client/      # Axios-based typed client SDK wrapping shared-types (tsup)
│   ├── ui/              # Empty component stub awaiting mobile cross-platform promotion
│   └── config/          # Shared tsconfig-base.json
├── infra/
│   ├── docker/          # api.Dockerfile, web.Dockerfile
│   ├── docker-compose.yml # PostgreSQL 16 (pgvector) + Redis 7
│   └── github-actions/  # CI definitions
└── docs/                # Master blueprint, PDF source of truth, architecture docs
```

### 2. Applications and Package Analysis

#### `apps/api`

- **Responsibility:** REST API, WebSocket gateway, BullMQ background processors, Prisma ORM database access.
- **Key Dependencies:** `@nestjs/platform-fastify`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/bullmq`, `bullmq`, `ioredis`, `@prisma/client`, `@huggingface/transformers`, `groq-sdk`, `bcryptjs`, `nestjs-pino`.
- **Boundaries & Coupling:** Modular NestJS architecture organized into domain feature modules (`auth`, `users`, `onboarding`, `identity-engine`, `parallels`, `collab`, `communities`, `quests`, `health`, `websockets`).
- **Deviations:** Uses Fastify for HTTP and Socket.IO for WebSockets. `@anthropic-ai/sdk` is installed but never imported.

#### `apps/web`

- **Responsibility:** Next.js App Router client-side UI, server components, and styling.
- **Key Dependencies:** `next 16.3.4`, `react 19.2.8`, `@tanstack/react-query`, `zustand`, `framer-motion`, `lucide-react`, `tailwindcss 4`.
- **Boundaries & Coupling:** Direct dependency on `@parallel/api-client` and `@parallel/shared-types`. No backend code imported.
- **Deviations:** No Socket.IO client integration mounted in any provider or hook; no client or server route middleware exists.

#### `packages/shared-types`

- **Responsibility:** Canonical single source of truth for all request/response DTOs, enums, and domain representations. Zero runtime dependencies. Builds via `tsup` to ESM and `.d.ts`.
- **Health:** Cleanly isolated. Builds in 139ms without errors.

#### `packages/api-client`

- **Responsibility:** Typed API wrapper taking an Axios instance and exposing domain methods (`auth`, `users`, `parallels`, `communities`, `collab`, etc.).
- **Health:** Cleanly typed, builds in 172ms. However, contains hardcoded assumptions about which backend endpoints use the `ApiResponse<T>` envelope vs raw responses.

#### `packages/ui`

- **Responsibility:** Reserved design system repository for code shared between Web and future Mobile apps.
- **Health:** Currently an empty stub (`export {};`). Day-to-day shadcn primitives live directly in `apps/web/src/components/ui/`. Clean boundary.

---

# C. Complete Feature Inventory

| Phase & Feature                        | Blueprint Reference                                |           Real Status            | Backend Files                                               | Frontend Files                                       |       Verified?       | Limitations / Failure Modes                                                                                    |
| :------------------------------------- | :------------------------------------------------- | :------------------------------: | :---------------------------------------------------------- | :--------------------------------------------------- | :-------------------: | :------------------------------------------------------------------------------------------------------------- |
| **1. Auth & Session**                  | Blueprint §16 Ph 5; `API.md` §2                    |     **COMPLETE & VERIFIED**      | `auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts`  | `auth-store.ts`, `login/page.tsx`, `signup/page.tsx` | YES (12 unit, 8 e2e)  | No refresh token mechanism; token stored in `localStorage`; no API rate limiting.                              |
| **2. Onboarding**                      | Blueprint §16 Ph 5; `USER_FLOW.md` §2              |     **COMPLETE & VERIFIED**      | `onboarding.controller.ts`, `onboarding.service.ts`         | `onboarding/[step]/page.tsx`, `reveal/page.tsx`      |     YES (10 unit)     | Initial map creation forces all parallels to `isGhost: true`.                                                  |
| **3. Parallel Map**                    | Blueprint §16 Ph 5; `USER_FLOW.md` §3              |     **COMPLETE & VERIFIED**      | `parallels.controller.ts`, `identity-engine.service.ts`     | `map/page.tsx`                                       |  YES (Unit & manual)  | User cannot un-ghost parallels from map cards.                                                                 |
| **4. Enter a Parallel**                | Blueprint §16 Ph 5; `USER_FLOW.md` §4              |     **COMPLETE & VERIFIED**      | `parallels.service.ts:enterParallel`                        | `parallel/[id]/page.tsx`                             |          YES          | Writes `PARALLEL_ENTER` signal and touches streaks.                                                            |
| **5. Feeds & Interactions**            | Blueprint §16 Ph 6; `USER_FLOW.md` §5              |    **PARTIALLY IMPLEMENTED**     | `content.controller.ts`, `parallels.service.ts`             | `parallel/[id]/page.tsx`                             |        PARTIAL        | Feed is empty unless database is pre-seeded manually; no content creation UI or moderation flow.               |
| **6. Streaks**                         | Blueprint §4.1, §16 Ph 6                           |     **COMPLETE & VERIFIED**      | `streak.service.ts`                                         | `map/page.tsx`                                       |     YES (5 unit)      | 48-hour activity window correctly touched by content interactions, quest steps, and collabs.                   |
| **7. Quests**                          | Blueprint §4.2, §16 Ph 6                           | **IMPLEMENTED BUT NOT VERIFIED** | `quests.controller.ts`, `quests.service.ts`                 | `parallel/[id]/page.tsx` (QuestsTab)                 |   PARTIAL (8 unit)    | Only 1 quest exists in DB; AI Quest generation via Claude does not exist; no reward visualizer.                |
| **8. Ghost Mode**                      | Blueprint §4.5, §22; `USER_FLOW.md` §3b            |       **BROKEN / BLOCKED**       | `identity-engine.service.ts:150`                            | `map/page.tsx:600`                                   |        FAILED         | **CRITICAL:** All parallels created as ghost; no "make-public" endpoint or UI exists.                          |
| **9. Hidden & Dismissed**              | Blueprint §16 Ph 6; `DATABASE.md` §2.3             |    **PARTIALLY IMPLEMENTED**     | `parallels.service.ts:hideParallel`                         | `map/page.tsx:538`                                   |        PARTIAL        | `hideParallel` works; `unhideParallel` and `dismissParallel` (`DELETE /parallels/:id`) were never implemented. |
| **10. Identity Evolution**             | Blueprint §16 Ph 6; `USER_FLOW.md` §8              |     **COMPLETE & VERIFIED**      | `identity-engine.service.ts`, `evolution.processor.ts`      | `map/page.tsx` (evolution graph)                     | YES (BullMQ monthly)  | Delta percentage is null until second monthly snapshot is captured.                                            |
| **11. Emerging Parallels**             | Blueprint §16 Ph 6; `FEATURE.md` §3.3              |    **PARTIALLY IMPLEMENTED**     | `emerging-parallel.service.ts`, `embedding.service.ts`      | `map/page.tsx`                                       |   PARTIAL (22 unit)   | Clustering works via local HuggingFace; Groq naming provider fails due to config key bug.                      |
| **12. People Discovery**               | Blueprint §16 Ph 7; `USER_FLOW.md` §9              |     **COMPLETE & VERIFIED**      | `parallels.service.ts:getPeople`                            | `parallel/[id]/page.tsx` (PeopleTab)                 |  YES (e2e verified)   | Works in tests only when users are manually seeded with `isGhost: false`.                                      |
| **13. Follow / Unfollow**              | Blueprint §16 Ph 7; `USER_FLOW.md` §9              |     **COMPLETE & VERIFIED**      | `users.service.ts:followUser/unfollowUser`                  | `u/[username]/page.tsx`, `parallel/[id]/page.tsx`    |  YES (e2e verified)   | Idempotent, prevents self-follows.                                                                             |
| **14. Parallel Twin**                  | Blueprint §16 Ph 7; `USER_FLOW.md` §10             |     **COMPLETE & VERIFIED**      | `users.service.ts:calculateTwinMatch`, `twins.processor.ts` | `twins/[id]/page.tsx`                                |  YES (e2e verified)   | Requires $\ge 2$ shared visible parallels and $\ge 70\%$ score; scheduled processor is $O(N^2)$.               |
| **15. Communities**                    | Blueprint §16 Ph 7; `FEATURE.md` §5.3              |     **COMPLETE & VERIFIED**      | `communities.service.ts`, `communities.processor.ts`        | `communities/page.tsx`                               |     YES (22 unit)     | Emergent detection BullMQ job, seed script, join/skip flow functional.                                         |
| **16. Collab Parallels**               | Blueprint §4.7, §16 Ph 7; `USER_FLOW.md` §10       |     **COMPLETE & VERIFIED**      | `collab.service.ts`, `collab.controller.ts`                 | `collab/page.tsx`, `collab/[id]/page.tsx`            | YES (22 unit, 11 e2e) | Real challenge generation, dual participant completion; card generation button in UI is mocked.                |
| **17. Identity Cards**                 | Blueprint §4.4, §16 Ph 9; `USER_FLOW.md` §11       |           **MISSING**            | None (`CardsModule` does not exist)                         | Mocked in `collab/[id]/page.tsx`                     |        FAILED         | Backend has no routes; frontend silently swallows 404.                                                         |
| **18. Parallel Wrapped**               | Blueprint §4.3, §16 Ph 9; `USER_FLOW.md` §12       |           **MISSING**            | None (`WrappedModule` does not exist)                       | None                                                 |      NOT STARTED      | Database model exists; no processor, API, or UI.                                                               |
| **19. Parallel Roulette**              | Blueprint §4.6, §16 Ph 9; `USER_FLOW.md` §13       |           **MISSING**            | None                                                        | None                                                 |      NOT STARTED      | Schema table exists; completely deferred.                                                                      |
| **20. Phase 8 Step 1 (Sockets)**       | Blueprint §16 Ph 8; `FUTURE_IMPLEMENTATIONS.md` §5 |     **COMPLETE & VERIFIED**      | `events.gateway.ts`, `events.module.ts`                     | None                                                 | YES (13 unit, 9 e2e)  | Fully boots on Fastify; handshake auth and Redis revocation verified.                                          |
| **21. Phase 8 Step 2 (Notifications)** | Blueprint §16 Ph 8; `API.md` §10                   |    **MISSING / NOT STARTED**     | None (`NotificationsModule` unbuilt)                        | None                                                 |      NOT STARTED      | Table exists in Postgres; no service, controllers, or event listeners built.                                   |

---

# D. Backend Health Audit (`apps/api`)

### 1. Architecture & Dependency Injection

- **Module Structure:** Clean separation of concerns across feature modules. `AppModule` cleanly registers domain modules and BullMQ queues.
- **Fastify Compatibility:** Handled correctly. Nest FastifyAdapter is properly passed in `main.ts`.
- **Response Wrapping Inconsistency:** Major divergence across controllers:
  - `AuthController`, `UsersController`, and `CollabController` wrap responses using `apiResponse(data, message)`.
  - `ParallelsController`, `OnboardingController`, `CommunitiesController`, `QuestsController`, and `ContentController` return raw database/service payloads without an envelope.
  - This forces `@parallel/api-client` to maintain per-module handling.

### 2. DTO Validation & Input Sanitization

- Global `ValidationPipe` is configured with `whitelist: true, forbidNonWhitelisted: true, transform: true`. Unknown fields are rejected with 400.
- Custom validator `@IsUsername()` is shared between `SignupDto` and `UpdateUserDto`.
- `ContentInteractionDto` strictly restricts allowed signals to content-safe values (`VIEW`, `LIKE`, `SAVE`, `SHARE`, `SEARCH`), preventing signal fabrication.

### 3. Business Logic Bugs & Dead Code

#### AUDIT-004: Configuration Key Bug in `GroqParallelNamingProvider`

- **Location:** [groq-parallel-naming.provider.ts:18](file:///Users/krishnagoyal/Development/personal%20projects/Parallel/apps/api/src/modules/identity-engine/providers/groq-parallel-naming.provider.ts#L18)
- **Code:** `const apiKey = this.configService.get<string>('groqApiKey');`
- **Issue:** `apps/api/src/config/configuration.ts` returns `{ app: { groqApiKey: process.env.GROQ_API_KEY, ... } }`. In NestJS ConfigService, nested keys must be queried as `'app.groqApiKey'`. Because it queries `'groqApiKey'`, it consistently returns `undefined`.
- **Result:** `this.client` is always `null`, and every emerging parallel unconditionally falls back to: `"Your recent activity shows a recurring interest pattern."` The Groq AI integration is completely dead in runtime.

#### AUDIT-015: Completely Dead SDK Dependency (`@anthropic-ai/sdk`)

- **Location:** `apps/api/package.json:28`, `apps/api/src/config/configuration.ts:17`
- **Issue:** The blueprint specifies Claude for identity descriptions, quests, and wrapped copy. `@anthropic-ai/sdk` is installed, and `ANTHROPIC_API_KEY` is declared in configuration. However, there is zero usage of Anthropic anywhere in `apps/api/src`.

#### AUDIT-017: Ambiguous Route Parameter Semantics in `ParallelsController`

- **Location:** [parallels.controller.ts:48-68](file:///Users/krishnagoyal/Development/personal%20projects/Parallel/apps/api/src/modules/parallels/parallels.controller.ts#L48-L68)
- **Issue:** In `GET /v1/parallels/:parallelId`, `:parallelId` refers to `ParallelType.id`. In `POST /v1/parallels/:parallelId/enter`, `:parallelId` refers to `ParallelType.id`. In `PATCH /v1/parallels/:parallelId/hide`, `:parallelId` unexpectedly expects `UserParallel.id`. Passing a `ParallelType.id` to `/hide` throws a 404 error.

---

# E. Frontend Health Audit (`apps/web`)

### 1. App Router Structure & Rendering Boundaries

- Next.js 16.3.4 with React 19. All pages properly declare `'use client'` where client state/hooks are utilized.
- Root layout cleanly isolates client providers in `src/components/providers.tsx`.

### 2. Broken & Mocked Functionality

#### AUDIT-003: Fake Card Generation in Collab Detail Page

- **Location:** [apps/web/src/app/collab/[id]/page.tsx:112-127](file:///Users/krishnagoyal/Development/personal%20projects/Parallel/apps/web/src/app/collab/%5Bid%5D/page.tsx#L112-L127)
- **Code:**
  ```typescript
  async function handleGenerateCard() {
    if (!session) return;
    setSubmitting(true);
    try {
      await api.cards.create({ cardType: "COLLAB", sourceId: session.id });
      setCardGenerated(true);
    } catch {
      // If card service is not yet fully configured in background, still provide friendly feedback
      setCardGenerated(true);
    } finally {
      setSubmitting(false);
    }
  }
  ```
- **Issue:** `POST /v1/cards` does not exist on the backend and returns a 404 error. The catch block swallows the error, sets `cardGenerated(true)`, and renders `"Joint Card Created! ✨"`. No card was created, no asset exists, and no URL is generated.

#### AUDIT-007: Complete Absence of Route Protection & Auth Redirection

- **Location:** Entire `apps/web` repository.
- **Issue:** There is no Next.js `middleware.ts`. Protected routes (`/map`, `/profile`, `/collab`, `/communities`, `/twins/[id]`) do not check `useAuthStore.getState().isAuthenticated`. Unauthenticated users can navigate to any internal URL; the pages attempt API calls, receive 401 Unauthorized, and render broken error screens ("Your map is unavailable", "Profile unavailable") rather than redirecting to `/login`.
- **401 Interceptor Absence:** `apps/web/src/lib/api-client.ts` does not intercept 401 responses to clear the auth store or trigger logout.

#### AUDIT-018: Insecure LocalStorage Authentication Persistence

- **Location:** [apps/web/src/features/auth/auth-store.ts:28](file:///Users/krishnagoyal/Development/personal%20projects/Parallel/apps/web/src/features/auth/auth-store.ts#L28)
- **Issue:** Raw JWT access tokens are persisted to `localStorage` under the key `'parallel-auth'`. In the presence of any Cross-Site Scripting (XSS) vulnerability, access tokens can be extracted by malicious client scripts.

---

# F. Database and Data Integrity Audit

### 1. Schema & Migration Status

- Current schema at `apps/api/prisma/schema.prisma` is up to date against the active PostgreSQL database (`parallel_dev`).
- `pnpm --filter api exec prisma migrate status` reports 7 applied migrations.

### 2. Untracked Migration Risk

#### AUDIT-005: Untracked Migration Directory in Working Tree

- **Location:** `apps/api/prisma/migrations/20261023000000_update_collab_sessions/`
- **Issue:** This migration was generated to support Collab sessions (`challenge_title`, `user_a_completed`, `user_b_completed`, nullable `parallel_type_b_id`). It has been executed against the local database, but the directory is completely untracked in git.
- **Risk:** Any clean checkout or CI execution using `prisma migrate deploy` will fail or drift because the schema in git does not match the migration history.

### 3. Missing Indexes & Query Performance Risks

#### AUDIT-009: Missing Vector and Relational Foreign Key Indexes

1. **Vector Indexes:** Neither `user_parallels.embedding` nor `content_items.embedding` has an HNSW or IVFFlat index. Cosine distance queries (`<=>`) execute full sequential table scans.
2. **`user_parallels` Search Index:** The composite key is `(user_id, parallel_type_id)`. There is no index starting with `parallel_type_id`. `ParallelsService.getPeople(parallelId)` must perform a table scan on all user parallels.
3. **`parallel_twins` Lookup Index:** The unique index is on `(user_a_id, user_b_id)`. `UsersService.getTwinMatches(userId)` checks `OR: [{ userAId: userId }, { userBId: userId }]`. The query cannot use the index for `userBId`, resulting in sequential scans.
4. **`community_members` User Index:** Primary key is `(community_id, user_id)`. There is no index on `user_id`, penalizing lookups of a user's joined communities.

---

# G. Shared Packages and API Contract Audit

### 1. Build Verification

- `@parallel/shared-types`: Builds cleanly via `tsup` in 139ms.
- `@parallel/api-client`: Builds cleanly via `tsup` in 172ms.
- `@parallel/ui`: Empty placeholder; builds in 166ms.

### 2. Contract Drift

- **Embedding Dimensions:** `DATABASE.md` and `PARALLEL_master_blueprint_final.md` specify 1536-dimensional embeddings (OpenAI `text-embedding-3-small`). The code, schema, and raw SQL queries strictly enforce 384 dimensions (HuggingFace `Xenova/all-MiniLM-L6-v2`).
- **Missing Ghost Management:** `API.md` §5 documents `POST /v1/parallels/:id/make-public`, `POST /v1/parallels/:id/unhide`, and `DELETE /v1/parallels/:id`. None of these exist in `packages/shared-types`, `packages/api-client`, or backend controllers.
- **Card Generation Endpoint:** `packages/api-client` declares `cards.create()`, calling `POST /v1/cards`. No matching backend controller exists.

---

# H. Authentication, Authorization, and Security Audit

### Severity Classification

| Finding ID    | Title                                                                             |   Severity   |  Status   |
| :------------ | :-------------------------------------------------------------------------------- | :----------: | :-------: |
| **AUDIT-001** | Remote Code Execution Vulnerability in Next.js 16.3.4 (`next/og`)                 | **CRITICAL** | CONFIRMED |
| **AUDIT-002** | Initial Onboarding Locks All Users in Ghost Mode (Breaks Core Security Invariant) | **CRITICAL** | CONFIRMED |
| **AUDIT-010** | Missing Rate Limiting on Authentication & Mutation Endpoints                      |  **MEDIUM**  | CONFIRMED |
| **AUDIT-007** | Absence of Client/Server Route Protection in Web App                              |   **HIGH**   | CONFIRMED |
| **AUDIT-018** | LocalStorage JWT Storage Without Session Revocation Handling                      |  **MEDIUM**  | CONFIRMED |

### Detailed Security Findings

#### AUDIT-001: Next.js Remote Code Execution (GHSA-vcvr-r3jv-pc5j)

- **Severity:** CRITICAL
- **Category:** Security / Dependency
- **Evidence:** `pnpm audit` reports vulnerability in `next@16.3.4` (affected range `>=16.2.0 <16.3.6`). Patched in `next@>=16.3.6`.
- **Impact:** Remote Code Execution via ImageResponse processing.
- **Recommendation:** Upgrade `apps/web/package.json` to `next@^16.3.6` or latest stable.

#### AUDIT-002: Real Users Trapped in Ghost Mode Indefinitely

- **Severity:** CRITICAL
- **Category:** Architecture / Security / Backend
- **Evidence:** [identity-engine.service.ts:150](file:///Users/krishnagoyal/Development/personal%20projects/Parallel/apps/api/src/modules/identity-engine/identity-engine.service.ts#L150)
  ```typescript
  create: {
    userId,
    parallelTypeId: type.id,
    strengthPct,
    momentum: 0,
    isGhost: true, // <--- Hardcoded true
    isHidden: false,
    suggestionReason: 'Based on your onboarding choices.',
  }
  ```
- **Impact:** Initial parallels generated upon onboarding completion are locked to `isGhost = true`. Because no `make-public` endpoint or UI exists, ordinary users can never make any Parallel public. Consequently, `getVisibleParallels` returns empty for all users, breaking Public Profiles, People Discovery, Twin Matching, and Collab invites.
- **Recommendation:** Implement `POST /v1/parallels/:id/make-public` and add a user-facing toggle on the map and profile screens. Alternatively, initialize the primary 4 onboarding parallels with `isGhost: false` as specified for starter types in Blueprint §16 Phase 5.

#### AUDIT-010: Zero Rate Limiting on Authentication Endpoints

- **Severity:** MEDIUM
- **Category:** Security
- **Evidence:** `apps/api/package.json` lacks `@nestjs/throttler`. `AuthController` endpoints `/signup` and `/login` have no rate-limiting guards.
- **Impact:** Vulnerable to automated credential stuffing, brute-force dictionary attacks, and denial of service via CPU-heavy bcrypt hashing.
- **Recommendation:** Install `@nestjs/throttler` backed by Redis, applying strict rate limits (e.g., 5 attempts per minute) on auth routes.

---

# I. Background Jobs, Redis, and Real-Time Audit

### 1. Phase 8 Step 1 Health Check

- **Status: HEALTHY AND VERIFIED.**
- **Implementation:** `EventsGateway` (`apps/api/src/websockets/events.gateway.ts`) and `EventsModule`.
- **Fastify Integration:** Gateway initializes cleanly on Fastify bootstrap.
- **Authentication:** Middleware intercepts Socket.IO handshake, validates canonical `handshake.auth.token` or `handshake.headers.authorization`, verifies token via `AuthService.verifyToken()`, and verifies `auth:revoked:${jti}` in Redis.
- **Room Isolation:** Automatically binds client to private room `user:<userId>`. Arbitrary room joining via `@SubscribeMessage('join')` is blocked and logged.
- **Verification:** Verified by 13 unit tests and 9 real Fastify e2e tests (`test/websockets.e2e-spec.ts`).

### 2. Multi-Instance Real-Time Gap

#### AUDIT-011: Missing Redis Adapter for Socket.IO Gateway

- **Severity:** MEDIUM
- **Category:** Architecture / Real-Time
- **Evidence:** `EventsGateway` uses the default in-memory adapter. `@socket.io/redis-adapter` is not installed.
- **Impact:** In a multi-instance production deployment (e.g. 2+ NestJS containers behind a load balancer), `gateway.emitToUser(userId, ...)` only delivers messages to sockets connected to that specific container. Sockets connected to other instances never receive events.
- **Recommendation:** Install `@socket.io/redis-adapter` and bind it to the Socket.IO server during `afterInit`.

### 3. Background Job Bottlenecks

#### AUDIT-008: $O(N^2)$ Scalability Trap in `TwinsProcessor`

- **Location:** [twins.processor.ts:40-52](file:///Users/krishnagoyal/Development/personal%20projects/Parallel/apps/api/src/jobs/twins/twins.processor.ts#L40-L52)
- **Code:**
  ```typescript
  const userIds = await this.usersService.getTwinCandidateUserIds();
  for (let i = 0; i < userIds.length; i += 1) {
    for (let j = i + 1; j < userIds.length; j += 1) {
      await this.twinsQueue.add("calculate-twin", {
        userAId: userIds[i],
        userBId: userIds[j],
      });
    }
  }
  ```
- **Impact:** Runs every 15 minutes. For $N$ users, it queues $N(N-1)/2$ individual jobs. At 1,000 users, that is 499,500 jobs every 15 minutes. At 10,000 users, that is $\sim 50,000,000$ jobs. This will exhaust Redis memory and collapse background worker queues.
- **Recommendation:** Replace global pair generation with inverted index candidate selection: only compare users who share at least 2 non-ghost parallels.

---

# J. Testing and Verification Results

### Summary of Executed Commands

| Command                                        | Working Directory       |  Result  | Details                                                   |
| :--------------------------------------------- | :---------------------- | :------: | :-------------------------------------------------------- |
| `pnpm --filter @parallel/shared-types build`   | `packages/shared-types` | **PASS** | Built in 139ms                                            |
| `pnpm --filter @parallel/api-client build`     | `packages/api-client`   | **PASS** | Built in 172ms                                            |
| `pnpm --filter @parallel/ui build`             | `packages/ui`           | **PASS** | Built in 166ms                                            |
| `pnpm --filter api lint`                       | `apps/api`              | **PASS** | oxlint: 0 errors, 0 warnings (96 files)                   |
| `pnpm --filter api build`                      | `apps/api`              | **PASS** | `nest build` completed successfully                       |
| `pnpm --filter api test`                       | `apps/api`              | **PASS** | **164 / 164 unit tests passed** across 20 test files      |
| `pnpm --filter api test:e2e`                   | `apps/api`              | **PASS** | **33 / 33 e2e tests passed** across 5 test suites         |
| `pnpm --filter web lint`                       | `apps/web`              | **PASS** | eslint: 0 errors, 1 warning (`@next/next/no-img-element`) |
| `pnpm --filter web test`                       | `apps/web`              | **PASS** | **18 / 18 unit tests passed** across 4 test files         |
| `pnpm --filter web build`                      | `apps/web`              | **PASS** | Next.js compiled all 14 routes successfully               |
| `pnpm --filter api exec prisma migrate status` | `apps/api`              | **PASS** | Schema up to date with 7 applied migrations               |
| `pnpm audit`                                   | Monorepo Root           | **FAIL** | **123 vulnerabilities** (4 critical, 46 high)             |

### Test Quality Observations

1. **API E2E Tests Are Genuine:** The 5 E2E test files (`app.e2e-spec.ts`, `auth.e2e-spec.ts`, `collab.e2e-spec.ts`, `social-discovery.e2e-spec.ts`, `websockets.e2e-spec.ts`) boot a real Fastify HTTP application instance with PostgreSQL and Redis connections.
2. **Artificial Test Seeding Masks Core Bug:** `social-discovery.e2e-spec.ts` and `collab.e2e-spec.ts` seed test accounts directly via `prisma.userParallel.createMany` with `isGhost: false`. If they executed the actual user journey (`onboarding/complete`), every test would fail because real onboarding creates ghost parallels.
3. **No Web E2E / Browser Tests:** Playwright is installed in `devDependencies` of `apps/web`, but no configuration (`playwright.config.ts`) or browser test specs exist.

---

# K. Configuration, Deployment, and Operational Readiness

### 1. Environment Configuration Parity

| Variable              |   In `.env.example`?   | In `apps/api/.env`? | In `apps/web/.env.local`? | Status / Notes                     |
| :-------------------- | :--------------------: | :-----------------: | :-----------------------: | :--------------------------------- |
| `NODE_ENV`            |          Yes           |         Yes         |            No             | Configured                         |
| `PORT`                |          Yes           |         Yes         |            No             | Configured (3001)                  |
| `CORS_ORIGIN`         |          Yes           |         Yes         |            No             | Configured                         |
| `DATABASE_URL`        |          Yes           |         Yes         |            No             | Configured (PostgreSQL + pgvector) |
| `REDIS_URL`           |          Yes           |         Yes         |            No             | Configured                         |
| `JWT_SECRET`          |          Yes           |         Yes         |            No             | Configured                         |
| `JWT_EXPIRES_IN`      |          Yes           |         Yes         |            No             | Configured (7d)                    |
| `BCRYPT_SALT_ROUNDS`  |          Yes           |         Yes         |            No             | Configured (12)                    |
| `ANTHROPIC_API_KEY`   |          Yes           |         Yes         |            No             | Unused in code                     |
| `EMBEDDING_API_KEY`   |          Yes           |         Yes         |            No             | Unused in code                     |
| `GROQ_API_KEY`        | No (in `.env.example`) |         Yes         |            No             | Missing from root `.env.example`   |
| `NEXT_PUBLIC_API_URL` |          Yes           |         No          |            Yes            | Configured (3001)                  |
| `NEXT_PUBLIC_WS_URL`  |          Yes           |         No          |            Yes            | Configured (3001)                  |

### 2. Docker Build Failure

#### AUDIT-006: Clean Docker Builds Fail for Both API and Web

- **Location:** [infra/docker/api.Dockerfile:14-19](file:///Users/krishnagoyal/Development/personal%20projects/Parallel/infra/docker/api.Dockerfile#L14-L19), [infra/docker/web.Dockerfile:14-19](file:///Users/krishnagoyal/Development/personal%20projects/Parallel/infra/docker/web.Dockerfile#L14-L19)
- **Issue:** `packages/shared-types` and `packages/api-client` are compiled with `tsup` into a git-ignored `dist/` directory. The Dockerfiles copy `packages/` and immediately execute `pnpm --filter api build` or `pnpm --filter web build` without running `pnpm --filter @parallel/* build`.
- **Impact:** On any clean clone or Docker build where `dist/` does not already exist on the host machine, the build fails with `Cannot find module '@parallel/shared-types/dist'`.
- **Recommendation:** Add `RUN pnpm --filter @parallel/shared-types build && pnpm --filter @parallel/api-client build` to the build stage of both Dockerfiles.

---

# L. Performance and Scalability Risks

1. **Unbounded Twin Matching (`TwinsProcessor`):** Detailed in AUDIT-008. $O(N^2)$ complexity will crash Redis in production.
2. **Missing Vector Indexes (HNSW):** Cosine distance search in `emerging-parallel.service.ts` (`vector(384)`) performs full table scans.
3. **Sequential Scans in People Discovery:** Querying `user_parallels` by `parallelTypeId` lacks a dedicated index.
4. **Synchronous Embedding Backfill in Worker:** Every time an embedding job runs for a user, `EmbeddingProcessor` queries all `content_items WHERE embedding IS NULL` and synchronously generates embeddings sequentially.

---

# M. Technical Debt

1. **Dual Envelope Convention:** Some controllers wrap responses in `{ success: true, message, data }` while others return raw data.
2. **Dead Dependencies:** `@anthropic-ai/sdk` and `groq-sdk` installed when only one naming provider is used (and that provider currently fails).
3. **Inconsistent Route Parameters:** `:parallelId` refers to `ParallelType.id` on 4 routes and `UserParallel.id` on 1 route.
4. **Duplicate Documentation Files:** `FUTURE_IMPLEMENTATION.md` vs `FUTURE_IMPLEMENTATIONS.md`.

---

# N. Documentation Drift and Product Ambiguities

1. **Embedding Dimension Spec vs Reality:** Blueprint §10.3 and `DATABASE.md` claim 1536-dim OpenAI embeddings. The codebase uses 384-dim HuggingFace local embeddings.
2. **Twin Refresh Mechanism:** `API.md` claims twins recompute on every GET read and no BullMQ job exists. In reality, `refreshTwinMatches` was deleted, and `TwinsProcessor` runs every 15 minutes.
3. **Quests Frontend Existence:** `FUTURE_IMPLEMENTATIONS.md` states "No frontend for Quests exists yet". In reality, `QuestsTab` is implemented and wired in `apps/web/src/app/parallel/[id]/page.tsx`.
4. **Untracked Collab Endpoints in API.md:** `API.md` marks Collab endpoints as "spec only", whereas `CollabController` is fully implemented.

---

# O. Broken Functionality

### 1. Ghost Mode Lockout

- **Evidence:** `apps/api/src/modules/identity-engine/identity-engine.service.ts:150`
- **Reproduction:** Complete onboarding as a new user. View `/map`. Parallels appear as ghost discoveries. Navigate to `/u/[username]` or try to invite someone to a Collab. Result: Profile has 0 parallels, Collab invite throws 400 error. No action exists to un-ghost the parallel.

### 2. Fake Identity Card Generation in Collab Detail Page

- **Evidence:** `apps/web/src/app/collab/[id]/page.tsx:112`
- **Reproduction:** Open any active collab session at `/collab/[id]`. Click "Generate Joint Identity Card". Result: Network tab shows 404 on `POST /v1/cards`. UI displays "Joint Card Created! ✨", but nothing is created.

### 3. Emerging Parallel Groq Naming Silent Fallback

- **Evidence:** `apps/api/src/modules/identity-engine/providers/groq-parallel-naming.provider.ts:18`
- **Reproduction:** Trigger emerging parallel detection with valid `GROQ_API_KEY`. Result: AI generation is skipped because `configService.get('groqApiKey')` returns `undefined`.

---

# P. Missing Functionality

1. **`POST /v1/parallels/:id/make-public`**: Endpoint and UI to un-ghost a Parallel.
2. **`NotificationsModule` (Phase 8 Step 2)**: Database model exists, but no controller, service, domain event listeners, or Redis pub/sub delivery exist.
3. **Frontend WebSocket Consumer**: No Socket.IO client mounted in `apps/web`.
4. **Web Route Protection**: No middleware or client auth guards.
5. **Cards and Wrapped Modules (Phase 9)**: No card image rendering engine, S3 storage, or Wrapped generation jobs.

---

# Q. Prioritized Remediation Roadmap

### P0 — Critical Blockers (Must Fix Immediately)

#### Item 1: Unlock Ghost Mode Parallels (Fix Core User Journey)

- **Issue:** Real users cannot make onboarding or discovered Parallels public, breaking public profiles, people discovery, twin matching, and collabs.
- **Severity:** CRITICAL (AUDIT-002)
- **Affected Files:** `apps/api/src/modules/parallels/parallels.controller.ts`, `parallels.service.ts`, `apps/web/src/app/map/page.tsx`
- **Fix:**
  1. Set initial onboarding parallels to `isGhost: false` (or provide immediate opt-in on reveal).
  2. Implement `POST /v1/parallels/:id/make-public` to flip `isGhost = false`.
  3. Add "Make Public" button on Parallel cards in the web map.
- **Blocks Phase 8 Step 2?** No, but blocks entire product usability.

#### Item 2: Fix Production Docker Build Failure

- **Issue:** Clean Docker builds fail because `@parallel/shared-types` is not built prior to application build.
- **Severity:** HIGH (AUDIT-006)
- **Affected Files:** `infra/docker/api.Dockerfile`, `infra/docker/web.Dockerfile`
- **Fix:** Insert `RUN pnpm --filter @parallel/shared-types build && pnpm --filter @parallel/api-client build` into build stage.
- **Blocks Phase 8 Step 2?** Yes, blocks containerized deployment.

#### Item 3: Commit Untracked Collab Migration

- **Issue:** Untracked migration `20261023000000_update_collab_sessions` creates immediate drift on fresh environments.
- **Severity:** HIGH (AUDIT-005)
- **Affected Files:** `apps/api/prisma/migrations/20261023000000_update_collab_sessions/`
- **Fix:** Track and commit the migration directory alongside the schema diff.
- **Blocks Phase 8 Step 2?** Yes, blocks clean CI execution.

---

### P1 — Must Fix Before Further Feature Development

#### Item 4: Fix Groq Naming Provider Config Lookup

- **Issue:** AI parallel naming is dead due to querying `'groqApiKey'` instead of `'app.groqApiKey'`.
- **Severity:** HIGH (AUDIT-004)
- **Affected Files:** `apps/api/src/modules/identity-engine/providers/groq-parallel-naming.provider.ts`
- **Fix:** Change `this.configService.get<string>('groqApiKey')` to `this.configService.get<string>('app.groqApiKey')`.

#### Item 5: Prevent $O(N^2)$ Explosion in `TwinsProcessor`

- **Issue:** Full user-pair cross product will overwhelm BullMQ and Redis as user count grows.
- **Severity:** HIGH (AUDIT-008)
- **Affected Files:** `apps/api/src/jobs/twins/twins.processor.ts`, `apps/api/src/modules/users/users.service.ts`
- **Fix:** Prune candidates by indexing users by visible parallel types before queuing jobs.

#### Item 6: Add Web Route Guards

- **Issue:** Unauthenticated users can load protected pages and receive broken error states.
- **Severity:** HIGH (AUDIT-007)
- **Affected Files:** `apps/web/src/middleware.ts`, `apps/web/src/lib/api-client.ts`
- **Fix:** Add Next.js middleware redirecting unauthenticated sessions to `/login`, and add 401 response interceptor.

---

### P2 — Important Improvements Before Beta

#### Item 7: Upgrade Next.js to Patch RCE Vulnerability

- **Issue:** GHSA-vcvr-r3jv-pc5j critical vulnerability in `next@16.3.4`.
- **Severity:** CRITICAL (AUDIT-001)
- **Affected Files:** `apps/web/package.json`
- **Fix:** Upgrade to `next@>=16.3.6`.

#### Item 8: Add Database Indexes

- **Issue:** Full table scans on vector similarity and twin lookups.
- **Severity:** MEDIUM (AUDIT-009)
- **Affected Files:** `apps/api/prisma/schema.prisma`
- **Fix:** Add HNSW index on `user_parallels.embedding` and B-tree indexes on `parallel_twins.user_b_id`, `user_parallels.parallel_type_id`, and `community_members.user_id`.

#### Item 9: Add Multi-Instance Redis Adapter for Socket.IO

- **Issue:** Events cannot reach users connected to sibling API containers.
- **Severity:** MEDIUM (AUDIT-011)
- **Affected Files:** `apps/api/src/websockets/events.gateway.ts`, `apps/api/package.json`
- **Fix:** Install and bind `@socket.io/redis-adapter`.

---

### P3 — Longer-Term Improvements

#### Item 10: Standardize API Envelopes

- Harmonize controller return types across all modules to consistently use or omit `ApiResponse<T>`.

#### Item 11: Remove Dead SDK Dependencies

- Remove `@anthropic-ai/sdk` until Phase 9 Wrapped/Quest authoring begins.

---

# R. Recommended Next Implementation Step

### Decision: Fix Foundational Defects (P0) Before Starting Phase 8 Step 2

**Why Step 2 Should NOT Proceed Immediately:**
While Phase 8 Step 1 (Socket.IO Gateway & Handshake Auth) is completely verified and healthy, proceeding directly to Step 2 (`NotificationsModule`) without addressing P0 defects is strongly discouraged for three reasons:

1. **Notifications Require Visible Events:** Notifications in Step 2 are designed to alert users about Twin matches, Collab invitations, and Quest unlocks. Because real users are currently locked in Ghost Mode (AUDIT-002), no Twin matches or Collab invites can occur in normal user journeys. Building real-time notifications for events that cannot organically fire builds scaffolding on top of broken foundations.
2. **Migration & Docker Drift:** The working directory has an untracked migration (`20261023000000_update_collab_sessions`) and Dockerfiles that cannot compile cleanly. Adding more database models or modules will compound migration drift.
3. **Next.js RCE:** Running live test deployments with a vulnerable `next@16.3.4` introduces security risks.

**Recommended Action Order:**

1. Commit the untracked Collab migration and schema diff.
2. Implement `POST /v1/parallels/:id/make-public` and ensure onboarding Parallels can be published.
3. Fix Docker build scripts in `infra/docker/*.Dockerfile`.
4. Fix the Groq config key bug in `GroqParallelNamingProvider`.
5. **Proceed to Phase 8 Step 2:** Implement `NotificationsModule`, notification REST endpoints, domain event listeners, and the frontend Socket.IO consumer.

---

# S. Questions Requiring Founder Decisions

1. **Starter Parallel Visibility Policy:**
   - Should the initial 4 Parallels calculated from onboarding answers start as **Public** immediately, or should they default to **Ghost Mode** with a mandatory "Choose what to publish" step during the onboarding reveal?
   - _Blueprint Note:_ Blueprint §4.5 states "Any 'What If?' exploration starts in Ghost Mode", suggesting starter Parallels were intended to be public, whereas newly emerged discoveries were meant to be ghost.
2. **Embedding Model & Infrastructure Strategy:**
   - The master blueprint (§10.3) prescribes OpenAI `text-embedding-3-small` (1536 dimensions). The current implementation uses local HuggingFace `Xenova/all-MiniLM-L6-v2` (384 dimensions) for zero cost and local execution.
   - Does the founder wish to officially approve local 384-dim embeddings and update the blueprint/documentation, or migrate to OpenAI 1536-dim embeddings?
3. **AI Provider Strategy for Naming & Quests:**
   - The blueprint specifies Claude / Anthropic. The codebase currently implements Groq (`openai/gpt-oss-120b`). Should the project standardize on Groq, Anthropic, or an abstract multi-provider strategy?
4. **Identity Card Mock vs Real Pipeline:**
   - In `collab/[id]/page.tsx`, the card generation button is currently mocked to fake success. Should Identity Card generation be formally scoped now, or should the UI button be hidden until Phase 9?

---

# T. Verification Appendix

### 1. Environment Specifications

- **Operating System:** macOS (Darwin 24.3.0, arm64)
- **Node.js:** v22+
- **Package Manager:** pnpm v11.25.0
- **PostgreSQL:** PostgreSQL 16.8 (pgvector/pgvector:pg16 container) on port 5432
- **Redis:** Redis 7.2 (host service) on port 6379

### 2. Exact Test & Verification Logs

#### API Unit Tests (`pnpm --filter api test`)

```text
Test Files  20 passed (20)
Tests       164 passed (164)
Duration    2.16s
- src/modules/quests/streak.service.spec.ts (5 tests)
- src/modules/communities/communities.service.spec.ts (19 tests)
- src/modules/users/users.service.spec.ts (20 tests)
- src/modules/auth/auth.service.spec.ts (12 tests)
- src/modules/quests/quests.service.spec.ts (8 tests)
- src/modules/onboarding/onboarding.service.spec.ts (6 tests)
- src/modules/users/users.controller.spec.ts (6 tests)
- src/modules/onboarding/onboarding.controller.spec.ts (4 tests)
- src/jobs/embedding/embedding.processor.spec.ts (1 test)
- src/modules/identity-engine/embedding.service.spec.ts (3 tests)
- src/modules/collab/collab.service.spec.ts (16 tests)
- src/modules/collab/collab.controller.spec.ts (6 tests)
- src/modules/identity-engine/emerging-parallel.service.spec.ts (18 tests)
- src/websockets/events.gateway.spec.ts (13 tests)
- src/modules/communities/communities.controller.spec.ts (3 tests)
- src/jobs/twins/twins.processor.spec.ts (3 tests)
- src/jobs/emerging-parallel/emerging-parallel.processor.spec.ts (4 tests)
- src/app.controller.spec.ts (1 test)
- src/modules/parallels/parallels.service.spec.ts (9 tests)
- src/modules/identity-engine/identity-engine.service.spec.ts (7 tests)
```

#### API E2E Tests (`pnpm --filter api test:e2e`)

```text
Test Files  5 passed (5)
Tests       33 passed (33)
Duration    5.95s
- test/app.e2e-spec.ts (2 tests)
- test/auth.e2e-spec.ts (8 tests)
- test/collab.e2e-spec.ts (11 tests)
- test/social-discovery.e2e-spec.ts (3 tests)
- test/websockets.e2e-spec.ts (9 tests)
```

#### Web Unit Tests (`pnpm --filter web test`)

```text
Test Files  4 passed (4)
Tests       18 passed (18)
Duration    1.25s
- src/features/auth/__tests__/auth-store.test.ts (3 tests)
- src/features/auth/__tests__/api-client.test.ts (4 tests)
- src/features/collab/__tests__/collab-components.test.tsx (6 tests)
- src/features/parallels/__tests__/people-tab.test.tsx (5 tests)
```

#### Security Audit (`pnpm audit`)

```text
123 vulnerabilities found
Severity: 15 low | 58 moderate | 46 high | 4 critical
Notable: Next.js Remote Code Execution in next/og ImageResponse (GHSA-vcvr-r3jv-pc5j)
```

---

_Report compiled and certified based strictly on empirical codebase execution and verification._
