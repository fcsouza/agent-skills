# Sources

Every page was opened on 2026-11-14. Blender manual pages are the "latest" edition, which is 5.3; API pages are the "current" edition, titled Blender 5.3 Python API. Star counts come from the GitHub API or the Blender Gitea API on the same date and mark how widely a project is used, not that it is correct.

## Versions

- Blender Developer Docs, "Release Notes" index - https://developer.blender.org/docs/release_notes/ - supports: 5.3 is the current stable release (November 10, 2026); 5.2 LTS supported until July 2028; 4.5 LTS until July 2027 - checked 2026-11-14
- Blender 5.1 Python API release notes - https://developer.blender.org/docs/release_notes/5.1/python_api/ - supports: Python upgraded to 3.13 - checked 2026-11-14
- Blender manual, "About Blender" - https://docs.blender.org/manual/en/latest/getting_started/about/index.html - supports: Blender is used to create game assets among other things - checked 2026-11-14

## Command line and bpy

- Blender manual, "Command Line Arguments" - https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html - supports: `-b`, `-X`, `-P`, `--python-expr`, `--python-exit-code` (only for command-line scripts, zero disables), `--addons`, `-Y` default, `-c` implies background, `--` passes arguments to `sys.argv`; arguments run in the order given - checked 2026-11-14
- Blender manual, "Scripting & Security" - https://docs.blender.org/manual/en/latest/advanced/scripting/security.html - supports: .blend files can carry Python; registered text blocks and drivers auto-execute when allowed; Auto Run Python Scripts preference; `-y`/`-Y` override the Preferences, also in background mode; Text editor and Freestyle run scripts with auto-execution off - checked 2026-11-14
- Blender API, `bpy.types.Scene` - https://docs.blender.org/api/current/bpy.types.Scene.html - supports: `compositing_node_group` deprecated since 5.0, removal planned in 6.0, use `compositor_effects` instead - checked 2026-11-14
- Blender API, `bpy.types.SceneCompositorEffect` - https://docs.blender.org/api/current/bpy.types.SceneCompositorEffect.html - supports: `node_group`, `enable_for_render`, `enable_for_preview` - checked 2026-11-14
- Blender API, "Using Operators" gotchas - https://docs.blender.org/api/current/info_gotchas_operators.html - supports: operators use context, return finished or cancelled, poll fails with "context is incorrect"; `Context.temp_override` - checked 2026-11-14
- Blender API, "Internal Data & Their Python Objects" gotchas - https://docs.blender.org/api/current/info_gotchas_internal_data_and_python_objects.html - supports: names may not match the requested value; keep references instead of name lookups; call `view_layer.update()` before reading computed values - checked 2026-11-14
- Blender API, "Modes and Mesh Access" gotchas - https://docs.blender.org/api/current/info_gotchas_meshes.html - supports: edit-mode data is written back only on leaving edit mode; exporters reading `obj.data` see stale data - checked 2026-11-14
- Blender API, `bpy.types.Context` - https://docs.blender.org/api/current/bpy.types.Context.html - supports: `evaluated_depsgraph_get()`, `temp_override()` - checked 2026-11-14
- Blender API, `bpy.types.ID` - https://docs.blender.org/api/current/bpy.types.ID.html - supports: `evaluated_get(depsgraph)`, `animation_data_create()` - checked 2026-11-14
- Blender API, `bpy.types.Object` - https://docs.blender.org/api/current/bpy.types.Object.html - supports: `to_mesh()`, `to_mesh_clear()`, `type`, `scale`, `data` - checked 2026-11-14
- Blender API, `bpy.types.Mesh` - https://docs.blender.org/api/current/bpy.types.Mesh.html - supports: `calc_loop_triangles()`, `loop_triangles`, `uv_layers`, `shape_keys`, `materials` - checked 2026-11-14
- Blender API, `bpy.types.AnimData` - https://docs.blender.org/api/current/bpy.types.AnimData.html - supports: `action`, `action_slot`, `nla_tracks` - checked 2026-11-14
- Blender API, `bpy.types.NlaTracks` - https://docs.blender.org/api/current/bpy.types.NlaTracks.html - supports: `nla_tracks.new()` - checked 2026-11-14
- Blender API, `bpy.types.NlaStrips` - https://docs.blender.org/api/current/bpy.types.NlaStrips.html - supports: `strips.new(name, start, action)` - checked 2026-11-14
- Blender API, `bpy.types.NlaTrack` - https://docs.blender.org/api/current/bpy.types.NlaTrack.html - supports: track `name`, `strips` - checked 2026-11-14
- Blender API, `bpy.types.NlaStrip` - https://docs.blender.org/api/current/bpy.types.NlaStrip.html - supports: strip `action` and its own `action_slot` - checked 2026-11-14
- Blender API, `bpy_extras.anim_utils` - https://docs.blender.org/api/current/bpy_extras.anim_utils.html - supports: `action_get_channelbag_for_slot`, `action_ensure_channelbag_for_slot` - checked 2026-11-14
- Blender API, `bpy.ops.collection` - https://docs.blender.org/api/current/bpy.ops.collection.html - supports: `export_all()` invokes all exporters on a collection; `exporter_export(index)` - checked 2026-11-14
- Blender API, `bpy.ops.wm` - https://docs.blender.org/api/current/bpy.ops.wm.html - supports: `collection_export_all()` for all collections; `save_mainfile()` - checked 2026-11-14
- Blender API, `bpy.types.Image` - https://docs.blender.org/api/current/bpy.types.Image.html - supports: `pixels` (floats), `save(filepath=...)` - checked 2026-11-14

