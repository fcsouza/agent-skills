# Canvas & PIXI Extensions

Deep reference for extending Foundry VTT v14's canvas using PIXI.js. Foundry pins PIXI `7.4.3`.

Most modules never need canvas extensions. Read this when you need custom visual elements on the game board — markers, overlays, custom token visuals, measurement tools, or interactive map elements.

---

## Canvas Architecture

### Stage Hierarchy

`canvas.stage` is the root `PIXI.Container`. Everything visible on the board is a descendant of it.

Layer groups (in z-order):
- `"background"` — scene background, tiles behind tokens
- `"primary"` — tokens, tiles, drawings (most custom layers go here)
- `"effects"` — lighting, weather, vision
- `"interface"` — controls, rulers, HUD elements

### Built-in Layers

| Property | Class | Group |
|---|---|---|
| `canvas.tokens` | `TokenLayer` | primary |
| `canvas.tiles` | `TilesLayer` | primary |
| `canvas.drawings` | `DrawingsLayer` | primary |
| `canvas.walls` | `WallsLayer` | interface |
| `canvas.lighting` | `LightingLayer` | effects |
| `canvas.grid` | `GridLayer` | interface |

### Useful Canvas Properties

```javascript
canvas.scene;        // Active Scene document
canvas.dimensions;   // { width, height, size, distance, distancePixels, rect, sceneRect, ... }
canvas.stage;        // Root PIXI.Container
canvas.app;          // PIXI.Application instance
canvas.app.ticker;   // PIXI ticker for frame-synced updates
canvas.level;        // NEW in v14 — the Level document currently in view
canvas.edges;        // NEW in v14 — the CanvasEdges collection for canvas.level
canvas.transition;   // NEW in v14 — TransitionContainer for scene transitions
```

**New in v14: Scene Levels.** A Scene holds one or more `Level` embedded documents, and the canvas draws one at a time. `canvas.level` is the Level in view, `canvas.scene.cycleLevel(1)` steps up, and `canvas.inferLevelFromElevation(elevation)` finds the level an elevation belongs to. Every placeable document carries a `levels` set. Scene `background`, `foreground`, `foregroundElevation` and `backgroundColor` moved onto `Level`. See `foundry-vtt-module-dev/references/scene-levels.md`.

---

## Custom Canvas Layer

### Registration

Register in the `init` hook — before the canvas draws:

```javascript
Hooks.once("init", () => {
  CONFIG.Canvas.layers.myLayer = {
    layerClass: MyLayer,
    group: "primary",
  };
});
```

**Changed in v14:** replacing a *core* layer class moved here too. `CONFIG.<Document>.layerClass` is deprecated (until v16).

```javascript
// v13
CONFIG.Token.layerClass = MyTokenLayer;

// v14
CONFIG.Canvas.layers.tokens.layerClass = MyTokenLayer;
```

The mapping is `AmbientLight` → `lighting`, `AmbientSound` → `sounds`, `Drawing` → `drawings`, `Note` → `notes`, `Region` → `regions`, `Tile` → `tiles`, `Token` → `tokens`, `Wall` → `walls`. `CONFIG.Canvas.layers.templates` still exists but is deprecated along with the rest of MeasuredTemplate.

### Layer Class

```javascript
class MyLayer extends foundry.canvas.layers.CanvasLayer {
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: "myLayer",
      zIndex: 500,
    });
  }

  /** Called when the canvas draws. Add PIXI children here. */
  async _draw(options) {
    await super._draw(options);
    this.markers = this.addChild(new PIXI.Container());
  }

  /** Called when the canvas tears down. Destroy all children. */
  async _tearDown(options) {
    this.removeChildren().forEach(c => c.destroy({ children: true }));
    await super._tearDown(options);
  }

  /** Optional: control this layer's stacking within its group. */
  getZIndex() {
    return super.getZIndex();
  }

  /** Public API used by the rest of the module. */
  addMarker(x, y, color = 0xff0000) {
    const g = new PIXI.Graphics();
    g.beginFill(color, 0.6).drawCircle(0, 0, 20).endFill();
    g.position.set(x, y);
    this.markers.addChild(g);
    return g;
  }
}

// Access after canvas draws:
// canvas.myLayer.addMarker(500, 300);
```

---

## PlaceableObject Subclass

For interactive objects on the canvas that behave like tokens — draggable, clickable, with a document backing.

### Minimal Implementation

