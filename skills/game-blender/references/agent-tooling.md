# Agent tooling for Blender

Stars, licences and last push from the GitHub API and the Blender Gitea API on 2026-11-14. The user installs any of these; this pack ships no MCP configuration. Every server listed here can run Python inside Blender, which can read, change, delete or send any file the Blender process can reach.

## What exists

- No official Blender agent skill was found, and docs.blender.org serves no `llms.txt` (404 at the site root, the manual and the API reference, checked 2026-11-14).
- The official agent tool is the Blender Lab MCP server. Its bundled API reference and manual excerpts are the closest thing to official machine-readable docs.
- An agent does not need any MCP server to export or check assets: the headless command line in `references/headless-and-bpy.md` does the same work in CI with no add-on.

## Official: Blender Lab MCP server

- Publisher: Blender Lab, which describes itself as the innovation space within the Blender project. Source: projects.blender.org/lab/blender_mcp. Licence GPL-3.0-or-later. 38 stars, 41 forks, last update 2026-09-29. Latest release v1.0.3 (2026-09-11) with `mcp-1.0.3.zip` (add-on) and `blender-1.0.3.mcpb` (MCP bundle).
- Needs Blender 5.1 or newer, the add-on installed and enabled, an MCP client, and the server (from the `.mcpb` bundle or source). The add-on must be enabled for any tool to work.
- Design: the add-on opens a TCP socket inside Blender, by default `localhost:9876`; a separate `blender-mcp` process talks stdio to the client and relays over the socket.
- Tools: `execute_blender_code`; `get_blendfile_summary_*` (data-blocks, missing files, linked libraries, paths, usage guess); `get_objects_summary`, `get_object_detail_summary`; `get_python_api_docs`, `search_api_docs`, `search_manual_docs`; screenshots of an area or window; `render_thumbnail_to_path`, `render_viewport_to_path`; tab and view jumps. `execute_blender_code` and the five `get_blendfile_summary_*` tools have `_for_cli` twins that open the .blend with `blender --background`, so they work without the UI.
- Its own warning, in short: the server runs LLM-generated code in Blender with no guards against deleting your data or sending it elsewhere; use a virtual machine or a system without sensitive data. The add-on's `weak_sandbox.py` says of itself that it is not really a sandbox and a motivated LLM can work around it. Both execute tools carry `destructiveHint=True`.
- Use it when a person works in the Blender UI with an agent beside them, or to inspect a .blend (missing textures, data-block usage) and search the bundled docs. For repeatable exports, use the command line.

## Community servers

| Repository | Licence | Stars | Last push | What it does | Warning |
|---|---|---|---|---|---|
| ahujasid/mcp-for-blender (PyPI `mcp-for-blender`, was `blender-mcp`) | MIT | 34,442 | 2026-11-13 | `get_scene_info`, `execute_blender_code`, a live viewport, Poly Haven and Sketchfab assets, AI model generation through third-party services (Meshy, Hunyuan3D, Tripo, Hyper3D Rodin). Needs Blender open with its add-on, which starts its server when Blender opens | README: `execute_blender_code` runs arbitrary Python, "ALWAYS save your work". Script checks are off unless `BLENDER_MCP_SAFE_MODE=1`. Asset and generation tools send data to third-party services. Content telemetry is opt-in, but a minimal anonymous usage record (install ID, tool names, versions, OS) is sent by default until `DISABLE_TELEMETRY=true` |
| HoldMyBeer-gg/blenderwright (`uvx blenderwright`) | MIT | 198 | 2026-11-05 | README claims 276 tools in 32 modules; built and tested on Blender 5.2 LTS. Needs its add-on, port 9876 by default | Raw Python (`execute_blender_code`) is off until you tick "Allow raw Python" each session; its restricted namespace is "a guard against accidents, not a security boundary" |
| sandraschi/blender-mcp | MIT | 65 | 2026-10-29 | Runs Blender headless as a `--background` subprocess by default; `BLENDER_EXECUTABLE` points at Blender | `blender_script_execute` runs inline bpy scripts |
| PatrykIti/blender-ai-mcp | Apache-2.0 | 66 | 2026-10-12 | | README: project discontinued, no longer maintained. Do not adopt |

Clashes to know:
- The Lab add-on and blenderwright both default to port 9876, so only one listens at a time.
- The Lab server's entry point is `blender-mcp`, and ahujasid's README says `uvx blender-mcp` still runs ahujasid's server. A config line `uvx blender-mcp` installs the community server, not the official one.

## Repositories to avoid

Skip any repository that holds only a README and a licence (sometimes a docs folder), whatever its star count. A server with no source cannot be read before it runs code on your machine. Do not open their download links.

## Rules when an agent drives Blender through MCP

This skill's rules:
- Save the .blend, or work on a copy, before the first `execute_blender_code` call.
- Inspect first (objects summary, data-block summary), then change.
- Prefer the `_for_cli` tools for anything you will repeat; they leave the open session alone.
- Treat code the model wrote like any script from the internet: read it before it runs on files you care about.
- A `_for_cli` tool opens the .blend you name in background mode. Point it only at files you trust; a third-party .blend can carry drivers and registered scripts (see `references/headless-and-bpy.md`).
