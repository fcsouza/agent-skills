# Headless Blender and bpy

Checked against the Blender 5.3 manual and Python API reference (2026-11-14). Python code here was written against those pages and has not been run in this repo; run it in Blender 5.3 before you rely on it.

## The command line

Shape of a CI export:

```sh
blender -b -X -Y --python-exit-code 1 art/crate.blend -P tools/export_glb.py -- out/crate.glb
```

| Flag | What it does (manual, Command Line Arguments) |
|---|---|
| `-b`, `--background` | Runs without the UI. Audio is off in background mode. |
| `-X`, `--factory-startup` | Skips the `startup.blend` in the user's home directory. Use it so a run does not depend on whose machine it is (this skill's rule). |
| `-P`, `--python <file>` | Runs a script file. |
| `--python-expr <code>` | Runs an inline expression; it may be a whole multi-line script. |
| `--python-exit-code <n>` | Exit code (0 to 255) used when a Python exception is raised, only for scripts run from the command line. 0 disables it. |
| `--addons <a,b>` | Enables add-ons by name, comma separated, no spaces. |
| `-Y`, `--disable-autoexec` | Python scripts stored in .blend files (drivers, startup scripts) do not run. Off is the default, but the Preferences still apply in background mode, so pass `-Y` to be sure (manual, Scripting & Security). |
| `-c`, `--command <cmd>` | Runs a command that takes all remaining arguments; implies background mode. |
| `--` | Ends option processing. Everything after it reaches the script through `sys.argv`. |

Order matters. Blender runs arguments in the order given. The manual's example: a render flag before the output flag renders without the output path, and an output path set before the .blend is overwritten when the file loads. So put the .blend before `-P`, and script arguments after `--`.

## A .blend file is code

The manual's Scripting & Security page:
- A .blend can carry Python, and Python does not restrict what a script can do. Registered text blocks load on start; driver expressions run in rigs and animations.
- Auto-execution is off by default, but the Preferences toggle Auto Run Python Scripts turns it on globally, and `-y`/`--enable-autoexec` turns it on for one run. The command-line flags override the Preferences, also in background mode.
- Some scripts run even with auto-execution off when a user acts: running a script in the Text editor, or rendering with Freestyle.

This skill's rules:
- Pass `-Y` on every headless run. Never pass `-y`, and never enable Auto Run Python Scripts on a machine that opens files from others.
- Treat a third-party .blend (downloaded, from a contractor, from an asset store) as untrusted code. Open it in a virtual machine or a throwaway CI runner with no secrets before it enters the project.
- The same applies when an MCP server's `_for_cli` tool opens a .blend in background mode for you.

## Exit codes are not automatic

- `--python-exit-code <n>` sets the exit code used when a Python exception is raised (manual). This skill's inference: without it, CI cannot rely on a failing script exiting non-zero, so always pass it.
- An operator's return value reports whether it finished or was cancelled (API gotchas, Using Operators); the glTF exporter returns `{'FINISHED'}` or `{'CANCELLED'}` (add-on source). This skill's inference: a cancelled export that raises nothing exits 0 even with `--python-exit-code`.
- This skill's rule: check the return set and that the output file exists, and raise if either is wrong.

```python
# Blender 5.3 API (checked 2026-11-14). Run with:
#   blender -b -X -Y --python-exit-code 1 asset.blend -P export_glb.py -- out/asset.glb
import sys
from pathlib import Path

import bpy

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(args) != 1:
    raise RuntimeError("pass the output path after --")
out = Path(args[0]).resolve()
out.parent.mkdir(parents=True, exist_ok=True)

# export_apply is one switch for the whole file, and applying modifiers drops
# shape keys (export_apply's own warning). Refuse a file that needs both
# settings at once: apply the modifiers in the .blend, or export the two
# groups to separate files. Any modifier counts, an Armature modifier
# included, so a skinned mesh with face shape keys is refused too.
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
keyed = [o.name for o in meshes if o.data.shape_keys]
modified = [o.name for o in meshes if o.modifiers]
if keyed and modified:
    raise RuntimeError(
        f"shape-key meshes {keyed} and modified meshes {modified} "
        "need different export_apply values"
    )
result = bpy.ops.export_scene.gltf(
    filepath=str(out),
    export_format="GLB",
    export_apply=bool(modified),
    export_extras=True,
)
if result != {"FINISHED"} or not out.is_file():
    raise RuntimeError(f"glTF export failed: {result}")
```