## Blender 5.x changes

- Blender 5.0 Python API release notes - https://developer.blender.org/docs/release_notes/5.0/python_api/ - supports: legacy Action API removed (`action.fcurves`, `action.groups`, `action.id_root`), channelbag replacements; `scene.node_tree` removed for `scene.compositing_node_group`; `use_nodes` on scene, world and material deprecated no-ops until 6.0; deprecated combine and separate nodes removed; EEVEE id `BLENDER_EEVEE`; `collection.exporters.new/remove/move` - checked 2026-11-14
- Blender 5.0 Core release notes - https://developer.blender.org/docs/release_notes/5.0/core/ - supports: data-block names up to 255 bytes, up from 63; 4.5 truncates them and cannot link them; NTFS 255-character file names - checked 2026-11-14
- Blender 5.0 Pipeline & I/O release notes - https://developer.blender.org/docs/release_notes/5.0/pipeline_io/ - supports: C++ FBX importer is the default, `bpy.ops.import_scene.fbx` is legacy, switch to `bpy.ops.wm.fbx_import`; Collada import and export removed - checked 2026-11-14
- Blender 5.1 Pipeline & I/O release notes - https://developer.blender.org/docs/release_notes/5.1/pipeline_io/ - supports: FBX exporter now exports shape-key normals when base mesh normals are exported - checked 2026-11-14
- Blender 5.2 Pipeline & I/O release notes - https://developer.blender.org/docs/release_notes/5.2/pipeline_io/ - supports: glTF export of `EXT_meshopt_compression` and `KHR_meshopt_compression` - checked 2026-11-14
- Blender 5.3 Pipeline & I/O release notes - https://developer.blender.org/docs/release_notes/5.3/pipeline_io/ - supports: glTF KTX2 (`KHR_texture_basisu`) import and export; new Collection Exporter center options - checked 2026-11-14
- Cycles add-on source at tag v5.3.0 (read through the Gitea contents API; the web view refuses curl) - https://projects.blender.org/api/v1/repos/blender/blender/contents/intern/cycles/blender/addon/__init__.py?ref=v5.3.0 - supports: the render engine's `bl_idname` is `CYCLES` - checked 2026-11-14

## Export

