# Canvas & PIXI Extensions

Deep reference for extending Foundry VTT v13's canvas using PIXI.js.

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
canvas.dimensions;   // { width, height, size, distance, rect, sceneRect, ... }
canvas.stage;        // Root PIXI.Container
canvas.app;          // PIXI.Application instance
canvas.app.ticker;   // PIXI ticker for frame-synced updates
```

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

### Layer Class

```javascript
class MyLayer extends CanvasLayer {
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
class MarkerObject extends PlaceableObject {
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

  // --- Event Handlers ---

  _onClickLeft(event) {
    console.log("Clicked marker:", this.document.name);
    // Open a sheet, trigger logic, etc.
  }

  _onClickRight(event) {
    // Show context menu
  }

  _onHoverIn(event) {
    this.hover = true;
    this._refresh();
  }

  _onHoverOut(event) {
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

// Snap a canvas point to the nearest grid center
function snapToGrid(x, y) {
  return canvas.grid.getCenter(x, y); // returns [cx, cy]
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
  const texture = await loadTexture(path);   // Foundry's texture loader
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

## Scene Regions (v13)

v13 introduces the **Scene Regions** API — interactive areas on the canvas that trigger events without relying on drawing-based workarounds. Use them for difficult terrain, teleporters, trigger zones, ambient effects, and encounter areas.

### Core Concepts

- `Region` — a document embedded in a Scene, defining an area with one or more geometric shapes
- `RegionGeometry` — the shape definitions (rectangles, circles, polygons) that compose a region
- Regions fire **Region Events** when tokens enter, exit, or move within them

### Creating Regions

Regions are embedded documents on Scenes:

```javascript
await canvas.scene.createEmbeddedDocuments("Region", [{
  name: "Trap Zone",
  color: "#ff0000",
  shapes: [{
    type: "rectangle",
    x: 500, y: 500,
    width: 200, height: 200,
  }],
  behaviors: [{
    type: "executeScript",
    system: false,
    events: ["tokenEnter"],
    script: `
      const token = event.data.token;
      ui.notifications.warn(\`\${token.name} triggered the trap!\`);
    `,
  }],
}]);
```

### Region Events

| Event | When |
|---|---|
| `tokenEnter` | A token moves into the region |
| `tokenExit` | A token moves out of the region |
| `tokenMoveWithin` | A token moves within the region (without crossing boundary) |
| `tokenTurnStart` | A token's combat turn starts while in the region |
| `tokenTurnEnd` | A token's combat turn ends while in the region |
| `tokenRoundStart` | A combat round starts with the token in the region |
| `tokenRoundEnd` | A combat round ends with the token in the region |

### Region Behaviors

Behaviors are the actions triggered by region events:
- `executeScript` — run arbitrary JavaScript
- `executeMacro` — run a Macro document
- `adjustMovement` — modify token movement (difficult terrain)
- `teleportToken` — move token to another location
- `toggleBehavior` — enable/disable other behaviors

Regions are managed via the canvas UI (Drawing tools → Regions) or programmatically. They replace the common pattern of invisible drawings + `canvasDrop` hooks for interactive map areas.

---

## v13 Canvas Layer Groups (Restructure)

v13 reorganized the canvas from a flat z-ordered layer list into named **layer groups** under `foundry.canvas.*`. Each group is a `PIXI.Container` with a fixed render priority; layers (TokenLayer, LightingLayer, etc.) live inside one of them. Use this map when registering custom layers via `CONFIG.Canvas.layers.<name> = { layerClass, group }`.

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

Each group is also reachable through `canvas.stage.children` but the named accessors are the documented v13 API.

### Choosing a Group for a Custom Layer

- **World-space, vision-respecting** → `primary` or `effects` (effects are masked by lighting/vision)
- **World-space, ignoring vision** → `primary` (pre-vision) or `interface`
- **Screen-space UI** → `interface` (panned/zoomed with the canvas) or `overlay` (above HUD)
- **Debug-only / dev tools** → `overlay`

### v13 Namespace Notes

The Canvas class itself moved to `foundry.canvas.Canvas`. Subclasses you'll commonly extend:

| v12 / legacy global | v13 namespaced |
|---|---|
| `CanvasLayer` | `foundry.canvas.layers.CanvasLayer` |
| `InteractionLayer` | `foundry.canvas.layers.InteractionLayer` |
| `PlaceableObject` | `foundry.canvas.placeables.PlaceableObject` |
| `Token` (object) | `foundry.canvas.placeables.Token` |
| `MeasuredTemplate` | `foundry.canvas.placeables.MeasuredTemplate` |

Legacy globals still exist as deprecation shims in v13 — they emit a console warning. Update imports when you touch a file.

---

## GSAP (GreenSock)

Foundry bundles the **full Club GreenSock bonus pack** (a paid premium license) and exposes it as the global `gsap`. No import, no `<script>` tag — it's already loaded along with every plugin. Reach for it when you need orchestrated UI/canvas animations that go beyond what CSS or `CanvasAnimation.animate` cover.

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
