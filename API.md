# Parallel — API Design

> **Purpose:** The REST contract between `apps/web`/`apps/mobile` and `apps/api`. Endpoints are grouped in the same implementation order as `FEATURE.md` §18 — build (and read) this document top to bottom. Request/response shapes should stay in sync with `packages/shared-types/src/index.ts`; when they drift, fix the code and this file together.
>
> **Source:** `PARALLEL_master_blueprint_final.md` §10/§13, `FEATURE.md`, `DATABASE.md`, `apps/api/src/*` (actual implementation)

---

## 1. Conventions

- **Base URL**: `http://localhost:3001` locally (`NEXT_PUBLIC_API_URL` in `apps/web`). All routes are versioned via NestJS URI versioning, already configured in `main.ts`: every path is prefixed `/v1/...` (e.g. the health check is `/v1/health`, not `/health`).
- **Auth**: Bearer JWT in `Authorization: Bearer <token>` header, issued by the `auth` module (Phase 5). Endpoints marked 🔒 below require it; NestJS route guards enforce this, not manual checks in controller bodies.
- **Content type**: `application/json` throughout.
- **Validation**: every request body is a `class-validator` DTO. The global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true, transform: true`, set in `main.ts`) strips unknown fields and rejects anything that doesn't match the DTO shape — a 400 with a validation error array, before the request ever reaches a controller method.
- **Error shape** (from `AllExceptionsFilter`, already implemented):
  ```json
  {
    "statusCode": 400,
    "path": "/v1/onboarding/answers",
    "timestamp": "2026-09-05T10:00:00.000Z",
    "message": "validation or error message here"
  }
  ```
  No stack traces or internal details are ever sent to the client — unhandled exceptions are logged server-side and returned as a generic `500` with this same shape.
- **Pagination**: cursor-based (`?cursor=<id>&limit=<n>`) for any list endpoint that can grow unbounded (feed, notifications) — not offset-based, to stay stable as new items are inserted.
- **Rate limiting**: Redis-backed, applied per-route via a guard once auth exists (Phase 10 Hardening) — every public-facing mutation endpoint needs one, not just the ones that "feel" abuse-prone.

---

## 2. Already implemented

| Method  | Path                  | Auth | Description                                                                                                                |
| ------- | --------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/v1`                 | —    | Root status check — `{ "name": "Parallel API", "status": "running" }`                                                      |
| `GET`   | `/v1/health`          | —    | Pings Postgres + Redis, returns `HealthResponse` (see `shared-types`) — used by deploy/monitoring, not by the frontend app |
| `POST`  | `/v1/auth/signup`     | —    | Create an account. `SignupDto { email, username, password }` → `{ user: PublicUser, accessToken }`                         |
| `POST`  | `/v1/auth/login`      | —    | `LoginDto { email, password }` → `{ user: PublicUser, accessToken }`                                                       |
| `POST`  | `/v1/auth/logout`     | 🔒   | `204` — stateless JWT, client discards the token                                                                           |
| `GET`   | `/v1/users/me`        | 🔒   | → `PublicUser`                                                                                                             |
| `PATCH` | `/v1/users/me`        | 🔒   | `UpdateUserDto` (partial) → `PublicUser`                                                                                   |
| `GET`   | `/v1/users/:username` | 🔒   | → `PublicUser`                                                                                                             |

Everything else in this document below §3 is spec, not yet built — update this table as each module ships.

---

## 3. Auth (`modules/auth`, `modules/users`) — ✅ implemented

Endpoints listed in §2 above. Hashing: **bcryptjs** (pure JS, 12 salt rounds) — chosen over `argon2`/`bcrypt` specifically to avoid native-module build friction in this monorepo (same class of issue as the Prisma CLI note in `apps/api/CLAUDE.md`). Passwords are never logged or returned in any response — `UsersService.toPublicUser()` strips both `passwordHash` and `email` before anything reaches a controller response.

Tokens: JWT via `@nestjs/jwt`, `Authorization: Bearer <token>`, secret/expiry from `JWT_SECRET`/`JWT_EXPIRES_IN` (`apps/api/.env`). Verified per-request by `JwtStrategy` (`modules/auth/strategies/jwt.strategy.ts`) and enforced with `@UseGuards(JwtAuthGuard)` — see `UsersController` for the pattern to copy in every future protected controller. The decoded payload becomes `request.user`, retrievable in any controller via the `@CurrentUser()` decorator (`common/decorators/current-user.decorator.ts`).

