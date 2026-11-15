---
name: game-blender
description: >-
  Takes 3D game assets from Blender 5.x into a web client, Godot or Unity: headless runs with bpy, glTF 2.0 and FBX export settings, modifiers, shape keys and animation clips, PBR materials and packed ORM textures, baking, LODs, collision meshes, engine naming rules, a pre-export checklist, and the Blender MCP servers. Use when a model, prop, character or level piece made in Blender has to reach the game: exporting .glb or .fbx, a script or CI job that runs Blender without the UI, an asset that arrives in the engine with the wrong scale, facing, materials, missing animations or no collision, baking normal or AO maps, or bpy code written for Blender 4.x that fails on 5.x.
---

# Game Blender

Blender is a content tool, not a runtime. It makes the files the game loads: glTF 2.0 for the browser client and Godot, FBX for Unity. This skill covers the Blender side of that file boundary. The loading side belongs to `game-client`, `game-godot` and `game-unity`.

## Version checked against

- Blender 5.3 is the current stable release (2026-11-10). 5.2 is the LTS, supported until July 2028; 4.5 LTS is supported until July 2027 (Blender release notes index, checked 2026-11-14). The API reference and manual pages cited here are the 5.3 editions.
- Python inside Blender is 3.13 since 5.1.
- Write for 5.x. Code from 4.x tutorials and from an assistant's training data breaks on 5.x in the ways listed under "5.x changes" below.
- Godot's own .blend import works with Blender 3.0 or later; Godot recommends 3.5 or later and an official build from blender.org.

## When Blender fits

- 3D props, characters, level pieces and their animations for a three.js or React Three Fiber client, a Godot game or a Unity game.
- Baking high-poly detail and lighting into textures for real-time use.
- A build step that exports or checks assets in CI with no person at the screen.

