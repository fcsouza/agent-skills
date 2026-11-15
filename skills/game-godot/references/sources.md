# Sources

Every URL below was opened on 2026-11-14. Godot documentation pages were read from the rst source of the docs' `stable` branch (version 4.7, the source of docs.godotengine.org/en/stable) and each rendered page was confirmed to load.

## Version and releases

- Godot Engine, "Releases" (GitHub, 2026) - https://github.com/godotengine/godot/releases/tag/4.7.2-stable - supports: 4.7.2-stable published 2026-08-18; 3.6.3-stable 2026-08-22 is the newest Godot 3 release - checked 2026-11-14
- Godot Engine, "godot-builds releases" (GitHub, 2026) - https://github.com/godotengine/godot-builds/releases/tag/4.8-beta3 - supports: 4.8-beta3 published 2026-11-09; 4.8 is not stable - checked 2026-11-14
- Godot Engine, "Godot 4.6 release page" (godotengine.org, 2026) - https://godotengine.org/releases/4.6/ - supports: Jolt is the default physics engine for all new 3D projects; new Windows projects default to Direct3D 12 - checked 2026-11-14

## Engine documentation (4.7)

- Godot Docs, "C# basics" - https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html - supports: Godot 4 C# projects cannot export to the web; Android and iOS since 4.2 are experimental; .NET SDK plus .NET-enabled editor; .NET 8 or later, .NET 9 or later for Android - checked 2026-11-14
- Godot Docs, "Exporting for the Web" - https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html - supports: WebGL 2 via Compatibility only, no WebGPU; only HTTP, WebSocket client and WebRTC; single-threaded export since 4.3 avoids cross-origin isolation - checked 2026-11-14
- Godot Docs, "Command line tutorial" - https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html - supports: every CLI flag in this skill; export needs the editor binary and installed templates; headless required without a GPU; scripts must extend SceneTree or MainLoop; --test needs tests=yes - checked 2026-11-14
- Godot Docs, "Version control systems" - https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html - supports: ignore .godot/ and *.translation; generated .gitignore and .gitattributes; export_presets.cfg credentials only in 3.x and 4.0 - checked 2026-11-14
- Godot Docs, "Project organization" - https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html - supports: snake_case files except PascalCase C# scripts, Windows case issues; PascalCase node names; addons/ folder - checked 2026-11-14
- Godot Docs, "TSCN file format" - https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html - supports: format=3 versus format=2; load_steps deprecated before 4.6; section order; ExtResource and SubResource; unique_id from 4.6; comments and default values discarded on save - checked 2026-11-14
- Godot Docs, "Upgrading from Godot 3 to Godot 4" - https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.html - supports: renames table; FileAccess and DirAccess; super() in lifecycle overrides; Signal-based connections; Tween node removed; randomize() on load; String and StringName - checked 2026-11-14
- Godot Docs, "Upgrading from Godot 4.3 to Godot 4.4" - https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.4.html - supports: FileAccess store_* return bool; @export_file stores uid:// paths - checked 2026-11-14
- Godot Docs, "Upgrading from Godot 4.5 to Godot 4.6" - https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.6.html - supports: StreamPeerTCP and TCPServer methods moved to StreamPeerSocket and SocketServer; AnimationPlayer properties to StringName - checked 2026-11-14
- Godot Docs, "Upgrading from Godot 4.6 to Godot 4.7" - https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.7.html - supports: DEVICE_ID_MOUSE and DEVICE_ID_KEYBOARD instead of 0; is_class takes StringName - checked 2026-11-14
- Godot Docs, "GDScript reference" - https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html - supports: annotations; await, yield reserved; variadic functions since 4.5; @abstract annotation; tool-script freeing warning; RefCounted, free, weakref memory rules - checked 2026-11-14
- Godot Docs, "GDScript style guide" - https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_styleguide.html - supports: snake_case, PascalCase and CONSTANT_CASE naming table - checked 2026-11-14
- Godot Docs, "TileMap" class - https://docs.godotengine.org/en/stable/classes/class_tilemap.html - supports: TileMap deprecated in favour of TileMapLayer nodes - checked 2026-11-14
- Godot Docs, "Node" class - https://docs.godotengine.org/en/stable/classes/class_node.html - supports: _enter_tree parent first, _ready children first; physics processing 60 per second by default; queue_free at end of frame with children; create_tween - checked 2026-11-14
- Godot Docs, "Idle and physics processing" - https://docs.godotengine.org/en/stable/tutorials/scripting/idle_and_physics_processing.html - supports: _process every frame, _physics_process at a fixed rate, 60 by default - checked 2026-11-14
- Godot Docs, "Physics interpolation quick start guide" - https://docs.godotengine.org/en/stable/tutorials/physics/interpolation/physics_interpolation_quick_start_guide.html - supports: move objects in _physics_process; call reset_physics_interpolation after positioning or teleporting - checked 2026-11-14
- Godot Docs, "Introduction to physics interpolation" - https://docs.godotengine.org/en/stable/tutorials/physics/interpolation/physics_interpolation_introduction.html - supports: interpolation works between physics ticks and rendered frames - checked 2026-11-14
- Godot Docs, "Engine" class - https://docs.godotengine.org/en/stable/classes/class_engine.html - supports: physics_ticks_per_second 60; physics can break down below about 30; max_physics_steps_per_frame; get_physics_interpolation_fraction for fixed-timestep interpolation - checked 2026-11-14
- Godot Docs, "Time" class - https://docs.godotengine.org/en/stable/classes/class_time.html - supports: get_ticks_msec is monotonic; _from_system clocks can be changed by the user - checked 2026-11-14
- Godot Docs, "Introduction to 3D" - https://docs.godotengine.org/en/stable/tutorials/3d/introduction_to_3d.html - supports: 1 unit is 1 metre; Y up; right-handed - checked 2026-11-14
- Godot Docs, "Vector math" - https://docs.godotengine.org/en/stable/tutorials/math/vector_math.html - supports: 2D origin top-left, positive Y down, pixels - checked 2026-11-14
- Godot Docs, "Matrices and transforms" - https://docs.godotengine.org/en/stable/tutorials/math/matrices_and_transforms.html - supports: rotations in radians - checked 2026-11-14
- Godot Docs, "Using InputEvent" - https://docs.godotengine.org/en/stable/tutorials/inputs/inputevent.html - supports: InputMap actions with Input.is_action_pressed; _unhandled_input for gameplay so GUI gets events first - checked 2026-11-14