```javascript
class MarkerObject extends foundry.canvas.placeables.PlaceableObject {
  /** @override — render the object's PIXI graphics */
  async _draw() {
    // Circle body
    this.shape = this.addChild(new PIXI.Graphics());
    this.shape
      .beginFill(0xff4444, 0.8)
      .drawCircle(0, 0, 24)
      .endFill();

    // Label
    this.label = this.addChild(
      new PIXI.Text(this.document.name ?? "", {
        fontSize: 14,
        fill: 0xffffff,
        align: "center",
      })
    );
    this.label.anchor.set(0.5);
    this.label.position.set(0, 30);

    return this;
  }

  /** @override — update visual state from document data */
  _refresh() {
    this.position.set(this.document.x, this.document.y);
    this.shape.tint = this.hover ? 0xff8888 : 0xffffff;
  }

  /** @override — clean up PIXI memory */
  _destroy(options) {
    this.shape.destroy();
    this.label.destroy();
  }

  /**
   * NEW in v14 — reset transient interaction state.
   * Public clear() is deprecated; override the protected _clear() instead.
   */
  _clear() {
    super._clear();
    this.hover = false;
  }

  // --- Event Handlers ---

  _onClickLeft(event) {
    console.log("Clicked marker:", this.document.name);
    // Open a sheet, trigger logic, etc.
  }

  _onClickRight(event) {
    // Show context menu
  }

  _onHoverIn(event, { hoverOutOthers = false, updateLegend = true } = {}) {
    this.hover = true;
    this._refresh();
  }

  _onHoverOut(event, options) {
    this.hover = false;
    this._refresh();
  }

  _onDragLeftStart(event) {
    this._dragOrigin = { x: this.document.x, y: this.document.y };
  }

  _onDragLeftMove(event) {
    const { x, y } = event.interactionData.destination;
    this.position.set(x, y);
  }

  async _onDragLeftDrop(event) {
    const { x, y } = event.interactionData.destination;
    await this.document.update({ x, y });
  }
}
```

### New PlaceableObject members in v14

| Member | Purpose |
|---|---|
| `_clear()` | Protected reset of transient state. The public `clear()` is a deprecated no-op. |
| `isFilteredOut` | True when the Placeables sidebar filter hides this object. |
| `isInteractable` | True when the object accepts pointer interaction right now. |
| `isVisible` | Whether the object is currently visible to the user. |
| `previewType` | What kind of preview this object is, if any. |
| `_refreshState()` / `_refreshVisibility()` | Split render-flag handlers. |
| `_pasteObject(offset, {hidden, snap, cut})` | Paste handling, used by the layer's copy/cut/paste keys. |

### Shape mixins

**New in v14:** `AmbientLight`, `AmbientSound`, `Drawing`, `Region` and `Tile` extend `ShapeObjectMixin(PlaceableObject)`, and `DrawingsLayer`, `LightingLayer`, `RegionLayer`, `SoundsLayer` and `TilesLayer` extend `ShapeLayerMixin(PlaceablesLayer)`. The mixins own the drag-to-create and drag-to-resize behaviour that each class used to hand-roll, plus `bounds` and `isVisible`.

Handle rendering moved to `foundry.canvas.containers.ShapeControls` and `ShapeControlsHandle`. If you patched `Tile#_onHandleDragMove` or the equivalent on `Drawing`, that code no longer has a target.

Layer hooks the mixin exposes: `_createDragPreviewData`, `_createDragShapeData`, `_updateDragPreview`, `_updateMouseWheelPreview`, `_commitDragLeftDrop`, `_isCreationToolActive`, `paletteCreateData`, and the static `paletteClass`.

### Iterating the documents on a layer

**Changed in v14:** `PlaceablesLayer#getDocuments()` is deprecated (until v16) because it is not Level-aware. Use the `viewedDocuments` generator, which yields only the documents in the level currently in view.

```javascript
// v13
for ( const doc of canvas.tokens.getDocuments() ) { /* ... */ }

// v14
for ( const doc of canvas.tokens.viewedDocuments() ) { /* ... */ }
```

`PlaceablesLayer.CREATION_STATES` is deprecated without replacement, and `PlaceablesLayer.SORT_ORDER` was removed.

### ControlIcon

**Changed in v14:** `ControlIcon` is now a `RenderFlagsMixin(PIXI.Container)`. Several members are deprecated until v16.

