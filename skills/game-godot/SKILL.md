---
name: game-godot
description: >-
  Covers building a game client in Godot 4 for this pack: when Godot fits, GDScript or C#, editing text scenes and running headless imports, scripts, tests and exports from the command line, Godot 3 habits that break in Godot 4, what to commit, community MCP servers, and connecting to the Bun game server over WebSocketPeer with Better Auth, saves and translations. Use when a game's client, editor tooling or export pipeline is in Godot, when GDScript or .tscn files written from an older Godot fail, or when a Godot build must talk to the pack's authoritative server.
---

# Godot

Godot is the client. The server stays TypeScript on Bun (`game-backend-architecture`) and owns the game state; the Godot build sends intents and draws what the server says. This skill covers the Godot side and the seams to the rest of the pack.

## Version checked

- Checked against **Godot 4.7.2-stable** (published 2026-08-18) on 2026-11-14. The documentation's "stable" branch is 4.7. **4.8 is in beta** (4.8-beta3, 2026-11-09): re-check the traps file when 4.8 ships.
- Godot 3 is still maintained (3.6.3-stable, 2026-08-22). Find out which major a project uses before writing code: a Godot 4 project has `format=3` in its `.tscn` headers, Godot 3 uses `format=2`.
- An assistant trained on Godot 3 writes code that no longer parses. `references/gdscript-traps.md` lists the breaks from 3 to 4 and from 4.4 to 4.7.

## When Godot fits

- Free and open source (MIT), 2D and 3D. The editor and exports run on Windows, macOS and Linux; Android editor support is experimental; iOS runs exported projects. For consoles, see https://godotengine.org/consoles/.
- Pick Godot over the browser stacks of `game-client` when the game needs an editor for scenes, tile maps and animation, or ships native desktop and mobile builds as well as the web.
- Limits that decide against it, or decide the language:
  - Web exports target WebGL 2 through the Compatibility renderer only. Forward+ and Mobile do not run on the web, and Godot has no WebGPU backend.
  - On the web, only HTTP, WebSocket (client) and WebRTC work. Raw TCP and UDP do not.
  - A browser client in Godot 4 must be GDScript (next section).
