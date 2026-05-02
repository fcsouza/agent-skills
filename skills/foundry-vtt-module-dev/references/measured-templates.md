# Measured Templates

Deep reference for Foundry VTT v13's MeasuredTemplate API — area-of-effect shapes on the canvas.

---

## 1. Template Document

`MeasuredTemplateDocument` is an embedded document on Scene that defines an area-of-effect shape.

### Schema fields

| Field | Type | Purpose |
|---|---|---|
| `t` | StringField | Shape type: `"circle"`, `"cone"`, `"rect"`, `"ray"` |
| `direction` | AngleField | Direction angle in degrees |
| `distance` | NumberField | Radius/length in grid units |
| `width` | NumberField | Width for `"ray"` and `"rect"` types (grid units) |
| `angle` | AngleField | Arc angle for `"cone"` type (degrees) |
| `x` | NumberField | X-coordinate origin (pixels) |
| `y` | NumberField | Y-coordinate origin (pixels) |
| `fillColor` | ColorField | Fill color |
| `borderColor` | ColorField | Border color |
| `texture` | FilePathField | Texture overlay |
| `hidden` | BooleanField | Hidden from players |
| `elevation` | NumberField | Elevation |
| `flags` | DocumentFlagsField | Module/system flags |

`rotation` is an alias for `direction`.

### Shape types

| Type | `distance` | `angle` | `width` | Description |
|---|---|---|---|---|
| `"circle"` | radius | — | — | Sphere/circle AoE |
| `"cone"` | length | arc degrees | — | Cone from origin |
| `"rect"` | length | — | width | Rectangle |
| `"ray"` | length | — | width | Line/beam |

---

## 2. Creating Templates

### Programmatically

```js
const scene = canvas.scene;

// Circle (e.g., Fireball — 20ft radius)
const [circle] = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
  t: "circle",
  x: 800,
  y: 600,
  distance: 20,
  fillColor: "#ff0000",
  borderColor: "#ff0000"
}]);

// Cone (e.g., Cone of Cold — 60ft cone, 90° arc)
const [cone] = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
  t: "cone",
  x: 500,
  y: 300,
  distance: 60,
  angle: 90,
  direction: 45,
  fillColor: "#00aaff"
}]);

// Line (e.g., Lightning Bolt — 100ft line, 5ft wide)
const [ray] = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
  t: "ray",
  x: 500,
  y: 300,
  distance: 100,
  width: 5,
  direction: 0,
  fillColor: "#ffff00"
}]);

// Rectangle
const [rect] = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
  t: "rect",
  x: 500,
  y: 300,
  distance: 30,
  width: 15,
  direction: 0
}]);
```

### Via Roll.toMessage with template

Some systems auto-create templates from rolls. For custom modules, create the template after the roll:

```js
const roll = new Roll("8d6");
await roll.evaluate();
await roll.toMessage({ flavor: "Fireball Damage" });

// Place the template
const template = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
  t: "circle",
  x: targetX,
  y: targetY,
  distance: 20,
  fillColor: "#ff4400",
  flags: { "my-module": { spellId: "fireball", damage: roll.total } }
}]);
```

---

## 3. Interacting with Templates

### Update / Delete

```js
// Move a template
await template.update({ x: 900, y: 700 });

// Change size
await template.update({ distance: 30 });

// Delete
await template.delete();
```

### Lifecycle hooks

```js
Hooks.on("createMeasuredTemplate", (template, options, userId) => {
  console.log("Template placed:", template.id);
});

Hooks.on("preDeleteMeasuredTemplate", (template, options, userId) => {
  // Return false to cancel deletion
});
```

### Stored flags

Templates support module flags for tracking spell data, damage, or other metadata:

```js
const spellData = template.getFlag("my-module", "spellId");
await template.setFlag("my-module", "damage", 48);
```

---

## 4. MeasuredTemplateConfig

The built-in configuration sheet for templates is `foundry.applications.sheets.MeasuredTemplateConfig`. Users can right-click a template to configure it.

Modules can render it programmatically:

```js
new foundry.applications.sheets.MeasuredTemplateConfig(template).render({ force: true });
```
