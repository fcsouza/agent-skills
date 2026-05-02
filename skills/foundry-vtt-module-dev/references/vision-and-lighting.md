# Vision & Lighting

Deep reference for Foundry VTT v13's vision modes, lighting system, and detection modes.

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

Controls how lighting channels render for this vision mode:

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
  const myVision = new VisionMode({
    id: "myDarkvision",
    label: "MY_MODULE.VisionMode.darkvision",
    tokenConfig: true,
    animated: false,
    canvas: {
      shader: ColorAdjustmentsSamplerShader,
      uniforms: { contrast: 0, saturation: -1.0, brightness: 0 }
    },
    vision: {
      darkness: { adaptive: false },
      defaults: { attenuation: 0, contrast: 0, saturation: -1.0, brightness: 0 }
    },
    lighting: {
      visibility: VisionMode.LIGHTING_VISIBILITY.ENABLED
    }
  });

  CONFIG.Canvas.visionModes["myDarkvision"] = myVision;
});
```

### Lifecycle methods

```js
class MyVisionMode extends VisionMode {
  // Called when a token using this vision becomes the POV
  _activate(source) {
    // source is a PointVisionSource
  }

  // Called when the POV switches away
  _deactivate(source) {
  }

  // Runs every frame while active (PIXI ticker)
  animate(dt) {
    // dt = deltaTime in ms
  }
}
```

### PointVisionSource

Each token's vision creates a `PointVisionSource`. The active vision mode receives this source in `activate`/`deactivate`. The source manages the token's sight polygon, range, and attenuation.

---

## 2. Detection Modes

Detection modes define *what* a token can perceive (beyond basic sight). They work with vision modes.

### Built-in detection modes

| Class | Purpose |
|---|---|
| `DetectionModeBasicSight` | Standard vision |
| `DetectionModeDarkvision` | See in darkness |
| `DetectionModeLightPerception` | Detect light sources |
| `DetectionModeInvisibility` | See invisible creatures |
| `DetectionModeTremor` | Tremorsense (feel through ground) |
| `DetectionModeAll` | Detect everything |

### Register a custom detection mode

```js
Hooks.once("init", () => {
  CONFIG.Canvas.detectionModes["myModule.truesight"] = new DetectionMode({
    id: "myModule.truesight",
    label: "MY_MODULE.DetectionMode.truesight",
    type: "sight",
    walls: true,          // respects walls
    angle: false          // not limited by vision angle
  });
});
```

Detection modes are referenced by ID in token vision configuration. The `type` field determines which visual channel it uses: `"sight"`, `"light"`, `"sound"`, or `"move"`.

---

## 3. Lighting System

### Canvas layers

The lighting and vision system spans several canvas layers (bottom to top):

```
LightingLayer      ← AmbientLight documents, darkness sources
SightLayer         ← Vision polygons, fog of war
EffectsLayer       ← Visual effects, weather
```

### Hooks

```js
// Fires after lighting refresh
Hooks.on("lightingRefresh", (lighting) => {
  // Custom logic after lights update
});

// Fires after sight/vision refresh
Hooks.on("sightRefresh", (sight) => {
  // Custom logic after vision update
});
```

### Wall restriction types

```js
CONST.WALL_RESTRICTION_TYPES = ["light", "sight", "sound", "move"];
```

Walls can restrict each of these independently. When creating custom vision modes or detection modes, the `walls: true` setting determines whether walls block the detection.

### AmbientLight documents

AmbientLight is an embedded document on Scene. Key config fields:

```js
// Create a light source on the scene
await scene.createEmbeddedDocuments("AmbientLight", [{
  x: 500, y: 300,
  config: {
    bright: 20,        // bright light radius (grid units)
    dim: 40,           // dim light radius
    color: "#ffaa00",
    alpha: 0.5,
    animation: {
      type: "torch",   // "torch", "pulse", "chromatic", "wave", "fog", "sunburst", "dome"
      speed: 3,
      intensity: 3
    },
    darkness: { min: 0, max: 1 }   // only active in this darkness range
  }
}]);
```

### Darkness level

The scene's darkness level controls light behavior. Programmatically adjust it:

```js
await canvas.scene.update({ darkness: 0.7 });   // 0 = bright, 1 = total darkness
```

Lights with `darkness.min`/`darkness.max` only activate within their configured range.

---

## 4. Fog of War

`FogManager` handles fog of war exploration state. It lives on `canvas.fog`.

```js
// Reset fog for the current scene
canvas.fog.reset();

// Check if a point has been explored
const explored = canvas.fog.getExplorationState();
```

Fog of war is managed automatically by Foundry when `scene.fog.exploration` is enabled. Modules rarely need to interact with it directly.
