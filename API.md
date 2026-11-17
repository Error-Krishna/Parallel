# Parallel — API Design

> **Purpose:** The REST contract between `apps/web`/`apps/mobile` and `apps/api`. Endpoints are grouped in the same implementation order as `FEATURE.md` §18 — build (and read) this document top to bottom. Request/response shapes should stay in sync with `packages/shared-types/src/index.ts`; when they drift, fix the code and this file together.
>
> **Source:** `PARALLEL_master_blueprint_final.md` §10/§13, `FEATURE.md`, `DATABASE.md`, `apps/api/src/*` (actual implementation)

---

## 1. Conventions

- **Base URL**: `http://localhost:4000` locally (or `NEXT_PUBLIC_API_URL` in `apps/web`). All routes are versioned via NestJS global prefix `/v1/...` (e.g. the health check is `/v1/health`, not `/health`).
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
- **Rate limiting**: Redis-backed (`RedisRateLimitGuard` + `@RateLimit(...)` in `common/guards/rate-limit.guard.ts`), emitting `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on `429 Too Many Requests`. Applied to auth endpoints (`signup`, `login`) and extensible to any route.

---

## 2. Already implemented

| Method   | Path                  | Auth | Description                                                                                                                |
| -------- | --------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/v1`                 | —    | Root status check — `{ "name": "Parallel API", "status": "running" }`                                                      |
| `GET`    | `/v1/health`          | —    | Pings Postgres + Redis, returns `HealthResponse` (see `shared-types`) — used by deploy/monitoring, not by the frontend app |
| `POST`   | `/v1/auth/signup`     | —    | `SignupDto { email, username, password }` → `data: { user: PublicUser, accessToken }`                                      |
| `POST`   | `/v1/auth/login`      | —    | `LoginDto { email, password }` → `data: { user: PublicUser, accessToken }`                                                 |
| `POST`   | `/v1/auth/logout`     | 🔒   | → `data: null` — **actually revokes the token** (Redis-backed, see §3), not a client-side no-op                            |
| `GET`    | `/v1/users/me`        | 🔒   | → `data: PublicUser`                                                                                                       |
| `PATCH`  | `/v1/users/me`        | 🔒   | `UpdateUserDto` (partial, rejects an empty body) → `data: PublicUser`                                                      |
| `GET`    | `/v1/users/me/export` | 🔒   | → `data: UserDataExport` — full self-serve JSON export (explicitly omits `passwordHash`)                                   |
| `DELETE` | `/v1/users/me`        | 🔒   | `204 No Content` — cascading account deletion + immediate Redis JWT revocation (`auth:revoked:<jti>`)                      |
| `GET`    | `/v1/users/:username` | 🔒   | → `data: PublicUser`                                                                                                       |

See §4–§10 below for the full set of implemented endpoints across Onboarding, Parallels, Quests, Content, Social, Communities, Notifications, Cards, and Wrapped.

---

## 3. Auth (`modules/auth`, `modules/users`) — ✅ implemented

Endpoints listed in §2 above. Hashing: **bcryptjs** (pure JS — chosen over `argon2`/`bcrypt` to avoid native-module build friction, same class of issue as the Prisma CLI note in `apps/api/CLAUDE.md`). Salt rounds are configurable via `BCRYPT_SALT_ROUNDS` (`config/configuration.ts`) — **the in-source default is 12**, the production-appropriate value; only override it lower in CI/test env for speed (see `.github/workflows/ci.yml`), never in a real `.env`. Email and username are normalized (`trim().toLowerCase()`) before lookup/storage, so `Alex@Example.com` and `alex@example.com` can't both sign up as distinct accounts. Passwords are never logged or returned in any response — `UsersService.toPublicUser()` strips both `passwordHash` and `email` before anything reaches a controller response (verified directly by an e2e assertion, not just a unit test's claim).

Tokens: JWT via `@nestjs/jwt`, `Authorization: Bearer <token>`, secret/expiry/issuer/audience from `JWT_SECRET`/`JWT_EXPIRES_IN`/`JWT_ISSUER`/`JWT_AUDIENCE` (`apps/api/.env`). The signed payload is deliberately minimal — `{ sub: userId, jti: <random> }`, no `username` — since a token issued before a username change would otherwise carry a stale value for its entire remaining lifetime; look up anything beyond the user's ID via `UsersService`. `main.ts` refuses to boot if `JWT_SECRET` is missing or shorter than 32 characters, and `JwtStrategy` rejects any token whose issuer/audience don't match, even if the signature is otherwise valid.

