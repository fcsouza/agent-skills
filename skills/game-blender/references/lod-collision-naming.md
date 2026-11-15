# LODs, collision meshes and names engines read

Only conventions that an official engine or Blender page states. Engine pages checked 2026-11-14: Godot 4.7 (stable docs), Unity 6 manual (6000.6 pages), Unreal Engine FBX Static Mesh Pipeline. This file covers what the Blender file must contain; the engine side belongs to `game-godot` and `game-unity`.

## Names in Blender

- Data-block names can be 255 bytes since 5.0, up from 63. Blender 4.5 truncates longer names when it opens the file and cannot link such data-blocks at all (5.0 Core notes). Keep names short when anyone on the team still runs 4.5.
- Windows (NTFS) file names stop at 255 characters, which a long name used inside a generated file name can reach (5.0 Core notes).
- No official engine page found in this pass sets a 64-character limit on object names. Do not cite one.
- Blender keeps names unique per type. A requested name can come back changed when it is taken, too long or empty, so a script that relies on a suffix must check the name it got (API gotchas, Data Names).

## LODs

- The glTF exporter's extension list has no LOD extension (manual, glTF 2.0, Extensions). This skill's rule: for glTF targets, export each LOD as its own object or file and switch them in the client or engine.
- Unity: add `_LODX` to each mesh name, `ExampleMeshName_LOD0` being the most detailed; an LOD Group takes at most eight levels; export as .fbx and Unity builds the LOD Group on import (Unity, Import LOD levels).
- Unreal: LOD meshes are aligned, occupy the same space and share one pivot; enable Import LODs in the import dialog (Unreal, FBX Static Mesh Pipeline). Unreal is not a target of this pack; the rule is listed because it is the clearest statement of what any LOD chain needs.
- Make lower LODs with the Decimate modifier. In Collapse mode Ratio is the share of faces kept, but it is counted in triangles, so a quad mesh keeps more faces than the ratio suggests unless Triangulate is on (manual, Decimate). The modifier shows the remaining face count.
- This skill's rule: LOD0 is the source of truth. Regenerate lower LODs from it after every edit, keep the same origin and transforms, and never hand-edit a lower LOD that will be overwritten.
- No official page gives polygon budgets per LOD or texel density targets. Take them from the project, not from this skill.

## Collision

### Godot (name suffixes, Godot 4.7)

- Suffixes can be joined with `-`, `$` or `_` and are case-insensitive. `wall_col` therefore creates collision, even if you did not mean it.
- `-col`: keeps the mesh and adds a child static collision with a triangle-mesh shape (accurate, slow; for level geometry).
- `-convcol`: same, with a convex shape.
- `-colonly`: removes the mesh and creates a StaticBody3D collision. `-convcolonly`: the same with convex decomposition.
- Prefer a few primitive shapes over triangle-mesh or convex shapes when you can.
- The empty-object form of `-colonly` (box, sphere and ray shapes from an Empty's draw type) works only with Collada, and Blender 5.0 removed Collada (5.0 Pipeline & I/O notes). Model collision as meshes.
- `-noimp` removes a node or animation at import. Use it for modeling helpers.
- Other suffixes: `-occ`/`-occonly` (occluder), `-navmesh`, `-rigid`, `-vehicle`, `-wheel`; on materials `-alpha` and `-vcol`.
- Animation clips whose name starts or ends with `loop` or `cycle` import with the loop flag; this one needs no hyphen. In Blender, name the action or NLA track accordingly.
- The import option `nodes/use_node_type_suffixes` turns the node-type suffixes off; `nodes/use_name_suffixes` turns all of them off.

### Unity

- No official Unity page read in this pass defines an FBX naming convention for colliders. Do not invent one.
- The Model tab's Generate Colliders attaches mesh colliders on import. Unity advises it for environment geometry and against it for geometry you move (Unity, Model tab import settings). For moving props, build colliders in Unity; see `game-unity`.

### Unreal (for reference)

- Prefixes `UBX_` (box), `UCP_` (capsule), `USP_` (sphere), `UCX_` (convex), then the render mesh name, then `_##`, for example `UCX_Tree_01_00`. The render mesh name must match exactly. Export render and collision meshes in the same FBX.
- Convex hulls of one object should not intersect; leave a gap between them.

### The server

In a multiplayer game the authoritative server (`game-backend-architecture`) owns collision for gameplay. A glTF file built for rendering does not give the server its collision. This skill's rule: export any server-side collision or nav data as its own data file, from simplified meshes, and keep it in step with the visual asset.

## Naming checklist before export

1. Every object, mesh, material and action has a deliberate name, with no numbered leftovers from duplicating.
2. Collision and helper objects carry exactly the suffix or prefix the target engine reads, and no visual mesh ends in one by accident (Godot reads `_col`).
3. LOD chains are named `<Name>_LOD0` to `<Name>_LODn` for Unity.
4. Looping clips carry `loop` or `cycle` at the start or end for Godot.
5. Collection names are not used for engine conventions; Godot and Unity read object and mesh names (this skill's rule).