| Deprecated | Replacement |
|---|---|
| `new ControlIcon({tint: null})` | pass `0xFFFFFF` or omit `tint` |
| `ControlIcon#refresh(options)` | set `#visible`, `#icon.tint`, `#border.tint` directly |
| `ControlIcon#rect` | `ControlIcon#size` |
| `ControlIcon#tintColor` | `ControlIcon#icon.tint` |
| `ControlIcon#borderColor` | `ControlIcon#border.tint` |
| `ControlIcon#iconSrc` | `ControlIcon#texture` |

`ControlsLayer` now extends `CanvasLayer` rather than `InteractionLayer`.

---

## Coordinate Systems

Foundry uses two coordinate spaces on the canvas:

| Space | Description |
|---|---|
| Screen / Client | Browser viewport pixels (`event.clientX/Y`) |
| Canvas | The game board's internal coordinate system |

### Converting Between Systems

```javascript
// Screen → Canvas
function screenToCanvas(clientX, clientY) {
  return canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
}

// Canvas → Screen
function canvasToScreen(x, y) {
  return canvas.clientCoordinatesFromCanvas({ x, y });
}

// Snap a canvas point to the nearest grid center.
// canvas.grid.getCenter(x, y) was removed in v14.
function snapToGrid(x, y) {
  return canvas.grid.getCenterPoint({ x, y }); // returns {x, y}
}

// Convert a grid cell position {i, j} to pixel top-left
function gridToPixel(i, j) {
  return canvas.grid.getTopLeftPoint({ i, j }); // returns {x, y}
}

// Convert a click event to canvas coordinates
canvas.stage.on("click", (event) => {
  const { x, y } = event.data.getLocalPosition(canvas.stage);
  console.log("Canvas coords:", x, y);
});
```

---

## Drawing with PIXI

### Shapes — PIXI.Graphics

```javascript
function makeMarker(x, y) {
  const g = new PIXI.Graphics();

  // Filled circle
  g.beginFill(0x3399ff, 0.75);
  g.drawCircle(0, 0, 30);
  g.endFill();

  // Outline ring
  g.lineStyle(2, 0xffffff, 1);
  g.drawCircle(0, 0, 32);

  g.position.set(x, y);
  return g;
}
```

### Label — PIXI.Text

```javascript
function makeLabel(text) {
  return new PIXI.Text(text, {
    fontFamily: "Arial",
    fontSize: 16,
    fill: 0xffffff,
    dropShadow: true,
    dropShadowDistance: 2,
  });
}
```

### Sprite — PIXI.Sprite

```javascript
async function makeIcon(path, x, y) {
  const texture = await foundry.canvas.loadTexture(path);   // Foundry's texture loader
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.position.set(x, y);
  sprite.width = 40;
  sprite.height = 40;
  return sprite;
}
```

### Circle with Label (Combined)

```javascript
function makeMarkerWithLabel(x, y, labelText, color = 0x3399ff) {
  const container = new PIXI.Container();
  container.position.set(x, y);

  const circle = new PIXI.Graphics();
  circle.beginFill(color, 0.75).drawCircle(0, 0, 28).endFill();
  circle.lineStyle(2, 0xffffff, 1).drawCircle(0, 0, 30);
  container.addChild(circle);

  const label = new PIXI.Text(labelText, { fontSize: 13, fill: 0xffffff });
  label.anchor.set(0.5);
  label.position.set(0, 38);
  container.addChild(label);

  return container;
}
```

---

## Animation

Always use Foundry's `CanvasAnimation` — never `requestAnimationFrame` directly.

### CanvasAnimation.animate()

```javascript
const { CanvasAnimation } = foundry.canvas.animation;

// Animate an object's position and alpha simultaneously
await CanvasAnimation.animate(
  [
    { parent: myObject, attribute: "x",     to: 800 },
    { parent: myObject, attribute: "y",     to: 600 },
    { parent: myObject, attribute: "alpha", to: 0   },
  ],
  {
    duration: 800,          // milliseconds
    easing: CanvasAnimation.easeInOutCosine,
    ontick: (dt, attributes) => {
      // Optional: called every frame during the animation
    },
  }
);

// Object is now at (800, 600) with alpha 0
```

Built-in easing functions:
- `CanvasAnimation.easeInOutCosine` (smooth, default-like)
- `CanvasAnimation.easeOutCubic`
- `CanvasAnimation.linear`

### Ticker-Based Updates

For continuous per-frame logic (not a one-shot animation):

