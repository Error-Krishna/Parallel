# CLAUDE.md — apps/web

This is the Next.js (App Router) frontend for Parallel. Root-level conventions in `../../CLAUDE.md` apply here too — this file adds web-specific detail.

## Structure (blueprint §11)

```
src/
  app/
    (marketing)/     public landing, unauthenticated routes
    (app)/            authenticated app shell — map, parallels, quests, feed...
    card/[id]/         public, server-rendered Identity Card share pages
    wrapped/[id]/      public, server-rendered Wrapped share pages
    api/                Route Handlers — thin only (OG images, webhooks). Never put real business logic here; that belongs in apps/api (NestJS).
    layout.tsx
  features/            one folder per product feature (onboarding, map, parallels, quests, wrapped, roulette, collab, ...) — components + hooks + local state for that feature live together
  components/          shared UI, built on shadcn/ui primitives
  hooks/
  stores/               Zustand stores (current Parallel, Ghost Mode toggle, in-flight animation state)
  lib/                   API client (talks to apps/api), TanStack Query client setup, utils
  styles/
```

## Server vs. Client Components

- Default to **Server Components** for anything read-heavy and mostly static: the public Identity Card / Wrapped share pages (`card/[id]`, `wrapped/[id]`), marketing pages, initial data fetch on profile pages. This is what makes shared links unfurl correctly on Instagram/TikTok/Snap.
- Use **Client Components** (`"use client"`) for the interactive core: onboarding flow, the Parallel switcher and its transition animation, Quests, Roulette, anything using Zustand, Framer Motion, or TanStack Query mutations.
- Don't reach for a Route Handler to talk to the database directly — all real data access goes through the NestJS API via `packages/api-client`.

## The Parallel-switch transition

This is called out in the blueprint (§14) as the single most important animation in the product — it should read as a scene change, not a tab switch. If you're touching this, look at `features/parallels/` and don't simplify the transition away for the sake of a quick fix; flag it instead.

## Design system

- Tailwind CSS 4 + shadcn/ui (components added individually via `pnpm dlx shadcn@latest add <component>`, kept in-repo and editable — not treated as an opaque dependency).
- Dark-first theme, distinct accent color + motion signature per Parallel type (blueprint §14).
- Identity Cards (portrait, 1080×1920, safe zones for story UI) are effectively a second, tighter design system — don't reuse general app components for them without checking they still fit story-safe dimensions.

## Testing

- Vitest + Testing Library for interaction-heavy components (onboarding, Parallel switcher, quest cards) — assert on user-visible behavior.
- Playwright for the critical path only: sign up → onboarding → map → enter a Parallel → complete a challenge → see evolution update.
