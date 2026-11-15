# Baking and textures

Checked against the Blender 5.3 manual (Cycles, Render Baking; glTF 2.0) and API (`bpy.ops.object.bake`, `BakeSettings`), 2026-11-14.

## What baking needs

- Baking runs in Cycles: "Cycles shaders and lighting can be baked to image textures" (manual). Set `scene.render.engine = 'CYCLES'` (the identifier is the `bl_idname` in Cycles' add-on source) before calling `bpy.ops.object.bake`.
- The mesh needs a UV map, and the material needs an Image Texture node with an image to bake into. The active Image Texture node is the target. A material with no active, selected Image Texture node gets nothing (manual, Setup and Target).
- Cycles uses the render settings (samples, bounces) for baking.
- Bake settings live on `scene.render.bake` (`RenderSettings.bake`, type `BakeSettings`). The operator `bpy.ops.object.bake(...)` takes the same options as keywords.
- Pass types (`type`): `COMBINED`, `AO`, `SHADOW`, `POSITION`, `NORMAL`, `UV`, `ROUGHNESS`, `EMIT`, `ENVIRONMENT`, `DIFFUSE`, `GLOSSY`, `TRANSMISSION` (API enum items).

## Normal maps for glTF

- Normal Space defaults to Tangent, which suits animated objects (manual). Keep it.
- Keep the default swizzle R +X, G +Y, B +Z (`normal_r='POS_X'`, `normal_g='POS_Y'`, `normal_b='POS_Z'`); the glTF manual says to keep these defaults for glTF.
- Load the result through a Normal Map node in Tangent Space with the image's Color Space set to Non-Color (glTF manual).

## High to low: Selected to Active, cage or ray distance

- Selected to Active bakes the selected objects onto the active one; rays go from the low-poly object inward toward the high-poly one (manual).
- **Cage Extrusion and Max Ray Distance are alternatives, not a pair.** The manual: use Max Ray Distance or Extrusion "depending on whether or not you are using cage", and "Ray distance is only available when not using Cage".
  - Without a cage (`use_cage=False`): rays follow the mesh normals; tune `max_ray_distance` (0 means no limit). It glitches on edges but suits planes.
  - With a cage (`use_cage=True`): tune `cage_extrusion`, or give a `cage_object`. A cage object needs the same topology as the low-poly mesh (same face count and order). Avoid hard splits such as an applied Edge Split modifier, which break smooth normals.
- No official page gives a "right" extrusion distance. Start small, bake, look for missed or overlapping rays, and adjust (this skill's rule).
- Each high-poly object costs a fixed amount of memory; join the high-poly objects before baking to avoid running out (manual).

## Margin

- A margin around UV islands stops seams from showing under filtering and mipmaps (manual).
- Default size is 16 px on both `BakeSettings.margin` and the operator's `margin`.
- Default type differs: `BakeSettings.margin_type` is `ADJACENT_FACES`, the operator keyword `margin_type` is `EXTEND`. Pass it explicitly in scripts.
- This skill's rule: raise the margin when the texture will be shown at small mip levels or packed into an atlas, since lower mips shrink the margin with the image.

## Packing ORM for glTF

glTF reads occlusion from R, roughness from G and metallic from B, so one image can hold all three (glTF manual).

1. Bake AO, roughness and metallic as separate grayscale images at the same size.
2. Combine them into one RGB image:
   - In Python, by writing `Image.pixels` (floats, RGBA per pixel) and calling `Image.save(...)` (API: Image). This needs no compositor setup and is the simpler path in a headless script (this skill's rule).
   - Or in the compositor, with a Combine Color node set to RGB mode. The old Combine RGB node was removed in 5.0. `scene.node_tree` is gone, and its 5.0 replacement `scene.compositing_node_group` is deprecated (removal planned in 6.0) in favour of `scene.compositor_effects` (API: Scene).
3. In the material, feed the ORM image (Color Space Non-Color) through a Separate Color node in RGB mode: G to Roughness, B to Metallic. The exporter recognizes that layout and copies the image unchanged.
4. Wire R to the `Occlusion` input of a node group named `glTF Material Output`. It does nothing in Blender's render but is the only way the exporter writes occlusion. With Shader Editor Add-ons enabled in the preferences, it is in Add > Output > glTF Material Output.

## Texture formats

- glTF wants PNG or JPEG; the exporter converts anything else at export (glTF manual).
- Images (`export_image_format`): AUTO keeps PNG, JPEG and WebP and turns the rest into PNG; JPEG saves alpha images as PNG; WEBP writes WebP with no fallback (API).
- Create Compressed Images adds WebP or KTX2 (BasisU) copies; KTX2 export is new in 5.3. The loader must support them (see `references/export-gltf-fbx.md`).
- `game-client` keeps textures at or under 4096 px per side unless the GPU limit is queried; bake web textures within that.
