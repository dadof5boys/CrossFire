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
- **Online real-time chat/play** connects to a **SPINS** server (default `cfserver.spellfire.net:10000`, which no longer resolves). The server is a separate project — the `dadof5boys/spellfire-spin-server` repo, NOT part of this repo. To test online end-to-end you must run that server locally and point the client at it.

### Connecting CrossFire to a local SPINS server
- The client connects with a plain async TCP socket: `Chat::ServerLogin` in `Scripts/Chat.tcl` calls `socket -async $host $port`. The default host/port come from `Scripts/Config.tcl` (`Chat,server,host` = `cfserver.spellfire.net`, `Chat,server,port` = `10000`).
- Easiest way to point at a local server: launch the client in developer mode with `DISPLAY=:1 wish CrossFire.tcl -dev`. In `-dev` mode the login dialog (CrossFire → Online Chat, Ctrl+H) shows editable **Host** and **Port** fields — set them to `localhost` / `<server port>`.
- Alternatively, add/select a server entry via Utilities → Configure → Chat, or edit the persisted config file `~/.CrossFire` (`Chat,server,host`/`Chat,server,port`/`Chat,server,list`).
- The two repos must both be present to test this (multi-repo Cursor environment): a cloud run's GitHub token is scoped to the repos in its environment, so the client and server repos need to be in the same environment for the agent to clone both.
