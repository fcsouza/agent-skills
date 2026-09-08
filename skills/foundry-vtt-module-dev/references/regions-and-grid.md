# Regions & Grid

Deep reference for the Foundry VTT v14 Scene Regions API and the Grid/Measurement system.

Regions carry much more weight in v14 than in v13: they absorbed MeasuredTemplate, they can block movement and sight, they can follow tokens, and they can spawn and teleport tokens. See `foundry-vtt-module-dev/references/measured-templates.md` for the template side.

---

## 1. Scene Regions

Regions define spatial areas on the canvas that respond to token movement. They are embedded documents on a Scene (`scene.regions`).

### Schema fields

| Field | Type | Purpose |
|---|---|---|
| `name` | StringField | Region display name (required, text-searchable) |
| `color` | ColorField | Highlight colour; defaults to a random hue |
| `shapes` | `ShapesField` | Array of shape data (10 types, see below) |
| `elevation` | SchemaField | `{ bottom, top, topInclusive }` — `null` means ±∞ |
| `levels` | `SceneLevelsSetField` | Which Scene Levels this Region belongs to |
| `restriction` | SchemaField | `{ enabled, type, priority }` — blocks movement/sight/etc. |
| `attachment` | SchemaField | `{ token }` — Region follows this token |
| `behaviors` | EmbeddedCollectionField | RegionBehavior documents |
| `visibility` | NumberField | `CONST.REGION_VISIBILITY` value |
| `highlightMode` | StringField | `"shapes"` or `"coverage"` |
| `displayMeasurements` | BooleanField | Print shape dimensions on the canvas |
| `hidden` | BooleanField | Hidden from players |
| `locked` | BooleanField | Prevents editing |
| `ownership` | DocumentOwnershipField | Per-user ownership |
| `flags` | DocumentFlagsField | Module/system flags |

**Changed in v14:** `shapes` is now a `ShapesField` over the ten `BaseShapeData` subtypes; `levels`, `restriction`, `attachment`, `highlightMode`, `displayMeasurements`, `hidden`, `ownership` and `elevation.topInclusive` are new. Schema version `14.361`.

### Visibility values

```js
CONST.REGION_VISIBILITY = {
  LAYER_UNLOCKED: 4,  // on the Region layer, to Observers, when unlocked (default)
  LAYER:          0,  // on the Region layer, to Observers
  GAMEMASTER:     1,  // always visible to GMs
  OBSERVER:       3,  // always visible to Observers
  ALWAYS:         2   // always visible to anyone
};
```

`LAYER_UNLOCKED` and `OBSERVER` are new in v14, and `LAYER_UNLOCKED` is the new default.

### Shape types

| Type | Fields |
|---|---|
| `rectangle` | `x, y, width, height, anchorX, anchorY, rotation, gridBased` |
| `circle` | `x, y, radius, gridBased` |
| `ellipse` | `x, y, radiusX, radiusY, rotation, gridBased` |
| `cone` | `x, y, radius, angle, rotation, curvature, gridBased` |
| `ring` | `x, y, radius, innerWidth, outerWidth, gridBased` |
| `line` | `x, y, length, width, rotation, gridBased` |
| `emanation` | `base` (nested shape), `radius, gridBased` |
| `polygon` | `points, origin` |
| `token` | `x, y, width, height, shape` |
| `grid` | `offsets, origin` |

All lengths are pixels. Set `gridBased: true` to have the shape convert to grid units and conform to the grid metric. Every shape also takes `hole: true` to subtract it from the rest. `foundry.data.BaseShapeData.TYPES` maps type strings to classes; the client subclasses live at `foundry.data.RectangleShapeData` and friends.

**Changed in v14:** `foundry.data.regionShapes.RegionShape` is deprecated (until v16) in favour of `foundry.data.*ShapeData`. `RegionPolygonTree` / `RegionPolygonTreeNode` are deprecated aliases of `foundry.data.PolygonTree` / `PolygonTreeNode`. `Region#shapes` on the placeable is deprecated (since v13) — read `RegionDocument#shapes`.

### Creating a region

```js
const px = canvas.dimensions.distancePixels;

const [region] = await canvas.scene.createEmbeddedDocuments("Region", [{
  name: "Trap Zone",
  color: "#ff0000",
  shapes: [{ type: "rectangle", x: 100, y: 200, width: 300, height: 200 }],
  elevation: { bottom: 0, top: 10 },
  levels: [canvas.level.id],
  visibility: CONST.REGION_VISIBILITY.GAMEMASTER
}]);
```

Creation needs the `REGION_CREATE` permission. Only GMs can create or update a Region that has behaviors; `executeScript` behaviors also need `MACRO_SCRIPT`.

### Interactive placement

```js
const region = await canvas.regions.placeRegion(data, {
  create: true,           // false returns an unsaved preview
  createOptions: {},
  allowRotation: true,    // mouse wheel rotates
  allowEmpty: false,
  attachToToken: false,
  onMove, onRotate, onChange, preConfirm, preSkip, preCommit
});
```

