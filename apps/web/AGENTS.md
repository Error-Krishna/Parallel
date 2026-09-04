# AGENTS.md — apps/web

Agent instructions for the Next.js frontend. See root `AGENTS.md` for repo-wide rules; this file is web-specific.

## Commands

```bash
pnpm --filter web dev             # dev server
pnpm --filter web build           # production build
pnpm --filter web lint            # eslint
pnpm --filter web test            # vitest (component/unit)
pnpm --filter web exec playwright test   # e2e, critical path only
```

## Rules specific to this app

- This app is presentation + SSR only. All business logic, the Identity Engine, auth, and real-time live in `apps/api` (NestJS). Route Handlers under `src/app/api/` are for thin edge concerns (OG image generation, webhooks) — do not add data-mutating logic there.
- Use Server Components by default; opt into `"use client"` only where interactivity, Zustand, Framer Motion, or TanStack Query hooks are actually needed.
- New feature UI goes in `src/features/<feature-name>/`, not directly in `src/app/` route folders — routes should stay thin and import from features.
- Add shadcn/ui components via the CLI (`pnpm dlx shadcn@latest add <name>`) rather than hand-rolling equivalents or pulling in a second component library.
- Respect Ghost Mode in the UI: any new-Parallel or "What If" surface must have a visibly different (private/exploratory) state before a user opts to make it public.
- Copy tone: playful, never clinical. Avoid "test," "score," "diagnosis" language in UI strings.