- Godot Docs, "List of features" - https://docs.godotengine.org/en/stable/about/list_of_features.html - supports: editor and exports on Windows, macOS, Linux; Android editor experimental; iOS runs exported projects; consoles see godotengine.org/consoles - checked 2026-11-14
- Godot Docs, "SceneTree" class - https://docs.godotengine.org/en/stable/classes/class_scenetree.html - supports: quit(exit_code), 0 for success by convention - checked 2026-11-14
- Godot Docs, "Sprite2D" class - https://docs.godotengine.org/en/stable/classes/class_sprite2d.html - supports: texture property used in the scene example - checked 2026-11-14
- Godot Docs, "Dictionary" class - https://docs.godotengine.org/en/stable/classes/class_dictionary.html - supports: duplicate(deep), erase, get(key, default), has - checked 2026-11-14
- Godot Docs, "Array" class - https://docs.godotengine.org/en/stable/classes/class_array.html - supports: append, pop_front - checked 2026-11-14
- Godot Docs, "Signal" class - https://docs.godotengine.org/en/stable/classes/class_signal.html - supports: emit - checked 2026-11-14
- Godot Docs, "PackedByteArray" class - https://docs.godotengine.org/en/stable/classes/class_packedbytearray.html - supports: get_string_from_utf8 - checked 2026-11-14

## Networking