- Blender API, `bpy.ops.export_scene` - https://docs.blender.org/api/current/bpy.ops.export_scene.html - supports: every glTF and FBX keyword and default quoted (`export_apply=False`, `export_yup=True`, `export_extras=False`, `export_animation_mode='ACTIONS'`, `export_meshopt_extension='EXT_meshopt_compression'`, `global_scale=1.0`, `apply_unit_scale=True`, `apply_scale_options='FBX_SCALE_NONE'`, `use_mesh_modifiers=True`, `path_mode='AUTO'`, `embed_textures=False` only for Copy, `axis_forward='-Z'`, `axis_up='Y'`, `add_leaf_bones=True`); both apply-modifier options warn that they prevent shape-key export - checked 2026-11-14
- glTF add-on source at tag v5.3.0 (read through the Gitea contents API) - https://projects.blender.org/api/v1/repos/blender/blender/contents/scripts/addons_core/io_scene_gltf2/__init__.py?ref=v5.3.0 - supports: `export_format` values `GLB`, `GLTF_SEPARATE`, and `GLTF_EMBEDDED` when the preference allows it; operator results `{'FINISHED'}` and `{'CANCELLED'}` - checked 2026-11-14
- Blender manual, "glTF 2.0" - https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html - supports: exported materials (Principled BSDF, unlit), PNG or JPEG images, metallic B and roughness G, occlusion R through `glTF Material Output`, tangent-space +Y normal maps, Non-Color, backface culling to DoubleSided, alpha modes, UDIM split; actions export only when active or stashed, each action on its own NLA track for a game animation library, track names, merge by action since 4.4; extension list with no LOD extension; custom properties as extras; file format variations; Collection Center options - checked 2026-11-14
- Blender manual, "FBX (Legacy)" - https://docs.blender.org/manual/en/latest/files/import_export/fbx_legacy.html - supports: Path Mode Copy copies and references by relative path; Blender uses Y forward, Z up; Scale "10 is the default" (contradicted by the API); vertex shape keys and material textures listed as not exported - checked 2026-11-14
- Blender manual, "FBX" - https://docs.blender.org/manual/en/latest/files/import_export/fbx.html - supports: the new FBX page covers the C++ importer - checked 2026-11-14
- Blender manual, "Collections" - https://docs.blender.org/manual/en/latest/scene_layout/collections/collections.html - supports: Collection Exporters, glTF game assets as the use case, supported formats, File > Export All Collections - checked 2026-11-14
- Blender manual, "Apply" - https://docs.blender.org/manual/en/latest/scene_layout/object/editing/apply.html - supports: applying resets location, rotation and scale while keeping the look; apply before rigging - checked 2026-11-14
- Blender manual, "Scene Properties" - https://docs.blender.org/manual/en/latest/scene_layout/scene/properties.html - supports: Unit Scale only changes displayed values; physics does not use it - checked 2026-11-14
- Blender manual, "Decimate Modifier" - https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html - supports: Collapse ratio counted in triangles - checked 2026-11-14

## Baking and textures

- Blender manual, "Render Baking" (Cycles) - https://docs.blender.org/manual/en/latest/render/cycles/baking.html - supports: Cycles bakes; UV map and active Image Texture target; tangent normal space default; Selected to Active rays; Max Ray Distance or Extrusion depending on cage, ray distance only without cage; cage topology; margin - checked 2026-11-14
- Blender API, `bpy.types.BakeSettings` - https://docs.blender.org/api/current/bpy.types.BakeSettings.html - supports: `margin` default 16, `margin_type` default `ADJACENT_FACES`, `max_ray_distance` 0 means no limit, `use_cage` default False - checked 2026-11-14
- Blender API, `bpy.ops.object` - https://docs.blender.org/api/current/bpy.ops.object.html - supports: `bake(...)` signature with `margin=16`, `margin_type='EXTEND'`, `normal_r='POS_X'`, `normal_g='POS_Y'`, `normal_b='POS_Z'`; `transform_apply`, `modifier_apply` - checked 2026-11-14
- Blender API, "Bake Pass Type Items" - https://docs.blender.org/api/current/bpy_types_enum_items/bake_pass_type_items.html - supports: bake pass identifiers - checked 2026-11-14
- Blender API, `bpy.types.RenderSettings` - https://docs.blender.org/api/current/bpy.types.RenderSettings.html - supports: `bake` is a `BakeSettings`; `engine` - checked 2026-11-14
- Blender manual, "Combine Color Node" (compositor) - https://docs.blender.org/manual/en/latest/compositing/types/color/combine_color.html - supports: combines channels in RGB, HSV, HSL, YCbCr or YUV mode - checked 2026-11-14
- Blender manual, "Separate Color Node" (shader) - https://docs.blender.org/manual/en/latest/render/shader_nodes/color/separate_color.html - supports: splits a color by mode RGB, HSV or HSL - checked 2026-11-14

## Engines and loaders

