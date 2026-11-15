---
name: game-unity
description: >-
  Covers building a game client in the Unity engine (C#) that an agent can drive without the Editor window: when Unity fits, the version to target, the Unity CLI and batch mode for builds and tests, scene, prefab and .meta file rules, API changes across Unity 6 releases, licence terms, agent tooling, and connecting to the pack's Bun server over WebSocket. Use when a game's client is or will be a Unity project: creating or building it from the command line, running its tests in CI, fixing C# that uses renamed Unity APIs, connecting a Unity or WebGL build to the authoritative server, or choosing Unity MCP servers and skills.
---

# Game Unity

Unity is a C# engine with an editor, its own asset pipeline and its own licence. In this pack the server is TypeScript on Bun (`game-backend-architecture`), so a Unity project is a client: it renders, collects input, predicts, and talks to that server over a plain WebSocket. This skill owns the Unity side of that contract and the rules an agent breaks when it works on a Unity project from a terminal.

## When Unity fits

- Fits: a 3D or 2D game that ships to desktop, mobile or consoles, or a team that already works in Unity. Unity's own page sells the engine for 2D and 3D on any platform, with C# and .NET as the scripting base.
- Fits less well for a browser-first game. A Web build cannot use .NET sockets, needs a WebSocket library with a browser path, and pauses when the tab is hidden (`references/networking.md`). For a browser-only game, compare `game-client` first. That comparison is this skill's rule.
- Unity's own netcode does not fit this pack. Netcode for GameObjects expects a Unity game instance as the server: its client-server page says the server always has authority and runs the main simulation, as a dedicated server or a listen-server host, both running Netcode. A Bun server cannot be that instance, so the client skips Netcode and uses a plain WebSocket (this skill's rule).

## Version

Target **Unity 6.3 LTS** (editor version 6000.3; the newest patch on 2026-11-14 is 6000.3.28f1, released Nov 3, 2026). Unity supports 6.3 LTS until December 2027.