```javascript
const ticker = canvas.app.ticker;

function onFrame(deltaTime) {
  mySprite.rotation += 0.01 * deltaTime;
}

ticker.add(onFrame);

// Remove when done — always clean up
function cleanup() {
  ticker.remove(onFrame);
}
```

### Particles

**Changed in v14:** `foundry.canvas.containers.ParticleEffect` and `foundry.canvas.primary.PrimaryParticleEffect` are deprecated (until v16) in favour of `foundry.canvas.animation.ParticleGenerator`, which pools particles and supports ambient and effect modes.

```javascript
const gen = new foundry.canvas.animation.ParticleGenerator({
  mode: "effect",
  count: 220,
  spawnRate: 180,
  area: { from: { x: 900, y: 700 }, to: { x: 1300, y: 760 } },
  textures: ["modules/my-module/particles/spark.png"],
  lifetime: [900, 1300],
  velocity: {
    angle: [70, 110],
    speed: { min: 525, max: 700, curve: [{ time: 0, value: 1 }, { time: 1, value: 0.2 }] }
  },
  rotation: { speed: { min: -120, max: 120 } },
  alpha: { min: 0.45, max: 0.8, curve: [{ time: 0, value: 0 }, { time: 1, value: 0 }] },
  scale: { min: 0.48, max: 0.8 },
  tint: { curve: [{ time: 0, value: 0x66CCFF }, { time: 1, value: 0x4F6DFF }] }
});
gen.start();
```

Ranges accept `[min, max]` or `{min, max}`, and `{curve: [{time, value}, ...]}` shapes a property over each particle's life.

Deprecated `ParticleGenerator` options: `perFrame` (use `spawnRate`), `maxParticlesPerFrame` (use `spawnRate`), `alphaRange` (use `alpha`), `scaleRange` (use `scale`), `rotationSpeed` (use `rotation.speed`), and an implicit centred `particleAnchor` (set it, or set `texture.defaultAnchor`).

Weather effects follow the same change: `CONFIG.weatherEffects.<id>.effects[]` now takes a `particles` array instead of an `effectClass`.

```javascript
CONFIG.weatherEffects.myAsh = {
  id: "myAsh",
  label: "MY_MODULE.Weather.ash",
  effects: [{
    id: "ashParticles",
    particles: [{
      textures: ["modules/my-module/particles/ash.png"],
      count: 150, lifetime: 8000, viewPadding: 0.1,
      velocity: { speed: [8, 30], angle: [85, 95] },
      alpha: [0.2, 0.6], scale: [0.05, 0.2], fade: { out: 0.4 }
    }]
  }]
};
```

### Screen shake

**New in v14:** `foundry.canvas.animation.CanvasShakeEffect`.

```javascript
const shake = new foundry.canvas.animation.CanvasShakeEffect({
  target: canvas.stage,     // defaults to canvas.stage
  duration: 800,
  maxDisplacement: 20,
  smoothness: 0.5,
  returnSpeed: 0.1
});
```

### Scene transitions

**New in v14:** `canvas.transition` is a `TransitionContainer`. `CONFIG.Canvas.sceneTransitions` holds the built-ins — `fade`, `swirl`, `waterDrop`, `morph`, `crosshatch`, `wind`, `waves`, `whiteNoise`, `hologram`, `hole`, `holeSwirl`, `glitch`, `dots`. A Scene picks its own via `scene.transition = {type, duration, activeOnly}`.

```javascript
// Transition around a camera pan
await canvas.transition.run({
  operation: async () => {
    await canvas.animatePan({ x: 2000, y: 1500, scale: 1.25, duration: 0 });
  },
  duration: 800,
  transitionType: "dots"
});

// Switch scenes with a transition
await canvas.transition.run({
  nextScene: game.scenes.get("ABC123"),
  activate: true,
  duration: 1200,
  transitionType: "fade"
});
```

`Token#panCanvas({transitionType, duration, speed, easing, force})` plays a transition while following a token. `Canvas#animatePan` itself takes `{x, y, scale, duration, speed, easing}` and has no transition option.

### VFX (experimental)

**New in v14, and explicitly unstable.** `foundry.canvas.vfx` holds a serialisable effect framework — `VFXEffect extends DataModel`, `VFXComponent`, components for particle generators, positional sound, scrolling text, shake, single attacks and single impacts, plus animations and path helpers. It is gated behind a flag that defaults to false:

```javascript
CONFIG.Canvas.vfx.enabled = true;
```

