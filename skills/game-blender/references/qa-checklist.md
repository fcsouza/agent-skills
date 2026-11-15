# Asset QA checklist

The process here (gates, severities, the delivery note) is this skill's rule. Each technical check cites the page behind it in the other reference files.

## Before export

| # | Check | Why | Severity if it fails |
|---|---|---|---|
| 1 | Rotation and scale applied; scale reads 1.0 | Unapplied scale reaches the engine as a node transform; applying keeps the look (manual, Apply) | Block |
| 2 | One Blender unit = 1 m; a known dimension (door, character height) measured | glTF, Godot and Unity physics all assume meters | Block |
| 3 | Origin where the engine needs the pivot; LODs share it | Unreal and Unity LOD chains share space and pivot | Block |
| 4 | Not in edit mode | Exporters read stale mesh data from an object in edit mode (API gotchas) | Block |
| 5 | Every mesh has a UV map; baked meshes have their target images | Baking and textures need UVs (Cycles baking manual) | Block |
| 6 | Materials are Principled BSDF or unlit only; data images set to Non-Color | Other shader setups do not export to glTF (glTF manual) | Block |
| 7 | Modifiers applied or `export_apply` set on purpose; shape-key meshes handled | Applying modifiers at export drops shape keys | Block |
| 8 | Every clip is active or stashed on an NLA track, named as the engine expects | Unstashed actions are not exported (glTF manual) | Block |
| 9 | Collision, helper and LOD names match the target engine; no visual mesh ends in `_col` by accident | Godot suffixes are case-insensitive and accept `_` | Block |
| 10 | Backface Culling on for one-sided materials | Otherwise glTF marks them double-sided and Godot disables culling | Warn |
| 11 | No numbered leftover names from duplicating, empty material slots or unused images | Clutters the import; `export_unused_images` is off by default | Warn |
| 12 | Triangle count per LOD within the project's budget | Budgets come from the project; no official Blender page sets them | Warn |

## After export

1. The file exists and the export returned `{'FINISHED'}` (`references/headless-and-bpy.md`).
2. Import it in the real target: the `game-client` page with the same GLTFLoader decoders as production, the Godot project, or the Unity project. A file that opens in Blender can still fail there (missing Draco or KTX2 decoder, wrong FBX scale, missing morph targets).
3. Check in the target: scale against a reference object, facing direction, materials, each animation clip by name, loop flags, collision shapes, LOD switching.
4. Record a delivery note next to the asset: source .blend, Blender version, exporter and its non-default settings, target engine, files produced. A later re-export then reproduces the same file.

Severities: Block stops the export, Warn ships with a note, Info is a suggestion.

## A background check script

Asserts on scene data and fails the run through `--python-exit-code`. Thresholds are placeholders for the project's own values.

```python
# Blender 5.3 API (checked 2026-11-14). Run with:
#   blender -b -X -Y --python-exit-code 1 asset.blend -P check_asset.py
import bpy

MAX_TRIS = 20_000  # project budget, not a Blender rule
problems = []
depsgraph = bpy.context.evaluated_depsgraph_get()

for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    if any(abs(s - 1.0) > 1e-4 for s in obj.scale):
        problems.append(f"{obj.name}: scale not applied {tuple(obj.scale)}")
    if not obj.data.uv_layers:
        problems.append(f"{obj.name}: no UV map")
    if obj.name.lower().endswith(("_col", "-col")) and obj.data.materials:
        problems.append(f"{obj.name}: collision mesh has materials")
    mesh = obj.evaluated_get(depsgraph).to_mesh()
    mesh.calc_loop_triangles()
    tris = len(mesh.loop_triangles)
    obj.evaluated_get(depsgraph).to_mesh_clear()
    if tris > MAX_TRIS:
        problems.append(f"{obj.name}: {tris} triangles > {MAX_TRIS}")

if problems:
    raise RuntimeError("asset check failed:\n" + "\n".join(problems))
```
