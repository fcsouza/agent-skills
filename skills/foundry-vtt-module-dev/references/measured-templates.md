# Templates with Regions

Deep reference for area-of-effect templates in Foundry VTT v14.

**Changed in v14: the MeasuredTemplate document is gone.** `common/documents/measured-template.mjs` was deleted. `MeasuredTemplateDocument`, the `MeasuredTemplate` placeable, `TemplateLayer`, `MeasuredTemplateConfig`, `Scene#templates`, `CONST.MEASURED_TEMPLATE_TYPES` and the `TEMPLATE_CREATE` permission are all deprecated since v14 and removed in v16. Templates merged into the Region document.

Write new code against Regions. The sections below cover the Region shape vocabulary, placement, targeting, and a migration recipe.

---

## 1. Region shapes

A Region carries a `shapes` array (`foundry.data.fields.ShapesField`). Each entry is a `BaseShapeData` subtype identified by its `type`. `foundry.data.BaseShapeData.TYPES` lists all ten.

| Type | Fields | Notes |
|---|---|---|
| `"circle"` | `x, y, radius` | Radius in **pixels** |
| `"cone"` | `x, y, radius, angle, rotation, curvature` | `curvature` is `"round"`, `"flat"` or `"semicircle"` |
| `"ellipse"` | `x, y, radiusX, radiusY, rotation` | |
| `"rectangle"` | `x, y, width, height, anchorX, anchorY, rotation` | `anchorX/anchorY` place the origin inside the rect (0 = top-left) |
| `"line"` | `x, y, length, width, rotation` | Beam/ray |
| `"ring"` | `x, y, radius, innerWidth, outerWidth` | |
| `"emanation"` | `base` (a nested shape), `radius` | Expands the base shape outward by `radius` |
| `"polygon"` | `points` ([x0,y0,x1,y1,…], min 4), `origin` | Must not self-intersect if filled |
| `"token"` | `x, y, width, height, shape` | `width/height` in grid spaces; `shape` from `CONST.TOKEN_SHAPES` |
| `"grid"` | `offsets` (GridOffset2D[]), `origin` | Union of explicit grid spaces |

Every shape also has `type`, `hole` (subtract this shape from the others) and, on the geometric types, `rotation`.

### `gridBased`

All types except `polygon`, `token` and `grid` accept `gridBased: true`. A grid-based shape divides its pixel dimensions by `grid.size`, multiplies by `grid.distance`, then builds the shape using the grid's own metric — the v13 "grid templates" behaviour, now per shape instead of a world setting.

```js
// 20 ft radius on a 5 ft / 100 px grid
const radius = canvas.dimensions.distancePixels * 20;
```

`canvas.dimensions.distancePixels` converts grid units to pixels.

### Shape validation

`ConeShapeData.validateJoint` rejects `angle > 90` with `curvature: "flat"` and `angle > 180` with `curvature: "semicircle"`.

**Changed in v14:** `foundry.data.regionShapes.RegionShape` and its subclasses are deprecated (until v16) in favour of the `*ShapeData` classes above. `RegionPolygonTree`/`RegionPolygonTreeNode` are deprecated aliases of `foundry.data.PolygonTree`/`PolygonTreeNode`, which now live at `client/data/polygon-tree.mjs`.

---

## 2. Creating a template

### Directly as a document

```js
const px = canvas.dimensions.distancePixels;

// Fireball — 20 ft radius
const [circle] = await canvas.scene.createEmbeddedDocuments("Region", [{
  name: "Fireball",
  color: "#ff4400",
  shapes: [{ type: "circle", x: 800, y: 600, radius: px * 20 }],
  elevation: { bottom: 0, top: null },
  levels: [canvas.level.id],
  visibility: CONST.REGION_VISIBILITY.ALWAYS,
  highlightMode: "coverage",
  displayMeasurements: true
}]);

// Cone of Cold — 60 ft, 90 degree arc pointing at 45 degrees
await canvas.scene.createEmbeddedDocuments("Region", [{
  name: "Cone of Cold",
  shapes: [{
    type: "cone", x: 500, y: 300,
    radius: px * 60, angle: 90, rotation: 45, curvature: "round"
  }]
}]);

// Lightning Bolt — 100 ft long, 5 ft wide
await canvas.scene.createEmbeddedDocuments("Region", [{
  name: "Lightning Bolt",
  shapes: [{ type: "line", x: 500, y: 300, length: px * 100, width: px * 5, rotation: 0 }]
}]);
```

Creating a Region needs the `REGION_CREATE` permission. Only GMs may create a Region that carries behaviors, and `executeScript` behaviors additionally need `MACRO_SCRIPT`.

### Interactively with `placeRegion`

`RegionLayer#placeRegion(data, options)` gives the user the drag-and-rotate placement flow the old template tool had, then returns the created `RegionDocument` (or `null` if the user cancelled).

```js
const region = await canvas.regions.placeRegion({
  name: "Fireball",
  shapes: [{ type: "circle", x: 0, y: 0, radius: canvas.dimensions.distancePixels * 20 }],
  levels: [canvas.level.id]
}, {
  create: true,          // false returns an unsaved preview document
  allowRotation: true,   // mouse wheel rotates the preview
  onMove: preview => {}, // called as the preview moves
  preConfirm: preview => true
});
if ( !region ) return;   // user cancelled
```

`placeRegions(dataArray, options)` places several at once and returns an array. Both accept `createOptions`, `allowEmpty`, `attachToToken`, `onMove`, `onRotate`, `onChange`, `preConfirm`, `preSkip` and `preCommit`.

### Template mode