- Khronos, glTF 2.0 specification - https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html - supports: right-handed, +Y up, front faces +Z, linear units in meters - checked 2026-11-14
- three.js docs, "GLTFLoader" - https://threejs.org/docs/pages/GLTFLoader.html - supports: supported extensions; `setDRACOLoader`, `setKTX2Loader`, `setMeshoptDecoder` required for their extensions - checked 2026-11-14
- Godot docs (4.7), "Node type customization using name suffixes" - https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/node_type_customization.html - supports: suffix list, separators `-`, `$`, `_`, case-insensitive; `-colonly` empties only with Collada; `loop`/`cycle` clips; opt-out import options - checked 2026-11-14
- Godot docs (4.7), "Available 3D formats" - https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html - supports: glTF 2.0 recommended; Export Deformation Bones Only with shape keys; backface culling; .blend import needs Blender 3.0+ on every machine, not on Android and web editors; ufbx since 4.3 - checked 2026-11-14
- Godot docs (4.7), "Introduction to 3D" - https://docs.godotengine.org/en/stable/tutorials/3d/introduction_to_3d.html - supports: 1 unit is 1 meter, Y up, right-handed, physics tuned for that scale - checked 2026-11-14
- Unity manual, "Import or create LOD levels for an LOD Group" (current manual; the same path under 6000.3 returns 404) - https://docs.unity3d.com/Manual/importing-lod-meshes.html - supports: `_LODX` suffix, LOD0 most detailed, at most eight levels, export as .fbx - checked 2026-11-14
- Unity manual (6000.3), "Model tab Import Settings reference" - https://docs.unity3d.com/6000.3/Documentation/Manual/FBXImporter-Model.html - supports: physics expects 1 m = 1 unit; Scale Factor, Convert Units, Bake Axis Conversion; blend-shape normals need smoothing groups; Generate Colliders advice - checked 2026-11-14
- Epic Games, "FBX Static Mesh Pipeline" - https://dev.epicgames.com/documentation/en-us/unreal-engine/fbx-static-mesh-pipeline-in-unreal-engine - supports: `UBX_`/`UCP_`/`USP_`/`UCX_[RenderMeshName]_##`, hulls should not intersect; LODs share space and pivot; Import LODs - checked 2026-11-14

## Agent tooling

- docs.blender.org llms.txt probes - https://docs.blender.org/llms.txt (also /manual/llms.txt and /api/current/llms.txt) - supports: all three return 404, so no official llms.txt exists - checked 2026-11-14
- Blender Lab, "MCP Server" - https://www.blender.org/lab/mcp-server/ - supports: requires Blender 5.1 or newer; security warning that the server executes LLM-generated code without guards and the advice to use a virtual machine or a system without sensitive data (read with a scraper; the site refuses curl) - checked 2026-11-14
- Blender Lab, blender_mcp repository (GPL-3.0-or-later, 38 stars, 41 forks, last update 2026-09-29, release v1.0.3 on 2026-09-11; read through the Gitea API and raw files, since the web view refuses curl) - https://projects.blender.org/api/v1/repos/lab/blender_mcp and https://projects.blender.org/lab/blender_mcp/raw/branch/main/readme.md - supports: add-on with TCP socket, `blender-mcp` stdio server, add-on must be enabled; default `localhost:9876` (`mcp_to_blender_server.py`); `weak_sandbox.py` says it is not really a sandbox; `destructiveHint=True` on both execute tools; `_for_cli` runs `blender --background` - checked 2026-11-14
- Blender Lab, generated tool list - https://projects.blender.org/lab/blender_mcp/raw/branch/main/readme_tools.rst - supports: the tool names listed - checked 2026-11-14
- ahujasid/mcp-for-blender (MIT, 34,442 stars, last push 2026-11-13) - https://github.com/ahujasid/mcp-for-blender - supports: `execute_blender_code` runs arbitrary Python; `BLENDER_MCP_SAFE_MODE=1` validation off by default; minimal anonymous usage record sent by default, `DISABLE_TELEMETRY=true`; `uvx blender-mcp` still runs this server; third-party asset and generation services - checked 2026-11-14
- HoldMyBeer-gg/blenderwright (MIT, 198 stars, last push 2026-11-05) - https://github.com/HoldMyBeer-gg/blenderwright - supports: raw Python opt-in per session, restricted namespace "not a security boundary", port 9876 default, built for Blender 5.2 LTS - checked 2026-11-14
- sandraschi/blender-mcp (MIT, 65 stars, last push 2026-10-29) - https://github.com/sandraschi/blender-mcp - supports: headless `--background` subprocess by default, `BLENDER_EXECUTABLE`, `blender_script_execute` - checked 2026-11-14
- PatrykIti/blender-ai-mcp (Apache-2.0, 66 stars, last push 2026-10-12) - https://github.com/PatrykIti/blender-ai-mcp - supports: README says the project is discontinued and no longer maintained - checked 2026-11-14
