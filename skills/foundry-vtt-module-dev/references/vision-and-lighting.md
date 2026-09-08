# Vision & Lighting

Deep reference for Foundry VTT v14's vision modes, lighting system, detection modes, edges and fog.

The big v14 change here is that vision is **level-aware**. Every source, polygon and detection test carries a Scene Level, and edges are collected per level. See `foundry-vtt-module-dev/references/scene-levels.md` for the Level document itself.

---

## 1. VisionMode

VisionMode extends `DataModel` and defines how the canvas appears when a specific Token is the point-of-view.

### Schema fields

| Field | Type | Purpose |
|---|---|---|
| `id` | StringField | Unique identifier |
| `label` | StringField | Display name |
| `tokenConfig` | BooleanField | Show in Token Configuration UI |
| `canvas` | SchemaField | Canvas shader/background config |
| `vision` | SchemaField | Vision source config |
| `lighting` | SchemaField | Lighting visibility/level overrides |
| `animated` | BooleanField | Whether the vision source is animated |

### Lighting levels

```js
VisionMode.LIGHTING_LEVELS = {
  BRIGHT:     2,
  BRIGHTEST:  3,
  DARKNESS:  -2,
  DIM:        1,
  HALFDARK:  -1,
  UNLIT:      0
};
```

### Lighting visibility

```js
VisionMode.LIGHTING_VISIBILITY = {
  DISABLED:  "disabled",   // layer not rendered
  ENABLED:   "enabled",    // layer rendered, shaders can choose
  REQUIRED:  "required"    // layer rendered, shaders cannot disable
};
```

### Register a custom vision mode

```js
Hooks.once("init", () => {
  CONFIG.Canvas.visionModes.myDarkvision = new foundry.canvas.perception.VisionMode({
    id: "myDarkvision",
    label: "MY_MODULE.VisionMode.darkvision",
    tokenConfig: true,
    animated: false,
    canvas: {
      shader: foundry.canvas.rendering.shaders.ColorAdjustmentsSamplerShader,
      uniforms: { contrast: 0, saturation: -1.0, brightness: 0 }
    },
    vision: {
      darkness: { adaptive: false },
      defaults: { attenuation: 0, contrast: 0, saturation: -1.0, brightness: 0 }
    },
    lighting: {
      visibility: foundry.canvas.perception.VisionMode.LIGHTING_VISIBILITY.ENABLED
    }
  });
});
```

**Changed in v14:** `CONFIG.Canvas.visionModes` and `CONFIG.Canvas.detectionModes` are lazy self-replacing getters — they build their defaults on first read to avoid a cyclic import. Reading or assigning keys works exactly as before; do not replace the whole object before the canvas first initialises.

### Lifecycle methods

```js
class MyVisionMode extends foundry.canvas.perception.VisionMode {
  _activate(source) {}     // token using this vision becomes the POV
  _deactivate(source) {}   // POV switches away
  animate(dt) {}           // every frame while active (PIXI ticker)
}
```

Each token's vision creates a `PointVisionSource`, which the active vision mode receives in `_activate`/`_deactivate`.

---

## 2. Detection Modes

Detection modes define *what* a token can perceive beyond basic sight.

### Built-in detection modes

| Class | Purpose |
|---|---|
| `DetectionModeBasicSight` | Standard vision |
| `DetectionModeDarkvision` | See in darkness |
| `DetectionModeLightPerception` | Detect light sources |
| `DetectionModeInvisibility` | See invisible creatures |
| `DetectionModeTremor` | Tremorsense |
| `DetectionModeAll` | Detect everything |

### Register a custom detection mode

```js
Hooks.once("init", () => {
  CONFIG.Canvas.detectionModes["myModule.truesight"] =
    new foundry.canvas.perception.DetectionMode({
      id: "myModule.truesight",
      label: "MY_MODULE.DetectionMode.truesight",
      type: "sight",
      walls: true,      // respects edges
      angle: false      // not limited by vision angle
    });
});
```

`type` is `"sight"`, `"light"`, `"sound"` or `"move"`.

### Level-aware detection

**Changed in v14:** the detection API takes a Level.

