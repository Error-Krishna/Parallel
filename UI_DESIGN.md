# Parallel — UI Design Spec

> **Purpose:** The design system and screen inventory that Figma and `apps/web` implementation both build from. Every screen here traces back to a flow in `USER_FLOW.md`; every token here is already implemented in `apps/web/src/app/globals.css` and `apps/web/components.json` — this document explains the _why_, the code is the source of truth for the _exact values_.
>
> **Source:** `PARALLEL_master_blueprint_final.md` §14, `FEATURE.md`, `USER_FLOW.md`

---

## 1. Design principles (blueprint §6, §14)

1. **Playful, never clinical.** No therapy language, no "test/score/diagnosis" framing anywhere — copy and visuals both.
2. **Dark-first.** Default theme is dark; per-Parallel accent colors need to pop against it (this is also what makes Identity Cards read well when screenshotted).
3. **The Parallel-switch is a scene change, not a tab switch.** This is the single highest-priority interaction to get right — budget real design and engineering time here, not a generic slide/fade.
4. **Identity Cards are a second, tighter design system.** Portrait-only, minimal chrome, ego-first — treat as a distinct Figma page, not a variant of in-app screens.
5. **Every percentage/label reads as play, not measurement.** Avoid bar-chart/dashboard aesthetics for the Parallel Map; favor organic, radar/blob-style visuals.

---

## 2. Design tokens (implemented in `apps/web/src/app/globals.css`)

### Base palette

| Token                | Dark (default) | Light     | Use                           |
| -------------------- | -------------- | --------- | ----------------------------- |
| `--background`       | `#09090b`      | `#ffffff` | App background                |
| `--foreground`       | `#fafafa`      | `#0a0a0a` | Primary text                  |
| `--card`             | `#101012`      | `#ffffff` | Card surfaces                 |
| `--border`           | `#27272a`      | `#e4e4e7` | Dividers, outlines            |
| `--muted`            | `#18181b`      | `#f4f4f5` | Subtle surfaces               |
| `--muted-foreground` | `#a1a1aa`      | `#71717a` | Secondary text                |
| `--primary`          | `#a78bfa`      | `#7c3aed` | Primary actions, brand accent |

### Per-Parallel accent colors

Each Parallel type gets a distinct color, used for its card, feed header, and transition animation. Defined once in `globals.css`, referenced everywhere via Tailwind's `--color-parallel-*` theme tokens — **add a new one here whenever a new system Parallel type is added**, don't hardcode ad-hoc colors in components.

| Parallel     | Token                   | Color              |
| ------------ | ----------------------- | ------------------ |
| Builder      | `--parallel-builder`    | `#f59e0b` (amber)  |
| Music Head   | `--parallel-music-head` | `#ec4899` (pink)   |
| Gamer        | `--parallel-gamer`      | `#22c55e` (green)  |
| Explorer     | `--parallel-explorer`   | `#3b82f6` (blue)   |
| The Urbanist | `--parallel-urbanist`   | `#a855f7` (purple) |

### Typography

