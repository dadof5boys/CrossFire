# Spellfire Online

A web reimplementation of the classic **CrossFire** Spellfire card‑game client
(originally a Tcl/Tk desktop app), built incrementally. This is a **pnpm
workspace** living on the `spellfire-online` branch as a subdirectory of the
CrossFire repo, so the legacy Tcl source (used as pipeline input) sits in the
parent directory.

## Workspace layout

| Package | Purpose |
| --- | --- |
| `packages/shared` (`@spellfire/shared`) | Zod schemas + inferred TypeScript types — the single source of truth for the data model, shared by every package. |
| `packages/data-pipeline` (`@spellfire/data-pipeline`) | **Step 1.** Pure‑TypeScript Tcl → JSON converter (no Tcl runtime) producing `cards.json`, `decks.json`, `combos.json`. |
| `apps/web` (`@spellfire/web`) | **Steps 2–3.** Vite + React card browser and deck editor (login required to save). |
| `apps/server` (`@spellfire/server`) | **Step 3.** Fastify REST API + Prisma, with decks stored in the local Supabase Postgres. |
| `supabase/` | Local Supabase stack config (`supabase start`) — Postgres + Auth. |

## Quick start

Requires Node.js >= 20, pnpm, Docker, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
pnpm install

# Local Supabase (Postgres + Auth). First run pulls images.
supabase start
# Copy the printed DATABASE_URL / ANON_KEY if they differ from the examples.
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# Apply Prisma migrations against the local Postgres (port 54322).
pnpm --filter @spellfire/server prisma:migrate

# Step 1 — regenerate the dataset from the parent CrossFire checkout.
pnpm build:data

# Step 3 — API (http://localhost:8787)
pnpm --filter @spellfire/server start

# Step 2/3 — web app (http://localhost:5173); Vite proxies /api -> :8787
pnpm web

# Repo-wide checks
pnpm typecheck
pnpm test
pnpm lint
```

Local auth uses the well-known Supabase local-dev keys (not secrets). Email
confirmation is typically auto-confirmed locally, so sign-up is immediate.

## Step 1 — Data pipeline (`packages/data-pipeline`)

A dependency‑free parser reads the *data subset* of Tcl (`set` + brace‑nested
lists) — it never evaluates Tcl. Converts the legacy card database, decks, and
combos into typed, Zod‑validated JSON.

- **6,024 cards** across **26 sets** (4,189 with images), 25 card types, 10
  worlds, 46 decks, 1 combo.
- Per‑set counts match the legacy `numLimits` exactly; variable bonuses (`?`,
  `+?`) preserved in `bonusRaw`.

## Step 2 — Web app (`apps/web`)

- **Card browser**: responsive grid with images, full‑text search (MiniSearch),
  and faceted filters (set / type / world / rarity), with a card detail dialog.
- **Deck editor**: add/remove cards (click or drag‑and‑drop), live counts.
  **Saving requires sign-in**; the server is the source of truth (no local
  IndexedDB persistence).
- **Images**: in dev, a Vite middleware serves the legacy `Graphics/` art from
  the parent CrossFire checkout under `/legacy/...`.

## Step 3 — Accounts + persistence (`apps/server` + Supabase)

- **Auth**: Supabase Auth (email/password). The web app uses
  `@supabase/supabase-js`; the Fastify API verifies the JWT via
  `supabase.auth.getUser(token)` (signing-algorithm agnostic — works with local
  ES256 keys).
- **Decks**: REST + Zod (`GET/POST /api/decks`, `GET/PUT/DELETE /api/decks/:id`).
  Prisma owns the `public.decks` table in the Supabase Postgres. Ownership is
  enforced in the API (`Deck.userId` = auth UUID).
- **Client**: TanStack Query for server deck CRUD; Zustand holds the in-progress
  (unsaved) working deck.

## Tech stack

TypeScript · Zod · Vite · React · Tailwind CSS · Radix UI · Zustand ·
React Router · MiniSearch · TanStack Query · Fastify · Prisma · Supabase Auth
· dnd‑kit · Vitest · Biome · pnpm workspaces.

## Roadmap

1. **Data extraction → JSON** ✅
2. **Web app: browser, search, deck editor** ✅
3. **Accounts + persistence (Supabase Auth + Fastify/Prisma)** ✅
4. Real‑time chat/play server (replaces the legacy SPINS Tcl server)
