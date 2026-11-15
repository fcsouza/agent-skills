# Exporting glTF 2.0 and FBX

Checked against Blender 5.3 (API reference and manual, 2026-11-14). Defaults come from the operator signatures on the API page `bpy.ops.export_scene`. Where the manual and the API disagree, this file says which one to trust.

## Which format for which target

| Target | Format | Why (source) |
|---|---|---|
| `game-client` (three.js, R3F) | glTF Binary (.glb) | `game-client` loads glTF; GLTFLoader reads the extensions Blender writes (GLTFLoader docs) |
| `game-godot` | glTF 2.0 (.glb or .gltf) | Godot calls glTF 2.0 the recommended format; its .blend import also converts to glTF and needs Blender on every machine, and is not available in the Android and web editors (Godot, Available 3D formats) |
| `game-unity` | FBX | Unity's LOD import steps export FBX (Unity, Import LOD levels) |

Godot 4.3 and later imports FBX with ufbx (Godot, Available 3D formats), but glTF stays the first choice there.

## glTF settings that change the result

| Setting (operator keyword) | Default | What to do | Source |
|---|---|---|---|
| Format (`export_format`) | `''` on the API page; values `GLB`, `GLTF_SEPARATE` | Pass `GLB` explicitly | add-on source, v5.3.0 |
| +Y Up (`export_yup`) | True | Leave on. Never rotate the model to fix the axis | API |
| Apply Modifiers (`export_apply`) | **False** | Turn on for meshes without shape keys. The API warns that applying modifiers prevents shape-key export | API |
| Shape Keys (`export_morph`) | True | | API |
| Custom Properties (`export_extras`) | **False** | Turn on to ship gameplay tags as glTF `extras` | API, manual "Custom Properties" |
| Animation Mode (`export_animation_mode`) | `ACTIONS` | See Actions below | API, manual "Animations" |
| Export Deformation Bones Only (`export_def_bones`) | False | Turn on for skinned meshes with shape keys going to Godot | Godot, Available 3D formats |
| Materials (`export_materials`) | `EXPORT` | `NONE` merges primitives and loses material slots | manual "Data - Material" |
| Images (`export_image_format`) | `AUTO` | AUTO keeps PNG and JPEG and WebP, turns other formats into PNG | API |
| Draco (`export_draco_mesh_compression_enable`) | False | Only if the loader sets a Draco decoder | API, GLTFLoader docs |
| Meshopt (`export_meshopt_compression_enable`) | False; extension `EXT_meshopt_compression` | Added in 5.2. Keep the EXT default unless the loader reads `KHR_meshopt_compression` | API, 5.2 Pipeline & I/O notes |
| Compressed images (`export_image_add_compressed_images`, `export_compressed_images_type`) | False, `WEBP` | KTX2 (`KHR_texture_basisu`) export arrived in 5.3 | API, 5.3 Pipeline & I/O notes |
| Cameras, Punctual Lights (`export_cameras`, `export_lights`) | False, False | Leave off for props | API |
| Selection (`use_selection`, `use_visible`, `collection`) | off, off, `''` | Export a named collection, not "whatever is selected" | API |

## Modifiers and shape keys