Core's own documentation calls the classes, functions and configuration likely to change across releases regardless of the build's stability label. Do not ship a module that depends on it.

### animejs

**New in v14:** animejs 4 is bundled and exposed as the global `animejs`. Core uses it for its own canvas animation engine, activating and deactivating it with the canvas. Prefer `CanvasAnimation.animate` for anything that has to interact with Foundry's frame budget; reach for animejs when you want its timeline model.

---

## Performance

**Draw once, update transforms.** Creating new PIXI objects every frame is the most common performance mistake.

```javascript
// BAD — creates new Graphics every frame
ticker.add(() => {
  layer.removeChildren();
  const g = new PIXI.Graphics();
  g.drawCircle(x, y, 20);
  layer.addChild(g);
});

// GOOD — create once, update position
const g = new PIXI.Graphics().beginFill(0xff0000).drawCircle(0, 0, 20).endFill();
layer.addChild(g);
ticker.add(() => {
  g.position.set(x, y); // just move it
});
```

**Texture caching** — reuse textures for repeated sprites:

```javascript
// PIXI caches by path automatically via TextureCache
const texture = PIXI.Texture.from("modules/my-module/icons/marker.png");
// Subsequent calls return the cached texture — no extra GPU upload
```

**Hiding vs removing** — prefer `visible = false` when you'll need the object again soon:

```javascript
// Cheaper than removeChild + addChild
markerContainer.visible = false;
// ... later ...
markerContainer.visible = true;
```

**Always destroy PIXI objects** when permanently done — they hold GPU memory:

```javascript
// Destroy container and all children recursively
container.destroy({ children: true, texture: false });
// texture: true would also destroy shared textures — usually not what you want
```

**Batch similar draw calls** — group objects with the same texture/tint under a shared container for the renderer to batch.

---

## Scene Regions

Regions are interactive areas on the canvas that trigger events as tokens move. In v14 they also absorbed MeasuredTemplate, so they cover difficult terrain, teleporters, trigger zones, auras and area-of-effect templates alike.

```javascript
const px = canvas.dimensions.distancePixels;

await canvas.scene.createEmbeddedDocuments("Region", [{
  name: "Trap Zone",
  color: "#ff0000",
  shapes: [{ type: "rectangle", x: 500, y: 500, width: 200, height: 200 }],
  levels: [canvas.level.id],
  behaviors: [{
    type: "executeScript",
    system: {
      events: ["tokenEnter"],
      script: `ui.notifications.warn(\`\${event.data.token.name} triggered the trap!\`);`
    }
  }]
}]);
```

Ten shape types: `rectangle`, `circle`, `ellipse`, `cone`, `ring`, `line`, `emanation`, `polygon`, `token`, `grid`. `RegionLayer#placeRegion(data, options)` runs the interactive placement flow.

The full schema, behaviors, shape fields, spawning and teleporting live in `foundry-vtt-module-dev/references/regions-and-grid.md`; the template migration is in `foundry-vtt-module-dev/references/measured-templates.md`.

---

## Canvas Layer Groups

The canvas is organised into named **layer groups** under `foundry.canvas.*`, a structure introduced in v13 and unchanged in v14. Each group is a `PIXI.Container` with a fixed render priority; layers (TokenLayer, LightingLayer, etc.) live inside one of them. Use this map when registering custom layers via `CONFIG.Canvas.layers.<name> = { layerClass, group }`.

| Group | Contains | Custom layers go here when… |
|---|---|---|
| `primary` | Scene background, tiles, tokens, drawings — the "world" content | …you're rendering world-space objects (markers, overlays attached to tokens) |
| `effects` | Lighting, vision, weather, illumination | …you're adding visual effects that should respect vision/lighting |
| `environment` | Global environment overlays (illumination color, darkness shader) | …you're modifying ambient look-and-feel scene-wide |
| `interface` | Rulers, controls, HUD anchors, grid | …your layer is UI-like and should ignore vision/fog |
| `overlay` | Top-most layer; sits above everything | …debug overlays, GM-only annotations, modal canvas overlays |
| `visibility` | Fog of war + vision restriction masks | …you're extending vision/fog (rare; usually use VisionMode) |
| `rendered` | Composited result of all visible content | …you need a post-process target; almost never written to directly |

Access groups directly:

