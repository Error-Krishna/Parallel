# Parallel — Future Implementations & Development Ledger

> Living development ledger for Parallel.
>
> **Source of truth:** `docs/PARALLEL_master_blueprint_final.md`
>
> This file tracks work that is intentionally deferred, partially implemented,
> temporary, or required by later blueprint phases. It exists so that we can
> continue building sequentially without forgetting intentionally postponed work.

---

## 1. Current Development Position

**Current phase: Phase 6 — Identity Engine**

The project is currently implementing the Identity Engine expansion:

- Interest signals → identity scoring
- Async embedding generation
- pgvector storage
- New Parallel detection
- Ghost Mode handling
- Hidden Parallel unlock logic

### Current checkpoint

**Embedding generation: COMPLETED / VERIFIED**

Verified end-to-end:

```text
BullMQ
  ↓
EmbeddingProcessor
  ↓
local all-MiniLM-L6-v2 model
  ↓
384-dimensional embedding
  ↓
PostgreSQL pgvector
```

The real test user currently has 4 UserParallel records with:

```text
has_embedding = true
dimensions    = 384
```

### Important sequencing rule

Do **not** jump ahead to later blueprint phases just because their database
models, folders, or scaffolding already exist.

Continue in blueprint order:

```text
Phase 6
  ↓
Phase 7 — Social
  ↓
Phase 8 — Realtime
  ↓
Phase 9 — AI & Growth
  ↓
Phase 10 — Hardening
  ↓
Phase 11 — Production
  ↓
Phase 12 — Beta / Mobile
  ↓
Phase 13 — Iteration
```

---

# 2. Status Legend

| Status        | Meaning                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `COMPLETED`   | Implemented and tested/verified                                          |
| `IN PROGRESS` | Currently being implemented                                              |
| `PARTIAL`     | Some functionality exists, but the blueprint requirement is not complete |
| `DEFERRED`    | Intentionally left for the correct later phase                           |
| `TECH DEBT`   | Existing implementation needs cleanup/rework                             |
| `NOT STARTED` | Required later but not implemented                                       |

---

# 3. Phase 6 — Identity Engine

## 3.1 Interest Signal Wiring

**Status: COMPLETED**

Meaningful interactions are being written as interest signals.

Current signal types include:

- VIEW
- LIKE
- SAVE
- SEARCH
- FOLLOW
- PARALLEL_ENTER
- CHALLENGE_COMPLETE
- SHARE
- QUEST_STEP
- COMMUNITY_JOIN

---

## 3.2 Identity Score Recalculation

**Status: COMPLETED / IN PROGRESS**

Existing rules-based scoring is implemented.

Current behavior:

- Uses onboarding responses.
- Uses recent interest signals.
- Calculates Parallel strength.
- Calculates momentum.
- Runs through the Identity Engine.
- Evolution snapshots are captured after recalculation.

### Future improvement

- Revisit scoring weights after real user data exists.
- Replace hard-coded weights with configurable/rule-versioned scoring.
- Add stronger behavioral decay.
- Validate score calibration with real usage.

---

## 3.3 Embedding Generation

**Status: COMPLETED / VERIFIED**

Implemented:

- `EmbeddingService`
- local `Xenova/all-MiniLM-L6-v2`
- 384-dimensional vectors
- pgvector storage
- BullMQ `embedding` queue
- `EmbeddingProcessor`
- `EmbeddingModule`
- unit tests
- real BullMQ job execution
- real PostgreSQL vector verification

### Intentionally deferred

**Automatic embedding job triggering**

Currently a real embedding job can be queued manually.

Future work:

- Trigger embedding jobs from the correct identity/activity flow.
- Decide whether embeddings should run:
  - after meaningful signal batches,
  - after score recalculation,
  - on a periodic schedule,
  - or through a hybrid strategy.
- Add deduplication/debouncing so excessive activity does not create
  unnecessary embedding jobs.
- Add retry/backoff behavior where appropriate.

---

## 3.4 Embedding Signature Quality

**Status: PARTIAL**

Current signature combines:

- Parallel name
- Parallel description
- recent user activity signal types/weights

Future work:

- Include better semantic behavioral context.
- Consider signal recency.
- Consider per-signal target content.
- Consider onboarding context where useful.
- Avoid generating near-identical embeddings when nothing meaningful changed.

---

## 3.5 New Parallel Detection

**Status: NOT STARTED**

Required by Phase 6.

Implement:

- similarity search using pgvector
- comparison of user embeddings against Parallel/content/identity vectors
- candidate discovery
- similarity thresholds
- explainable discovery reasons
- prevention of duplicate existing Parallels
- prevention of dismissed Parallels being re-suggested
- async BullMQ detection job