- Godot Docs, "WebSocketPeer" class - https://docs.godotengine.org/en/stable/classes/class_websocketpeer.html - supports: connect_to_url then poll; send_text for JSON; handshake_headers not supported on web; heartbeat_interval no effect on web, default 0; 65535-byte buffers and 4096 queued packets; keep polling until STATE_CLOSED; connect_to_url returns OK before connecting; wss:// hostname matching the certificate; get_connected_host unavailable on web - checked 2026-11-14
- Godot Docs, "Using WebSockets" - https://docs.godotengine.org/en/stable/tutorials/networking/websocket.html - supports: WebSocket in native and web exports; poll in _process or _physics_process; Android INTERNET permission - checked 2026-11-14
- Godot Docs, "High-level multiplayer" - https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html - supports: high-level API built on SceneTree with @rpc and MultiplayerPeer, WebSocketMultiplayerPeer; low-level work cannot be avoided with a custom backend server; treat all client input as untrusted - checked 2026-11-14
- Godot Docs, "HTTPClient" class - https://docs.godotengine.org/en/stable/classes/class_httpclient.html - supports: avoid credentials in GET URL parameters; web exports need CORS on the remote server - checked 2026-11-14
- Godot Engine, "wsl_peer.cpp" at 4.7.2-stable (GitHub) - https://github.com/godotengine/godot/blob/4.7.2-stable/modules/websocket/wsl_peer.cpp - supports: the native handshake sends Host, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, optional Sec-WebSocket-Protocol and handshake_headers lines; no Origin - checked 2026-11-14
- Godot Engine, "websocket_minimal client.gd" (godot-demo-projects, 9,794 stars, MIT) - https://github.com/godotengine/godot-demo-projects/blob/master/networking/websocket_minimal/client.gd - supports: connect in _ready, poll and drain in _process, close in _exit_tree - checked 2026-11-14
- IETF, "RFC 6455: The WebSocket Protocol" (2011) - https://datatracker.ietf.org/doc/html/rfc6455 - supports: section 10.5, servers may authenticate with cookies or HTTP authentication; section 10.1, non-browser hosts can send fake Origin fields; section 10.2, servers for specific sites should verify Origin - checked 2026-11-14
- WHATWG, "WebSockets Standard" - https://websockets.spec.whatwg.org/ - supports: constructor takes url and protocols only, no headers; the connection request uses credentials mode include - checked 2026-11-14
- MDN, "Set-Cookie" - https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie - supports: SameSite Strict, Lax and None behaviour; some browsers default to Lax - checked 2026-11-14
- Better Auth, "Cookies" - https://www.better-auth.com/docs/concepts/cookies - supports: crossSubDomainCookies, enable only when needed with the narrowest domain; default SameSite not stated - checked 2026-11-14
- Better Auth, "Bearer plugin" - https://www.better-auth.com/docs/plugins/bearer - supports: token from the set-auth-token response header; getSession with an Authorization Bearer header; use only for clients without cookie support - checked 2026-11-14
- Better Auth, "One-Time Token plugin" - https://www.better-auth.com/docs/plugins/one-time-token - supports: single-use session tokens for cross-domain authentication; 3-minute default expiry, expiresIn in minutes; auth.api.verifyOneTimeToken returns the session - checked 2026-11-14

## Data, saves and localization

- Godot Docs, "Saving games" - https://docs.godotengine.org/en/stable/tutorials/io/saving_games.html - supports: saves in user://; ConfigFile for user configuration; JSON cannot hold Vector2, Vector3, Color, Rect2, Quaternion; store_var and get_var binary serialization - checked 2026-11-14
- Godot Docs, "JSON" class - https://docs.godotengine.org/en/stable/classes/class_json.html - supports: all numbers become floats; parse_string returns null on failure; lax parsing; INF and NAN handling; from_native and to_native - checked 2026-11-14
- Godot Docs, "FileAccess" class - https://docs.godotengine.org/en/stable/classes/class_fileaccess.html - supports: get_var(allow_objects) warning that deserialized objects can execute code; file_exists; get_as_text - checked 2026-11-14
- Godot Docs, "@GlobalScope" - https://docs.godotengine.org/en/stable/classes/class_@globalscope.html - supports: bytes_to_var_with_objects execution warning; var_to_bytes_with_objects can include executable code; lerpf - checked 2026-11-14
- Godot Docs, "Internationalizing games" - https://docs.godotengine.org/en/stable/tutorials/i18n/internationalizing_games.html - supports: tr() with keys; TranslationServer.set_locale; translation contexts; tr_n pluralization - checked 2026-11-14
- Godot Docs, "Localization using gettext" - https://docs.godotengine.org/en/stable/tutorials/i18n/localization_using_gettext.html - supports: PO files work better with Git than CSV; plurals and contexts - checked 2026-11-14
- Godot Docs, "Object" class - https://docs.godotengine.org/en/stable/classes/class_object.html - supports: tr_n signature with plural message, n and context - checked 2026-11-14

## Official position on AI tooling

- Godot Engine, "UID changes coming to Godot 4.4" (godotengine.org) - https://godotengine.org/article/uid-changes-coming-to-godot-4-4/ - supports: commit .uid files, never ignore them; move the .uid with a script or shader moved outside the editor - checked 2026-11-14
- Godot Engine, "Contribution policy 2026" (godotengine.org, 2026) - https://godotengine.org/article/contribution-policy-2026/ - supports: human-authored code required for engine contributions; AI limited to menial help; nothing on games made with Godot - checked 2026-11-14
- Godot Engine, "CONTRIBUTING.md" at 4.7.2-stable - https://github.com/godotengine/godot/blob/4.7.2-stable/CONTRIBUTING.md - supports: AI agents must disclose in titles or be banned - checked 2026-11-14
- Godot Engine, "godot-proposals #12409" (GitHub, 2025) - https://github.com/godotengine/godot-proposals/issues/12409 - supports: integrated AI assistant closed as not planned on 2025-08-23; third-party add-ons encouraged - checked 2026-11-14
- Godot Engine, "godotengine organisation repositories" (GitHub API) - https://api.github.com/orgs/godotengine/repos - supports: no MCP, AI, agent, LLM or skill repository - checked 2026-11-14
- Godot Docs, "llms.txt" - https://docs.godotengine.org/llms.txt - supports: returns 404, as do https://docs.godotengine.org/en/stable/llms.txt and https://godotengine.org/llms.txt - checked 2026-11-14

