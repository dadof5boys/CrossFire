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
| `apps/web` (`@spellfire/web`) | **Steps 2–6.** Vite + React card browser, deck editor, chat lobby, and digital tabletop. |
| `apps/server` (`@spellfire/server`) | **Steps 3–6.** Fastify REST API + Prisma + Socket.IO chat, tabletop, and rules. |
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

# Step 3/4 — API + Socket.IO (http://localhost:8787)
pnpm --filter @spellfire/server start

# Step 2–4 — web app (http://localhost:5173); Vite proxies /api and /socket.io -> :8787
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

## Step 4 — Realtime chat + table lobby (Socket.IO)

Chat and a thin table lobby run on the **same Fastify process** via Socket.IO.
This is **not** a reimplementation of the legacy SPINS Tcl protocol, and it does
**not** include Spellfire combat/rules.

- **Auth**: handshake `auth.token` is the Supabase access token (same JWT as REST).
- **Chat**: auto-join `Main`; optional extra channels; `/tell email text` whispers.
- **Presence**: who's in the current channel.
- **Tables**: create / join / leave; list is broadcast to every connected socket.
- **History**: last 50 messages **in memory only** (ephemeral; lost on restart).
- **Client**: `/chat` (sign-in required). Vite proxies `/socket.io` → `:8787` with
  WebSockets.

## Step 5 — Digital tabletop

A table is a **game room**. The creator auto-sits; a second player can Sit
(max 2). Spectators may watch public zones. Each seated player loads a **saved
deck**; **Start** shuffles and deals 5 cards.

- **Private**: your hand (full cards) and draw pile (count only).
- **Public**: realms, pool/champions, discard — opponents see the card ids.
- **Actions**: Draw, drag a card onto realms / pool / discard, Pass turn.
- State is **in-memory** (lost on server restart), same as chat history.

Open a table in Chat, then **Play** (`/play/:tableId`).

## Step 6 — Rules engine (first slice)

The server now enforces a thin Spellfire rules layer. It looks up `typeId` and
`bonus` from `packages/data-pipeline/data/cards.json` — clients cannot spoof
card types.

- **Turn**: only `activeSeat` may draw, move, set phase, or attack.
- **Phase**: 0 Start / 1–3 build / 4 Combat / 5 End. Attack auto-advances to
  phase 4 if the turn is still in a build phase, and is rejected in phase 5.
- **Zones**: realms accept typeId 13 only; pool accepts champions
  (5, 7, 10, 12, 14, 16, 20); discard accepts any; hand is fillable only via
  Draw.
- **Combat** (`play:attack`): opens a **battlefield**. The defender may
  `play:defend` with a pool champion or `play:decline-defend`.
  - Undefended: same as before — raze if attacker bonus is strictly greater
    than the realm bonus.
  - Defended: compare champion bonuses. Attacker wins → realm razed, both
    champions stay in pool. Defender holds (tie or better) → attacker is
    discarded, realm unrazed.
  No spoils, attachments, or formation slots yet.

## Tech stack

TypeScript · Zod · Vite · React · Tailwind CSS · Radix UI · Zustand ·
React Router · MiniSearch · TanStack Query · Fastify · Prisma · Supabase Auth
· Socket.IO · dnd‑kit · Vitest · Biome · pnpm workspaces.

## Roadmap

1. **Data extraction → JSON** ✅
2. **Web app: browser, search, deck editor** ✅
3. **Accounts + persistence (Supabase Auth + Fastify/Prisma)** ✅
4. **Realtime chat + table lobby (Socket.IO)** ✅
5. **Digital tabletop (shared board, private hands)** ✅
6. **Rules engine first slice (turn, zones, realm attack)** ✅
7. **Battlefield defense (champion vs champion)** ✅
8. Allies, spells, items, formation A–F, holdings, spoils — later.
