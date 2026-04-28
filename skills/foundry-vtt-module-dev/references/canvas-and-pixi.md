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