### Required outcome

A test account with a consistent interest cluster should receive a
surprising but correctly labeled new Parallel suggestion during the session.

---

## 3.6 Ghost Mode

**Status: PARTIAL / DATA MODEL READY**

`UserParallel.isGhost` already exists.

Future work:

- New Parallel discoveries should default to `isGhost = true`.
- Ghost Parallels should remain invisible to other users.
- Ghost Mode exploration should not leak presence/discovery.
- Add the correct UI/state transition for making a Parallel public.
- Verify Ghost Mode behavior across:
  - map
  - profile
  - people discovery
  - feeds
  - Twin matching
  - communities
  - recommendations

---

## 3.7 Hidden Parallels

**Status: PARTIAL / DATA MODEL READY**

`isHidden` and Quest reward infrastructure exist.

Future work:

- Implement actual Hidden Parallel candidate logic.
- Tie Hidden Parallel hints to Quest completion.
- Reveal/unlock the Parallel only when the required condition is met.
- Ensure hidden Parallels are excluded from normal discovery.
- Add reveal UI/celebration.
- Test repeated Quest completion and idempotency.

---

## 3.8 Phase 6 Verification

Before leaving Phase 6, verify all of:

- [ ] Interest signals affect Identity Engine
- [x] Embedding generation job exists
- [x] Embedding processor tested
- [x] Real BullMQ embedding job completed
- [x] Real pgvector storage verified
- [ ] Embedding jobs are triggered automatically
- [ ] Similarity/new Parallel detection job
- [ ] Explainable discovery reason
- [ ] Ghost Mode enforced
- [ ] Hidden Parallel unlock logic
- [ ] Phase 6 end-to-end test account scenario

---

# 4. Phase 7 — Social

> Do not implement until Phase 6 exit criteria are satisfied.

## 4.1 Parallel Feed

**Status: PARTIAL / IMPLEMENTED BASE**

Current feed functionality exists.

Future work:

- Improve personalized feed selection per Parallel.
- Integrate Identity Engine signals into ranking.
- Add cursor pagination hardening.
- Handle empty/loading/error states consistently.
- Validate feed ranking against user behavior.

---

## 4.2 Basic Interactions

**Status: PARTIAL / IMPLEMENTED**

Implemented:

- VIEW
- LIKE / UNLIKE
- SAVE / UNSAVE

Future work:

- SHARE flow
- SEARCH signal flow where applicable
- challenge/content interactions
- ensure every meaningful interaction writes the correct signal
- prevent duplicate/unwanted signals

---

## 4.3 People Discovery

**Status: PARTIAL / IMPLEMENTED BASE**

Current implementation can discover people through shared Parallels.

Future work:

- Improve discovery ranking.
- Integrate strength/momentum/similarity.
- Respect Ghost Mode and visibility in every path.
- Add better intersection explanations.
- Connect discovery to Twin/Community/Collab flows.

---

## 4.4 Follows

**Status: IMPLEMENTED**

Current follow/unfollow flow exists.

Future work:

- Feed ranking based on follows.
- Better follower/following UX.
- Notifications when required by Phase 8.

---

## 4.5 Parallel Twin

**Status: PARTIAL / IMPLEMENTED BASE**

Twin queue/processor infrastructure exists.

Future work:

- Complete robust Twin computation.
- Use identity/embedding intersections.
- Improve match explanation.
- Build complete Twin UI.
- Verify two-account unusual shared-intersection discovery.
- Ensure Ghost/visibility rules are respected.

---

## 4.6 Communities

**Status: NOT STARTED / MODEL SCAFFOLD MAY EXIST**

Future work:

- Emergent community detection.
- Community seeding.
- Membership flow.
- Community discovery UI.
- Community interaction signals.
- Privacy/visibility handling.
- Connect communities to Parallels and Identity Engine.

---

## 4.7 Collab Parallels

**Status: NOT STARTED**

Future work:

- Collab discovery.
- Shared Parallel collaboration.
- Collaboration lifecycle/state.
- UI.
- Interaction signals.
- Identity impact.
- Privacy and moderation rules.

---

## 4.8 Phase 7 Verification

- [ ] Personalized Parallel feed
- [ ] People discovery
- [x] Follow/unfollow
- [ ] Complete Twin system
- [ ] Communities
- [ ] Collab Parallels
- [ ] Two-account discovery scenario
- [ ] Ghost/visibility checks across social features

---

# 5. Phase 8 — Realtime

**Status: DEFERRED**

Do not build until Phase 7 is complete.

## 5.1 Socket.IO