## Community projects (examples, not authority for an API)

Stars and last push from the GitHub API on 2026-11-14.

- Coding-Solo, "godot-mcp" (6,654 stars, MIT) - https://github.com/Coding-Solo/godot-mcp - supports: Node 18+, GODOT_PATH, CLI plus bundled godot_operations.gd, tool names - checked 2026-11-14
- hi-godot, "godot-ai" (3,541 stars, MIT) - https://github.com/hi-godot/godot-ai - supports: Godot 4.7+, uv, add-on, ports 8000 and 9500, 46 tools, telemetry opt-out, signed releases, project confinement - checked 2026-11-14
- hi-godot, "godot-ai editor.py" - https://github.com/hi-godot/godot-ai/blob/main/src/godot_ai/tools/editor.py - supports: game_eval(code) operation - checked 2026-11-14
- tugcantopaloglu, "godot-mcp" (512 stars, MIT) - https://github.com/tugcantopaloglu/godot-mcp - supports: 157 tools, Godot 4.4+, tested on 4.7, game_eval executes arbitrary GDScript - checked 2026-11-14
- satelliteoflove, "godot-mcp" (185 stars, MIT) - https://github.com/satelliteoflove/godot-mcp - supports: bridge add-on, debugger link, 21 tools and 86 actions, game-clock stepping, read and write split, read-only flag - checked 2026-11-14
- satelliteoflove, "exec tool docs" - https://github.com/satelliteoflove/godot-mcp/blob/main/docs/tools/exec.md - supports: godot_exec runs GDScript in the running game; denylist is an accident guard, not a security boundary - checked 2026-11-14
- HaD0Yun, "Doyunha-Gopeak" (273 stars, MIT) - https://github.com/HaD0Yun/Doyunha-Gopeak - supports: bun add -g with SHA-256; curl piped to bash add-on install; ports 6005, 6006, 7777 - checked 2026-11-14
- ryanmazzolini, "minimal-godot-mcp" (47 stars, MIT) - https://github.com/ryanmazzolini/minimal-godot-mcp - supports: Node 22+, Godot language server 6005 and debug adapter, no plugin - checked 2026-11-14
- IvanMurzak, "Godot-MCP" (345 stars, Apache-2.0) - https://github.com/IvanMurzak/Godot-MCP - supports: .NET Godot 4.3+ editor and .NET 8 SDK; cloud relay ai-game.dev by default or a local server; no telemetry stated; CI on 4.3 to 4.7 - checked 2026-11-14
- youichi-uda, "godot-mcp-pro" (644 stars, proprietary) - https://github.com/youichi-uda/godot-mcp-pro - supports: proprietary licence, paid MCP server, execute_editor_script and execute_game_script - checked 2026-11-14
- gamedev-skills, "awesome-gamedev-agent-skills" (8,899 stars, Apache-2.0) - https://github.com/gamedev-skills/awesome-gamedev-agent-skills - supports: cross-engine skills checked against Godot 4.7.2 - checked 2026-11-14
- jame581, "GodotPrompter" (964 stars, MIT) - https://github.com/jame581/GodotPrompter - supports: 59 Godot skills built on Superpowers - checked 2026-11-14
- bitwes, "Gut" (2,784 stars, MIT per README) - https://github.com/bitwes/Gut - supports: GUT 9.x for Godot 4, 9.7.1 for 4.7.x - checked 2026-11-14
- GUT, "Command Line" docs - https://gut.readthedocs.io/en/latest/Command-Line.html - supports: gut_cmdln.gd command, -gdir, -gexit, -gjunit_xml_file, exit code 1 on failure - checked 2026-11-14
- godot-gdunit-labs, "gdUnit4" (1,301 stars, MIT) - https://github.com/godot-gdunit-labs/gdUnit4 - supports: GDScript, C# and scene tests; version support table - checked 2026-11-14
