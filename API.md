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
- **Success shape**: every successful response is wrapped in a consistent envelope (`common/utils/api-response.ts`'s `apiResponse()`):
  ```json
  {
    "success": true,
    "message": "human-readable description of what happened",
    "data": {}
  }
  ```
  **Every response shape shown in the tables below (§4 onward) is the shape of `data`, not the top-level response body.** `message` is a short, human-readable confirmation ("Account created successfully", not restated field-by-field); `data` is `null` for actions with nothing meaningful to return (e.g. logout). Controllers throw via `apiError()` (same file's sibling) rather than constructing an error envelope manually — errors never go through this success envelope, they go through the shape below instead.
- **Error shape** (from `AllExceptionsFilter`, already implemented):
  ```json
  {
    "statusCode": 400,
    "path": "/v1/onboarding/answers",
    "timestamp": "2026-09-05T10:00:00.000Z",
    "message": "a single string, or an array of validation messages",
    "error": "Bad Request"
  }
  ```
  `message` is always either a plain string (most thrown exceptions) or a string array (class-validator's `ValidationPipe` errors) — **never** a nested object. `error` is optional (the short HTTP reason phrase) and only present when the underlying exception provided one. Prisma errors are mapped rather than leaked: `P2002` (unique constraint) → `409 Conflict`, `P2025` (record not found) → `404 Not Found`, anything else → generic `500` (logged server-side, not detailed to the client). No stack traces or internal details are ever sent to the client.
- **Pagination**: cursor-based (`?cursor=<id>&limit=<n>`) for any list endpoint that can grow unbounded (feed, notifications) — not offset-based, to stay stable as new items are inserted.
- **Rate limiting**: Redis-backed, applied per-route via a guard once auth exists (Phase 10 Hardening) — every public-facing mutation endpoint needs one, not just the ones that "feel" abuse-prone.

---

## 2. Already implemented

| Method  | Path                  | Auth | Description                                                                                                                |
| ------- | --------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/v1`                 | —    | Root status check — `{ "name": "Parallel API", "status": "running" }`                                                      |
| `GET`   | `/v1/health`          | —    | Pings Postgres + Redis, returns `HealthResponse` (see `shared-types`) — used by deploy/monitoring, not by the frontend app |
| `POST`  | `/v1/auth/signup`     | —    | `SignupDto { email, username, password }` → `data: { user: PublicUser, accessToken }`                                      |
| `POST`  | `/v1/auth/login`      | —    | `LoginDto { email, password }` → `data: { user: PublicUser, accessToken }`                                                 |
| `POST`  | `/v1/auth/logout`     | 🔒   | → `data: null` — **actually revokes the token** (Redis-backed, see §3), not a client-side no-op                            |
| `GET`   | `/v1/users/me`        | 🔒   | → `data: PublicUser`                                                                                                       |
| `PATCH` | `/v1/users/me`        | 🔒   | `UpdateUserDto` (partial, rejects an empty body) → `data: PublicUser`                                                      |
| `GET`   | `/v1/users/:username` | 🔒   | → `data: PublicUser`                                                                                                       |

Everything else in this document below §3 is spec, not yet built — update this table as each module ships.

---

## 3. Auth (`modules/auth`, `modules/users`) — ✅ implemented

Endpoints listed in §2 above. Hashing: **bcryptjs** (pure JS — chosen over `argon2`/`bcrypt` to avoid native-module build friction, same class of issue as the Prisma CLI note in `apps/api/CLAUDE.md`). Salt rounds are configurable via `BCRYPT_SALT_ROUNDS` (`config/configuration.ts`) — **the in-source default is 12**, the production-appropriate value; only override it lower in CI/test env for speed (see `.github/workflows/ci.yml`), never in a real `.env`. Email and username are normalized (`trim().toLowerCase()`) before lookup/storage, so `Alex@Example.com` and `alex@example.com` can't both sign up as distinct accounts. Passwords are never logged or returned in any response — `UsersService.toPublicUser()` strips both `passwordHash` and `email` before anything reaches a controller response (verified directly by an e2e assertion, not just a unit test's claim).

Tokens: JWT via `@nestjs/jwt`, `Authorization: Bearer <token>`, secret/expiry/issuer/audience from `JWT_SECRET`/`JWT_EXPIRES_IN`/`JWT_ISSUER`/`JWT_AUDIENCE` (`apps/api/.env`). The signed payload is deliberately minimal — `{ sub: userId, jti: <random> }`, no `username` — since a token issued before a username change would otherwise carry a stale value for its entire remaining lifetime; look up anything beyond the user's ID via `UsersService`. `main.ts` refuses to boot if `JWT_SECRET` is missing or shorter than 32 characters, and `JwtStrategy` rejects any token whose issuer/audience don't match, even if the signature is otherwise valid.

**Logout is real, server-side revocation — not a client-side no-op.** Each token carries a `jti` (JWT ID); `POST /v1/auth/logout` writes `auth:revoked:<jti>` into Redis with a TTL equal to the token's remaining lifetime. `JwtStrategy` checks this key on _every_ authenticated request, so a logged-out token stops working immediately rather than staying valid until its natural expiry. This means every protected request costs one Redis round-trip; if Redis is unreachable, `JwtStrategy` fails closed (`503`, never a silent pass-through) — the deliberate tradeoff of a stateless-JWT-plus-revocation-list hybrid.

Verified per-request by `JwtStrategy` (`modules/auth/strategies/jwt.strategy.ts`) and enforced with `@UseGuards(JwtAuthGuard)` — see `UsersController` for the pattern to copy in every future protected controller. The decoded payload becomes `request.user` (`{ id, jti, exp }`), retrievable in any controller via the `@CurrentUser()` decorator (`common/decorators/current-user.decorator.ts`).

Same error message ("Invalid email or password") for both a nonexistent email and a wrong password — deliberate, prevents account enumeration.

Username rules (`common/validators/username.validator.ts`'s `@IsUsername()`) are shared between `SignupDto` and `UpdateUserDto` — kept as one decorator specifically so "create" and "edit" can't drift apart the way they once did.

---

## 4. Onboarding — ✅ implemented (no Identity Engine scoring yet, see note below)

| Method | Path                       | Auth | Request                                            | Response                                                                                                                                                                                       |
| ------ | -------------------------- | ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/v1/onboarding/questions` | 🔒   | —                                                  | `OnboardingQuestion[]`, static/config-driven, not user-specific. **Unwrapped** — not behind the success envelope (see §1), a deliberate split from `auth`/`users` for now                      |
| `POST` | `/v1/onboarding/answers`   | 🔒   | `OnboardingAnswerDto { questionKey, answerValue }` | `204 No Content` — upserts one answer (resubmitting the same `questionKey` overwrites, never duplicates); rejects an unknown `questionKey` or an `answerValue` outside that question's options |
| `GET`  | `/v1/onboarding/status`    | 🔒   | —                                                  | `OnboardingStatusDto { completed, answeredCount, totalQuestions, answers }` — also unwrapped. `apps/web`'s login flow calls this to route a returning user (`app/login/page.tsx`)              |

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