Same error message ("Invalid email or password") for both a nonexistent email and a wrong password — deliberate, prevents account enumeration.

---

## 4. Onboarding (Phase 5 — `modules/onboarding`)

| Method | Path                       | Auth | Request                                            | Response                                                                                                                              |
| ------ | -------------------------- | ---- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/v1/onboarding/questions` | 🔒   | —                                                  | ordered list of onboarding questions (static/config-driven, not user-specific)                                                        |
| `POST` | `/v1/onboarding/answers`   | 🔒   | `OnboardingAnswerDto { questionKey, answerValue }` | `204 No Content` — persists one answer; called once per question as the user progresses (see `USER_FLOW.md` Flow 2's resume behavior) |
| `POST` | `/v1/onboarding/complete`  | 🔒   | —                                                  | triggers the first-pass rules-based Identity Engine scoring job, returns once the initial map is ready: `ParallelMapResponse`         |

---

## 5. Identity Engine / Parallel Map (Phase 5–6 — `modules/identity-engine`, `modules/parallels`)

| Method   | Path                            | Auth | Request              | Response                                                                                                                                                                                                                                                           |
| -------- | ------------------------------- | ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/v1/parallels/map`             | 🔒   | —                    | `ParallelMapResponse` (current user's full map — see `shared-types`)                                                                                                                                                                                               |
| `GET`    | `/v1/parallels/:id`             | 🔒   | —                    | `UserParallelDto` detail                                                                                                                                                                                                                                           |
| `POST`   | `/v1/parallels/:id/make-public` | 🔒   | —                    | flips `isGhost → false`; `204`                                                                                                                                                                                                                                     |
| `POST`   | `/v1/parallels/:id/hide`        | 🔒   | —                    | sets `isHidden → true`; `204` — reversible                                                                                                                                                                                                                         |
| `POST`   | `/v1/parallels/:id/unhide`      | 🔒   | —                    | sets `isHidden → false`; `204`                                                                                                                                                                                                                                     |
| `DELETE` | `/v1/parallels/:id`             | 🔒   | —                    | user-initiated "reject" (Flow 3a) or "remove" (Flow 14) — same mechanism, sets `dismissedAt` (soft delete, `DATABASE.md` §2.3) rather than a hard delete, so the Identity Engine can check for it before re-suggesting the same `(user, parallelType)` pair; `204` |
| `GET`    | `/v1/parallels/:id/evolution`   | 🔒   | `?range=month\|year` | time series for the Identity Evolution view (Flow 8)                                                                                                                                                                                                               |

Scoring/embedding/new-Parallel-detection are **background jobs** (BullMQ, `apps/api/src/jobs/`), not synchronous endpoints — nothing in this section computes a score inline on request.

---

## 6. Quests & Streaks (Phase 6/9 — `modules/quests`)

| Method | Path                                       | Auth | Request | Response                                                                              |
| ------ | ------------------------------------------ | ---- | ------- | ------------------------------------------------------------------------------------- |
| `GET`  | `/v1/parallels/:id/quests`                 | 🔒   | —       | quests scoped to this Parallel type                                                   |
| `GET`  | `/v1/quests/:id`                           | 🔒   | —       | quest detail + current user's progress if any                                         |
| `POST` | `/v1/quests/:id/start`                     | 🔒   | —       | creates `UserQuestProgress` row, `status: IN_PROGRESS`                                |
| `POST` | `/v1/quests/:id/steps/:stepIndex/complete` | 🔒   | —       | advances `currentStep`; if final step, sets `status: COMPLETED` and grants the reward |

---

## 7. Feed & Content (Phase 5/7 — `modules/feed`)

| Method | Path                           | Auth | Request                                       | Response                               |
| ------ | ------------------------------ | ---- | --------------------------------------------- | -------------------------------------- |
| `GET`  | `/v1/parallels/:id/feed`       | 🔒   | `?cursor=&limit=`                             | paginated `ContentItem[]`              |
| `GET`  | `/v1/content/:id`              | 🔒   | —                                             | content detail                         |
| `POST` | `/v1/content/:id/interactions` | 🔒   | `{ signalType: 'VIEW'\|'LIKE'\|'SAVE'\|... }` | `204` — writes an `InterestSignal` row |

---

## 8. Social (Phase 7 — `modules/social`, `modules/communities`)

| Method   | Path                         | Auth | Request                            | Response                                                  |
| -------- | ---------------------------- | ---- | ---------------------------------- | --------------------------------------------------------- |
| `POST`   | `/v1/users/:username/follow` | 🔒   | —                                  | `204`                                                     |
| `DELETE` | `/v1/users/:username/follow` | 🔒   | —                                  | `204` (unfollow)                                          |
| `GET`    | `/v1/parallels/:id/people`   | 🔒   | —                                  | suggested people, scoped to this Parallel's intersections |
| `GET`    | `/v1/twins`                  | 🔒   | —                                  | current user's computed Twin matches                      |
| `GET`    | `/v1/communities`            | 🔒   | `?parallelTypeId=`                 | communities related to a Parallel type                    |
| `POST`   | `/v1/communities/:id/join`   | 🔒   | —                                  | `204`                                                     |
| `POST`   | `/v1/collab/invite`          | 🔒   | `{ toUsername, myParallelTypeId }` | `CollabSession` (`PENDING`)                               |
| `POST`   | `/v1/collab/:id/accept`      | 🔒   | `{ myParallelTypeId }`             | `CollabSession` (`ACTIVE`)                                |

---

## 9. Growth mechanics (Phase 9 — `modules/wrapped`, `modules/cards`)

| Method | Path                 | Auth       | Request                                        | Response                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | -------------------- | ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/v1/cards`          | 🔒         | `CreateIdentityCardDto { cardType, sourceId }` | queues a render job, returns `{ jobId }`; client polls or receives a `notifications` event when ready. `sourceId` must point to a real row matching `cardType` (`UserParallel.id` for `PARALLEL`, `Quest.id` for `QUEST`, `ParallelWrapped.id` for `WRAPPED`, `Twin.id` for `TWIN`, `CollabSession.id` for `COLLAB`) — stored on the resulting row as `sourceType`/`sourceId` (`DATABASE.md` §2.7) |
| `GET`  | `/v1/cards/:id`      | — (public) | —                                              | `IdentityCardDto` — this is what the public `card/[id]` Next.js route (§10.1) fetches server-side                                                                                                                                                                                                                                                                                                  |
| `GET`  | `/v1/wrapped/:id`    | — (public) | —                                              | `WrappedRecapDto`, backing the public `wrapped/[id]` route                                                                                                                                                                                                                                                                                                                                         |
| `GET`  | `/v1/wrapped/latest` | 🔒         | —                                              | current user's most recent `WrappedRecapDto`, or `null` if none exists yet                                                                                                                                                                                                                                                                                                                         |

Note the two public (no-auth) endpoints above — they exist specifically so shared card/Wrapped links render correctly for people who don't have an account, per the blueprint's growth-loop design (§10.1, §4.3/§4.4).

---

## 10. Notifications & real-time (Phase 8 — `modules/notifications`, `src/websockets/`)

| Method | Path                         | Auth | Request           | Response                   |
| ------ | ---------------------------- | ---- | ----------------- | -------------------------- |
| `GET`  | `/v1/notifications`          | 🔒   | `?cursor=&limit=` | paginated `Notification[]` |
| `POST` | `/v1/notifications/:id/read` | 🔒   | —                 | `204`                      |

Real-time delivery (streak warnings, quest completions, Twin matches) is pushed over Socket.IO (`src/websockets/`), authenticated via the same JWT passed at connection time. The REST endpoints above are the durable fallback/history — the client should not rely on REST polling as the primary delivery mechanism once the WebSocket gateway exists.

---

## 11. Admin (Phase 10+ — `modules/admin`)

Deliberately unspecified until Hardening (Phase 10) — will cover: content moderation queue, Roulette report handling, manual community seeding. Document endpoints here once built; don't build ahead of the phase that needs them.

---

## 12. Deferred (P3/P4, per `FEATURE.md` §17)

- `POST /v1/roulette/queue`, `/v1/roulette/:id/*` — Roulette matching, **requires the safety/moderation model to exist first** (see `DATABASE.md` §4 and `apps/api/CLAUDE.md`).
- Any messaging/DM endpoints — explicitly out of scope (blueprint §7 non-goals).
