# Spellfire Online

A web reimplementation of the classic **CrossFire** Spellfire card‑game client
(originally a Tcl/Tk desktop app). This project is being built incrementally and
lives on the `spellfire-online` branch as a subdirectory of the CrossFire repo,
so the legacy Tcl source (its input) sits in the parent directory.

## Step 1 — Data extraction pipeline (this repo, so far)

The legacy client stores its card database and user content as **Tcl data
files**. Step 1 converts that data into typed, validated JSON that the future
web client and server can consume, without depending on a Tcl runtime.

- **Pure‑TypeScript Tcl parser** (`src/tcl.ts`) — reads the *data subset* of Tcl
  (`set` assignments + brace‑nested lists) with correct quoting rules. It does
  **not** evaluate Tcl, so nothing in the source data is executed.
- **Zod schema** (`src/schema.ts`) — the single source of truth for the data
  model. Every converted record is validated against it, and the TypeScript
  types are inferred from it for reuse by the client/server later.
- **Converters** — reference tables (`src/reference.ts`), cards (`src/cards.ts`),
  decks & combos (`src/decks.ts`).

### Output (`data/`)

| File | Contents |
| --- | --- |
| `cards.json` | Combined dataset: `sets`, `cardTypes`, `worlds`, and all `cards` (+ counts). |
| `decks.json` | Sample decks converted from `.cfd` files. |
| `combos.json` | Combos converted from `.cfc` files. |

Current extraction: **6,024 cards** across **26 sets** (4,189 with card images),
plus 25 card types, 10 worlds, 46 decks, and 1 combo.

### Card shape

```jsonc
{
  "id": "1st/1",
  "setId": "1st",
  "number": 1,
  "title": "Waterdeep",
  "text": "Any champion can use wizard spells when defending Waterdeep.",
  "typeId": 13, "type": "Realm",
  "worldId": 1, "world": "Forgotten Realms",
  "isAvatar": false,
  "bonus": null, "bonusRaw": "",      // bonusRaw preserves variable values like "+?"
  "rarity": "M",
  "blueLine": "Coast.",
  "attrCodes": ["5", "31"],           // raw legacy attribute codes (index 10)
  "usesCodes": ["d19", "o19"],        // raw legacy "uses" codes (index 11)
  "uses": ["Wizard Spell, Def", "Wizard Spell, Off"], // decoded
  "weight": 1,
  "image": "Graphics/Cards/1st/001.jpg" // repo‑relative path in the CrossFire source, or null
}
```

## Usage

Requires Node.js >= 20 and pnpm.

```bash
pnpm install

# Regenerate data/ from the CrossFire checkout.
# Input path resolution: argv[1] > $CROSSFIRE_DIR > ".." (the CrossFire repo root)
pnpm build:data              # uses the parent CrossFire checkout by default
pnpm build:data /path/to/CrossFire   # or point at another checkout

pnpm test        # unit + integration tests (integration auto‑skips if source absent)
pnpm typecheck
pnpm lint
```

> The pipeline reads the CrossFire source as **input**; it is not vendored here.
> The generated `data/*.json` is committed so the dataset is usable standalone.
> Card **images** are referenced by repo‑relative path and are not copied yet
> (image hosting is a later step).

## Tech stack

TypeScript · Zod (schema + validation) · Vitest (tests) · Biome (lint/format) ·
tsx (runner) · pnpm. Chosen to keep everything in the target web stack with the
schema as the reusable core; see the project plan for full rationale.

## Roadmap

1. **Data extraction → JSON** ✅ (this step)
2. Read‑only web app: card browser, search, deck editor (local‑first)
3. Accounts + persistence (Postgres)
4. Real‑time chat/play server (replaces the legacy SPINS Tcl server)