**Logout is real, server-side revocation — not a client-side no-op.** Each token carries a `jti` (JWT ID); `POST /v1/auth/logout` writes `auth:revoked:<jti>` into Redis with a TTL equal to the token's remaining lifetime. `JwtStrategy` checks this key on _every_ authenticated request, so a logged-out token stops working immediately rather than staying valid until its natural expiry. This means every protected request costs one Redis round-trip; if Redis is unreachable, `JwtStrategy` fails closed (`503`, never a silent pass-through) — the deliberate tradeoff of a stateless-JWT-plus-revocation-list hybrid.

Verified per-request by `JwtStrategy` (`modules/auth/strategies/jwt.strategy.ts`) and enforced with `@UseGuards(JwtAuthGuard)` — see `UsersController` for the pattern to copy in every future protected controller. The decoded payload becomes `request.user` (`{ id, jti, exp }`), retrievable in any controller via the `@CurrentUser()` decorator (`common/decorators/current-user.decorator.ts`).

Same error message ("Invalid email or password") for both a nonexistent email and a wrong password — deliberate, prevents account enumeration.

Username rules (`common/validators/username.validator.ts`'s `@IsUsername()`) are shared between `SignupDto` and `UpdateUserDto` — kept as one decorator specifically so "create" and "edit" can't drift apart the way they once did.

---

## 4. Onboarding — ✅ implemented

| Method | Path                       | Auth | Request                                            | Response                                                                                                                                                                                       |
| ------ | -------------------------- | ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/v1/onboarding/questions` | 🔒   | —                                                  | `OnboardingQuestion[]`, static/config-driven, not user-specific. **Unwrapped** — not behind the success envelope (see §1), a deliberate split from `auth`/`users` for now                      |
| `POST` | `/v1/onboarding/answers`   | 🔒   | `OnboardingAnswerDto { questionKey, answerValue }` | `204 No Content` — upserts one answer (resubmitting the same `questionKey` overwrites, never duplicates); rejects an unknown `questionKey` or an `answerValue` outside that question's options |
| `GET`  | `/v1/onboarding/status`    | 🔒   | —                                                  | `OnboardingStatusDto { completed, answeredCount, totalQuestions, answers }` — also unwrapped. `apps/web`'s login flow calls this to route a returning user (`app/login/page.tsx`)              |

**Also implemented, not in the original table**: `POST /v1/onboarding/complete` — runs the Identity Engine's initial scoring pass (`IdentityEngineService.generateInitialMap`, see §5). Idempotent — safe to call more than once; a repeat call just returns the existing map rather than re-scoring. Returns `ParallelMapResponse`, also unwrapped. Called once by `app/onboarding/reveal/page.tsx` right after the last question — **not** on every login (see §5's note on why that matters).

---

## 5. Identity Engine / Parallel Map — ✅ implemented (`modules/identity-engine`, `modules/parallels`)

Onboarding creates 4 **public** starter Parallels (`isGhost: false`) so new users immediately appear on profiles, discovery, and Twin matching. Newly emerging Parallels discovered later by `EmergingParallelProcessor` default to **Ghost Mode** (`isGhost: true`, private) until the user explicitly publishes them.

> **ID convention:** `GET /v1/parallels/:id`, `POST /v1/parallels/:id/enter`, `/feed`, `/quests`, and `/people` take a `ParallelType.id`. Visibility lifecycle mutations (`make-public`, `hide`, `unhide`, `DELETE`) take a `UserParallel.id` and enforce atomic owner-scoped writes with enumeration-safe `404` on non-owned/nonexistent records.

| Method   | Path                            | Auth | Request | Response                                                                                                                                                       |
| -------- | ------------------------------- | ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/v1/parallels/map`             | 🔒   | —       | `ParallelMapResponse` (visible + Ghost Parallels on the map; excludes hidden & dismissed)                                                                      |
| `GET`    | `/v1/parallels/manage`          | 🔒   | —       | `UserParallelDto[]` (active Public, Ghost, and Hidden Parallels for Profile > My Parallels; excludes dismissed)                                                |
| `GET`    | `/v1/parallels/:id`             | 🔒   | —       | `ParallelTypeDto` detail (`id`, `name`, `description`, `icon`)                                                                                                 |
| `POST`   | `/v1/parallels/:id/enter`       | 🔒   | —       | logs a `PARALLEL_ENTER` interest signal, returns `ParallelTypeDto`                                                                                             |
| `POST`   | `/v1/parallels/:id/make-public` | 🔒   | —       | `200 OK` — atomically flips `isGhost → false` (idempotent, preserves `isHidden`), returns updated `UserParallelDto`                                            |
| `POST`   | `/v1/parallels/:id/hide`        | 🔒   | —       | `200 OK` — sets `isHidden → true` (reversible), returns updated `UserParallelDto`                                                                              |
| `POST`   | `/v1/parallels/:id/unhide`      | 🔒   | —       | `200 OK` — atomically sets `isHidden → false` (idempotent, preserves `isGhost`), returns updated `UserParallelDto`                                             |
| `DELETE` | `/v1/parallels/:id`             | 🔒   | —       | `204 No Content` — soft-delete setting `dismissedAt` (idempotent), preventing Identity Engine re-suggestion                                                    |
| `GET`    | `/v1/parallels/evolution`       | 🔒   | —       | whole-map evolution grouped by `parallelTypeId` with `{ currentStrengthPct, previousStrengthPct, deltaPct }`, powered by `EvolutionProcessor` BullMQ snapshots |

Scoring, embedding (`EmbeddingProcessor` with local 384-dim HuggingFace model), evolution snapshots (`EvolutionProcessor`), emerging Parallel detection (`EmergingParallelProcessor` with optional free-tier Groq naming), Twin matching (`TwinsProcessor`), and Community clustering (`CommunitiesProcessor`) all run as **BullMQ background jobs** (`apps/api/src/jobs/`).

---

## 6. Quests & Streaks — ✅ implemented (`modules/quests`)

**Implemented**: `GET /v1/parallels/:id/quests`, `GET /v1/quests/:questId`, `POST /v1/quests/:id/start`, and `POST /v1/quests/:id/complete-step`, wired into the Quests tab on `/parallel/[id]` with completion rewards (`UserQuestReward`) and `QUEST_COMPLETED` notifications. Streaks (`StreakService.touch()`, 48-hour window) are shared between quest steps and content interactions. Starter quests and content items can be idempotently seeded via `apps/api/scripts/seed-starter-content.ts`.

| Method | Path                           | Auth | Request | Response                                                                                                                         |
| ------ | ------------------------------ | ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/v1/parallels/:id/quests`     | 🔒   | —       | quests scoped to this Parallel type, each with the current user's `progress`                                                     |
| `GET`  | `/v1/quests/:questId`          | 🔒   | —       | single `QuestDto` with the authenticated user's progress (`404` if not found)                                                    |
| `POST` | `/v1/quests/:id/start`         | 🔒   | —       | creates `UserQuestProgress` row, `status: IN_PROGRESS` — idempotent if already started                                           |
| `POST` | `/v1/quests/:id/complete-step` | 🔒   | —       | advances `currentStep` by one; on the final step, sets `status: COMPLETED`, grants `UserQuestReward`, and creates a notification |

---

## 7. Feed & Content — ✅ implemented (`modules/parallels`)

Built inside `modules/parallels` (`ParallelsController` / `ContentController`). `GET /v1/parallels/:id/feed` is cursor-paginated. Starter curated items are seeded via `apps/api/scripts/seed-starter-content.ts`.

| Method   | Path                           | Auth | Request                                       | Response                                         |
| -------- | ------------------------------ | ---- | --------------------------------------------- | ------------------------------------------------ |
| `GET`    | `/v1/parallels/:id/feed`       | 🔒   | `?cursor=&limit=`                             | paginated `ParallelFeedResponse`                 |
| `GET`    | `/v1/content/:id`              | 🔒   | —                                             | `ContentItemDto` detail                          |
| `POST`   | `/v1/content/:id/interactions` | 🔒   | `{ signalType: 'VIEW'\|'LIKE'\|'SAVE'\|... }` | `204` — writes `InterestSignal` & touches streak |
| `DELETE` | `/v1/content/:id/interactions` | 🔒   | `?signalType=LIKE\|SAVE`                      | `204` — removes toggleable interaction           |

---

## 8. Social & Communities — ✅ implemented (`modules/users`, `modules/parallels`, `modules/communities`)

Follow/unfollow (`POST /v1/users/:userId/follow` → `201` / `POST /v1/users/:userId/unfollow` → `204`) are idempotent, reject self-follow, and emit a `NEW_FOLLOWER` notification. Twin matching runs asynchronously via BullMQ (`TwinsProcessor`) using inverted-index candidate pruning (`UsersService.getTwinCandidatePairs(minSharedParallels = 2)`) and notifies both users on new matches; `GET /v1/users/twins` reads persisted rows from `parallel_twins`. Communities (`GET /v1/communities`, `POST /v1/communities/:id/join`, `POST /v1/communities/:id/skip`) are implemented alongside `CommunitiesProcessor`.

| Method | Path                          | Auth | Request | Response                                                          |
| ------ | ----------------------------- | ---- | ------- | ----------------------------------------------------------------- |
| `POST` | `/v1/users/:userId/follow`    | 🔒   | —       | `201` — idempotent, rejects self-follow, notifies followee        |
| `POST` | `/v1/users/:userId/unfollow`  | 🔒   | —       | `204` — idempotent, rejects self-unfollow                         |
| `GET`  | `/v1/users/following`         | 🔒   | —       | current user's list of followee IDs                               |
| `GET`  | `/v1/users/:userId/parallels` | 🔒   | —       | that user's _visible_ Parallels only (`UserVisibleParallelDto[]`) |
| `GET`  | `/v1/parallels/:id/people`    | 🔒   | —       | suggested people exploring this Parallel visibly                  |
| `GET`  | `/v1/users/twins`             | 🔒   | —       | current user's persisted Twin matches (`TwinMatchDto[]`)          |
| `GET`  | `/v1/communities`             | 🔒   | —       | recommended communities for the current user (`CommunityDto[]`)   |
| `POST` | `/v1/communities/:id/join`    | 🔒   | —       | `204` — joins community                                           |
| `POST` | `/v1/communities/:id/skip`    | 🔒   | —       | `204` — skips community recommendation                            |

---

## 9. Growth mechanics — ✅ implemented (`modules/cards`, `modules/wrapped`)

| Method | Path                   | Auth       | Request                                        | Response                                                                                                                                                                            |
| ------ | ---------------------- | ---------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/v1/cards`            | 🔒         | `CreateIdentityCardDto { cardType, sourceId }` | `201` — validates ownership & rejects private Ghost/hidden Parallels (`400`); persists `IdentityCard` with self-hosted SVG URL `/v1/cards/:id/image`; returns `{ id, jobId, card }` |
| `GET`  | `/v1/cards/me`         | 🔒         | —                                              | `IdentityCardDto[]` created by the authenticated user                                                                                                                               |
| `GET`  | `/v1/cards/:id`        | — (public) | —                                              | `IdentityCardDto` with sanitized public metadata, backing `/card/[id]`                                                                                                              |
| `GET`  | `/v1/cards/:id/image`  | — (public) | —                                              | `image/svg+xml` deterministic 1080×1920 portrait card (XML-escaped, `X-Content-Type-Options: nosniff`, zero paid storage)                                                           |
| `POST` | `/v1/wrapped/generate` | 🔒         | `{ period?: 'MONTHLY' \| 'ANNUAL' }`           | `201` — computes & persists `ParallelWrapped` strictly from public Parallels (excluding Ghost/hidden), emits `WRAPPED_READY` notification, returns `WrappedRecapDto`                |
| `GET`  | `/v1/wrapped/latest`   | 🔒         | —                                              | current user's most recent `WrappedRecapDto`, or `null` if none exists yet                                                                                                          |
| `GET`  | `/v1/wrapped/:id`      | — (public) | —                                              | `WrappedRecapDto` with resolved `username` and `parallelNames`, backing `/wrapped/[id]`                                                                                             |

---

## 10. Notifications — ✅ implemented (`modules/notifications`)

| Method | Path                         | Auth | Request           | Response                                                                                                      |
| ------ | ---------------------------- | ---- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/v1/notifications`          | 🔒   | `?cursor=&limit=` | `NotificationsListResponse { items, nextCursor, unreadCount }` (cursor-paginated, ownership-validated cursor) |
| `POST` | `/v1/notifications/read-all` | 🔒   | —                 | `200 OK` — `{ updatedCount }`                                                                                 |
| `POST` | `/v1/notifications/:id/read` | 🔒   | —                 | `204 No Content` — atomic owner-scoped mark-read (idempotent; enumeration-safe `404` for foreign/missing ID)  |

Durable notifications are persisted in `notifications` on follow (`NEW_FOLLOWER`), new Twin match (`TWIN_MATCHED`), Quest completion (`QUEST_COMPLETED`), and Wrapped generation (`WRAPPED_READY`), and surfaced in the `NotificationBell` popover in the `/map` header.

---

## 11. Admin (Phase 10+ — `modules/admin`)

Deliberately unspecified until Hardening (Phase 10) — will cover: content moderation queue, Roulette report handling, manual community seeding. Document endpoints here once built; don't build ahead of the phase that needs them.

---

## 12. Deferred (P3/P4, per `FEATURE.md` §17)

- `POST /v1/roulette/queue`, `/v1/roulette/:id/*` — Roulette matching, **requires the safety/moderation model to exist first** (see `DATABASE.md` §4 and `apps/api/CLAUDE.md`).
- Any messaging/DM endpoints — explicitly out of scope (blueprint §7 non-goals).
