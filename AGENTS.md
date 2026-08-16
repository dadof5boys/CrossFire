# AGENTS.md

## Cursor Cloud specific instructions

CrossFire is a legacy **Tcl/Tk desktop GUI application** (for the Spellfire card game). It is a single fat-client app: all logic runs locally in one `wish` process. There is **no package manager, no build step, and no automated test suite / lint config** in this repo, so there is nothing to `build`, `lint`, or `test` — the only relevant action is running the app.

### Running the app
- Entry point is `CrossFire.tcl` at the repo root. Run it from the repo root so its relative paths resolve:
  - `DISPLAY=:1 wish CrossFire.tcl`
- A graphical display is required (the VM desktop is on `DISPLAY=:1`). This is a native Tk GUI, not a web app, so use the desktop pane / computer-use to interact with it (not a browser).
- Optional flags: `-debug` (traces proc calls to a debug window) and `-dev` (developer mode).
- On startup the app auto-creates working subdirs (`ChatLogs`, `Inventory`, `Reports`, `Trades`, `BackUp`, `Games`, etc.). These are runtime data, not source.

### Runtime dependency (installed by the update script)
- The only dependency is a Tcl/Tk runtime providing `wish` (installed via `apt` as `tcl`/`tk`, currently 8.6).
- Note: the `README.markdown` warns against Tcl/Tk 8.5/8.6, but that warning is **Windows-specific** (registry / file-association code). On Linux the version check in `CrossFire.tcl` only requires `>= 8.4`, and the app runs fine on the system's Tk 8.6. The Windows-only `tcom`/`registry` packages are never loaded on Linux.

### Offline vs. online functionality
- All local features work fully offline: card database browsing (`DataBase/*.tcl`), the **DeckIt!** deck editor (saves `.cfd` files to `Decks/`), Card Warehouse (inventory), ComboMan, Swap Shop, Fan Set editor, Solitaire, printing/reports.
- **Online real-time chat/play** (legacy Tcl client) connects to an external server (`cfserver.spellfire.net:10000`) that is **not part of this repo**. A local SPINS checkout may be used instead. The web reimplementation does **not** speak that Tcl protocol.

## Spellfire Online (`spellfire-online/`)

Web reimplementation of CrossFire. Canonical commands and stack notes live in `spellfire-online/README.md`.

- **Dev stack**: pnpm workspace. Vite web app on **5173**, Fastify API + Socket.IO on **8787**, local Supabase (`supabase start` from `spellfire-online/`) for Auth + Postgres.
- **Chat / play**: Socket.IO on the Fastify process (ephemeral in-memory state). Vite must proxy `/socket.io` with `ws: true`. `/play/:tableId` is the digital tabletop. The server enforces turn order, zone-by-`typeId` (realms = 13, pool = champions, allies = 1, wizard/cleric spells = 19/4), and battlefield combat: `play:attack` opens a pending attack; the defender `play:defend`s with a pool champion or `play:decline-defend`. Either fighter may `play:ally` a hand ally or `play:cast` a hand spell onto their champion (defender only after a champion is committed). Spells also require the champion’s catalog `usesCodes`. After a champion defends, either fighter `play:resolve`s. Combat total = champion + ally + spell bonuses; attachments go to discard on resolve. It looks up cards from `packages/data-pipeline/data/cards.json` — do not trust client-sent type/bonus. Draw/move/pass/attack are blocked until the attack resolves; `play:ally` and `play:cast` are legal during an open battlefield.
- The play page must `joinTable` on **this browser socket** even if the same user is already listed as an occupant (another tab or a helper script). Occupancy is per-socket; skipping join leaves the UI outside the table room so `play:state` never arrives.
- Restart the Fastify process after server-side Socket.IO changes; the old process will not pick them up. Auth tokens come from the signed-in Supabase session (`auth.token` on the handshake).