`placeRegions(dataArray, options)` places several in one gesture. `canvas.regions.templateMode` (boolean getter/setter) switches the layer between persistent region editing and one-off template placement; it defaults to `true` for non-GMs.

---

## 2. Region behaviors

```js
await region.createEmbeddedDocuments("RegionBehavior", [{
  name: "Trap Trigger",
  type: "executeMacro",
  system: { events: ["tokenEnter"], uuid: "Macro.abc123", everyone: false }
}]);
```

Core behavior types include `adjustDarknessLevel`, `displayScrollingText`, `executeMacro`, `executeScript`, `modifyMovementCost`, `pauseGame`, `suppressWeather`, `teleportToken`, `toggleBehavior`, plus three added in v14.

### `applyActiveEffect` (new in v14)

Its only type-data field is `effects`, a set of ActiveEffect UUIDs. The effects apply while a token is inside the Region and lift when it leaves.

```js
system: { effects: ["Compendium.my-module.effects.ActiveEffect.abc123"] }
```

### `defineSurface` (new in v14)

Turns the Region into a floor or ceiling that blocks things.

```js
system: {
  placement: "bottom",   // "bottom" | "top" | "both"
  light: true, move: true, sight: true, sound: true,
  occlusion: true, exposure: false, culling: false
}
```

Query surfaces from the Scene:

```js
const surfaces = canvas.scene.getSurfaces({ type: "sight", level: canvas.level.id });
const blocked = canvas.scene.testSurfaceCollision(origin, destination, {
  type: "move", mode: "any", side: "below"
});
```

### `changeLevel` (new in v14)

Moves a token to another Scene Level. Its schema field is `movementActions`: the set of movement actions (from `CONFIG.Token.movement.actions`, minus `displace`) that trigger the change.

### Events

`CONST.REGION_EVENTS` names them all.

- Token: `tokenEnter`, `tokenExit`, `tokenMoveIn`, `tokenMoveOut`, `tokenMoveWithin`, `tokenAnimateIn`, `tokenAnimateOut`, `tokenTurnStart`, `tokenTurnEnd`, `tokenRoundStart`, `tokenRoundEnd`
- Region: `regionBoundary`, `regionAnimation` (new in v14)
- Behavior: `behaviorActivated`, `behaviorDeactivated`, `behaviorViewed`, `behaviorUnviewed`

**Changed in v14:** `CONST.REGION_EVENTS.BEHAVIOR_STATUS` is deprecated; use `BEHAVIOR_ACTIVATED` / `BEHAVIOR_DEACTIVATED`.

---

## 3. Region document methods

```js
// Point containment — takes an ElevatedPoint
region.testPoint({ x: 150, y: 250, elevation: 5 });

// Tokens currently inside
region.tokens;              // Set<TokenDocument>

// Geometry
region.area;                // total area
region.bounds;
region.isSingleShape;       // one shape, not a hole?
region.polygonTree;         // foundry.data.PolygonTree
region.clipperPolyTree;

// Split a movement path into inside/outside segments
region.segmentizeMovementPath(waypoints, samples, tolerance = 0);

// Level membership
region.includedInLevel(level);
```

### Spawning tokens

```js
const spawned = await region.spawnTokens(tokenDocuments, {
  placement: "random",   // "random" | "center" | "relative"
  snap: true,
  avoidOccupied: true,
  level: canvas.level.id,
  create: true           // false returns ephemeral TokenDocuments
});
```

### Teleporting tokens

```js
// One token — same scene or cross-scene
await region.teleportToken(tokenDoc, { updateData: { rotation: 90 } });

// Several at once; returns Map<deleted, created>
const moved = await region.teleportTokens(tokenDocs, {
  placement: "random", snap: true, avoidOccupied: true, pan: true
});
```

Cross-scene teleport requires `TOKEN_CREATE` and `TOKEN_DELETE` permissions.

### Token emanations (auras)

```js
await foundry.documents.RegionDocument.createTokenEmanation(
  tokenDoc,
  10,                                      // range in grid units
  { name: "Aura", color: "#ffcc00" },      // Region data minus shapes/elevation
  { excludeToken: false, gridBased: false }
);
```

The Region attaches to the token via `attachment.token` and follows it. An attached Region must sit in exactly the token's level and match its `hidden` state.

### Restriction

`restriction.enabled` makes the Region block a sense: `restriction.type` is one of `CONST.EDGE_RESTRICTION_TYPES` (`"light"`, `"darkness"`, `"sight"`, `"sound"`, `"move"`, default `"move"`), and `restriction.priority` orders competing regions.

### Animation state

The Region placeable exposes `animationState` and `isAnimating`, and fires the `regionAnimation` event through `_onAnimationStateChange`. Skip interaction while `isAnimating` is true.

---

## 4. Grid & Measurement

### Grid properties

