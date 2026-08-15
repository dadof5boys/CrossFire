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
| `apps/web` (`@spellfire/web`) | **Step 2.** Vite + React card browser and local‑first deck editor. |

## Quick start

Requires Node.js >= 20 and pnpm.

```bash
pnpm install

# Step 1 — regenerate the dataset from the parent CrossFire checkout.
# (Input path: argv > $CROSSFIRE_DIR > nearest ancestor containing Scripts/CommonV.tcl)
pnpm build:data

# Step 2 — run the web app (predev copies the dataset into apps/web/public/data)
pnpm web            # http://localhost:5173

# Repo-wide checks
pnpm typecheck
pnpm test
pnpm lint
```

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
- **Local‑first deck editor**: add/remove cards (click or drag‑and‑drop),
  live counts, decks saved in the browser via **IndexedDB (Dexie)**, plus
  load / delete / export.
- **State**: Zustand for the working deck; React Router for Browse/Decks.
- **Images**: in dev, a Vite middleware serves the legacy `Graphics/` art from
  the parent CrossFire checkout under `/legacy/...` (production hosting is a
  later step).

## Tech stack

TypeScript · Zod · Vite · React · Tailwind CSS · Radix UI · Zustand ·
React Router · MiniSearch · Dexie · dnd‑kit · Vitest · Biome · pnpm workspaces.

## Roadmap

1. **Data extraction → JSON** ✅
2. **Read‑only web app: browser, search, local‑first deck editor** ✅
3. Accounts + persistence (server + Postgres)
4. Real‑time chat/play server (replaces the legacy SPINS Tcl server)