- [ ] Socket.IO infrastructure
- [ ] authenticated realtime connections
- [ ] presence
- [ ] connection lifecycle
- [ ] reconnect handling

## 5.2 Redis Pub/Sub

- [ ] Redis pub/sub integration
- [ ] cross-instance event propagation
- [ ] event naming conventions

## 5.3 Live Notifications

Implement realtime notifications for:

- [ ] streak warnings
- [ ] Quest completion
- [ ] new Twin/match
- [ ] other blueprint-approved notification events

## 5.4 Notification Center

- [ ] Notification persistence
- [ ] unread/read state
- [ ] notification UI
- [ ] realtime updates
- [ ] pagination/retention

---

# 6. Phase 9 — AI & Growth

**Status: DEFERRED**

Do not build until Phase 8 is complete.

## 6.1 AI Quest Generation

- [ ] Claude integration
- [ ] AI-generated Quest creation
- [ ] validation/safety layer
- [ ] persistence
- [ ] regeneration/fallback behavior

## 6.2 Parallel Wrapped

**Status: DEFERRED**

Database model/scaffolding may exist, but the complete feature is not implemented.

- [ ] monthly Wrapped generation
- [ ] annual Wrapped generation
- [ ] background generation job
- [ ] recap statistics
- [ ] narrative generation
- [ ] Wrapped UI
- [ ] sharing

## 6.3 Identity Cards

**Status: DEFERRED**

Database/API scaffolding may exist.

- [ ] Identity Card generation
- [ ] rendering pipeline
- [ ] image/object storage
- [ ] CDN delivery
- [ ] share pages
- [ ] card generation from meaningful results
- [ ] Quest completion → card prompt
- [ ] Parallel discovery → card
- [ ] Wrapped → card where applicable

## 6.4 Parallel Roulette

- [ ] matching queue
- [ ] candidate selection
- [ ] matching rules
- [ ] match lifecycle
- [ ] UI
- [ ] privacy/visibility rules

---

# 7. Phase 10 — Hardening

**Status: DEFERRED**

## Privacy

- [ ] Full Ghost Mode audit
- [ ] visibility audit
- [ ] profile privacy
- [ ] Parallel privacy
- [ ] social discovery privacy
- [ ] data exposure audit

## Abuse / Safety

- [ ] rate limiting
- [ ] abuse prevention
- [ ] blocking/reporting where required
- [ ] content moderation
- [ ] spam protection
- [ ] suspicious activity handling

## Testing

- [ ] Complete unit test coverage for critical services
- [ ] Complete API integration tests
- [ ] Full end-to-end user journey
- [ ] Two-account social journey
- [ ] Ghost Mode journey
- [ ] Quest/reward journey
- [ ] Identity Engine regression suite
- [ ] Embedding regression suite

---

# 8. Phase 11 — Production

**Status: DEFERRED**

- [ ] Production PostgreSQL
- [ ] Production Redis
- [ ] Production object storage
- [ ] CDN
- [ ] Web deployment
- [ ] API deployment
- [ ] environment/secrets management
- [ ] database migration strategy
- [ ] backups
- [ ] health/readiness checks
- [ ] observability
- [ ] structured logs
- [ ] metrics
- [ ] tracing
- [ ] error tracking
- [ ] CI/CD
- [ ] production security review

---

# 9. Phase 12 — Beta / Mobile

**Status: DEFERRED**

## Beta

- [ ] Beta onboarding
- [ ] analytics
- [ ] user feedback
- [ ] feature flags
- [ ] controlled rollout
- [ ] performance monitoring

## Mobile

- [ ] `apps/mobile`
- [ ] React Native / Expo
- [ ] shared API client
- [ ] shared types
- [ ] authentication
- [ ] onboarding
- [ ] Parallel Map
- [ ] Parallel feed
- [ ] profile
- [ ] social features
- [ ] notifications

---

# 10. Phase 13 — Iteration

**Status: DEFERRED**

Only after real usage data exists:

- [ ] recommendation improvements
- [ ] Identity Engine improvements
- [ ] embedding strategy improvements
- [ ] scoring calibration
- [ ] feed ranking improvements
- [ ] Twin improvements
- [ ] Quest improvements
- [ ] Wrapped improvements
- [ ] retention experiments
- [ ] new identity mechanics
- [ ] performance/cost optimization

---

# 11. Technical Debt / Cleanup

These are not necessarily future product features. They are items that must be
revisited so the codebase remains production-safe.

## 11.1 pgvector Migration Reproducibility

**Status: TECH DEBT**

The current database columns were manually changed from `vector(1536)` to
`vector(384)` because Prisma does not automatically detect the Unsupported
vector dimension change.

