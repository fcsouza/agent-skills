# Agent tooling for Unity

Checked on 2026-11-14. Stars and last push from `gh api repos/<owner>/<repo>` on that date. The user installs every tool here; this pack ships no MCP configuration.

## Official (Unity Technologies)

**Unity CLI (`unity`) and `unity mcp`.** Free, separate from Unity AI, 1.0.0 since November 12, 2026.
- What it does: installs Editors and modules, creates projects, manages licences, runs headless builds and tests. With the Pipeline package it drives a running Editor through `unity command` and `unity eval`.
- `unity mcp` is an MCP server for agents that cannot run shell commands, or whose models do not compose command lines well. Unity says the direct commands are faster and use fewer tokens; use them when the agent has a shell. `unity mcp configure <client>` writes the client's configuration, and `unity mcp configure --list` lists supported clients.
- What must run: Unity 6.0 or later with the Pipeline package for live work, and an open Editor. The pipeline server accepts localhost connections only.
- Warnings: the Pipeline can run arbitrary C# in your Editor (`unity command script eval '...'`), as your user. Unity's own security notes accept that because it is local. The CLI sends telemetry until you opt out (project-and-cli.md). `unity bug` sends logs to Unity; Unity's skill says never to run it without asking.

**Unity skills** (`Unity-Technologies/skills`; 1,256 stars, last push 2026-11-13).
- Licence: Unity Companion License, for Unity-dependent projects (LICENSE.md; GitHub's API reports NOASSERTION).
- What it is: 37 agent skills, among them `unity-cli`, `unity-pipeline`, `new-unity-project`, `unity-package-management`, `setup-multiplayer-services`, `localize-unity-project` and `optimize-web`. Many expect the Unity CLI. The repository takes no pull requests.
- Install: `unity skill install <agent-name>`, or the plugin below, which Unity's README recommends instead.

**Unity agent plugin** (`Unity-Technologies/unity-agent-plugin`; 638 stars, last push 2026-11-13; `plugin.json` licence `LicenseRef-Unity-Companion-License`). The same skills as one plugin, for Claude Code, Codex, Grok, Antigravity and GitHub Copilot CLI.
- Claude Code: `/plugin marketplace add Unity-Technologies/unity-agent-plugin`, then `/plugin install unity@unity-agent-plugin`.
- Warning: it runs `unity skill sync --hook` when a session starts, to keep the skills current. Unity's security notes say it writes only the pinned, checked skills into the one client and never overwrites a copy you edited.

**Docs for agents.** Every manual page serves Markdown when you add `.md` to its URL. `https://docs.unity.com/llms.txt` indexes each product, and `https://docs.unity.com/en-us/engine/<version>/manual/llms.txt` indexes one editor version. Pin the version (`6000.3`); unversioned pages may describe 7000.0.

**Deprecated: the MCP server in the AI Assistant package** (`com.unity.ai.assistant`). Unity's page: "Unity MCP server is deprecated. Use the Unity command-line interface (CLI) instead." It used a relay binary in `~/.unity/relay/` and IPC to the Editor. Assistant package versions before 2.13 conflict with the CLI; update or remove the package. Third-party MCP packages are not affected by the deprecation.

## Community MCP servers

Each of these runs inside or beside your open Editor and can change your project. Read what a server can execute and where it connects before you install it.

| Server | Publisher, licence, stars, last push | What it can do | What must run | Warning |
|---|---|---|---|---|
| MCP for Unity | CoplayDev/unity-mcp, MIT, 15,973, 2026-11-14 | Scenes, GameObjects, components, prefabs, assets, scripts, tests, builds, console, packages, menu items; `execute_code` | Unity 2021.3 to 6.x, Python 3.10+ via `uv`, the Editor open | `execute_code` runs arbitrary C# in the Editor. Its own docs say the safety check "is not a full sandbox". |
| AI Game Developer (Unity-MCP) | IvanMurzak/Unity-MCP, Apache-2.0, 4,637, 2026-11-14 | Scene, prefab, asset and C# tools; `script-execute` compiles and runs C# with Roslyn; Edit and Play Mode tests; tools inside built games | Unity 2022.3+, the Editor open | Cloud relay (ai-game.dev) is the default connection. Local mode starts with auth `none` on 127.0.0.1, which any program on the machine can reach; switch it to `token`. |
| Unity-Skills | Besty0728/Unity-Skills, MIT, 1,943, 2026-11-14 | A REST server inside the Editor with hundreds of operations, task snapshots with rollback, and Approval / Auto / Bypass permission modes | Unity 2022.3+, the plugin and its server enabled in the Editor | Installs upgraded from an older version stay in Bypass mode, where every operation runs unrestricted. Set the mode yourself. |
| MCP Unity | CoderGamester/mcp-unity, MIT, 2,017, 2026-10-11 | Scenes, GameObjects, components, materials, prefabs, packages, tests, recompile, Play mode, `batch_execute`, `execute_menu_item`, `unity://` resources | Unity 6+, Node.js 18+, the Editor open | `execute_menu_item` runs any function tagged as a menu item. |

Choice (this skill's rule): use the official CLI first. Reach for a community server only for a capability the CLI lacks, prefer one that runs locally with authentication on, and never point any of them at an Editor whose project is not your own checkout.