```js
class TrueSight extends foundry.canvas.perception.DetectionMode {
  /** @param {Level} level  The level the test is performed in */
  _canDetect(visionSource, target, level) {
    if ( !super._canDetect(visionSource, target, level) ) return false;
    return target?.document?.level === level.id;
  }
}
```

`DetectionMode#testVisibility(visionSource, mode, {object, level, tests})` passes the level through to `_canDetect`. `DetectionMode._testCollision(visionSource, test, configOrLos)` is now static.

`CanvasVisibility#testVisibility(points, options)` accepts a single point or an array of points, with `{tolerance = 2, object}`:

```js
const visible = canvas.visibility.testVisibility(
  [{ x: 500, y: 300 }, { x: 520, y: 320 }],
  { tolerance: 2, object: token }
);
```

### Token detection mode configuration

**Changed in v14:** `TokenDocument#detectionModes` is a `TypedObjectField` keyed by mode id, not an array of `{id, enabled, range}`.

```js
// v13
await token.document.update({ detectionModes: [{ id: "feelTremor", enabled: true, range: 30 }] });

// v14
await token.document.update({ "detectionModes.feelTremor": { enabled: true, range: 30 } });
```

---

## 3. Edges (formerly Walls)

**Changed in v14:** the wall constants were renamed to edge constants. The old names are deprecated until v16.

| v13 | v14 |
|---|---|
| `CONST.WALL_SENSE_TYPES` | `CONST.EDGE_SENSE_TYPES` |
| `CONST.WALL_DIRECTIONS` | `CONST.EDGE_DIRECTIONS` |
| `PointSourcePolygon.WALL_DIRECTION_MODES` | `CONST.EDGE_DIRECTION_MODES` |
| `ClockwiseSweepPolygon#wallDirectionMode` | `#edgeDirectionMode` |

```js
CONST.EDGE_RESTRICTION_TYPES;  // ["light", "darkness", "sight", "sound", "move"]

CONST.EDGE_SENSE_TYPES = {
  NONE: 0, LIMITED: 10, NORMAL: 20, PROXIMITY: 30, DISTANCE: 40
};

CONST.EDGE_DIRECTIONS = { BOTH: 0, LEFT: 1, RIGHT: 2 };
```

`CONST.WALL_RESTRICTION_TYPES` still exists and is still `["light", "sight", "sound", "move"]`. `CONST.EDGE_RESTRICTION_TYPES` is the wider list that adds `"darkness"`, and the `Edge` constructor takes a matching `darkness` option alongside `light`, `sight`, `sound` and `move`.

### Per-level edge collections

**Changed in v14:** `CanvasEdges` is constructed per Level (`new CanvasEdges(level)`), and `canvas.edges` returns the collection for the current level.

```js
canvas.edges;                          // CanvasEdges for canvas.level
canvas.edges.level;                    // the Level document
canvas.edges.getEdges(rect, { collisionTestBounds: true });
canvas.edges.identifyIntersections();

canvas.scene.initializeEdges();        // rebuild all levels' edges
```

`CanvasEdges#initialize` is deprecated in favour of `Scene#initializeEdges`; `CanvasEdges#refresh` is deprecated because `getEdges` computes intersections lazily. The `refreshEdges` perception flag is obsolete.

### WallDocument

Edge construction moved from the `Wall` placeable to the document.

```js
wallDoc.edge;                      // the Edge instance
wallDoc.initializeEdge();          // rebuild it (call after out-of-band changes)
wallDoc.isDoor;
wallDoc.isOpen;
wallDoc.getWallCategory();
```

`WallDocument#_onEdgeChange(level, newEdge, priorEdge, changedTypes)` is the protected hook that fires when a wall's edge enters, leaves, or changes within a level. The `Wall` placeable's `A`, `B`, `vertices`, `roof`, `hasActiveRoof`, `orientPoint`, `applyThreshold` and `identifyInteriorState` are gone — read `wall.document.edge` instead.

### Walls also carry levels

`WallDocument#levels` is a `SceneLevelsSetField`, so a wall can exist on some levels and not others.

---

## 4. Polygons and collision testing