- glTF: `export_apply=False` by default, so modifiers such as Mirror or Bevel do not reach the file. Turning it on drops shape keys.
- FBX: `use_mesh_modifiers=True` by default, with the same warning: it prevents exporting shape keys.
- The two exporters disagree on the default. Set the value explicitly in every export script (this skill's rule).
- For a mesh that needs both modifiers and shape keys, apply the modifiers in the .blend before export. This skill's rule; test it in the engine.

## Which actions export (glTF)

In the default Actions mode (manual, "Animations"):
- An action exports only if it is active on an object or stashed on an NLA track. Actions associated in neither way are not exported; this skill's inference is that the exporter does not warn, so check the clip list after export. Stash every clip.
- For a game character's animation library, each action must be on its own NLA track.
- The glTF animation takes the action name; rename the NLA track to override it.
- Since 4.4 tracks merge by the action they use, not by track name.
- Only object transforms, pose bones and shape-key values export. Physics, light and material animation is ignored outside the experimental Animation Pointer option.
- Godot sets the loop flag on clips whose name starts or ends with `loop` or `cycle` (Godot, name suffixes page). See `references/lod-collision-naming.md`.

Stash a clip from a script (API: AnimData, NlaTracks, NlaStrips):

```python
# Blender 5.3 API (checked 2026-11-14)
anim = obj.animation_data or obj.animation_data_create()
track = anim.nla_tracks.new()
track.name = "Run-loop"
strip = track.strips.new("Run-loop", 1, run_action)
```

Since 4.4 actions have slots. A strip has its own `action_slot` (API: NlaStrip); if the action holds more than one slot, check that the strip uses the one for this object.

FBX: `bake_anim_use_all_actions=True` exports each action as its own AnimStack; animated objects get every compatible action, the rest get none (API).

## Materials that export (glTF)

From the manual's glTF page:
- Only Principled BSDF (metal/rough) and unlit export. Other shader setups lose their look.
- Images must be PNG or JPEG; other formats are converted at export, which takes longer. WebP and KTX2 go through their extensions.
- Base color: an Image Texture into Base Color.
- Metallic and roughness: one image, metallic in B, roughness in G. Split it with a Separate Color node (RGB mode) into the Principled BSDF and the exporter copies the image as is. The manual still names a "Separate RGB" node, which 5.0 removed.
- Normal map: Image Texture into a Normal Map node set to Tangent Space, into the Principled BSDF Normal input. glTF normals are tangent space, +Y up.
- Occlusion: only through a node group named `glTF Material Output` with an input named `Occlusion`. Occlusion lives in R, so one ORM image can hold all three channels. See `references/baking-and-textures.md`.
- Data images (metal/rough, normal, occlusion, transmission) need Color Space set to Non-Color.
- Backface Culling off in Blender means DoubleSided in glTF. Godot then sets cull mode Disabled, which costs performance; turn Backface Culling on for one-sided materials (manual, Godot formats page).
- Alpha: the exporter picks Opaque, Mask or Blend from the nodes on the Alpha socket. Round alpha with a Math node for Mask.
- UDIM is split into one image per tile at export.

## FBX settings that change the result

| Setting (keyword) | Default | Note | Source |
|---|---|---|---|
| Forward, Up (`axis_forward`, `axis_up`) | `-Z`, `Y` | Blender is Y forward, Z up; many apps are Y up, which needs -Z forward, Y up | API, FBX (Legacy) manual |
| Scale (`global_scale`) | 1.0 | The manual says 10 is the default; the API signature says 1.0. Trust the API | API, FBX (Legacy) manual |
| Apply Unit (`apply_unit_scale`) | True | Takes the scene unit settings into account | API |
| Apply Scalings (`apply_scale_options`) | `FBX_SCALE_NONE` | `FBX_SCALE_ALL` puts custom and unit scale into the FBX scale instead of each object | API |
| Apply Transform (`bake_space_transform`) | False | The API marks it experimental and known to break armatures and animation | API |
| Apply Modifiers (`use_mesh_modifiers`) | True | Prevents shape-key export | API |
| Smoothing (`mesh_smooth_type`) | `OFF` (Normals Only) | | API |
| Custom Properties (`use_custom_props`) | False | | API |
| Add Leaf Bones (`add_leaf_bones`) | True | Adds an end bone per chain; turn off unless you will edit the rig after reimport | API |
| Only Deform Bones (`use_armature_deform_only`) | False | | API |
| Path Mode (`path_mode`) | `AUTO` | See below | API, FBX (Legacy) manual |
| Embed Textures (`embed_textures`) | False | Works only with Path Mode Copy | API |

**Path Mode Copy does not embed textures.** It copies each image file next to the export and references it by relative path (FBX (Legacy) manual). To put the images inside a binary FBX, set `path_mode='COPY'` and `embed_textures=True` (API).

**FBX shape keys.** The FBX (Legacy) manual lists vertex shape keys and material textures as not exported. The 5.1 notes say the exporter now writes shape-key normals to fix imports in some engines. The pages disagree; import into the engine and check before you rely on FBX morph targets. Unity imports blend-shape normals only when the FBX has smoothing groups (Unity, Model tab), while Blender's default Smoothing is Normals Only. If Unity's blend-shape shading is wrong, try `mesh_smooth_type='FACE'` or `'SMOOTH_GROUP'` (this skill's inference; test it).

## Scale and axis per target

Blender is Z up with Y forward (FBX (Legacy) manual).

| Target | Engine convention | Exporter setting | Source |
|---|---|---|---|
| glTF in general | Right-handed, +Y up, asset front faces +Z, distances in meters | `export_yup=True` (default) | Khronos glTF 2.0 spec, Coordinate System and Units |
| `game-client` (three.js) | Reads glTF as above | glTF defaults | glTF spec |
| `game-godot` | 1 unit is 1 meter, Y up, right-handed; physics is tuned for that scale; set metric units in the modeling tool | glTF defaults | Godot, Introduction to 3D |
| `game-unity` | Physics expects 1 m in the game to be 1 unit in the file; the importer has Scale Factor, Convert Units and Bake Axis Conversion | Blender's FBX defaults `-Z` forward, `Y` up, scale 1.0. Unity's page does not name these values: this skill's inference, import-test in Unity | Unity 6000.3, Model tab import settings |

Before any export (Blender manual, Apply; Scene properties, Units):
- Apply rotation and scale (Ctrl-A). Applying resets scale to 1.0 and moves the change into the mesh, so the object looks the same. Apply before rigging; on an armature it does not touch poses or animation.
- Unit Scale only changes the values shown in the UI. Physics does not use it. Model at 1 Blender unit = 1 meter (this skill's rule, matching the glTF spec and both engines).

## Web compression must match the loader

| Blender option | Extension | three.js loader call (GLTFLoader docs) |
|---|---|---|
| Draco | `KHR_draco_mesh_compression` | `setDRACOLoader` is required |
| Meshopt (EXT default) | `EXT_meshopt_compression` | `setMeshoptDecoder` is required |
| KTX2 images | `KHR_texture_basisu` | `setKTX2Loader` is required |
| WebP images | `EXT_texture_webp` | in GLTFLoader's supported list |

A compressed file loads in Blender and fails in the browser when the client never sets the decoder. `game-client` notes that drei's `useGLTF` fetches Draco decoders from a CDN by default; the other decoder calls are set where the client creates its GLTFLoader.

## Collection Exporters

A collection can store exporter settings and re-export with one action, or with File > Export All Collections; the manual names glTF game assets as the use case. Formats: Alembic, USD, OBJ, PLY, FBX (Legacy), glTF (manual, Collections). The glTF Collection Exporter has a Collection Center option since 5.3: World Origin (default), Center of Mass, Object Position or Instance Offset; root objects move relative to it without changing rotation or scale (manual glTF page, 5.3 notes).