It does not fit a 2D game whose art is sprite atlases, unless you render the sprites from 3D (this skill's rule).

## Run Blender headless

```sh
blender -b -X -Y --python-exit-code 1 art/crate.blend -P tools/export_glb.py -- out/crate.glb
```

- `-b` runs without the UI, `-X` skips the user's startup file, `-Y` stops scripts stored in the .blend from running, `-P` runs the script, and arguments after `--` reach it through `sys.argv`.
- A .blend can carry Python: registered text blocks and driver expressions run when auto-execution is allowed, and the Preferences still apply in background mode unless `-Y` overrides them (manual, Scripting & Security). Never pass `-y`, never turn on Auto Run Python Scripts, and treat a third-party .blend as code, in CI export scripts and MCP `_for_cli` tools alike.
- Arguments run in the order given, so the .blend comes before `-P`.
- `--python-exit-code` sets the exit code used when the script raises; pass it, since CI cannot otherwise rely on a non-zero exit (this skill's inference). An operator reports finished or cancelled as its return value, so check it and that the file exists, and raise yourself.
- Prefer the data API over `bpy.ops` in background scripts: operators read context (mode, selection, active object) and fail their poll when it is wrong.

`references/headless-and-bpy.md` has the flag table, an export script that fails CI correctly, and the bpy rules for scripts without a UI.

## 5.x changes agents get wrong

| Old (4.x and earlier) | Now (5.x) |
|---|---|
| `action.fcurves`, `action.groups` | F-curves live on a slot's channelbag: `bpy_extras.anim_utils.action_ensure_channelbag_for_slot(action, slot)` |
| `scene.node_tree` for the compositor | `scene.compositor_effects`; the 5.0 replacement `scene.compositing_node_group` is itself deprecated, removal planned for 6.0 |
| `mat.use_nodes = True` to get nodes | New materials already have a node tree; `use_nodes` is a deprecated no-op |
| Combine RGB, Separate RGB nodes | Combine Color, Separate Color, Mode RGB |
| `BLENDER_EEVEE_NEXT` | `BLENDER_EEVEE` |
| `bpy.ops.import_scene.fbx` | `bpy.ops.wm.fbx_import` (C++ importer). Export is still `bpy.ops.export_scene.fbx` |
| Collada (.dae) export | Removed in 5.0 |
| Names capped at 63 bytes | 255 bytes; Blender 4.5 truncates them |

## Export procedure

1. **Pick the format per target.** glTF Binary (.glb) for `game-client` and `game-godot`; FBX for `game-unity`.
2. **Check the scene** against the pre-export checklist below.
3. **Set the exporter options explicitly**, never by relying on defaults:
   - glTF: `export_format='GLB'`, `export_yup=True`, `export_apply` on unless the mesh has shape keys, `export_extras=True` if the game reads custom properties, `export_def_bones=True` for Godot meshes with shape keys.
   - FBX for Unity: `axis_forward='-Z'`, `axis_up='Y'`, `global_scale=1.0`, `apply_unit_scale=True` (the Blender defaults; Unity's page does not name them, so this is this skill's inference: import-test in Unity), `use_mesh_modifiers` chosen per asset, `add_leaf_bones=False` unless the rig will be edited after reimport.
   - Web compression (Draco, meshopt, KTX2, WebP) only when the client sets the matching GLTFLoader decoder.
4. **Export from a script** with the command above, or from a Collection Exporter that stores the settings on the collection.
5. **Verify**: the export returned `{'FINISHED'}`, the file exists, and it imports correctly in the real target.

The defaults, and the cases where the manual and the API disagree, are in `references/export-gltf-fbx.md`.

Rules that cost the most when missed:
- glTF exports only actions that are active on an object or stashed on an NLA track. Stash every clip.
- Only Principled BSDF and unlit materials export to glTF. Data images use Non-Color. Occlusion exports only through a `glTF Material Output` node group.
- glTF packs occlusion in R, roughness in G, metallic in B.
- Applying modifiers at export (glTF `export_apply`, FBX `use_mesh_modifiers`) drops shape keys. The two exporters have opposite defaults.
- FBX Path Mode Copy copies textures beside the file. Embedding needs Embed Textures on as well.
- Never rotate a model by hand to fix the up axis: the exporters convert Blender's Z up.

## Where the asset goes

| Target | File | What the target expects | Engine-side skill |
|---|---|---|---|
| Browser client (three.js, R3F) | .glb | glTF: +Y up, front faces +Z, meters. Draco, meshopt and KTX2 need decoders set on GLTFLoader | `game-client` (its three.js reference) |
| Godot 4 | .glb, or .blend with Blender installed on every machine | 1 unit = 1 m, Y up; name suffixes such as `-col`, `-colonly`, `-noimp`, `loop` | `game-godot` |
| Unity 6 | .fbx | 1 m = 1 unit for physics; `_LOD0`..`_LOD7` names build an LOD Group | `game-unity` |

The multiplayer server in `game-backend-architecture` never loads these files. If it needs collision or navigation data, export that as separate data from simplified meshes (this skill's rule).

LODs, collision meshes and the names each engine reads are in `references/lod-collision-naming.md`.

## Baking

- Bakes run in Cycles (`scene.render.engine = 'CYCLES'`) into the active Image Texture node of a mesh with a UV map.
- Normal maps for glTF: tangent space, swizzle +X +Y +Z (the defaults).
- Selected to Active uses either Max Ray Distance (no cage) or Cage Extrusion (with cage), not both: the manual makes ray distance available only without a cage.
- Margin defaults to 16 px; the operator's margin type default differs from the scene setting, so pass it.

`references/baking-and-textures.md` covers the bake options, ORM packing with Combine Color, and texture formats.

## Pre-export checklist

1. Rotation and scale applied; scale reads 1.0; one unit is one meter.
2. Origin where the engine needs the pivot; LODs share it.
3. Object in object mode, not edit mode.
4. Every mesh has a UV map; baked images are saved and wired.
5. Principled BSDF or unlit materials only; data images Non-Color; Backface Culling on for one-sided materials.
6. Modifiers applied or `export_apply` set on purpose; shape-key meshes handled.
7. Every clip active or stashed, named for the engine (Godot `loop`/`cycle`).
8. Collision, helper and LOD names match the engine, and no visual mesh ends in `_col` by accident.
9. Compression options match the client's loader.
10. After export: import into the real target and check scale, facing, materials, clips, collision.

`references/qa-checklist.md` has severities, the delivery note and a background check script.

## Agent tooling

- Official: the Blender Lab MCP server (GPL-3.0, Blender 5.1+, add-on plus `blender-mcp` server). Its `execute_blender_code` runs model-written Python with no guards; Blender Lab recommends a virtual machine or a system without sensitive data. Use it for live sessions and .blend inspection.
- Community servers (ahujasid/mcp-for-blender, HoldMyBeer-gg/blenderwright, sandraschi/blender-mcp) also run raw Python; ahujasid's sends anonymous usage telemetry by default.
- Avoid repositories that hold only a README and a licence, whatever their star count.
- The user installs any server; this pack ships no MCP config. Repeatable exports need no server: use the command line.

`references/agent-tooling.md` lists licences, stars, tools, requirements and warnings.

## Pitfalls

- bpy code from 4.x tutorials: `action.fcurves`, `scene.node_tree`, Combine RGB, `BLENDER_EEVEE_NEXT`.
- A failing script that exits 0 because `--python-exit-code` is missing, or because a cancelled operator was not checked.
- Flags after the .blend in the wrong order, so settings are overwritten when the file loads.
- glTF export with `export_apply` left False ships the unmodified base mesh; turning it on silently drops shape keys.
- Actions that are neither active nor stashed vanish from the glTF.
- Draco or KTX2 output loaded by a client that never set the decoder.
- FBX Path Mode Copy expected to embed textures.
- Trusting the FBX manual's Scale default of 10; the API default is 1.0.
- Relying on FBX for morph targets without an engine import test: the manual and the 5.1 notes disagree.
- Setting both Cage Extrusion and Max Ray Distance and expecting both to apply.
- A Godot import that grows collision on a mesh named `wall_col`.
- Running an MCP server's raw-code tool on the only copy of a .blend.
- Opening a downloaded .blend with `-y` or Auto Run Python Scripts on: its drivers and registered scripts run with your permissions.

## Files

- `references/headless-and-bpy.md`: read when running Blender from a script or CI, or when bpy code fails on 5.x.
- `references/export-gltf-fbx.md`: read when choosing exporter settings, or when an asset arrives with wrong scale, axis, materials or missing animation.
- `references/lod-collision-naming.md`: read when preparing LODs, collision meshes or names for Godot or Unity.
- `references/baking-and-textures.md`: read when baking normal, AO or other maps, or packing ORM textures.
- `references/qa-checklist.md`: read when checking an asset before or after export, or writing a check script for CI.
- `references/agent-tooling.md`: read when choosing or installing a Blender MCP server.
- `references/sources.md`: read when you need the page behind a rule or want to re-check a version.

## Related skills

- `game-client`: the browser client that loads the .glb with three.js or React Three Fiber; GPU disposal and the 4096 px texture cap.
- `game-godot`: the Godot 4 client, its text scenes and its headless imports and exports.
- `game-unity`: the Unity client and its asset loading; it receives the FBX this skill produces.
- `game-backend-architecture`: the authoritative server that owns gameplay collision.
- `ci-cd-game`: the pipeline where a headless export or asset check can run.
- `level-design`: the levels these assets fill.
- `elevenlabs-sound-music`: the audio side of the same asset pipeline.