- Unity 6.6 (6000.6.9f1, Nov 12, 2026) is the newest Update release. Unity calls Update releases production-ready, but each is supported only until the next one ships. Code written for 6.3 can warn or break on 6.6: `references/api-traps.md` lists the changes from 6.4 to 6.6.
- Unity 6.7 is in beta and Unity 7.0 in alpha (the manual's own labels). Unity announced CoreCLR, .NET 10 and C# 14 for Unity 7, with a preview in December 2026 and a full release targeted for Q1 2027. Do not write Unity 7 code for a 6.x project.
- The language is C# 9.0 on Roslyn, in both 6.3 and 6.6, with gaps: no init-only setters, covariant returns or module initializers. Records need a hand-declared `System.Runtime.CompilerServices.IsExternalInit`. An agent trained on modern .NET writes C# 10 to 14 by default; it will not compile.
- Read docs pinned to your version: `https://docs.unity.com/en-us/engine/6000.3/...`. Pages without a version, and package docs at `@latest`, describe newer editors. Every manual page also serves Markdown when you add `.md` to its path, and `https://docs.unity.com/llms.txt` indexes each product.

## What an agent can do without the Editor window

1. **Install Editors, manage projects, build and test from the Unity CLI** (`unity`, 1.0.0, GA on November 12, 2026; Unity Hub installs it by default). `unity install` installs an Editor, `unity projects` lists, creates and opens projects, `unity build` builds in batch mode, `unity test` runs Edit Mode and Play Mode tests and writes an NUnit report, `unity run` runs a project in batch mode, `unity recompile` reports compile errors from a running Editor. Details and exit codes: `references/project-and-cli.md`.
2. **Fall back to raw Editor arguments** when the CLI is not installed: `-batchmode -projectPath <path> -executeMethod Class.Method -logFile <path>`, plus `-runTests` for tests. Read the traps in `references/project-and-cli.md` before you add `-quit`.
3. **Drive a running Editor** through the CLI and the Unity Pipeline package (Unity 6.0 or later; a local HTTP API on localhost): `unity status`, `unity command`, `unity eval`. This is how an agent edits scenes, GameObjects and prefabs. Ask the user to open the Editor; do not start a second one on the same project.
4. **Edit C# freely.** Scripts are plain text. After an edit, a running Editor recompiles when it refreshes (on focus with Auto-Refresh, on Assets > Refresh, or on `AssetDatabase.Refresh`); from the terminal, run `unity recompile`.

Rules for project files:

- Never write or hand-edit scene (`.unity`), prefab (`.prefab`) or other asset YAML. Unity's own manual says to avoid generating or editing Unity YAML directly and to use the Unity API. UnityYAML is a custom library that supports only part of the YAML spec (no comments, for one). This skill's rule: do not expect a generic YAML tool to round-trip these files. Change them through a live Editor or an `-executeMethod` script that calls the API.
- A `.meta` file travels with its asset. It holds the asset's unique ID and its import settings. When you move or rename an asset outside Unity, move or rename its `.meta` to match. An asset that loses its `.meta` gets a new one, and every reference to it breaks. Never delete or regenerate a `.meta`.
- Keep the defaults: asset serialization Force Text and version control mode Visible Meta Files. Merge `.unity`, `.prefab` and `.meta` conflicts with UnityYAMLMerge (Smart Merge), not a text merge.
- When the Editor will not respond, do not fall back to editing scene files. A project with compile errors opens in Safe Mode, where the Pipeline package does not load: run `unity status` to read the errors, fix the C#, and wait for the Editor to leave Safe Mode.

## The API changes agents get wrong

The full list, with the version that changed each one, is in `references/api-traps.md`. The ones that break most often:

- `FindObjectsOfType` and `FindObjectOfType` are obsolete since 6.0. In 6.6 the `FindObjectsByType` overloads that take a sort mode and `FindFirstObjectByType` are obsolete too: use `FindObjectsByType<T>()` and `FindAnyObjectByType<T>()`.
- `Rigidbody.velocity` and `drag` are obsolete in favour of `linearVelocity` and `linearDamping`.
- The legacy Input Manager is deprecated and will be removed. Use the Input System package (`references/assets-and-input.md`).
- 6.5 replaced `InstanceID` with `EntityId`; `GetInstanceID()` becomes `GetEntityId()`, and the id no longer fits in an `int`.
- `?.` and `??` on a Unity object skip Unity's overridden null check, so a destroyed object passes them. Compare with `== null`.

## Licence (terms on 2026-11-14)

These are Unity's terms as published on the date checked, read from Unity's own pages. They change. Read the current Unity Editor Software Terms and pricing page before you start a project, and ask a lawyer about your case; this is not legal advice.

- The Unity Editor Software Terms (last updated June 30, 2026) set the Unity Personal ceiling at $200,000 USD of Total Finances over the most recent 12 months. Above it you may not use Personal at all, "even for internal projects or prototyping". Unity Pro covers $200,001 to $24,999,999.
- Unity's plans page says Enterprise is required above $25 million in revenue or funding in the last 12 months.
- The terms grant runtime distribution with no royalty, revenue share or runtime fee for projects made with Unity 6 or earlier, provided you pay any applicable fees (subscription or seat price) and stay within current tier eligibility. They say nothing here about Unity 7, so do not tell a user that Unity 7 projects carry no fee. Unity cancelled the Runtime Fee for games on Sept 12, 2024.
- The Personal page says Unity Pro allows console builds.
- This skill's reading of the terms: the definition of "Platform" now includes automated, AI-enabled or agentic conversion, porting or repackaging services. Read it before you build an agent service that ports Unity projects.
- Unity's agent skills and plugin are under the Unity Companion License, for Unity-dependent projects. Point to them; do not copy them into other projects.

## Agent tooling

Use the `unity-cli` skill if it is installed, otherwise https://docs.unity.com/en-us/unity-cli. Official first: the Unity CLI and `unity mcp`, Unity's skills and plugin, the docs as Markdown and llms.txt. The MCP server inside the AI Assistant package is deprecated. Community MCP servers can run arbitrary C# in your Editor, and one relays through a cloud service by default. The user installs all of these; this pack ships no MCP config. Publisher, licence, what each can do, what must be running and the warnings are in `references/agent-tooling.md`.

## Connection to the pack

- **Server.** The client opens one WebSocket to the authoritative Bun server from `game-backend-architecture` and sends inputs, never results. Use a plain WebSocket client with a browser path (NativeWebSocket); details in `references/networking.md`.
- **Authentication.** `betterauth-integration` reads the session once, from the upgrade request's headers and cookies, and the server in `game-backend-architecture` returns 403 when `Origin` is missing or untrusted. What each build can send:
  - Web (WebGL) build: the browser's WebSocket takes only a URL and subprotocols, so no `Authorization` header. The browser sets `Origin` to the page that hosts the build and attaches cookies under its own rules. Host the build on an origin in the server's trusted origins and rely on the Better Auth session cookie. This skill's rule: serve the build and the auth and game server from the same site, because the cookie's SameSite setting decides whether the browser sends it with the upgrade. Better Auth's cookie page does not state the default SameSite value, and it notes that Safari blocks third-party cookies.
  - Desktop and mobile builds: .NET `ClientWebSocket` can set request headers, and NativeWebSocket passes a header dictionary through to it. Expect a native client to send no `Origin` (RFC 6455 makes it optional outside browsers); log the upgrade headers on the server to confirm. Send `Authorization: Bearer <token>`, with the token from the sign-in response headers and Better Auth's `bearer()` plugin on the server, plus an `Origin` from the trusted list. Test this on each target platform.
  - An `Origin` set by a native client proves nothing. The server's `Origin` check protects players' browsers from other sites; any non-browser program can send any `Origin`. Security for native builds rests on the bearer token alone, and a leaked token gives full access to that player's account until the session is revoked.
  - Store the native token where the platform keeps secrets, never in a save file or `PlayerPrefs`. Never put the token in the URL query string.
- **State sync.** `game-state-sync` owns prediction, reconciliation and interpolation. Where its fixed-step loop and interpolation hook into `Update`, `FixedUpdate` and `LateUpdate` is in `references/networking.md`.
- **Saves.** The authoritative save lives on the server (`game-save-load`). On Web, `Application.persistentDataPath` is in the browser's IndexedDB under a hash of the page URL, so this skill expects local saves to be lost when the build moves to another URL.
- **Localization.** `game-localization` owns the process and string rules. In Unity, the Localization package (1.5) holds string and asset tables, Smart Strings for placeholders and plurals, pseudo-localization, and XLIFF, CSV and Google Sheets exchange.
- **Anti-cheat.** `game-anti-cheat` applies unchanged: the server validates every input. A Unity build is a client the player controls, whatever the engine.
- **Assets.** Models, textures and animation come from `game-blender`; Addressables and the Input System are in `references/assets-and-input.md`.

## Pitfalls

- `-quit` together with `-runTests`: the Editor quits before the tests finish.
- `-nographics` without `-logFile`: output logs are off.
- Batch mode without `-accept-apiupdate` on a project upgraded from an older editor: the API Updater does not run and old code can fail to compile.
- CI that collects the Editor log from the global path on 6.5 or later: the log moved to `<Project>/Logs/Editor.log`.
- `System.Net.WebSockets` or a blocking `UnityWebRequest` loop in a Web build.
- `JsonUtility` for the server's delta messages: it cannot read dictionaries or free-form objects.

## Files

- `references/project-and-cli.md`: read when creating, building or testing a Unity project from the terminal or CI, or when a batch run hangs or exits with a code you do not recognise.
- `references/api-traps.md`: read when writing or fixing C# for Unity 6, or upgrading a project between 6.x releases.
- `references/networking.md`: read when connecting a Unity client to the Bun server, authenticating the socket, parsing server messages, or wiring interpolation into the frame loop.
- `references/assets-and-input.md`: read when setting up input, loading content with Addressables, or bringing assets in from Blender.
- `references/agent-tooling.md`: read when choosing or installing the Unity CLI, Unity's skills, or a community MCP server.
- `references/sources.md`: read when you need the page behind a rule or want to re-check a version or a licence term.

## Related skills

- `game-backend-architecture`: the authoritative Bun server, rooms, tick loop and WebSocket upgrade this client connects to.
- `betterauth-integration`: the session check on the WebSocket handshake.
- `game-state-sync`: prediction, reconciliation and snapshot interpolation the client runs.
- `game-client`: the browser client in TypeScript, for comparing stacks.
- `game-save-load`: server-side saves and local save rules.
- `game-localization`: string IDs, plurals and translation process.
- `game-anti-cheat`: server validation that treats every client as untrusted.
- `game-blender`: making the models, textures and animations the project imports.
- `ci-cd-game`: the pipeline that runs the build and test commands.
