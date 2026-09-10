# Parallel — Database Design

> **Purpose:** Documents the actual, implemented schema at `apps/api/prisma/schema.prisma` — entity purpose, relationships, and the reasoning behind non-obvious choices. This describes real, migrated tables (migration `20260904045205_init` is already applied), not a proposal — if you change the schema, update this file in the same commit.
>
> **Source:** `PARALLEL_master_blueprint_final.md` §13, `apps/api/prisma/schema.prisma`

---

## 1. Engine & extensions

- **PostgreSQL 16**, run locally via `infra/docker-compose.yml` using the `pgvector/pgvector:pg16` image (pgvector extension baked in).
- **Prisma ORM 6.19** (deliberately pinned below the `8.0.0-rc` line — see `apps/api/CLAUDE.md` for why; the RC line has an incompatible, redesigned CLI).
- `postgresqlExtensions` preview feature enabled; `vector` extension declared in the `datasource` block.
- Embedding columns (`UserParallel.embedding`, `ContentItem.embedding`) are typed `Unsupported("vector(1536)")` — Prisma's stable client doesn't have a native vector scalar yet, so these columns exist in Postgres but aren't directly queryable through the Prisma Client API. **Similarity search and HNSW index creation must go through raw SQL** (`$queryRaw`/a manual migration), not the generated client. 1536 dimensions matches OpenAI's `text-embedding-3-small` — update this everywhere if a different embedding model is chosen (blueprint §10.3).

---

## 2. Entity groups

### 2.1 Users & onboarding

- **`User`** — core account. `visibilitySettings` is a free-form `Json` column at the database level (privacy controls, blueprint §22, are expected to grow without needing a migration each time), but it is **not** free-form at the API boundary — `UpdateUserDto.visibilitySettings` is validated against `VisibilitySettingsDto` (`modules/users/dto/visibility-settings.dto.ts`), an explicit whitelist of known keys. Add new keys there deliberately as real privacy controls get built; never let the API accept arbitrary client-supplied JSON into this field, since it directly controls visibility/security behavior.
- **`OnboardingResponse`** — one row per answered onboarding question (`questionKey` + `answerValue`), append-only. This is the first-party signal source before any behavioral data exists (blueprint §19).

### 2.2 Data flywheel

- **`InterestSignal`** — the raw, append-only behavioral event log (blueprint §21). Every view/like/save/search/follow/challenge-completion/share/quest-step writes a row here. `targetType` + `targetId` is a loose polymorphic reference (a content item, a Parallel type, a quest — whatever generated the signal) rather than several nullable foreign keys, since the set of signal-worthy entities will keep growing. The Identity Engine (BullMQ jobs) reads from this table; nothing else should write scoring logic directly against it.

### 2.3 Identity Engine