- Godot's high-level multiplayer API (`@rpc`, `MultiplayerPeer`, `WebSocketMultiplayerPeer`) is built on the SceneTree for Godot peers. Godot's networking page names a custom backend server as the case where low-level work cannot be avoided. Against the pack's Bun server, use a plain `WebSocketPeer` and the pack's JSON messages; no Godot page documents the high-level API against a non-Godot server (this skill's rule).

## GDScript or C#

| Need | Language |
|---|---|
| Any web export | GDScript. Godot 4 C# projects cannot export to the web |
| Desktop only, team already writes C# | C# is fine |
| Android or iOS | GDScript is the safe choice. C# on mobile is experimental since 4.2 |

C# needs the .NET-enabled editor build plus a separately installed .NET SDK: .NET 8 or later, and .NET 9 or later to export to Android. Build C# from the command line with `--build-solutions`. GDScript needs nothing beyond the editor binary.

## Working without the editor

An agent can do most work through files and the command line. `references/project-and-cli.md` has the flags, the scene format and the CI recipe. The short version:

- **Project**: a folder with `project.godot`. Paths inside the game use `res://` (the project) and `user://` (writable player data, where saves go).
- **Scenes and resources** (`.tscn`, `.tres`) are text. Godot 4 writes `format=3`; drop `load_steps`, which is deprecated and only appears in files saved before 4.6. The editor discards comments and properties equal to their defaults when it saves, so do not use comments as documentation inside a scene.
- **Scripts** are plain `.gd` files. `godot --headless --path . --script res://tools/x.gd --check-only` parses one script and quits.
- **Import first**: `godot --headless --path . --import` imports resources and quits. Run it on a fresh clone before scripts, tests or exports, because `.godot/` (the import cache) is not committed (this skill's rule, from those two facts).
- **Run headless**: `--headless` is required on machines without a GPU, such as CI. A script run with `--script` must extend `SceneTree` or `MainLoop`. `--quit-after <n>` stops after n iterations for a smoke run.
- **Export**: `godot --headless --path . --export-release "<preset>" builds/game.exe`. The binary must be the **editor**, not an export template; export templates for that exact editor version must be installed; the preset name must match `export_presets.cfg`; the target directory must exist.
- **Tests**: Godot ships no game test framework. `--test` runs the engine's own C++ tests and needs an engine compiled with `tests=yes`. Use GUT or gdUnit4 (`references/project-and-cli.md`).
- **Language server**: the editor serves the GDScript language server and debug adapter on the ports given by `--lsp-port` and `--dap-port`.

## Godot 3 code that breaks

The traps an older model hits most. The full list, with 4.4 to 4.7 changes, is in `references/gdscript-traps.md`.

- `export`, `onready`, `tool` are annotations: `@export`, `@onready`, `@tool`.
- `yield` is gone; use `await` on a signal or coroutine.
- Connect signals through the `Signal` object: `button.pressed.connect(_on_pressed)`, not a string name.
- `_ready()` and `_process()` no longer call the parent's version; call `super()` first in the override.
- Renames: `Spatial` is `Node3D`, `KinematicBody` is `CharacterBody3D`, `Sprite` is `Sprite2D`, `File` and `Directory` are `FileAccess` and `DirAccess`. The Tween node is gone; use Tweeners.
- `TileMap` is deprecated; use one `TileMapLayer` node per layer.
- `randomize()` now runs on project load. A deterministic run needs an explicit seed.

## Project hygiene

- Commit `*.uid` files (4.4 and later). Godot's UID article says they must not go in `.gitignore`; without them, references break on a fresh clone. When a script or shader moves outside the editor, move its `.uid` beside it.
- Ignore `.godot/` (cache) and `*.translation` (binary files imported from CSV).
- Generate `.gitignore` and `.gitattributes` from the project manager's Git option, or **Project > Version Control > Generate Version Control Metadata**.
- `export_presets.cfg` holds no credentials from 4.1 on, so it can be committed; Godot 3 and 4.0 could store credentials there.
- Name files and folders in snake_case (C# scripts excepted, which are PascalCase), node names in PascalCase. Mixed-case file names can break after a Windows export.
- Keep third-party add-ons in a top-level `addons/` folder.

## Agent tooling

- **Official: none.** The Godot project publishes no MCP server, agent skill or `llms.txt` (all three `llms.txt` URLs return 404). The proposal for a built-in AI assistant (godot-proposals #12409) was closed as not planned on 2025-08-23, with users encouraged to write third-party add-ons. The 2026 contribution policy requires human-authored code in engine pull requests; it says nothing about making games with AI.
- **Community MCP servers** exist, from file-and-CLI servers that need no editor to live-editor bridges with dozens of tools. Most of the live ones can run arbitrary GDScript in the editor or the running game. The user installs them; this pack ships no MCP config. Publisher, licence, stars, what must be running and the warning for each are in `references/agent-tooling.md`.
- Every step above has an official command-line flag, so an agent needs no MCP server to build, test and export.

## Connect to the pack

- **Server and transport**: `WebSocketPeer`, polled every frame, sending the pack's JSON messages with `send_text()`. Read `references/networking.md` before writing the client: the loop, buffer sizes, and the handshake findings below.
- **Origin**: Godot 4.7.2's native WebSocket client sends no `Origin` header; a browser export sends the page's origin. A non-browser client can set any `Origin` it likes (RFC 6455), so an `Origin` set by a native client proves nothing: security there rests on the bearer token. `game-backend-architecture` accepts an upgrade with no `Origin` when it carries `Authorization: Bearer` and the session check passes; an untrusted `Origin` is still refused. Native builds do not fake an `Origin`.
- **Authentication** (`betterauth-integration` reads the session from the upgrade's headers and cookies):
  - Web export: `handshake_headers` is not supported, so no `Authorization` header. Serve the game page from the same site as the auth server, sign in on the hosting page (not inside Godot), and the browser sends the session cookie with the handshake; this works with the pack's server as it is.
  - Web export from another site (a store or portal): the cookie does not come along. Better Auth's one-time-token plugin is a documented cross-domain mechanism (single-use, 3-minute default expiry); putting it in the WebSocket URL is this skill's inference. It needs a server change, was not run for this skill, and how the export obtains a session on a portal is not covered by any page opened.
  - Native: send `Authorization: Bearer <token>` through `handshake_headers` with Better Auth's bearer plugin, and no `Origin`. Keep the token in memory, and if it must survive a restart, in a file under `user://`; never in `res://`, a URL or a log (this skill's rule).
  - Details, sources and the server changes each option needs are in `references/networking.md`.
- **State sync**: `game-state-sync`'s boilerplate is TypeScript, so a GDScript client reimplements prediction and the snapshot bracket. Predicted ticks run on a fixed step, remote entities interpolate in `_process`. Godot's physics interpolation smooths physics ticks only and does not replace the snapshot buffer.
- **Saves**: `game-save-load` owns the format, versioning and where saves live. In Godot, write to `user://`; never call `get_var(true)` or `bytes_to_var_with_objects` on data from outside the build. Read `references/saves-and-data.md`.
- **Translations**: Godot translates with `tr("KEY")`, `tr_n()` for plurals and a context argument for ambiguous words, from CSV or gettext PO files. Keep `game-localization`'s rules (stable IDs, whole messages, translator comments) and use the same IDs as Godot message keys. Godot's docs say PO files work better with Git than CSV.
- **Anti-cheat**: `game-anti-cheat` applies unchanged. A Godot build, native or web, is under the player's control. Godot's own multiplayer page says to treat all client input as untrusted.
- **Input**: define actions in the InputMap and read gameplay input in `_unhandled_input`, so GUI controls get events first. 4.7 changed mouse and keyboard device IDs (traps file).

## Pitfalls

- Exporting a C# project to the web: Godot 4 cannot.
- `connect_to_url()` returns `OK` before the socket connects. Nothing moves until you call `poll()` each frame.
- Expecting `handshake_headers` or `heartbeat_interval` to work in a web export: neither does.
- A native build that fakes a trusted `Origin` instead of sending the bearer token: the `Origin` proves nothing, and without the token the upgrade fails.
- Large snapshots with the default 65535-byte `WebSocketPeer` buffers: raise `inbound_buffer_size` before connecting (this skill's rule).
- Treating JSON numbers as ints: Godot parses every JSON number as a float.
- `get_var(true)` on a downloaded save: deserialized objects can run code.
- `.uid` files missing from Git, or left behind when files move outside the editor.
- Code with `yield`, string signal connections, `Spatial`, `TileMap` or a missing `super()`: Godot 3 habits.
- Exporting with an export template binary, or without templates matching the editor version.
- Running scripts or tests on a fresh clone before `--import`.
- Freeing nodes in a `@tool` script: it runs in the editor and can crash it.
- Setting physics ticks to the server's 20 Hz: Godot warns that physics can break down below about 30.
- A community MCP server's `game_eval`, `godot_exec` or `execute_editor_script`: they run arbitrary GDScript.

## Files

- `references/project-and-cli.md`: read when creating a project, editing `.tscn` or `.tres` by hand, running headless imports, scripts, tests or exports, or setting up CI.
- `references/gdscript-traps.md`: read when writing or fixing GDScript, or porting code written for Godot 3 or an older 4.x.
- `references/networking.md`: read when connecting a Godot client to the Bun server: the WebSocketPeer loop, the Origin and authentication options per platform, and where interpolation runs.
- `references/saves-and-data.md`: read when saving player data, parsing JSON from the server, or loading files a player could have touched.
- `references/agent-tooling.md`: read when a user asks for a Godot MCP server or skill set, or before installing one.
- `references/sources.md`: read when you need the page behind a rule or want to re-check the version.

## Related skills

- `game-backend-architecture`: the authoritative Bun server, rooms, message protocol and upgrade check this client connects to.
- `betterauth-integration`: the session check on the WebSocket upgrade.
- `game-state-sync`: prediction, reconciliation and snapshot interpolation to reimplement in GDScript.
- `game-client`: the browser alternative in TypeScript.
- `game-save-load`: save format, migrations and where saves live.
- `game-localization`: string IDs, plurals and the translation process.
- `game-anti-cheat`: server-side validation; the Godot build is untrusted.
- `ci-cd-game`: the pipeline that runs the headless import, tests and export.