Current database:

```text
user_parallels.embedding  -> vector(384)
content_items.embedding   -> vector(384)
```

The original historical migration still contains the previous vector
dimension.

Future work:

- [ ] Create a proper migration strategy for fresh databases.
- [ ] Ensure a fresh database creates `vector(384)`.
- [ ] Ensure deployment migrations reproduce the production schema.
- [ ] Never rewrite an already-applied historical migration.

---

## 11.2 Embedding Model Decision

**Status: TECHNICAL DECISION TO REVISIT**

Current model:

```text
Xenova/all-MiniLM-L6-v2
384 dimensions
local execution
```

Chosen to avoid paid embedding APIs during development.

Future work:

- [ ] Benchmark quality against real Parallel discovery tasks.
- [ ] Measure inference speed.
- [ ] Measure memory usage.
- [ ] Revisit model choice before production if necessary.
- [ ] If changing dimensions/model, plan a vector migration + re-embedding.

---

## 11.3 Generated / Build Artifacts

The codebase audit contains generated files such as:

- `.next`
- `dist`
- `.turbo`
- `node_modules`
- TypeScript build info

These should not be treated as source code during future audits.

Future work:

- [ ] Keep generated artifacts ignored by Git.
- [ ] Keep codebase audit commands focused on source/config/docs.
- [ ] Remove accidental tracked generated artifacts if any exist.

---

## 11.4 Documentation Drift

There are multiple project documents.

Future work:

- [ ] Keep `docs/PARALLEL_master_blueprint_final.md` as the build source of truth.
- [ ] Keep this ledger synchronized with implementation.
- [ ] Update status after every verified checkpoint.
- [ ] Avoid creating conflicting architecture decisions in secondary docs.

---

## 11.5 Temporary / Manual Development Commands

Several jobs have currently been tested by manually enqueueing BullMQ jobs.

Future work:

- [ ] Replace manual test triggering with production event/scheduler triggers.
- [ ] Keep manual enqueue commands as development/debug utilities where useful.
- [ ] Add safe admin/debug mechanisms only if needed.

---

# 12. Existing Scaffolding That Must Not Be Mistaken for Completion

The schema/codebase contains infrastructure for features that belong to later
phases.

Examples include:

- Identity Cards
- Wrapped
- Twin-related data
- Communities
- Collab
- Roulette
- Notifications
- additional job queues

**Rule:** a database model or empty module does not mean the feature is
complete.

Before marking a feature `COMPLETED`, verify:

1. backend behavior exists
2. API contract exists
3. frontend behavior exists where required
4. tests exist
5. end-to-end behavior works

---

# 13. Completed Development Checkpoints

## Authentication / Foundation

- [x] Authentication foundation
- [x] Users module
- [x] Onboarding
- [x] Identity Engine foundation
- [x] Parallel Map
- [x] Enter Parallel
- [x] Profile / visibility foundation

## Social Foundation

- [x] Parallel feed foundation
- [x] View signal
- [x] Like / unlike
- [x] Save / unsave
- [x] Follow / unfollow
- [x] People discovery foundation
- [x] Basic Quest flow

## Quests / Streaks

- [x] Quest start
- [x] Quest step completion
- [x] Quest completion
- [x] Quest rewards
- [x] Genuine calendar-day streak logic
- [x] Same-day streak protection
- [x] Streak display on Parallel page
- [x] Quest tests

## Identity Evolution

- [x] Evolution snapshots
- [x] Evolution history
- [x] Evolution UI
- [x] Evolution job integration

## Embeddings

- [x] Local embedding model
- [x] 384-dimensional vectors
- [x] EmbeddingService
- [x] EmbeddingProcessor
- [x] EmbeddingModule
- [x] BullMQ embedding queue
- [x] Processor unit test
- [x] Real BullMQ job
- [x] Real PostgreSQL vector verification

---

# 14. Development Rule Going Forward

For every new feature:

```text
1. Check blueprint phase
2. Check this ledger
3. Inspect existing implementation
4. Make one small change
5. Build
6. Test
7. Manually verify when applicable
8. Update this ledger
9. Move to the next checkpoint
```

Never mark a feature complete merely because it compiles.

---

# 15. Next Immediate Work

**Current next task:**

Complete the remaining Phase 6 Identity Engine requirements:

```text
Embedding job
    ↓
automatic trigger
    ↓
similarity / new Parallel detection
    ↓
explainable discovery reason
    ↓
Ghost Mode enforcement
    ↓
Hidden Parallel unlock
    ↓
Phase 6 end-to-end verification
```

Only after Phase 6 exit criteria are verified should development move to
Phase 7 Social.
