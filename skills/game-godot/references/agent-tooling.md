# Agent tooling for Godot

Checked 2026-11-14. Stars, licences and last-push dates come from the GitHub API on that date, not from README badges. The user installs any of these; this pack ships no MCP configuration. Re-check before relying on a row: this space changes weekly.

## Official

- **No official MCP server, agent skill or `llms.txt`.** No repository in the `godotengine` GitHub organisation matches mcp, ai, agent, llm or skill except three unrelated ones (`build-containers`, `godot-platform-haiku`, `godot-maintainers-docs`). `https://docs.godotengine.org/llms.txt`, `https://docs.godotengine.org/en/stable/llms.txt` and `https://godotengine.org/llms.txt` return 404.
- **Built-in AI assistant: rejected.** godot-proposals #12409, "Add an integrated AI assistant to the editor with project-wide refactoring", was closed as not planned on 2025-08-23. The maintainer who closed it said users are encouraged to make third-party add-ons instead.
- **Engine contribution policy (2026).** Godot requires human-authored code in pull requests to the engine and limits AI help to menial work such as completion, regex and find-and-replace. `CONTRIBUTING.md` asks AI agents to disclose themselves in pull request and issue titles, or be banned. None of this covers games made with Godot.
- Without an official server, the official command line covers building, testing and exporting (`project-and-cli.md`). Prefer it in CI: it needs no editor, plugin or open port.

## Community MCP servers

All are community projects. None is published by the Godot project or Foundation.

| Server | Publisher, licence | Stars, last push | What must run | What it does | Warning |
|---|---|---|---|---|---|
| [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp) | Coding-Solo, MIT | 6,654, 2026-04-16 | Node.js 18+ and a Godot binary (`GODOT_PATH` if not found). No editor plugin | Launches the editor, runs the project, captures debug output, creates scenes and adds nodes. Simple commands use Godot's CLI; scene work goes through one bundled `godot_operations.gd` | Seven months without a push |
| [hi-godot/godot-ai](https://github.com/hi-godot/godot-ai) | hi-godot, MIT | 3,541, 2026-11-14 | Godot 4.7+, `uv`, the add-on enabled under Project Settings > Plugins, the editor open. Python server on authenticated HTTP port 8000, editor plugin on authenticated WebSocket port 9500 | 46 tools and 120+ operations that build scenes, edit nodes and scripts, wire signals, and configure UI, materials, animation, particles, cameras and environments | `game_eval` executes GDScript in the running game. Anonymous telemetry, opt out with `GODOT_AI_DISABLE_TELEMETRY=true`. Signed releases and project confinement are documented |
| [tugcantopaloglu/godot-mcp](https://github.com/tugcantopaloglu/godot-mcp) | tugcantopaloglu, MIT | 512, 2026-10-09 | Godot 4.4+ (tested on 4.7), Node.js; install by `git clone` and build | Fork of Coding-Solo with 157 tools, including headless scene operations | `game_eval` executes arbitrary GDScript in the running game |
| [satelliteoflove/godot-mcp](https://github.com/satelliteoflove/godot-mcp) | satelliteoflove, MIT | 185, 2026-11-13 | Node server plus a bridge add-on in the project (installed with its `--install-addon` flag); the editor open; the game reached over Godot's debugger | 21 tools, 86 actions. Freezes and steps the game clock for repeatable playtests. Read tools are split from write tools, so reads can be auto-allowed; a `--read-only` flag exists | `godot_exec` runs GDScript in the running game behind a denylist its docs call an accident guard, not a security boundary |
| [HaD0Yun/Doyunha-Gopeak](https://github.com/HaD0Yun/Doyunha-Gopeak) (GoPeak) | HaD0Yun, MIT | 273, 2026-11-13 | Installed with `bun add -g` from a release tarball, with a published SHA-256. GDScript language server on 6005, debug adapter on 6006, runtime add-on on 7777 | Language-server and debug-adapter tools, runtime inspection, screenshots, input injection | Its add-on install pipes a remote script into `bash` (`curl ... \| bash`). Download and read the script first, or install the add-on by hand |
| [ryanmazzolini/minimal-godot-mcp](https://github.com/ryanmazzolini/minimal-godot-mcp) | ryanmazzolini, MIT | 47, 2026-11-12 | Node.js 22+, the editor running with its language server (6005); debug adapter on 6006 or 6010. No plugin | GDScript validation through Godot's own language server | Small surface; reads diagnostics, no code execution found in its README |
| [IvanMurzak/Godot-MCP](https://github.com/IvanMurzak/Godot-MCP) | IvanMurzak, Apache-2.0 | 345, 2026-11-14 | The .NET build of the Godot 4.3+ editor and the .NET 8 SDK (game scripts can stay GDScript); a C# editor add-on | Reads and changes scenes, nodes, resources and scripts; builds and runs C#; validates GDScript; screenshots. CI on 4.3 to 4.7 | Cloud relay by default: the add-on connects out to the hosted ai-game.dev server unless you choose the local server. README states no telemetry |
| [youichi-uda/godot-mcp-pro](https://github.com/youichi-uda/godot-mcp-pro) | youichi-uda, proprietary (GitHub reports no SPDX licence) | 644, 2026-09-24 | The public repo holds only the add-on; the MCP server comes in a paid package | Editor and game tools | `execute_editor_script` runs arbitrary GDScript in the editor; `execute_game_script` runs GDScript in the game. Closed and paid: not a pack dependency |

What to tell the user before they install one:

- A server that runs arbitrary GDScript gives the agent whatever GDScript can do in that process, including file and process access (this skill's rule). satelliteoflove's own docs call its denylist an accident guard, not a security boundary.
- The live-editor servers need the editor open, a plugin in the project and local ports. The CLI-style servers need only the binary and suit CI better.
- Keep the add-on folder out of release exports, or check that it does not ship (this skill's rule).

## Community skill sets

| Repository | Licence | Stars, last push | What it is | Note |
|---|---|---|---|---|
| [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 | 8,899, 2026-11-12 | Cross-engine skills; says it checks against Godot 4.7.2 | Apache-2.0 requires attribution if text is reused |
| [jame581/GodotPrompter](https://github.com/jame581/GodotPrompter) | MIT | 964, 2026-11-14 | 59 Godot 4.x skills as a plugin built on Superpowers | Check its version claims against the release list: 4.8 is still beta |

Use them as a second opinion. When one disagrees with this skill or the Godot docs, the docs win.