```javascript
canvas.primary;        // PrimaryCanvasGroup
canvas.effects;        // EffectsCanvasGroup
canvas.environment;    // EnvironmentCanvasGroup
canvas.interface;      // InterfaceCanvasGroup
canvas.overlay;        // OverlayCanvasGroup
canvas.visibility;     // CanvasVisibility
canvas.rendered;       // RenderedCanvasGroup (read-only)
```

Each group is also reachable through `canvas.stage.children`, but the named accessors are the documented API.

### Primary group internals

`PrimaryCanvasGroup#objects` is the flat, unordered array of every `PrimaryCanvasObject` in the group. `#drawLevelTextures` draws the current Level's background and foreground; `#hoverFadeElevation` drives the hover fade, configured by `CONFIG.Canvas.hoverFade = {delay: 250, duration: 750}`. `PrimaryCanvasGroup#mapElevationToDepth` was removed — use `canvas.masks.depth.mapElevation`.

`PrimaryCanvasContainer#sortLayer` (a number) and `#inPrimary` control where a container sorts inside the primary group; sorting compares `sortLayer` first, then elevation and sort.

### Choosing a Group for a Custom Layer

- **World-space, vision-respecting** → `primary` or `effects` (effects are masked by lighting/vision)
- **World-space, ignoring vision** → `primary` (pre-vision) or `interface`
- **Screen-space UI** → `interface` (panned/zoomed with the canvas) or `overlay` (above HUD)
- **Debug-only / dev tools** → `overlay`

### Namespaces (`foundry.canvas.*`)

The namespaced layout arrived in v13 and is still correct in v14. The Canvas class itself is `foundry.canvas.Canvas`. Classes you'll commonly extend:

| Legacy global | Namespaced |
|---|---|
| `CanvasLayer` | `foundry.canvas.layers.CanvasLayer` |
| `InteractionLayer` | `foundry.canvas.layers.InteractionLayer` |
| `PlaceableObject` | `foundry.canvas.placeables.PlaceableObject` |
| `Token` (object) | `foundry.canvas.placeables.Token` |
| `Region` (object) | `foundry.canvas.placeables.Region` |
| `CanvasAnimation` | `foundry.canvas.animation.CanvasAnimation` |
| `VisionMode` / `DetectionMode` | `foundry.canvas.perception.*` |

Legacy globals still exist as deprecation shims and log a console warning. **Changed in v14:** a large batch of v12-era globals was removed outright — among them `BaseGrid`, `HexagonalGrid`, `SquareGrid`, `GridHex`, `LightSource`, `VisionSource`, `DarknessSource`, `MovementSource`, `SoundSource`, `GlobalLightSource` — plus the bare `foundry.utils` globals (`mergeObject`, `getProperty`, `deepClone`, `randomID`). Use `foundry.grid.*`, `foundry.canvas.sources.*` and `foundry.utils.*`.

---

## Textures and Shaders

### KTX2 textures

**New in v14:** `foundry.canvas.KTX2Parser` reads KTX2/Basis compressed textures. `CONST.TEXTURE_FILE_EXTENSIONS` adds `basis` and `ktx2`, the FilePicker gains a `"texture"` type, and `TextureData` fields can declare `categories: ["TEXTURE"]` to accept them.

### Loading

```javascript
const texture = await foundry.canvas.loadTexture("modules/my-module/art/marker.webp");
const exists = await foundry.utils.srcExists(src);
const data = await foundry.utils.fetchResource(src, { bustCache: true });
const busted = foundry.utils.getCacheBustURL(src);
```

**Changed in v14:** `TextureLoader.fetchResource`, `TextureLoader.getCacheBustURL` and `foundry.canvas.srcExists` are deprecated (until v16) in favour of the `foundry.utils` versions above. `TextureLoader.hasTextExtension` is deprecated without replacement.

### Custom shaders

**Changed in v14:** the static `fragmentShader` and `vertexShader` getters on shader classes are deprecated. Override the factory methods instead, which receive the compile options.

```javascript
class MyShader extends foundry.canvas.rendering.shaders.AbstractBaseShader {
  static _createFragmentShader(options) {
    return `
      precision mediump float;
      void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`;
  }

  static _createVertexShader(options) {
    return super._createVertexShader(options);
  }
}
```

`AbstractBaseShader#_defaults` was removed — use `initialUniforms`. Foundry sets `PIXI.Program.defaultVertexPrecision` and `defaultFragmentPrecision` to `HIGH` globally.

### Occlusion

