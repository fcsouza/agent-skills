# Project, text formats and the command line

Checked against Godot 4.7.2-stable and the 4.7 documentation, 2026-11-14. Every flag below is from the official command-line tutorial.

## Create a project without the editor

A project is a folder that contains `project.godot`. The official tutorial creates one with an empty file:

```bash
mkdir newgame && cd newgame && touch project.godot
```

There is no `create-project` command. Open the folder once in the editor, or run `--import`, to let Godot fill in the settings and the `.godot/` cache.

## Flags an agent uses

| Flag | What it does |
|---|---|
| `--headless` | Headless display driver and Dummy audio driver. Required where there is no GPU, such as CI. On a machine with a GPU it stops a window from opening during export |
| `--path <dir>` | The project folder (must contain `project.godot`) |
| `--import` | Starts the editor, waits for resources to import, then quits |
| `-s`, `--script <file>` | Runs a script. It must extend `SceneTree` or `MainLoop` |
| `--check-only` | With `--script`: parse for errors and quit |
| `--quit`, `--quit-after <n>` | Quit after the first iteration, or after n iterations |
| `--export-release <preset> <path>` | Export with a preset from `export_presets.cfg`. The target directory must exist |
| `--export-debug <preset> <path>` | Same with the debug template. Implies `--import` |
| `--export-pack <preset> <path>` | Export only the game pack; the extension picks PCK or ZIP. Implies `--import` |
| `--export-patch <preset> <path>` with `--patches <list>` | Export a pack of changed files only |
| `--build-solutions` | Build C# solutions |
| `--install-android-build-template` | Install the Android build template, with `--export-release` or `--export-debug` |
| `--log-file <file>` | Write the log to this path |
| `--lsp-port`, `--dap-port` | Ports for the GDScript language server and debug adapter |
| `--doctool <path>`, `--gdscript-docs <path>` | Dump the engine API reference, or reference docs from GDScript comments |
| `--convert-3to4`, `--validate-conversion-3to4` | Convert a Godot 3 project, or list what the conversion would rename |

Export paths given to `--export-*` are relative to the folder holding `project.godot`, not to the current directory.

## Run a script headless

```gdscript
# tools/check_levels.gd, Godot 4.7. Run with:
#   godot --headless --path . --script res://tools/check_levels.gd
extends SceneTree

func _init() -> void:
	print("levels ok")
	quit()
```

`quit()` ends the run (the official example calls it). `quit(exit_code)` sets the process exit code; by convention 0 is success and anything else an error, so pass 1 when a CI check fails.

## Export from CI

1. Download the **editor** binary for the exact version and the matching export templates. The command must run the editor, not a template.
2. `godot --headless --path . --import`.
3. `godot --headless --path . --export-release "Web" build/web/index.html` (preset names come from `export_presets.cfg`; create `build/web/` first).
4. For a web build that must run on stores and portals, use the single-threaded export (available since 4.3). The threaded export needs cross-origin isolation headers on the host, which rules out ads and third-party integrations on that page.
5. Android: enable the `INTERNET` permission in the preset, or Android blocks all networking.

## Text scenes (`.tscn`) and resources (`.tres`)

Hand edits work if they follow the format:

- First line: the descriptor, for example `[gd_scene format=3 uid="uid://cecaux1sm7mo0"]`. Godot 4 writes `format=3`; Godot 3 wrote `format=2`.
- `load_steps` appears only in scenes saved before 4.6. It is deprecated; leave it out of new files.
- Sections in order: `ext_resource`, then `sub_resource`, then `node`, then `connection`.
- Properties reference resources as `ExtResource("id")` and `SubResource("id")`.
- The root node has no `parent`. Every other node gives a path from the root: `parent="."`, `parent="Arm/Hand"`.
- Scenes saved with 4.6 or later give each node a `unique_id`, used to track nodes that are moved or renamed. Older scenes lack it, so do not depend on it.
- Comments start with `;` and are discarded when the editor saves. Properties equal to their default are not stored, and hand-written ones are dropped on save.

```ini
; Godot 4.7 text scene, minimal
[gd_scene format=3 uid="uid://b2kq3m8x1pwln"]

[ext_resource type="Texture2D" path="res://player/player.png" id="1_abc"]

[node name="Player" type="CharacterBody2D"]

[node name="Sprite2D" type="Sprite2D" parent="."]
texture = ExtResource("1_abc")
```

The `uid` values here are placeholders. Let the editor or `--import` assign real ones; two files with the same UID collide (this skill's rule).

## UID files

Since 4.4, scripts and shaders get a `.uid` file beside them. Commit them. When a script or shader moves outside the editor, move its `.uid` too; deleting a stale `.uid` is less important. `@export_file` stores `uid://` paths, not `res://`, since 4.4.

## Tests

Godot has no game test framework; `--test` is for engine C++ tests built with `tests=yes`. Community frameworks, checked 2026-11-14:

| Framework | Stars | Licence | Last push | Notes |
|---|---|---|---|---|
| [bitwes/Gut](https://github.com/bitwes/Gut) | 2,784 | MIT (stated in its README; GitHub detects none) | 2026-08-18 | GDScript tests in GDScript. GUT 9.x targets Godot 4; 9.7.1 targets 4.7.x |
| [godot-gdunit-labs/gdUnit4](https://github.com/godot-gdunit-labs/gdUnit4) | 1,301 | MIT | 2026-11-14 | GDScript, C# and scene tests, input simulation. v6.2.x lists 4.5 to 4.7.1; master (v7.0.0) lists 4.7, 4.7.1 and 4.8 dev |

GUT on the command line, from its docs:

```bash
godot -d -s addons/gut/gut_cmdln.gd --path "$PWD" -gdir=res://test -gexit -gjunit_xml_file=junit.xml
```

`-gdir` lists the test folders, `-gexit` quits when done, `-gjunit_xml_file` writes JUnit XML. The run returns 1 if any test fails. Add `--headless` on CI (this skill's rule, from the export note above).