`export_format` is typed as a plain string on the API page; its values, `GLB` and `GLTF_SEPARATE` (plus `GLTF_EMBEDDED` when the add-on preference allows it), come from the glTF add-on source at the v5.3.0 tag.

## Blender 5.x API changes that older code gets wrong

From the 5.0 Python API release notes unless marked:

- The legacy Action API is gone: `action.fcurves`, `action.groups` and `action.id_root` were removed. F-curves live in a slot's channelbag. Use `bpy_extras.anim_utils.action_get_channelbag_for_slot(action, slot)` to find one and `action_ensure_channelbag_for_slot(action, slot)` to create one, then `channelbag.fcurves.find/new/ensure`.
- `scene.node_tree` was removed. The 5.0 notes point to `scene.compositing_node_group`, but the 5.3 Scene reference marks that property deprecated since 5.0, removal planned in 6.0, and says to use `scene.compositor_effects`. Each `SceneCompositorEffect` has a `node_group` and an `enable_for_render` flag (API: Scene, SceneCompositorEffect). Until 6.0, setting `scene.compositing_node_group` still works: the Scene reference says it creates an effect if none exists. The pages read do not show how to add an effect through `compositor_effects` from Python; check the `SceneCompositorEffects` collection in Blender before relying on it.
- `material.use_nodes`, `world.use_nodes` and `scene.use_nodes` always return True, setting them does nothing, and they go away in 6.0. A new material already has a default node tree.
- The deprecated combine and separate nodes were removed. Use Separate Color and Combine Color with Mode set to RGB (manual: shader Separate Color node, compositor Combine Color node).
- EEVEE's engine identifier is `BLENDER_EEVEE`, not `BLENDER_EEVEE_NEXT`. Cycles is `CYCLES` (the `bl_idname` in Cycles' add-on source).
- Data-block names can be 255 bytes, up from 63 (5.0 Core notes). Blender 4.5 truncates them when it opens a 5.0 file.
- Collada (.dae) import and export were removed (5.0 Pipeline & I/O notes).
- FBX import defaults to the C++ importer, `bpy.ops.wm.fbx_import`. `bpy.ops.import_scene.fbx` is the legacy add-on (5.0 Pipeline & I/O notes). FBX export is still `bpy.ops.export_scene.fbx`, the Python add-on the manual labels FBX (Legacy).
- Python is 3.13 since 5.1 (5.1 Python API notes).
- `collection.exporters.new(...)`, `.remove(...)` and `.move(...)` create and order Collection Exporters from Python (5.0 Python API notes).

## Rules for scripts that run without a UI

- Operators take their input from context (mode, active object, selection), not arguments. When the context is wrong their poll fails with `RuntimeError ... context is incorrect` (API gotchas, Using Operators). `bpy.types.Context.temp_override(...)` sets context members for one call. This skill's rule: in background scripts prefer the data API (`bpy.data`, object and mesh properties) and use operators only for exporters and bakes.
- Edit mode keeps its own mesh data and writes it back only on leaving edit mode. An exporter reading `obj.data` while the object is in edit mode reads stale data (API gotchas, Modes and Mesh Access). Leave edit mode before exporting, or write back with `bmesh` `to_mesh()`.
- After changing transforms, call `bpy.context.view_layer.update()` before reading `matrix_world` or other computed values (API gotchas, Stale Data).
- A requested name is not guaranteed: it can differ when it is too long, already used or empty. Keep the object you created in a variable or dict instead of looking it up by name later (API gotchas, Data Names).
- To read the mesh after modifiers, get the depsgraph with `bpy.context.evaluated_depsgraph_get()`, then `obj.evaluated_get(depsgraph).to_mesh()`, and free it with `to_mesh_clear()` (API: Context, ID, Object).
- Triangles: call `mesh.calc_loop_triangles()` and count `mesh.loop_triangles` (API: Mesh).
- Collection Exporters keep export settings on a collection. `bpy.ops.collection.export_all()` runs the exporters of the collection in context; `bpy.ops.wm.collection_export_all()` runs every collection's exporters (API: bpy.ops.collection, bpy.ops.wm). Run one in background mode once before relying on it in CI (this skill's rule).
- Save the .blend only if the job is meant to change it: `bpy.ops.wm.save_mainfile()` writes over the source file.