**Changed in v14:** `CanvasOcclusionMask#updateOcclusion` is deprecated. Request the refresh through the perception manager.

```javascript
canvas.perception.update({ refreshOcclusion: true });
```

Tile occlusion moved from a single mode to a set. `CONST.OCCLUSION_MODES` was renumbered as bit flags: `NONE 0`, `FADE 1`, `SURFACE 2`, `RADIAL 4`, `VISION 8`.

```javascript
// v13
await tile.document.update({ "occlusion.mode": CONST.OCCLUSION_MODES.FADE });

// v14 — a Set of modes
await tile.document.update({ "occlusion.modes": [CONST.OCCLUSION_MODES.FADE, CONST.OCCLUSION_MODES.RADIAL] });
```

`occlusion.mode` still reads as a shim until v16, returning the first entry of the set.

**Changed in v14:** a Tile's `x, y` is now its origin, not its top-left corner. The schema is unchanged — `texture.anchorX` and `texture.anchorY` have defaulted to `0.5` since v13 — but the placeable changed how it reads them. v13 drew the mesh at `(x + width/2, y + height/2)`; v14 draws it at `(x, y)` and lets the anchor place the texture. With the default anchor, `x, y` is the tile's centre, and rotation happens around it.

```javascript
// Recover the old top-left from a v14 Tile
const { x, y, width, height, anchorX, anchorY } = tile.document.shape;
const topLeft = { x: x - (width * anchorX), y: y - (height * anchorY) };
```

`TileDocument#shape` is new in v14: a derived `RectangleShapeData` built in `prepareDerivedData` from `x`, `y`, `width`, `height`, `texture.anchorX`, `texture.anchorY` and `rotation`. Read geometry from it rather than assembling the fields yourself.

---

## GSAP (GreenSock)

Foundry bundles the **full Club GreenSock bonus pack** (a paid premium license) and exposes it as the global `gsap`. No import, no `<script>` tag — it's already loaded along with every plugin. Reach for it when you need orchestrated UI/canvas animations that go beyond what CSS or `CanvasAnimation.animate` cover.

Unchanged in v14: the same GreenSock distribution ships in `public/scripts/greensock/`. Core canvas animation itself does not use it — that runs on `CanvasAnimation` and, new in v14, the bundled animejs (`globalThis.animejs`).

### What's Available

Beyond the gsap core (tweens, timelines, eases), Foundry ships these plugins pre-registered:

| Plugin | Purpose |
|---|---|
| **PixiPlugin** | Canonical PIXI integration — tween PIXI display object properties through GSAP's optimized path |
| **Draggable** | Touch + mouse drag with momentum, bounds, snap |
| **Flip** | FLIP-technique animations (animate layout changes) |
| **MotionPathPlugin** | Animate along an SVG path or arbitrary point sequence |
| **MorphSVGPlugin** | Morph between SVG path shapes |
| **DrawSVGPlugin** | Animate SVG path drawing/erasing |
| **InertiaPlugin** | Velocity-based throw/inertia tweens |
| **ScrollTrigger**, **ScrollSmoother**, **ScrollToPlugin** | Scroll-driven animation |
| **SplitText** | Animate per-character / per-word text effects |
| **TextPlugin**, **ScrambleTextPlugin** | Animate text content changes |
| **CustomEase**, **CustomBounce**, **CustomWiggle** | Author-defined easing curves |
| **Physics2DPlugin**, **PhysicsPropsPlugin** | Physics-driven animation |
| **Observer** | Unified gesture/wheel/touch input observer |
| **GSDevTools** | Visual debugger for tweens (development only) |

```javascript
// Core tween — to a target
gsap.to(element, { x: 100, opacity: 0, duration: 0.4, ease: "power2.out" });

// Tween FROM a starting value to the current state (reveal animations)
gsap.from(element, { y: -20, opacity: 0, duration: 0.3 });

// Sequence multiple tweens — timeline orchestrates them in order
const tl = gsap.timeline();
tl.to(card, { x: 200, duration: 0.4 })
  .to(card, { rotation: 360, duration: 0.6 })
  .to(card, { opacity: 0, duration: 0.2 });

// Kill a running tween
gsap.killTweensOf(element);
```

For the full API see greensock.com/docs. Module devs benefit most from PixiPlugin (canvas), Flip (sheet layout transitions), MorphSVG (animated tokens/icons), and Draggable (custom UI).

### When to Use GSAP vs Alternatives