```js
const collides = foundry.canvas.geometry.ClockwiseSweepPolygon.testCollision(
  origin, destination,
  { type: "move", mode: "any", tMin: 0, tMax: 1 }
);
```

**Changed in v14:** `PointSourcePolygon.testCollision(origin, destination, {mode, tMin, tMax, ...config})` accepts `tMin` and `tMax` to restrict the test to a fraction of the ray.

Polygon configuration changes:

| Deprecated | Replacement |
|---|---|
| `type: "universal"` | `{ edgeTypes: { wall: false } }` |
| `config.edgeTypes.light` / `.darkness` | `config.edgeTypes.source` |
| `config.edgeOptions` | `config.edgeTypes` |
| `config.useInnerBounds` / `includeDarkness` | `config.edgeTypes` entries |
| `wallDirectionMode` | `edgeDirectionMode` |

`PointSourcePolygon#level` and `#scene` expose the level and scene a polygon was computed for.

---

## 5. Lighting System

### Canvas layers

```
LightingLayer      ← AmbientLight documents, darkness sources
CanvasVisibility   ← vision polygons, fog of war (canvas.visibility)
EffectsCanvasGroup ← visual effects, weather (canvas.effects)
```

### Hooks

```js
Hooks.on("lightingRefresh", lighting => {});
Hooks.on("sightRefresh", visibility => {});
Hooks.on("initializeEdges", scene => {});   // v14 signature: takes the Scene
```

### AmbientLight documents

```js
await canvas.scene.createEmbeddedDocuments("AmbientLight", [{
  x: 500, y: 300,
  name: "Brazier",              // new in v14
  levels: [canvas.level.id],    // new in v14
  config: {
    bright: 20,
    dim: 40,
    color: "#ffaa00",
    alpha: 0.5,
    animation: { type: "torch", speed: 3, intensity: 3 },
    darkness: { min: 0, max: 1 }
  }
}]);
```

**Changed in v14:** AmbientLight and AmbientSound gained `name`, `levels` and `locked`. The control icon was replaced by a tooltip (`_getTooltipText`, `_refreshTooltip`); the `refreshElevation` render flag is deprecated in favour of `refreshTooltip`. `AmbientLight#updateSource` and `#source` are gone — use `initializeLightSource()` and `lightSource`.

### Effect sources carry a level

`BaseEffectSource#level` returns the Level document the source lives in. Source data now includes a `level` id, which defaults to `canvas.level.id` and throws if the level does not exist.

### Darkness level

```js
await canvas.scene.update({ "environment.darknessLevel": 0.7 });  // 0 = bright, 1 = dark
```

Lights with `darkness.min`/`darkness.max` only activate within their configured range.

### Regions can block light and sight

**New in v14:** a Region with a `defineSurface` behavior acts as a floor or ceiling that blocks `light`, `move`, `sight`, `sound`, `occlusion`, `exposure` or `culling`. A Region with `restriction.enabled` blocks one `EDGE_RESTRICTION_TYPES` value directly.

```js
const surfaces = canvas.scene.getSurfaces({ type: "sight", level: canvas.level.id });
const blocked = canvas.scene.testSurfaceCollision(origin, destination, { type: "sight" });
```

See `foundry-vtt-module-dev/references/regions-and-grid.md`.

---

## 6. Fog of War

`FogManager` lives on `canvas.fog`.

**Changed in v14:** the boolean `scene.fog.exploration` became `scene.fog.mode`.

```js
CONST.FOG_EXPLORATION_MODES = {
  DISABLED:   0,
  INDIVIDUAL: 1,   // each user has their own fog
  SHARED:     2    // fog is shared across all users
};

await canvas.scene.update({ "fog.mode": CONST.FOG_EXPLORATION_MODES.SHARED });
```

```js
canvas.fog.sharedExploration;        // is this scene using shared fog?
await canvas.fog.save({ share: true });
await canvas.fog.load({ preserve: true });
canvas.fog.reset();
```

`FogExploration` documents now carry a `level` id, so exploration is tracked per Scene Level. The fog texture source moved to `Level#fog.src`; `scene.fog.overlay` was removed.

`CanvasVisibility#explorationRect` sets the rectangle the exploration texture covers, which matters when a level's background does not fill the scene rect.