- **Sans** (`--font-geist-sans`, Geist): body text, UI chrome — legible workhorse face.
- **Mono** (`--font-geist-mono`, Geist Mono): percentages, streak counters, code-like/stat-like moments — gives numbers a bit of attitude without needing a whole second display face yet.
- Headline sizing: keep it large and confident on the Map/reveal screens (this is the "aha" moment, don't undersell it) — 36–48px range for the primary headline, tracked tight (`tracking-tight`).

### Motion (Framer Motion, see `apps/web/src/features/parallels/` once built)

- **Parallel switch**: full-screen transition — accent color wash, content cross-fade, ~400–600ms, easing that feels like a scene cut (sharp out, soft in) rather than a linear slide.
- **Streak/Quest completion**: a distinct celebratory motion (scale + particle/confetti-adjacent, kept tasteful) — reserved for genuine completions only, never overused or it loses meaning.
- **Map reveal (post-onboarding)**: the very first thing a new user sees after answering questions — this animation carries the whole "aha" (blueprint §27), don't reuse a generic loading spinner here.

### Component primitives

- shadcn/ui (`new-york` style, see `apps/web/components.json`), Tailwind CSS 4, `class-variance-authority` for variants.
- Add components via `pnpm dlx shadcn@latest add <name>` from `apps/web` — never hand-roll an equivalent of something shadcn already provides.
- Icons: `lucide-react` exclusively, for consistency.

---

## 3. Screen inventory

Each screen lists: the flow(s) in `USER_FLOW.md` it serves, its states, and its Next.js route (App Router — see `apps/web/CLAUDE.md`).

| Screen                        | Flow(s) | Route                                                       | Key states                                               |
| ----------------------------- | ------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| Landing (marketing)           | 1       | `(marketing)/`                                              | default                                                  |
| Sign Up                       | 1       | `(marketing)/signup`                                        | default, validation error, submitting                    |
| Log In                        | 1       | `(marketing)/login`                                         | default, invalid credentials, submitting                 |
| Onboarding — question screens | 2       | `(app)/onboarding/[step]`                                   | default, submitting, resumed-mid-flow                    |
| Onboarding — map reveal       | 2       | `(app)/onboarding/reveal`                                   | loading ("building your map"), revealed                  |
| Parallel Map                  | 3       | `(app)/map`                                                 | default, new-discovery banner, empty-ish (sparse signal) |
| New Parallel Discovered       | 3a      | `(app)/map/discovered/[id]`                                 | default (with "why"), confirmed-public, confirmed-hidden |
| Ghost Mode / What If world    | 3b      | `(app)/parallels/[id]/ghost`                                | default, converting-to-public                            |
| Enter Parallel — Feed         | 4, 5    | `(app)/parallels/[id]`                                      | loading, populated, empty (no curated content yet)       |
| Content detail                | 5, 6    | `(app)/content/[id]`                                        | default                                                  |
| Quest list                    | 7       | `(app)/parallels/[id]/quests`                               | default, empty (no quests yet)                           |
| Quest detail                  | 7       | `(app)/quests/[id]`                                         | not-started, in-progress, completed                      |
| Quest completion reveal       | 7       | `(app)/quests/[id]/complete`                                | default → prompts Identity Card                          |
| Identity Evolution            | 8       | `(app)/evolution`                                           | default, insufficient-history                            |
| People Discovery              | 9       | `(app)/parallels/[id]/people`                               | default, empty                                           |
| Profile preview (other user)  | 9       | `(app)/u/[username]`                                        | default, is-twin                                         |
| Twin comparison               | 9       | `(app)/twins/[id]`                                          | default                                                  |
| Collab invite / picker        | 10      | `(app)/collab/new`, `(app)/collab/[id]`                     | pending, active, completed, expired                      |
| Identity Card preview         | 11      | public route `card/[id]` (server-rendered, blueprint §10.1) | default                                                  |
| Wrapped recap                 | 12      | public route `wrapped/[id]` (server-rendered)               | default, insufficient-activity variant                   |
| Roulette                      | 13      | `(app)/roulette`                                            | queued, matched, ended — **P3, not MVP**                 |
| Profile — My Parallels        | 14      | `(app)/profile/parallels`                                   | default                                                  |
| Profile — Privacy & Data      | 14      | `(app)/profile/privacy`                                     | default, export-in-progress, delete-confirmation         |

**MVP screen set** (build these first, per `FEATURE.md` §16): Landing, Sign Up, Log In, Onboarding (both), Parallel Map, New Parallel Discovered, Enter Parallel Feed, Content detail, Identity Evolution, People Discovery, Profile preview, Profile — My Parallels. Everything else follows the P1–P4 priority order already defined in `FEATURE.md` §17.

---

## 4. Identity Card design spec (blueprint §7, §4.4)

- **Canvas**: 1080×1920 (9:16, native story format).
- **Safe zones**: keep all text/key visuals within the center ~80% — top ~250px and bottom ~300px are commonly covered by Instagram/Snap's own UI chrome when shared.
- **Content**: Parallel name/icon, one headline stat or the "why", subtle Parallel accent-color background treatment, small Parallel wordmark — nothing else. No nav bars, no buttons, no app chrome.
- **Card types**: `PARALLEL` (new discovery), `QUEST` (completion), `WRAPPED` (recap), `TWIN` (match), `COLLAB` (shared Collab-session completion, one card rendered per participant) — matches the `IdentityCardType` enum in `DATABASE.md`.
- Rendered server-side (blueprint §9, Phase 9) and served from object storage/CDN — the design file should assume a template + dynamic data model, not one-off static designs per user.

---

## 5. Figma file structure

Organize the Figma file to mirror this document, so design and this doc never drift:

```
📄 Parallel — Product Design
 ├── 🎨 Foundations (tokens above: color, type, spacing, motion specs as prototypes)
 ├── 🧩 Components (shadcn-equivalent primitives, kept 1:1 with apps/web/src/components/ui)
 ├── 📱 MVP Screens (one frame per row in the MVP screen set above, all states)
 ├── 📱 P1–P4 Screens (organized by priority tier from FEATURE.md §17)
 ├── 🃏 Identity Cards (separate page — see §4 above, all four card types)
 └── 🎬 Motion prototypes (Parallel-switch transition, Quest completion, Map reveal)
```

Each MVP screen frame should include, at minimum: default state, loading state, empty/error state (see the ⚠ notes in `USER_FLOW.md` for what those are per flow) — a frame with only the "happy path" isn't done.

---

## 6. Open design questions (track here until resolved)

- Exact radar/blob visualization style for the Parallel Map — needs a prototype pass before Phase 5 build starts.
- Whether per-Parallel accent colors are designer-assigned per type or generated (e.g. from a hash) as new system Parallel types get added over time.
- Final Identity Card template variety — one template per card type, or multiple templates per type with light randomization to avoid every user's cards looking identical.