| Need | Tool |
|---|---|
| Hover state, simple in/out fade | **CSS transition** — no JS, GPU-accelerated, smallest |
| Canvas-only, single property animation | **`CanvasAnimation.animate`** — Foundry's built-in, integrates with the PIXI ticker |
| One-frame visual update reacting to data | **`requestAnimationFrame`** — minimal overhead |
| Orchestrated multi-step sequence | **GSAP timeline** — reads cleanly, supports labels, callbacks, reverse |
| Animating multiple PIXI properties together | **GSAP** — handles position, alpha, rotation, scale in one tween |
| Ease-aware easing curves beyond `linear`/`ease-in-out` | **GSAP** — 30+ named eases vs CSS's handful |
| A timeline you want to build from data | **animejs** — bundled in v14 as `globalThis.animejs` |

If a single CSS line works, use CSS. If it's "animate four properties of three sprites in sequence with a callback at the end," use GSAP.

### PIXI Integration (PixiPlugin — preferred)

`PixiPlugin` is the canonical way to animate PIXI display objects. It maps standard CSS-like properties (`x`, `y`, `scale`, `rotation`, `tint`, `alpha`, `skewX`) onto PIXI's underlying object structure for you, handles units correctly, and is more performant than manual nested tweens.

```javascript
// Tween via the pixi: prefix — PixiPlugin unpacks to the right nested properties
const sprite = canvas.tokens.placeables[0].mesh;

gsap.to(sprite, {
  pixi: {
    x: 1000,
    y: 800,
    scale: 2,
    rotation: 90,           // degrees
    alpha: 0.3,
    tint: 0xff0000,         // hex color, animates through color space
  },
  duration: 1.2,
  ease: "power3.inOut",
});
```

Without PixiPlugin you'd have to tween nested objects manually:

```javascript
// Manual approach — works but verbose, slower
gsap.to(sprite.position, { x: 1000, y: 800, duration: 1.2 });
gsap.to(sprite.scale, { x: 2, y: 2, duration: 1.2 });
gsap.to(sprite, { alpha: 0.3, rotation: Math.PI / 2, duration: 1.2 });
```

PixiPlugin handles all of these in one tween, applies eases consistently, and uses radians under the hood while accepting degrees in the API.

### Respect `prefers-reduced-motion`

Vestibular issues, motion sickness, attention disorders — animation can be hostile if forced. Always honor the OS-level preference:

```javascript
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

gsap.to(element, {
  x: 100,
  duration: reduced ? 0 : 0.4,    // instant when user prefers reduced motion
});

// Or globally cap GSAP duration once at init
if (reduced) gsap.globalTimeline.timeScale(0);   // pauses all timelines
```

For sheets specifically, listen for changes too — users can toggle the setting mid-session:

```javascript
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
  gsap.globalTimeline.timeScale(e.matches ? 0 : 1);
});
```

### Cleanup on Application Close

A tween running when the target element is destroyed is a frame-rate leak. Kill tweens explicitly in `_onClose`:

```javascript
class MyAnimatedSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  _onClose(options) {
    gsap.killTweensOf(this.element);
    gsap.killTweensOf(this.element.querySelectorAll("*"));
    return super._onClose(options);
  }
}
```

Same applies to PIXI sprite tweens when a custom layer is torn down — kill them in `_tearDown` before destroying the display objects.

### Pitfalls

1. **Tweening Foundry-managed properties directly** — `gsap.to(token, { x: 1000 })` bypasses the Token document update. Other clients won't see the move; collision/vision logic doesn't fire. For Foundry-controlled state, use `Token.update(...)` and let Foundry animate via its own pipeline. Reserve GSAP for properties Foundry doesn't manage (custom overlays, sprite alpha tweens that don't need to sync).
2. **Re-render fighting the tween** — if a sheet re-renders mid-animation, the new HTML replaces the animating element and GSAP keeps tweening a detached DOM node. Either guard the render (`if (this._isAnimating) return;`) or use GSAP's `onComplete` to trigger the render.
3. **Forgetting cleanup** — leaked tweens accumulate over a session. Performance degrades subtly until the user reloads. Always `killTweensOf` on close/tear-down.
4. **`gsap.set` confusion** — `gsap.set(el, { x: 100 })` is the **non-animated** equivalent; useful for initial state but not what you want for transitions.
5. **Default ease is `power1.out`** — not `linear`. If your tween feels slightly squishy, you didn't pass an ease. Set explicitly when timing matters.