- **`ParallelType`** — the catalog of identity types (Builder, Music Head, The Urbanist, ...). `isSystemGenerated` distinguishes curated types from a future user-suggested type feature; `createdByUserId` is reserved for that, unused at MVP.
- **`UserParallel`** — a user's actual map: one row per (user, Parallel type) they've discovered. Key fields:
  - `strengthPct` / `momentum` — current score and signed delta since last recompute (drives the map's percentage + arrow UI, `UI_DESIGN.md` §3).
  - `streakCount` / `streakLastTouchedAt` — engagement streak (blueprint §4.1/§9).
  - `isGhost` (**defaults to `true`**) — privacy-by-default for new discoveries; a Parallel is never publicly visible until a user explicitly flips this (blueprint §4.5/§22). **Do not change this default.**
  - `isHidden` — reversible, user-initiated hide (Flow 14, `USER_FLOW.md`). Un-hideable from Profile > My Parallels at any time. Distinct from Ghost Mode: Ghost = "not yet public," Hidden = "actively suppressed from view but still tracked."
  - `dismissedAt` — permanent reject/remove (nullable `DateTime`, soft delete). Set when a user rejects a suggestion at discovery time (Flow 3a) or removes an already-active Parallel later (Flow 14). **The Identity Engine must check this before re-inserting a row for the same `(userId, parallelTypeId)` pair** — the `@@unique` constraint on that pair means a dismissed row already occupies the slot, so re-suggestion logic has to either respect the dismissal or explicitly clear `dismissedAt`, never insert a duplicate.
  - `suggestionReason` — required, plain-language explanation of why this Parallel was suggested (blueprint §22 explainability rule). A new-Parallel-detection job must never insert a row here without populating this field.
  - `embedding` — this user's interest-signature vector within this Parallel type, for similarity search (Twin matching, recommendations).
- **`ParallelEvolutionSnapshot`** — periodic (e.g. daily/weekly job-driven) point-in-time capture of `strengthPct`, feeding the Identity Evolution view and Wrapped (blueprint §14/§8). Deliberately a separate append-only table rather than reconstructing history from `InterestSignal`, so evolution queries stay cheap regardless of how large the raw signal log grows.

### 2.4 Quests & streaks

- **`Quest`** — a chain of steps (`steps: Json`) scoped to one Parallel type. `isAiGenerated` flags Claude-generated quests (blueprint §16 Phase 9) for the human-review gate mentioned in `apps/api/CLAUDE.md`.
- **`UserQuestProgress`** — one row per (user, quest), tracks `status` + `currentStep`. Unique on `(userId, questId)` — a user can't have two concurrent progress rows for the same quest.

### 2.5 Content

- **`ContentItem`** — feed content scoped to a `ParallelType`. `payload: Json` holds the type-specific shape (`POST`/`ARTICLE`/`EVENT`/`CHALLENGE_PROMPT` have different fields) rather than one rigid column set per content type.

### 2.6 Social

- **`Follow`** — composite primary key `(followerId, followeeId)`, no surrogate ID needed since the pair is already unique.
- **`Twin`** — cached, precomputed match between two users (`similarityScore`, `sharedParallelTypeIds`). Computed by a scheduled job, not on-demand, since similarity search across embeddings is too expensive to run per page load. **Invariant, enforced in code not the DB**: `userAId` must always be the lexicographically smaller ID of the pair — `@@unique([userAId, userBId])` only blocks an exact duplicate in the same order, so without this rule computing a match for `(X, Y)` and later `(Y, X)` would insert two rows for the same relationship. Whatever job computes Twins must sort the pair before upserting (see the matching comment directly on the `Twin` model in `schema.prisma`).
- **`Community`** / **`CommunityMember`** — communities can be `autoGenerated` (detected from behavior, blueprint §12) or manually seeded (early cohort strategy, blueprint §19).
- **`RealWorldEvent`** — deliberately plain `latitude`/`longitude` floats, **not** PostGIS, matching the blueprint's "PostGIS if introduced" framing (§23) — add PostGIS only when real geospatial queries (radius search, etc.) are actually needed.
- **`CollabSession`** — two users, two chosen Parallel types, a status lifecycle (`PENDING → ACTIVE → COMPLETED`/`CANCELLED`). `parallelTypeAId`/`parallelTypeBId` are real foreign keys to `ParallelType` (not plain strings) so referential integrity is enforced at the DB level like everywhere else in this schema.
- **`RouletteMatch`** — `userBId` is nullable because a match starts in a `QUEUED` state before a counterpart is found. `parallelTypeId` is a real FK to the Parallel the queuing user picked (`onDelete: SetNull` — losing the Parallel type shouldn't delete match history, just null out the reference); `matchedParallelContext` remains a free-text note for anything not captured by the FK alone.

### 2.7 Growth & notifications

- **`ParallelWrapped`** — the persisted, shareable Wrapped recap (blueprint §8, `USER_FLOW.md` Flow 12). One row per (user, period). `highlights` is `Json` rather than rigid columns because the highlight set (biggest evolution, most explored, weirdest intersection, streak, Twin) is expected to grow over time (blueprint §4.3) — see the shape documented directly in the schema comment and mirrored in `packages/shared-types`' `WrappedHighlights` interface. **Keep both in sync if the shape changes.**
- **`IdentityCard`** — a rendered, shareable image (`imageUrl` points to object storage/CDN, not stored in Postgres itself). `cardType` matches the five types in `UI_DESIGN.md` §4 (`PARALLEL`, `QUEST`, `WRAPPED`, `TWIN`, `COLLAB`). `sourceType`/`sourceId` is a loose polymorphic reference back to whatever triggered the card (a `UserParallel.id`, `Quest.id`, `ParallelWrapped.id`, `Twin.id`, or `CollabSession.id`) — same pattern as `InterestSignal.targetType`/`targetId`, kept nullable so a card can still exist if its source is later deleted.
- **`Notification`** — generic `type` + `payload: Json`, `readAt` nullable. Real-time delivery is Socket.IO-driven (blueprint §16 Phase 8); this table is the durable record, not the delivery mechanism.

---

## 3. Conventions

- **IDs**: `cuid()` everywhere, not auto-increment integers — avoids leaking row counts/creation order, and works better with distributed/optimistic generation than sequential IDs.
- **Naming**: Prisma model fields are camelCase; `@map(...)` translates every one to snake_case at the actual Postgres column/table level (e.g. `strengthPct` → `strength_pct`). This is a deliberate convention — Prisma/TypeScript code reads idiomatically, while the raw SQL/Postgres side stays idiomatic too. Keep this pattern for every new field.
- **Cascading deletes**: relations to `User` are `onDelete: Cascade` throughout — deleting a user should not leave orphaned rows, which matters directly for the account-deletion requirement in `FEATURE.md` §12.
- **Enums over free strings** where the value set is closed and known (`SignalType`, `QuestStatus`, `CollabStatus`, etc.) — free-text `Json` only where the shape genuinely varies (`payload`, `steps`, `visibilitySettings`).

---

## 4. What's deliberately not modeled yet

Per `FEATURE.md` §16 (MVP boundary) and the blueprint's phased plan — don't add these until the phase that needs them:

- PostGIS geospatial types (plain lat/lng is enough until real radius/proximity queries exist).
- A dedicated vector database — pgvector inside the existing Postgres instance is the call for MVP scale (blueprint §10.2).
- Any Roulette safety/moderation tables (report reasons, moderation queue) — build these _before_ Roulette ships, not as an afterthought (blueprint §19 risk, `apps/api/CLAUDE.md`), but they're not needed until that feature is actually being built (P3).
- Message/DM tables — out of scope entirely per the blueprint's non-goals (§7).

---

## 5. Migration workflow

```bash
# after any schema.prisma change:
pnpm --filter api exec prisma migrate dev --name <short_description>
pnpm --filter api exec prisma generate
```

Never hand-edit a generated migration or the database directly — see `apps/api/AGENTS.md`. Migrations are committed to `apps/api/prisma/migrations/` and applied in CI via `prisma migrate deploy` (see `.github/workflows/ci.yml`) before build/test run.