`canvas.regions.templateMode` is a boolean getter/setter on the Region layer. In template mode the layer presents the shape tools as one-off template placement rather than persistent region editing. It defaults to `true` for non-GM users.

```js
canvas.regions.templateMode = true;
```

---

## 3. Shape equivalents for old template types

Core's own converter is `foundry.documents.BaseRegion._migrateMeasuredTemplateData`. It maps as follows.

| v13 `t` | v14 shape | Conversion |
|---|---|---|
| `"circle"` | `{type: "circle", x, y, radius}` | `radius = distance * distancePixels` |
| `"cone"` | `{type: "cone", x, y, radius, angle, rotation, curvature}` | `rotation = direction`; `curvature` is `"round"` for grid templates or the old round cone type, else `"flat"` |
| `"ray"` | `{type: "line", x, y, length, width, rotation}` | `length = distance * distancePixels`, `width = width * distancePixels` |
| `"rect"` | `{type: "rectangle", x, y, width, height, anchorX: 0, anchorY: 0, rotation}` | `rotation` snaps down to the nearest 90 degrees; width/height swap at 90 and 270 |

Old `hidden: true` becomes `visibility: CONST.REGION_VISIBILITY.OBSERVER`; `fillColor` becomes `color`; the template author becomes an `ownership` entry at OWNER.

**Changed in v14:** the `core.gridTemplates` and `core.coneTemplateType` world settings are deprecated. Per-shape `gridBased` and `ConeShapeData#curvature` replace them.

---

## 4. Targeting tokens inside a template

`RegionDocument#tokens` is the live set of tokens the Region contains. For an unsaved preview, test points yourself.

```js
// Persisted region
for ( const token of region.tokens ) game.user.targets.add(token.object);

// Point test — accepts an ElevatedPoint
const hit = region.testPoint({ x: 150, y: 250, elevation: 5 });
```

`Region#highlightMode` controls the on-canvas highlight: `"shapes"` outlines the geometry, `"coverage"` fills the grid spaces the shape covers — the behaviour players expect from a template. `displayMeasurements: true` prints the shape's dimensions on the canvas.

---

## 5. Auras: attaching a region to a token

**New in v14.** A Region can follow a token through `attachment.token`. `RegionDocument.createTokenEmanation` builds one.

```js
// A 10 ft aura that moves with the token
await foundry.documents.RegionDocument.createTokenEmanation(
  token.document,
  10,                                  // range in grid units
  { name: "Aura of Protection", color: "#ffcc00" },
  { excludeToken: false, gridBased: false }
);
```

An attached Region must sit in exactly the token's level and share its `hidden` state. `placeRegion(..., {attachToToken: true})` attaches a single-shape Region interactively.

---

## 6. Applying an effect to everything in the area

**New in v14:** the `applyActiveEffect` region behavior. Its schema is a single field, `effects`, a set of ActiveEffect UUIDs. While a token is inside the Region, those effects apply; when it leaves, they lift.

```js
await region.createEmbeddedDocuments("RegionBehavior", [{
  name: "Aura of Protection",
  type: "applyActiveEffect",
  system: { effects: ["Compendium.my-module.effects.ActiveEffect.abc123"] }
}]);
```

For one-shot damage on entry, keep using `executeScript` or `executeMacro` with the `tokenEnter` event.

---

## 7. Migration recipe

Before (v13):

```js
const [t] = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
  t: "circle", x, y, distance: 20, fillColor: "#ff0000", hidden: false
}]);
const affected = canvas.tokens.placeables.filter(tok => t.object.shape.contains(
  tok.center.x - t.x, tok.center.y - t.y
));
```

After (v14):

```js
const px = canvas.dimensions.distancePixels;
const [region] = await scene.createEmbeddedDocuments("Region", [{
  name: "Fireball",
  color: "#ff0000",
  shapes: [{ type: "circle", x, y, radius: px * 20 }],
  levels: [canvas.level.id],
  visibility: CONST.REGION_VISIBILITY.ALWAYS,
  highlightMode: "coverage"
}]);
const affected = [...region.tokens];
```

Checklist:

1. `scene.templates` → `scene.regions`. `Scene#getEmbeddedCollection("MeasuredTemplate")` still works as a shim.
2. `MeasuredTemplate*` classes and `CONFIG.MeasuredTemplate.layerClass` → Regions and `CONFIG.Canvas.layers.regions.layerClass`.
3. `CONST.MEASURED_TEMPLATE_TYPES` → `foundry.data.BaseShapeData.TYPES`.
4. `TEMPLATE_CREATE` permission → `REGION_CREATE`.
5. Distances in grid units → pixel values (multiply by `canvas.dimensions.distancePixels`), or set `gridBased: true` and keep the grid metric.
6. `MeasuredTemplate.getCircleShape/getConeShape/getRectShape/getRayShape` → `CircleShapeData`, `ConeShapeData`, `RectangleShapeData`, `LineShapeData`.
7. Hooks: `createMeasuredTemplate` → `createRegion`; the same `preCreate`/`preUpdate`/`preDelete` pattern applies.
8. Sheet: `MeasuredTemplateConfig` → `foundry.applications.sheets.RegionConfig`; `foundry.applications.apps.ShapeConfig` edits a single shape.

Flags work the same way:

```js
await region.setFlag("my-module", "spellId", "fireball");
const spellId = region.getFlag("my-module", "spellId");
```

See `foundry-vtt-module-dev/references/regions-and-grid.md` for the full Region schema, behaviors and grid API, and `foundry-vtt-module-dev/references/v14-migration.md` for the wider v13 → v14 checklist.