```js
const grid = canvas.grid;
grid.size;       // pixel size of one grid space
grid.distance;   // distance per grid space in game units (e.g. 5)
grid.units;      // unit label (e.g. "ft")
grid.type;       // CONST.GRID_TYPES
grid.isGridless;
grid.isHexagonal;

canvas.dimensions.distancePixels;   // pixels per game distance unit
canvas.scene.gridlessGrid;          // a GridlessGrid with the same size/distance
```

`Scene#gridlessGrid` is new in v14. It is the same grid as `scene.grid` when the scene type is gridless, and otherwise a gridless companion useful for Euclidean measurement on a square or hex scene.

### Coordinate conversion

```js
canvas.grid.getCenterPoint({ x: 500, y: 300 });    // { x, y } centre of that space
canvas.grid.getTopLeftPoint({ x: 500, y: 300 });   // { x, y } top-left of that space
canvas.grid.getOffset({ x: 500, y: 300 });         // { i, j } row/col
canvas.grid.getSnappedPoint({ x: 512, y: 307 }, {
  mode: CONST.GRID_SNAPPING_MODES.CENTER
});
```

### Distance measurement

```js
const result = canvas.grid.measurePath([{ x: 500, y: 300 }, { x: 800, y: 600 }]);
// result: { waypoints, segments, distance, cost, spaces, diagonals, euclidean }

const custom = canvas.grid.measurePath(waypoints, {
  cost: (from, to, distance) => isDifficultTerrain(to) ? distance * 2 : distance
});
```

### Adjacency

```js
canvas.grid.getAdjacentOffsets({ i: 5, j: 3 });      // { i, j }[]
canvas.grid.testAdjacency({ i: 5, j: 3 }, { i: 5, j: 4 });
```

### Shape generation

`BaseGrid` builds template-style polygons that conform to the grid metric. `getCircle` and `getCone` existed before; `getRectangle`, `getEllipse`, `getLine` and `getRing` are new in v14 and match the new Region shape types.

```js
canvas.grid.getCircle({ x: 500, y: 300 }, 3);                    // radius in grid units
canvas.grid.getCone({ x: 500, y: 300 }, 5, 45, 90);              // origin, radius, direction, angle
canvas.grid.getRectangle(origin, width, height, anchor, rotation);
canvas.grid.getEllipse(center, radiusX, radiusY, rotation);
canvas.grid.getLine(origin, length, width, direction);
canvas.grid.getRing(center, radius, innerWidth, outerWidth);
```

Each returns the polygon points for the shape. `foundry.data.GridShapeData` stores such a shape as an explicit set of grid offsets (`offsets`, `origin`) when you want to persist it on a Region.

### Grid spaces occupied by a token

```js
const offsets = tokenDoc.getOccupiedGridSpaceOffsets();       // GridOffset3D[]
const atOther = tokenDoc.getOccupiedGridSpaceOffsets({ x: 800, y: 600, width: 2, height: 2 });
```

New in v14. Returns the offsets the token's shape covers in its snapped position, accounting for walls and surfaces. Returns an empty array on gridless grids.

### Grid highlighting

```js
canvas.interface.grid.addHighlightLayer("my-module-aura");
canvas.interface.grid.highlightPosition("my-module-aura", {
  x: 500, y: 300, color: 0xff0000, border: 0xff0000, alpha: 0.25
});
canvas.interface.grid.clearHighlightLayer("my-module-aura");
canvas.interface.grid.destroyHighlightLayer("my-module-aura");
```

### Removed in v14

The v12-era grid shims were kept through v13 and are gone in v14. If any of these are still in your code, it throws now.

| Removed | Replacement |
|---|---|
| `canvas.grid.measureDistance(p1, p2)` | `canvas.grid.measurePath([p1, p2])` |
| `canvas.grid.getGridPositionFromPixels(x, y)` | `canvas.grid.getOffset({x, y})` |
| `canvas.grid.getPixelsFromGridPosition(col, row)` | `canvas.grid.getCenterPoint({i, j})` / `getTopLeftPoint` |
| `canvas.grid.getNeighbors(row, col)` | `canvas.grid.getAdjacentOffsets({i, j})` |
| `canvas.grid.getSnappedPosition(...)` | `canvas.grid.getSnappedPoint(point, options)` |
| `canvas.grid.getTopLeft` / `getCenter` | `getTopLeftPoint` / `getCenterPoint` |
| `canvas.grid.w` / `h` | `canvas.grid.sizeX` / `sizeY` |
| `canvas.grid.isHex` / `isNeighbor` | `canvas.grid.isHexagonal` / `testAdjacency` |
| `canvas.grid.grid` | `canvas.grid` directly |
| `GridLayer#type/size/measureDistance/...` | the matching `canvas.grid.*` method |
| `BaseGrid#getRect/shiftPosition/highlightGridPosition/...` | `getRectangle`, `getShiftedPoint`, `canvas.interface.grid.*` |
| `GridHex(config)` | `GridHex(grid)` with `{i, j}` coordinates |
| `HexagonalGrid.offsetToCube/cubeToOffset/pixelToCube/...` | removed outright |
| `PlaceablesLayer#gridPrecision` | `getSnappedPoint` |
