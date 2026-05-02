# Regions & Grid

Deep reference for Foundry VTT v13's Scene Regions API and Grid/Measurement system.

---

## 1. Scene Regions

Regions define spatial areas on the canvas that respond to token movement. They are embedded documents within a Scene.

### Schema fields

| Field | Type | Purpose |
|---|---|---|
| `name` | StringField | Region display name |
| `shapes` | ArrayField | Array of shape definitions (rectangle, ellipse, polygon) |
| `elevation` | SchemaField | `{ bottom, top }` — elevation range |
| `behaviors` | EmbeddedCollectionField | RegionBehavior documents |
| `color` | ColorField | Debug/visualization color |
| `visibility` | NumberField | Visibility mode (layers, always, gamemaster) |
| `locked` | BooleanField | Prevents editing |

### Creating a region

```js
const scene = canvas.scene;
const [region] = await scene.createEmbeddedDocuments("Region", [{
  name: "Trap Zone",
  shapes: [{ type: "rectangle", x: 100, y: 200, width: 300, height: 200 }],
  elevation: { bottom: 0, top: 10 },
  color: "#ff0000",
  visibility: 0   // CONST.REGION_VISIBILITY.LAYERS
}]);
```

### Adding behaviors

Behaviors define what happens when tokens interact with the region:

```js
await region.createEmbeddedDocuments("RegionBehavior", [{
  name: "Trap Trigger",
  type: "executeMacro",
  active: true,
  events: ["tokenEnter"],
  system: {}
}]);
```

Common event types: `"tokenEnter"`, `"tokenExit"`, `"tokenMove"`.

### Spatial testing

```js
// Test if a point is inside the region
const isInside = region.testPoint({ x: 150, y: 250, elevation: 5 });

// Get all tokens currently inside
const tokens = region.tokens;   // ReadonlySet<TokenDocument>

// Segmentize a movement path to find enter/exit points
const segments = region.segmentizeMovementPath(waypoints, samples);
```

### Teleporting tokens

```js
// Teleport a token into this region (same scene or cross-scene)
const tokenDoc = canvas.tokens.controlled[0].document;
const teleported = await region.teleportToken(tokenDoc);
```

Cross-scene teleport requires `TOKEN_CREATE` and `TOKEN_DELETE` permissions.

---

## 2. Grid & Measurement

The grid API was rewritten in v12/v13. Old methods like `measureDistance`, `getGridPositionFromPixels`, and `getPixelsFromGridPosition` are replaced.

### Grid properties

```js
const grid = canvas.grid;
grid.size;       // pixel size of one grid space
grid.distance;   // distance per grid space in game units (e.g. 5)
grid.units;      // unit label (e.g. "ft")
grid.type;       // CONST.GRID_TYPES (GRIDLESS, SQUARE, HEXODDR, HEXEVENQ, etc.)
```

### Coordinate conversion

```js
// Pixel → grid center point
const center = canvas.grid.getCenterPoint({ x: 500, y: 300 });
// Returns { x, y } — center pixel of the grid space

// Pixel → grid top-left corner
const topLeft = canvas.grid.getTopLeftPoint({ x: 500, y: 300 });
// Returns { x, y } — top-left pixel of the grid space

// Pixel → offset coordinates (row/col)
const offset = canvas.grid.getOffset({ x: 500, y: 300 });
// Returns { i, j } — grid offset

// Snap a point to the grid
const snapped = canvas.grid.getSnappedPoint({ x: 512, y: 307 }, {
  mode: CONST.GRID_SNAPPING_MODES.CENTER   // or TOP_LEFT, etc.
});
```

### Distance measurement (v13)

`measurePath` replaces the old `measureDistance`:

```js
// Measure a direct path between two points
const result = canvas.grid.measurePath([
  { x: 500, y: 300 },   // start
  { x: 800, y: 600 }    // end
]);
// result: { distance, cost, segments, waypoints }

// Measure with custom cost function (e.g. difficult terrain)
const result = canvas.grid.measurePath(waypoints, {
  cost: (from, to, distance) => {
    // Return custom cost for this segment
    return isDifficultTerrain(to) ? distance * 2 : distance;
  }
});
```

### Adjacency and neighbors

```js
// Get adjacent grid space offsets
const neighbors = canvas.grid.getAdjacentOffsets({ i: 5, j: 3 });
// Returns array of { i, j } offsets

// Test if two spaces are adjacent
const adjacent = canvas.grid.testAdjacency(
  { i: 5, j: 3 },
  { i: 5, j: 4 }
);
// Returns boolean
```

### Shape generation

```js
// Get circle polygon points (for aura/area-of-effect visualization)
const circlePoints = canvas.grid.getCircle({ x: 500, y: 300 }, 3);
// 3 = radius in grid units

// Get cone polygon points
const conePoints = canvas.grid.getCone(
  { x: 500, y: 300 },   // origin
  5,                      // radius in grid units
  45,                     // direction in degrees
  90                      // arc angle in degrees
);
```

### Grid highlighting

```js
// Create a named highlight layer
canvas.interface.grid.addHighlightLayer("my-module-aura");

// Highlight a grid space
canvas.interface.grid.highlightPosition("my-module-aura", {
  x: 500, y: 300,
  color: 0xff0000,
  border: 0xff0000,
  alpha: 0.25
});

// Clear highlights
canvas.interface.grid.clearHighlightLayer("my-module-aura");

// Remove the layer entirely
canvas.interface.grid.destroyHighlightLayer("my-module-aura");
```

### v12 → v13 migration

| v12 Method | v13 Replacement |
|---|---|
| `canvas.grid.measureDistance(p1, p2)` | `canvas.grid.measurePath([p1, p2])` |
| `canvas.grid.getGridPositionFromPixels(x, y)` | `canvas.grid.getOffset({x, y})` |
| `canvas.grid.getPixelsFromGridPosition(col, row)` | `canvas.grid.getCenterPoint({i, j})` or `getTopLeftPoint` |
| `canvas.grid.getNeighbors(row, col)` | `canvas.grid.getAdjacentOffsets({i, j})` |
| `canvas.grid.grid` | `canvas.grid` directly |
