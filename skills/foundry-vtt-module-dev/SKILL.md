---
name: foundry-vtt-module-dev
version: 5.0.0
description: >-
  Covers building, extending, debugging, and maintaining Foundry VTT modules for v14+. This skill
  applies when scaffolding a new module, writing custom Actor/Item types with TypeDataModel, building
  ApplicationV2 sheets, dialogs, or detached windows, registering hooks or settings, implementing
  socket communication, extending the canvas with PIXI.js, working with Scene Levels or Regions,
  managing compendium packs, using ActiveEffect V2 changes, setting up TypeScript with fvtt-types,
  configuring Vite/Rollup builds, localizing strings, or migrating modules from v13 to v14. Triggers
  on: "Foundry module", "FVTT", "FoundryVTT", "foundryvtt module", "ApplicationV2", "TypeDataModel",
  "actor sheet", "module.json", "fvtt-types", "libWrapper", "socketlib", "Scene Levels", "Regions",
  "ActiveEffect V2", "messageMode", "detached windows", or any task involving Foundry VTT module
  development.
---

# Foundry VTT Module Development

Build, extend, and maintain modules for Foundry Virtual Tabletop (v14+). This skill covers the full module lifecycle — from scaffolding a new module to migrating between Foundry versions. Coming from v13? Read `references/v14-migration.md` first.

## Quick Start

### Module Structure

```
my-module/
├── module.json          ← manifest (required)
├── scripts/
│   └── main.mjs         ← ES module entry point
├── templates/            ← Handlebars HTML templates
├── styles/               ← CSS stylesheets
├── packs/                ← compendium data
└── lang/
    └── en.json           ← localization strings
```

Use `boilerplate/module.json` and `boilerplate/main.mjs` as starting points.

### Module Manifest (module.json)

Every module needs a valid `module.json`. The critical v14 fields:

```json
{
  "id": "my-module",
  "title": "My Module",
  "description": "What this module does.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "14",
    "verified": "14"
  },
  "documentTypes": { "Actor": { "hero": {} } },
  "authors": [{ "name": "Your Name", "url": "https://github.com/you" }],
  "esmodules": ["scripts/main.mjs"],
  "styles": [{ "src": "styles/my-module.css", "layer": "modules" }],
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" }],
  "socket": true,
  "relationships": {
    "systems": [],
    "requires": [],
    "recommends": []
  }
}
```

| Field | Purpose |
|---|---|
| `id` | Unique identifier, `[A-Za-z0-9_-]` only — must match folder name |
| `compatibility` | `minimum` (won't load below), `verified` (tested on). Omit `maximum` unless a confirmed break exists |
| `documentTypes` | Declares custom Actor/Item/ActiveEffect subtypes your module registers. Keys must match `CONFIG.<Doc>.dataModels` keys |
| `esmodules` | ES module entry points — always prefer over legacy `scripts` |
| `styles` | Array of `{ src, layer? }` objects. `layer` names the CSS cascade layer the sheet loads into. Plain strings still migrate, but write objects |
| `socket` | Set `true` to enable `game.socket.emit/on` for your module |
| `packs` | Array of compendium pack definitions. `name` must match `[A-Za-z0-9_-]`; duplicate names or paths throw at load |
| `relationships.requires` | Hard dependency on other modules/systems |
| `library` | Set `true` if this module is a shared library, not user-facing |
| `quickstart` | New in v14. `{ adventures: { "<id>": { uuid } }, postImport, world: { background, cover, description } }` — marks the module as a Quickstart that creates a world and imports adventures from the Setup screen |

**Changed in v14:** `template.json` is deprecated (until v16) for systems too — declare types with `documentTypes` and a `TypeDataModel`. Static `.html` files are served as `text/plain`; templates still render, but a browser can't open them directly.

### Initialization Lifecycle

Modules run through three hooks in order. Register yours in the entry point:

```javascript
// init — register settings, sheets, custom document types
// game.user is NOT available yet. Canvas is NOT ready.
Hooks.once("init", () => {
  console.log("my-module | Initializing");
  // Register settings, custom sheets, document types here
});

// setup — packages loaded, documents available, canvas not ready
Hooks.once("setup", () => {
  // Modify CONFIG, register additional features
});

// ready — everything available: game.actors, game.scenes, canvas
Hooks.once("ready", () => {
  console.log("my-module | Ready");
  // Safe to access game.actors, game.scenes, game.user
  // Run migrations, initialize socket listeners
});
```

Register `CONFIG` additions (`CONFIG.statusEffects`, `CONFIG.ActiveEffect.changeTypes`, `CONFIG.Canvas.layers`) in `init`. `game.template` is gone since v14 — read type defaults from `game.model` or your `TypeDataModel` schema.

### Styling (CSS Cascade Layers)

Foundry uses CSS Cascade Layers (`@layer`). Put your module CSS in a layer to avoid specificity conflicts and support Foundry's Light/Dark themes. Core declares its layers in this order: `reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions`. Name `modules` in the manifest — `styles: [{ "src": "...", "layer": "modules" }]` — and your rules land after core's own and before `exceptions`.

Do not invent a layer name. A name core never declares sorts after `exceptions` and overrides all core CSS.

An inner `@layer` inside a stylesheet loaded under `modules` nests within it, so `@layer my-module { ... }` becomes `modules.my-module` and keeps the same position in the order. Use it to group your own rules, not to replace the manifest field:

```css
@layer my-module {
  .my-module .window-content {
    --accent-color: var(--color-warm-2);
    padding: 0.5rem;
  }
}
```

Theming works through `body.theme-light` / `body.theme-dark` and `.themed.theme-<x>` on sheets; the `@layer` names and the mechanism are unchanged from v13.

### CSS Variables (Theme-Aware Styling)

Foundry provides CSS custom properties for light/dark theme support. Always prefer these over hardcoded colors:

```css
@layer my-module {
  .my-module-panel {
    /* Text */
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);

    /* Accent palette */
    --my-accent: var(--color-warm-2);
    --my-muted: var(--color-cool-4);

    /* Typography */
    font-family: var(--font-primary);
    font-size: var(--font-size-13);
  }
}
```

Key variable categories:

| Category | Variables |
|---|---|
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-emphatic`, `--color-text-subtle`, `--color-text-dark-primary`, `--color-text-dark-secondary`, `--color-text-hyperlink`, `--color-text-selection` |
| Borders | `--color-border`, `--color-border-dark`, `--color-border-light-1`, `--color-border-light-2` |
| Warm accents | `--color-warm-1`, `--color-warm-2`, `--color-warm-3` |
| Cool accents | `--color-cool-3`, `--color-cool-4`, `--color-cool-5` |
| Greys | `--color-dark-1` … `--color-dark-6`, `--color-light-1` … `--color-light-6` |
| Fonts | `--font-primary`, `--font-body`, `--font-sans`, `--font-h1`, `--font-size-13` through `--font-size-48` |
| Cursors (new in v14) | `--cursor-default`, `--cursor-pointer`, `--cursor-grab`, `--cursor-text` (+ `-down` variants) |

### Local Development

1. Create your module folder in Foundry's data path: `{userData}/Data/modules/my-module/`
2. Or symlink: `ln -s /path/to/your/dev/folder {userData}/Data/modules/my-module`
3. Launch Foundry, go to **Add-on Modules**, enable your module in a world
4. Open browser console (F12) to see logs and errors

---

## Namespaces (`foundry.*`)

Since v13 nearly every core API lives in the `foundry.*` namespace. The legacy globals still resolve through deprecation shims (removed in v15; the appv1 framework in v16). v14 already removed the v12-era shims: bare `mergeObject`, `getProperty`, `Die`, `DiceTerm`, `Math.clamped`, `CONST.DOCUMENT_TYPES` and friends are gone. Write namespaced paths in every new file and update old files when you touch them.

| Legacy global (v12 and earlier) | Namespaced path |
|---|---|
| `Application`, `FormApplication` | `foundry.appv1.api.Application` *(use V2 instead)* |
| `Dialog` | `foundry.appv1.api.Dialog` *(use `DialogV2`)* |
| `ApplicationV2` | `foundry.applications.api.ApplicationV2` |
| `HandlebarsApplicationMixin` | `foundry.applications.api.HandlebarsApplicationMixin` |
| `DialogV2` | `foundry.applications.api.DialogV2` |
| `DocumentSheetV2` | `foundry.applications.api.DocumentSheetV2` |
| `ActorSheetV2`, `ItemSheetV2` | `foundry.applications.sheets.ActorSheetV2` / `.ItemSheetV2` |
| `Hooks` | `foundry.helpers.Hooks` *(global `Hooks` still aliased)* |
| `Canvas`, `CanvasLayer` | `foundry.canvas.Canvas`, `foundry.canvas.layers.CanvasLayer` |
| `Token`, `Tile`, `Region` (objects) | `foundry.canvas.placeables.*` (`MeasuredTemplate` is deprecated since v14 — use `Region`) |
| `Document`, `DataModel`, `TypeDataModel` | `foundry.abstract.Document`, `foundry.abstract.DataModel`, `foundry.abstract.TypeDataModel` |
| `fields.*` (NumberField, etc.) | `foundry.data.fields.*` |
| `Roll`, `DiceTerm`, `Die` | `foundry.dice.Roll`, `foundry.dice.terms.Die` |
| `Actors`, `Items` (collections) | `foundry.documents.collections.Actors` / `.Items` |
| `loadTemplates`, `renderTemplate` | `foundry.applications.handlebars.loadTemplates` / `.renderTemplate` |
| (no legacy alias) | `foundry.applications.fields.*` — `createFormGroup`, `createSelectInput`, `createCheckboxInput`, `createNumberInput`, `createTextInput`, `createTextareaInput`, `createMultiSelectInput`, `createEditorInput`, `setInputAttributes` |
| (no legacy alias) | `foundry.applications.ux.*` — `Tabs`, `ContextMenu`, `DragDrop`, `Draggable`, `FormDataExtended`, `HTMLSecret`, `ProseMirrorEditor`, `SearchFilter`, `TextEditor` |
| `mergeObject`, `duplicate`, `debounce`, `isNewerVersion` | `foundry.utils.*` (bare globals removed in v14 — `mergeObject`, `deepClone`, `expandObject`, `flattenObject`, `getProperty`, `setProperty`, `hasProperty`, `diffObject`, `equals` (replaces `objectsEqual`), `getType`, `isEmpty`, `isNewerVersion`, `randomID`, `debounce`, `throttle`, `benchmark`, `parseUuid`, `buildUuid`, `buildRelativeUuid`, `escapeHTML`, `formatFileSize`, etc.) |
| (no legacy alias) | `foundry.data.operators.*` — `ForcedDeletion`, `ForcedReplacement` (globals `_del`, `_replace`) replace the `-=` / `==` update keys |

**Why bother updating?** The remaining shims are scheduled for removal in v15 (v16 for appv1). Code written against the namespaced paths is forward-compatible; code written against legacy globals is on borrowed time.

**Quick destructure pattern:**

```javascript
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const fields = foundry.data.fields;
```

Use these at the top of each file; the rest of the file then reads naturally.

---

## Document Model

Foundry's data layer is built on `DataModel` and `Document`. Modules extend it to create custom Actor types, Item types, or store structured data.

**Core pattern:** Define a schema with typed fields → register it on `CONFIG` during `init` → Foundry handles persistence, validation, and sync.

```javascript
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      health: new fields.NumberField({ required: true, initial: 100, min: 0 }),
      class: new fields.StringField({ required: true, initial: "fighter" }),
      abilities: new fields.SchemaField({
        strength: new fields.NumberField({ initial: 10 }),
        dexterity: new fields.NumberField({ initial: 10 }),
      }),
      inventory: new fields.ArrayField(new fields.StringField()),
    };
  }

  prepareDerivedData() {
    this.maxHealth = this.health + this.abilities.strength * 2;
  }
}

// Register in init hook
Hooks.once("init", () => {
  CONFIG.Actor.dataModels.hero = HeroData;
});
```

**Flags** are module-namespaced metadata on any document — safe, survives module uninstall:

```javascript
await actor.setFlag("my-module", "customData", { tracked: true });
const data = actor.getFlag("my-module", "customData");
await actor.unsetFlag("my-module", "customData");
```

**Changed in v14 — update operators.** The `"-=key": null` and `"==key": value` update syntax is deprecated (until v16). Use `foundry.data.operators` (globals `_del` and `_replace`):

```javascript
await actor.update({ "system.inventory": _del });                 // delete the key
await actor.update({ "system.abilities": _replace({ str: 12 }) }); // replace without merging
```

`ActiveEffect` is now a typed document (`type` + `system`, subtypes via `documentTypes.ActiveEffect`) whose `changes` live in `system.changes` — see the Active Effects section. `DataField#migrateSource` became `_migrate(value, options, _state)`, and `migrateData` must return the data.

For full field type reference, lifecycle hooks (`_preCreate`, `_onCreate`, `_preUpdate`, `_onUpdate`, `_preDelete`, `_onDelete`), embedded document management, `foundry.documents.modifyBatch()` for atomic multi-document writes, and flags vs model fields guidance, read `references/document-model.md`.

### Module Sub-Types

Modules can contribute custom Actor, Item, JournalEntryPage, and other document subtypes to **any** world running on **any** system. The official, supported extension mechanism since v11.

Three required pieces: declare under `documentTypes` in `module.json` (with `htmlFields` and `filePathFields`), register a `TypeDataModel` on `CONFIG.<Doc>.dataModels` with the auto-prefixed key (`my-module.vehicle`), and register a sheet for the prefixed type. Always provide a conversion path so users aren't stranded when they uninstall the module.

For declaration syntax, deactivation behavior, conversion macros, and pitfalls, read `references/module-subtypes.md`.

---

## Application Framework (v2)

All UI uses `ApplicationV2`. The legacy `Application` and `FormApplication` classes (`foundry.appv1`) are deprecated and scheduled for removal in v16.

**Standard pattern:** Extend `HandlebarsApplicationMixin(ApplicationV2)` for template-driven windows. For Actor/Item sheets, use `ActorSheetV2` / `ItemSheetV2` from `foundry.applications.sheets` — they extend `DocumentSheetV2` and add document-specific drag-drop and token management.

```javascript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class MySheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "my-sheet",
    classes: ["my-module"],
    window: { title: "My Sheet", resizable: true },
    position: { width: 500, height: 400 },
    actions: {
      rollDice: MySheet.#onRollDice,
    },
  };

  static PARTS = {
    main: { template: "modules/my-module/templates/sheet.hbs" },
  };

  async _prepareContext(options) {
    return { name: "Hello Foundry" };
  }

  static async #onRollDice(event, target) {
    const roll = new Roll("1d20");
    await roll.evaluate();
    await roll.toMessage({ flavor: "Ability Check" });
  }
}
```

**New in v14 — detached windows.** Every ApplicationV2 gets "Detach" / "Attach" header controls by default (`DEFAULT_OPTIONS.window.controls`). `app.detachWindow()` moves the app into its own browser window; `app.attachWindow()` brings it back; `app.renderChild(child)` renders another app inside the same window. Hooks `openDetachedWindow(id, win)` / `closeDetachedWindow(id, win)` fire on each transition. Custom elements that must survive a move between documents should extend `foundry.applications.elements.AdoptableHTMLElement`.

**New in v14 — render hooks and frame buttons.** `_preRender(context, options)` runs after `_prepareContext` and before the frame and parts render; it fires the `preRender<ClassName>` hook for each class in the chain. `_getFrameButtons(options)` returns extra header buttons (`{ icon, label, action, visible? }`, same shape as header controls, which now use `label`/`visible`/`onClick` — `name`/`condition`/`callback` are deprecated). `DialogV2.wait({ renderOptions })` forwards options to the dialog's render call.

For `DocumentSheetV2`, `DialogV2`, the parts system, action handlers, and form submission, read `references/application-v2.md`. For drag-drop deep dives, async/race patterns, and debounce strategies, read the same file's "Drag & Drop Deep Dive" and "Async Patterns" sections.

For Foundry's custom Handlebars helpers (`{{localize}}`, `{{selectOptions}}`, `{{formInput}}`, `{{formGroup}}`, `{{editor}}`, etc. — `{{select}}` and `{{colorPicker}}` were removed in v14), custom HTML elements (`<prose-mirror>`, `<file-picker>`, `<color-picker>`, `<string-tags>`, and v14's `<formula-input>` and `<autocomplete-tags>`) and when to prefer them over helpers, custom helper/partial registration, template preloading, and common sheet patterns, read `references/handlebars-and-templates.md`. Rich text is ProseMirror only — TinyMCE and `CONFIG.TinyMCE` are gone.

Sheets and dialogs are HTML — give them ARIA roles, keyboard support, focus management, and `prefers-reduced-motion` handling. Read `references/accessibility.md`.

---

## Hooks & Settings

**Hooks** are Foundry's event system. **Settings** store module configuration per-world or per-client.

```javascript
// Document lifecycle hooks — fire for every Actor/Item/etc CRUD operation
Hooks.on("createActor", (actor, options, userId) => {
  console.log(`Actor ${actor.name} created by user ${userId}`);
});

Hooks.on("preUpdateItem", (item, changes, options, userId) => {
  // Return false to cancel the update
  if (changes.name === "forbidden") return false;
});

// Settings — register in init, use anywhere after
Hooks.once("init", () => {
  game.settings.register("my-module", "difficulty", {
    name: "Difficulty Level",
    hint: "Adjusts the challenge rating of encounters.",
    scope: "world",       // GM-set, all players see same value
    config: true,         // show in settings menu
    type: String,
    choices: { easy: "Easy", normal: "Normal", hard: "Hard" },
    default: "normal",
    onChange: (value) => console.log("Difficulty changed to", value),
  });
});

// Read a setting
const diff = game.settings.get("my-module", "difficulty");
```

**New hooks in v14:** `preRender<App>(app, context, options)`, `openDetachedWindow` / `closeDetachedWindow(id, win)`, `get<DocumentName>PlaceableContextOptions(app, menuItems)` for the Placeables sidebar tab, `dropItemSheetData(item, sheet, data)`, `planToken(document)`. No hook was removed; `renderChatMessage` (jQuery) is still deprecated in favour of `renderChatMessageHTML(message, html, context)` and goes away in v15.

**Changed in v14 — core settings:** `core.rollMode` is a deprecated shim; read `game.settings.get("core", "messageMode")` (`public | gm | blind | self | ic`). `core.gridTemplates` and `core.coneTemplateType` are deprecated with MeasuredTemplates.

For the complete hook lifecycle, document hook naming, canvas hooks, `Hooks.callAll` vs `Hooks.call`, settings submenus, and `scope: "world"` vs `scope: "client"`, read `references/hooks-and-settings.md`.

---

## Advanced Patterns

### Sockets (GM-Authoritative)

Non-GM clients cannot modify world documents directly. The pattern: client emits a request → GM client intercepts and executes the mutation → broadcasts the result.

```javascript
// Requires "socket": true in module.json
const SOCKET_NAME = "module.my-module";

// GM listens and executes
Hooks.once("ready", () => {
  game.socket.on(SOCKET_NAME, async (data) => {
    if (!game.user.isGM) return;
    if (data.type === "updateActor") {
      const actor = game.actors.get(data.actorId);
      await actor.update(data.changes);
    }
  });
});

// Any client requests
function requestActorUpdate(actorId, changes) {
  if (game.user.isGM) {
    return game.actors.get(actorId).update(changes);
  }
  game.socket.emit(SOCKET_NAME, { type: "updateActor", actorId, changes });
}
```

### Dice Rolls

```javascript
const roll = new Roll("2d6 + @mod", { mod: 3 });
await roll.evaluate();       // ALWAYS await — roll() is only an async alias of evaluate()
await roll.toMessage({ flavor: "Damage Roll" });
console.log(roll.total);     // e.g. 11

// Visibility: pass a messageMode (a key of CONFIG.ChatMessage.modes)
await roll.toMessage({ flavor: "Secret" }, { messageMode: "gm" });
await roll.toMessage({ flavor: "Uses the chat dropdown" },
  { messageMode: game.settings.get("core", "messageMode") });

// Use getRollData() on actors to expose system data to roll formulas
const rollData = actor.getRollData(); // { abilities: { str: 16, ... }, health: 50, ... }
const abilityRoll = new Roll("1d20 + @abilities.str", rollData);
```

**Changed in v14 — roll modes are message modes.** `rollMode` (`publicroll`, `gmroll`, `blindroll`, `selfroll`) is deprecated on `Roll#toMessage`, `ChatMessage.create`, `RollTable#draw`, and `Combat#rollInitiative`. Use `messageMode` with `public | gm | blind | self | ic`; `CONFIG.Dice.rollModes` → `CONFIG.ChatMessage.modes`; `ChatMessage#applyRollMode` → `applyMode`. Convert old values with `Roll._mapLegacyRollMode(rollMode)`. Chat commands are registered in `ChatLog.CHAT_COMMANDS` (`MESSAGE_PATTERNS` is deprecated).

### Compendium Packs

```javascript
const pack = game.packs.get("my-module.monsters");
const docs = await pack.getDocuments();
const dragon = await pack.getDocument("some-id");
await game.actors.importFromCompendium(pack, "some-id");
```

### Localization

```javascript
// lang/en.json: { "MY_MODULE.greeting": "Hello, {name}!" }
game.i18n.localize("MY_MODULE.greeting");              // "Hello, {name}!"
game.i18n.format("MY_MODULE.greeting", { name: "GM" }); // "Hello, GM!"
```

v14 adds a `_loc` global bound to `game.i18n.localize`, and `localize(id, data)` now formats placeholders too. `game.i18n.localize` is not deprecated — `_loc` is a shorthand.

For full socket patterns, custom DiceTerm, Roll.RESOLVERS, compendium querying, `fromUuid()`, and localization setup, read `references/sockets-rolls-packs.md`.

---

## Canvas Extensions

Extend the Foundry canvas with custom layers and placeable objects using PIXI.js:

```javascript
const { CanvasLayer } = foundry.canvas.layers;

class MyLayer extends CanvasLayer {
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, { name: "myLayer" });
  }

  async _draw(options) {
    // Add PIXI children here
  }

  async _tearDown(options) {
    this.removeChildren().forEach(c => c.destroy());
  }
}

// Register in init
Hooks.once("init", () => {
  CONFIG.Canvas.layers.myLayer = { layerClass: MyLayer, group: "primary" };
});
```

`CONFIG.Canvas.layers` is the only place to swap a layer class. `CONFIG.<Doc>.layerClass` (`CONFIG.Token.layerClass`, …) is a deprecated proxy since v14 — write `CONFIG.Canvas.layers.tokens.layerClass = MyTokenLayer` instead.

**Scene Levels (new in v14).** A Scene holds an embedded collection of `Level` documents (`scene.levels`, `scene.initialLevel`, `canvas.level` for the viewed one). Background, foreground, and fog textures moved from the Scene to the Level (`level.background.src`, `level.foreground.src`, `level.elevation.{bottom,top}`); `scene.background`, `scene.foreground`, `scene.foregroundElevation`, and `scene.backgroundColor` are deprecated getters. Every placeable document has a `levels` set; tokens have `level` and `depth`. Iterate `layer.viewedDocuments()` (Level-aware) instead of the deprecated `getDocuments()`. Read `references/scene-levels.md`.

**Regions are the templates now.** `MeasuredTemplateDocument`, `TemplateLayer`, and `Scene#templates` are deprecated (until v16); `RegionDocument#shapes` accepts `circle`, `cone`, `ellipse`, `emanation`, `grid`, `line`, `polygon`, `rectangle`, `ring`, and `token` shapes. Interactive placement is `canvas.regions.placeRegion(data, { create })`, toggled by `canvas.regions.templateMode`:

```javascript
const region = await canvas.regions.placeRegion({
  name: "Fireball",
  shapes: [{ type: "circle", x: 0, y: 0, radius: canvas.dimensions.distancePixels * 20 }],
  levels: [canvas.level.id],
  displayMeasurements: true,
});
```

`RegionDocument.createTokenEmanation(token, range, regionData)` builds an aura attached to a token (`attachment.token`); `region.spawnTokens()` / `region.teleportTokens()` move tokens into a region. Read `references/measured-templates.md` ("Templates with Regions") and `references/regions-and-grid.md`.

**Placeables sidebar and palettes.** v14 adds a Placeables sidebar tab (`ui.placeables`, `foundry.applications.sidebar.tabs.PlaceableDirectory`) with one tab per document type (`CONFIG.<Doc>.sidebar = { applicationClass, order }`) and the hook `get<DocumentName>PlaceableContextOptions`. Placeable configs extend `foundry.applications.sheets.PlaceableConfig`.

**VFX (experimental).** `foundry.canvas.vfx` ships `VFXEffect` and components; it is off until `CONFIG.Canvas.vfx.enabled = true` and the API may still change. `foundry.canvas.animation.ParticleGenerator` replaces `ParticleEffect` / `PrimaryParticleEffect` (deprecated until v16), `CanvasShakeEffect` shakes the screen, and `Scene#transition` drives scene transitions (`CONFIG.Canvas.sceneTransitions`).

Most modules never need canvas extensions. For custom layers, `PlaceableObject` subclasses, coordinate conversion, `CanvasAnimation.animate()`, and PIXI performance tips, read `references/canvas-and-pixi.md`.

### Bundled JS Libraries

Foundry ships these libraries pre-loaded — no install, no import:

| Library | Global | Purpose | Read |
|---|---|---|---|
| **Handlebars** | `Handlebars` | HTML templating for sheets/dialogs/chat | `references/handlebars-and-templates.md` |
| **PixiJS** | `PIXI` | WebGL canvas rendering — the engine behind tokens, lighting, scenes (pinned 7.4.3) | `references/canvas-and-pixi.md` |
| **anime.js** (new in v14) | `animejs` | Tween/timeline animation library, `animejs ^4.3.6` exposed as `globalThis.animejs` | — |
| **GSAP (GreenSock)** | `gsap` | Orchestrated UI/canvas animations beyond CSS or `CanvasAnimation` | `references/canvas-and-pixi.md` "GSAP" section |
| **jQuery** | `$`, `jQuery` | Still bundled (`^3.7.1`) for appv1 and the legacy `renderChatMessage` hook only. Legacy — use native DOM APIs | `references/migration-guide.md` |

Use them when they fit; reach for npm dependencies only when none of these cover the case.

---

## Developer Tooling & Ecosystem

### Official CLI (`@foundryvtt/foundryvtt-cli`)

```bash
npm install -g @foundryvtt/foundryvtt-cli
```

The official CLI (`fvtt` command) handles compendium management — extracting LevelDB packs into individual JSON/YAML files and repackaging them. Essential for version-controlling compendium content.

```bash
fvtt package workon my-module          # set active package context
fvtt package extract --type Module     # extract compendium to JSON files
fvtt package pack --type Module        # repackage JSON back to LevelDB
```

### TypeScript (`@league-of-foundry-developers/foundry-vtt-types`)

Community-maintained type definitions for the entire Foundry VTT API. Provides typed `game`, `CONFIG`, `Hooks`, and all core classes.

```bash
npm add -D fvtt-types@github:League-of-Foundry-Developers/foundry-vtt-types#main
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["fvtt-types"],
    "target": "esnext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

Check the repo for v14 support before you depend on the types — the v14 schema changes (ActiveEffect `system.changes`, Scene Levels, Regions shapes, `messageMode`) may lag behind core. Where the types are missing, cast and move on.

### Runtime: Node 24

The v14 server requires Node `>=24.13.1 <25.0.0` (v13 needed Node 20–22; the two are mutually exclusive). Run the same Node for your build tooling so local dev, CI, and the Foundry host match.

### Build Tools (Vite / Rollup)

Foundry modules are standard web apps — use Vite (recommended) or Rollup for TypeScript compilation, SCSS, npm dependencies, and bundling. Source lives in `src/`, output ships from `dist/`, and `dist/` is symlinked into Foundry's `Data/modules/<id>/`.

The single Foundry-specific constraint: **no asset hashing**. Foundry references files by the fixed paths in `module.json`, so `[hash]` in any output filename breaks the manifest. Disable hashing on JS, CSS, and copied assets.

The `boilerplate/` ships ready-to-use [vite.config.mjs](boilerplate/vite.config.mjs), [rollup.config.mjs](boilerplate/rollup.config.mjs), and [package.json](boilerplate/package.json) configured for Foundry — dev proxy to port 30000, fixed-name output, copy plugin for templates/lang/manifest, source maps, watch mode.

For the full guide (project layout, dev loop, `flags.hotReload` integration, production build, pre-build manifest injection, and pitfalls), read `references/build-pipeline.md`.

### Reactive Frameworks (Svelte / Lit)

ApplicationV2 makes it trivial to mount reactive frameworks instead of Handlebars — Svelte is the community favorite for complex module UIs due to its lack of virtual DOM overhead. Override `_renderHTML()` to mount your framework, override `_onClose()` to tear it down.

### Module Template

The League of Foundry Developers maintains a starter template with Vite, TypeScript, and ESM pre-configured: `League-of-Foundry-Developers/FoundryVTT-Module-Template` on GitHub.

### Publishing to Foundry

Submit modules at https://foundryvtt.com/packages/submit. The manifest and download URLs must follow this pattern for GitHub Releases:

```
manifest:  https://github.com/you/my-module/releases/latest/download/module.json
download:  https://github.com/you/my-module/releases/download/v1.0.0/module.zip
```

The `manifest` URL always points to `latest` so Foundry auto-detects updates. The `download` URL is versioned — Foundry uses it to install a specific release.

Minimal GitHub Actions workflow for automated releases:

```yaml
name: Release
on:
  push:
    tags: ["v*"]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: zip -r module.zip module.json scripts/ templates/ styles/ lang/ packs/
      - uses: softprops/action-gh-release@v2
        with:
          files: module.zip
          generate_release_notes: true
```

Tag a release with `git tag v1.0.0 && git push --tags` to trigger the workflow. Update `module.json` version before tagging.

### Tours API

Guided interactive tours that highlight UI elements and walk users through features step by step. Tours are defined in JSON files and registered via `game.tours.register()`.

Create a tour JSON file at `modules/my-module/tours/welcome.json`:

```json
{
  "title": "MY_MODULE.Tour.welcome.title",
  "description": "MY_MODULE.Tour.welcome.description",
  "canBeResumed": false,
  "display": true,
  "steps": [
    {
      "id": "step1",
      "title": "MY_MODULE.Tour.welcome.step1",
      "content": "MY_MODULE.Tour.welcome.step1Content",
      "selector": ".my-module-panel .header"
    },
    {
      "id": "step2",
      "title": "MY_MODULE.Tour.welcome.step2",
      "content": "MY_MODULE.Tour.welcome.step2Content",
      "selector": ".my-module-panel button[data-action='roll']"
    },
    {
      "id": "step3",
      "title": "MY_MODULE.Tour.welcome.step3",
      "content": "MY_MODULE.Tour.welcome.step3Content",
      "selector": ".my-module-panel .inventory"
    }
  ]
}
```

Register in the `setup` hook:

```js
Hooks.once("setup", async () => {
  game.tours.register(
    "my-module",
    "welcome",
    await foundry.nue.Tour.fromJSON("/modules/my-module/tours/welcome.json")
  );
});

// Start programmatically (e.g., on first module load)
Hooks.once("ready", async () => {
  if (!game.settings.get("my-module", "tourCompleted")) {
    await game.tours.get("my-module.welcome").start();
    await game.settings.set("my-module", "tourCompleted", true);
  }
});
```

Each step highlights a DOM element via `selector`. The `sidebarTab` field (optional) auto-switches to a sidebar tab before the step. Steps can define `tooltipDirection` (`UP`, `DOWN`, `LEFT`, `RIGHT`) for tooltip placement.

### Testing (`@ethaks/fvtt-quench`)

In-game testing framework using Mocha/Chai that runs inside the Foundry environment — necessary because Foundry's APIs require an initialized game state. Register batches in the `quenchReady` hook; lazy-import test files only when Quench is active so they don't bloat production bundles. For batch registration patterns, document/sheet/hook/roll test recipes, and a CI strategy that splits Quench (manual) from pure-helper unit tests (Vitest in GitHub Actions), read `references/testing-with-quench.md`.

### Community Libraries

| Library | Purpose | When to use |
|---|---|---|
| **libWrapper** | Safe monkey-patching of core Foundry methods | Modifying core behavior (e.g., `Token.prototype.draw`). Prevents conflicts between modules |
| **socketlib** | Simplified cross-client communication | Easier alternative to raw `game.socket` — supports `await`ing GM responses from player clients |
| **Developer Mode** | Unified debug flags per module | Structured logging that can be toggled per-module in a UI |

### Module API Pattern

Expose a public API so other modules can interact with yours:

```javascript
Hooks.once("init", () => {
  game.modules.get("my-module").api = {
    getHeroData: (actorId) => game.actors.get(actorId)?.system,
    rollAbility: async (actorId, ability) => { /* ... */ },
  };
});
```

Other modules access it via `game.modules.get("my-module")?.api?.getHeroData(id)`.

### Debugging

- **Browser DevTools (F12)** — primary debugging tool
- **`CONFIG.debug.hooks = true`** — logs every hook call to console
- **`ui.notifications.info/warn/error()`** — in-game feedback for testing
- **Developer Mode module** — per-module debug flag toggling

---

## Active Effects

`ActiveEffect` is Foundry's system for temporary modifications to document data — buffs, debuffs, conditions, status effects. They live as embedded documents on Actors and Items.

**Changed in v14 — ActiveEffect V2.** `ActiveEffect` is a typed document. Changes moved from the root `changes` array into `system.changes`, defined by `foundry.data.ActiveEffectTypeDataModel`. Each change is `{ key, type, value, phase, priority }`:

```javascript
await actor.createEmbeddedDocuments("ActiveEffect", [{
  name: "Blessed",
  img: "icons/svg/angel.svg",
  type: "base",
  system: {
    changes: [{ key: "system.abilities.str", type: "add", value: 2, phase: "initial" }]
  },
  duration: { value: 10, units: "rounds", expiry: "turnStart" }
}]);

// Toggle an effect
const effect = Array.from(actor.allApplicableEffects()).find(e => e.name === "Blessed");
await effect.update({ disabled: !effect.disabled });
```

| Field | v13 | v14 |
|---|---|---|
| Changes | `changes: [...]` at the root | `system.changes: [...]` |
| Change operation | numeric `mode` (`CONST.ACTIVE_EFFECT_MODES`) | string `type` (`CONST.ACTIVE_EFFECT_CHANGE_TYPES`) |
| Icon | `icon` | `img` |
| Duration | `{ rounds, turns, seconds, startTime, startRound }` | `{ value, units, expiry, expired }` plus a separate `start` schema |
| Origin | `StringField` | `DocumentUUIDField({ relative: true })` |
| Icon display | `overlay` boolean | `showIcon` (`CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER \| CONDITIONAL \| ALWAYS`) |

`migrateData` converts old documents on load, so v13 data keeps working — but write the new shape.

**Change types** (`CONST.ACTIVE_EFFECT_CHANGE_TYPES`, listed with their default priority): `custom` (0), `multiply` (10), `add` (20), `subtract` (20), `downgrade` (30), `upgrade` (40), `override` (50). `add` and `subtract` also concatenate strings and push to / splice from Arrays and Sets. Packages register their own types in `CONFIG.ActiveEffect.changeTypes` (`{ label, defaultPriority, handler, render }`) and their own arbitrary `type` strings; anything unrecognised is ignored.

**Phases.** `CONST.ACTIVE_EFFECT_CHANGE_PHASES` is `["initial", "final"]`. Core calls `actor.applyActiveEffects("initial")` before derived data and `applyActiveEffects("final")` after. Register extra phases in `CONFIG.ActiveEffect.phases` and call `applyActiveEffects("myPhase")` yourself — nothing else will.

**Duration and expiry.** `duration.units` is one of `CONST.ACTIVE_EFFECT_DURATION_UNITS` (`years`, `months`, `days`, `hours`, `minutes`, `seconds`, `rounds`, `turns`). `duration.expiry` is one of `CONST.ACTIVE_EFFECT_EXPIRY_EVENTS` (`combatStart`, `roundStart`, `turnStart`, `combatEnd`, `roundEnd`, `turnEnd`) or a key you added to `CONFIG.ActiveEffect.expiryEvents`. `ActiveEffect.registry` tracks pending expirations; `CONFIG.ActiveEffect.expiryAction` (`"update"` by default) decides whether expiry sets `duration.expired` or deletes the effect. Custom expiry events fire through `ActiveEffect.registry.refresh()`.

To change how a change type applies, override the statics `_applyChangeUnguided`, `_applyChangeAdd`, `_applyChangeSubtract`, `_applyChangeMultiply`, `_applyChangeOverride`, `_applyChangeUpgrade`, `_applyChangeCustom` on your `ActiveEffect` subclass. The old instance methods (`apply`, `_applyAdd`, …) are deprecated until v16.

`CONFIG.ActiveEffect.legacyTransferral` is gone — item effects always live on the item and are read through `allApplicableEffects()`.

For subtypes, the registry, compendium-stored effects, and the full change pipeline, read `references/active-effects-v2.md`.

### Global Status Effects

`CONFIG.statusEffects` is a Proxy indexed by status id. Assign by id:

```js
Hooks.once("init", () => {
  CONFIG.statusEffects["my-module.burning"] = {
    id: "my-module.burning",
    name: "MY_MODULE.Effect.burning",
    img: "modules/my-module/icons/burning.svg",
    system: {
      changes: [{ key: "system.abilities.dex", type: "subtract", value: 2 }]
    }
  };
});
```

`push()` still works, but assign by id — it replaces an existing entry cleanly. Systems that replace the whole palette may still assign an array.

### Retrieving all effects

`actor.effects` only contains effects directly on the actor. Effects transferred from Items require `allApplicableEffects()`:

```js
for (const effect of actor.allApplicableEffects()) {
  console.log(effect.name, effect.disabled, effect.isTemporary);
}

// Categorize for sheet display
function prepareActiveEffectCategories(effects) {
  const categories = {
    temporary: { label: "Temporary", effects: [] },
    passive:   { label: "Passive", effects: [] },
    inactive:  { label: "Inactive", effects: [] }
  };
  for (const e of effects) {
    if (e.disabled) categories.inactive.effects.push(e);
    else if (e.isTemporary) categories.temporary.effects.push(e);
    else categories.passive.effects.push(e);
  }
  return categories;
}

// Usage in _prepareContext
context.effects = prepareActiveEffectCategories(actor.allApplicableEffects());
```

Key properties: `e.disabled` (inactive), `e.isTemporary` (true when `duration.expiry` is set or `duration.value` is finite — v14 widened this), `e.showIcon` (token icon display).

---

## Adventure Documents

`Adventure` is Foundry's official document type for shipping pre-made content — campaign modules, one-shots, encounter packs. One Adventure aggregates scenes, actors, items, journals, tables, macros, playlists, cards, and the folder hierarchy that organizes them. Users import everything in one click.

```javascript
// Programmatic import (selective)
const pack = game.packs.get("my-module.starter-adventure");
const adventure = await pack.getDocument("adventureDocId");

// Preview before committing
const data = await adventure.prepareImport();

// Import — all collections by default, opt out per collection
await adventure.import({ scenes: false });
```

Declare the pack in `module.json` with `type: "Adventure"`. Author the content in a world, build with `fvtt package pack`, and ship in `packs/`. For re-imports to update cleanly, use stable IDs everywhere.

For authoring flow, programmatic import, version updates, the `preImportAdventure` hook, and pitfalls (duplicate IDs, scene thumbnails, macro permissions, playlist paths), read `references/adventure-documents.md`.

---

## Permissions & Ownership

Foundry's permission model has two independent dimensions: a user's **role** (game-wide capability — `USER_ROLES.PLAYER` through `GAMEMASTER`) and a document's **ownership** (per-document access — `OWNERSHIP_LEVELS.NONE` through `OWNER`). A modification is allowed only if both check pass.

```javascript
// UI-level check (gate a button)
if (actor.canUserModify(game.user, "update")) { /* show edit UI */ }
if (actor.testUserPermission(game.user, "OBSERVER")) { /* show sheet */ }

// Granular permission (GM-configurable thresholds per role)
if (game.user.hasPermission("ACTOR_CREATE")) { /* show "New" button */ }

// Set ownership programmatically
await actor.update({ "ownership.default": 2, [`ownership.${player.id}`]: 3 });
```

Embedded documents default to `ownership: { default: -1 }` (INHERIT from parent). Players can't modify world documents they don't own — use the GM-authoritative socket pattern for player-initiated changes. Client-side checks are UX; server enforces independently.

For role hierarchy, granular `USER_PERMISSIONS`, ownership inheritance, the GM-authoritative pattern, compendium pack ownership, and silent-failure pitfalls, read `references/permissions-and-ownership.md`.

---

## Migration & Maintenance

When updating a module across Foundry versions or changing your data schema, run migrations on world load:

```javascript
const MIGRATIONS = [
  { version: 1, fn: migrateV1 },
  { version: 2, fn: migrateV2 },
];

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const current = game.settings.get("my-module", "schemaVersion") ?? 0;
  const target = MIGRATIONS[MIGRATIONS.length - 1].version;
  if (current >= target) return;

  for (const { version, fn } of MIGRATIONS) {
    if (current < version) await fn();
  }
  await game.settings.set("my-module", "schemaVersion", target);
  ui.notifications.info("my-module | Migration complete.");
});
```

**Migrating a v13 module to v14?** Start with `references/v14-migration.md` — it lists every breaking change, each deprecation with its replacement and removal version, and a checklist. The big ones: ActiveEffect changes moved to `system.changes` with string types, MeasuredTemplate became Regions, Scene background/foreground moved to Level documents, `rollMode` became `messageMode`, `-=`/`==` update keys became `_del`/`_replace`, and the v12 global shims are gone.

For older version jumps (Application→ApplicationV2, sync roll removal), data migration patterns, compatibility flags, bulk migration with `migrateWorld`, and the full migration registry pattern, read `references/migration-guide.md`.

---

## Boilerplate Files

Copy these as starting points for new modules:

| File | Purpose |
|---|---|
| `boilerplate/module.json` | Valid v14 manifest — `compatibility` 14, `styles` objects, `documentTypes` |
| `boilerplate/main.mjs` | ES module entry with init/setup/ready + settings + sheet registration |
| `boilerplate/type-data-model.mjs` | Custom Actor type with TypeDataModel + defineSchema |
| `boilerplate/actor-sheet.mjs` | ActorSheetV2 + HandlebarsApplicationMixin |
| `boilerplate/sheet.hbs` | Handlebars template with character info, abilities, and inventory |
| `boilerplate/socket-handler.mjs` | GM-authoritative socket pattern |
| `boilerplate/vite.config.mjs` | Vite config — dev proxy, fixed-name output, static copy plugin |
| `boilerplate/rollup.config.mjs` | Rollup alternative — node-resolve, commonjs, postcss, copy, terser |
| `boilerplate/package.json` | Scripts (`dev`, `build`, `link`), devDependencies, and the Node 24 `engines` pin |

---

## Common Pitfalls

1. **Using deprecated v1 classes** — `Application`, `FormApplication`, `ActorSheet`, `ItemSheet` live under `foundry.appv1` and go away in v16. Use `ApplicationV2`, `DocumentSheetV2`.
2. **Forgetting to await a roll** — `roll.roll()` is only an async alias of `evaluate()`. Always `await roll.evaluate()`. `Roll.evaluateSync()` exists only for deterministic rolls (`maximize`/`minimize`).
3. **Missing socket prefix** — Socket events must use `"module.my-module"` format. Without the `module.` prefix, messages won't route.
4. **Accessing game.user in init** — `game.user` is not set during `init`. Use `ready` hook for user-dependent logic.
5. **Non-GM modifying world documents** — Only GM clients can modify world-level documents. The update returns successfully but doesn't persist. Use `document.canUserModify(user, "update")` before attempting, and route player-initiated changes through the GM-authoritative socket pattern. See `references/permissions-and-ownership.md`.
6. **Using `scripts` instead of `esmodules`** — The `scripts` field loads files as classic scripts (no module scope). Always use `esmodules` for proper ES module support. There is no separate `worldScripts` field — the concept is a community misnomer. All module scripts run client-side via `esmodules`/`scripts` in your manifest. Use hooks (`init`, `setup`, `ready`) with conditional checks to control when and where your code executes.
7. **Forgetting `config: false` for internal settings** — Settings with `config: true` show in the module settings menu. Use `config: false` for programmatic-only values like schema versions.
8. **Hardcoded English strings** — Use `game.i18n.localize()` for any user-visible text, even if you only support English. It makes future localization trivial.
9. **Not cleaning up hooks** — Store the hook ID from `Hooks.on()` and call `Hooks.off()` when your application closes. Leaked hooks cause memory issues and duplicate behavior.
10. **Setting `compatibility.maximum` too aggressively** — Prevents users from running your module on newer Foundry versions. Only set it if you've confirmed a breaking incompatibility.
11. **Running side effects on all clients in lifecycle hooks** — `_onCreate`, `_onUpdate`, `_onDelete` fire on every connected client. Guard with `if (game.userId !== userId) return;` to run side effects only on the originating client.
12. **Patching core methods without libWrapper** — Direct monkey-patching breaks when multiple modules modify the same method. Use `libWrapper` for safe, conflict-free patching of core Foundry functions.
13. **Missing `getRollData()` on custom Actor types** — Without implementing `getRollData()`, roll formulas like `@abilities.str` won't resolve. Return the system data your rolls need.
14. **Using jQuery** — jQuery is still bundled for appv1 and the legacy `renderChatMessage` hook, but hooks and `_onRender` pass native `HTMLElement`. Use `querySelector`, `addEventListener`, `classList` instead of `$()`.
15. **CSS without `@layer`, or in a made-up layer** — Foundry uses CSS Cascade Layers. Name `modules` in the manifest: `styles: [{ "src": "...", "layer": "modules" }]`. A layer name core never declares sorts after `exceptions` and overrides all core CSS.
16. **Passing `rollMode` (v14)** — `rollMode` is deprecated on `toMessage`, `ChatMessage.create`, `RollTable#draw`, and `rollInitiative`. Pass `messageMode` (`public | gm | blind | self | ic`), or pass nothing: `toMessage` falls back to the `core.messageMode` setting on its own.
17. **Numeric ActiveEffect change modes (v14)** — `CONST.ACTIVE_EFFECT_MODES` and the root `changes` array are deprecated. Write `system.changes` with string `type` values (`add`, `subtract`, `multiply`, `override`, `upgrade`, `downgrade`, `custom`).
18. **`-=` and `==` update keys (v14)** — deprecated until v16. Use `_del` and `_replace(value)` from `foundry.data.operators`, or `mergeObject(..., { applyOperators: true })`.
19. **Building MeasuredTemplates (v14)** — `MeasuredTemplateDocument`, `TemplateLayer`, and `Scene#templates` are deprecated. Place a Region instead: `canvas.regions.placeRegion({ shapes: [...] })`. See `references/measured-templates.md`.
20. **Reading `scene.background` (v14)** — background, foreground, and their elevation moved onto `Level` documents. Read `canvas.level` / `scene.levels`; the Scene getters are deprecated shims. See `references/scene-levels.md`.
21. **Setting `CONFIG.<Doc>.layerClass` (v14)** — a deprecated proxy. Assign `CONFIG.Canvas.layers.<name>.layerClass` instead.
22. **Opening a bundled `.html` file in a browser (since 14.361)** — static `.html` is served as `text/plain`. Handlebars templates still render through Foundry; only direct browsing broke.
23. **Shipping `template.json` (v14)** — deprecated until v16. Declare types with `documentTypes` in the manifest and a `TypeDataModel`. `game.template` is gone; read `game.model`.

---

## Reference Files

Read these for deep API details — they're loaded on demand:

| File | When to read |
|---|---|
| `references/v14-migration.md` | **Start here when moving a module from v13 to v14** — breaking changes, deprecations with removal versions, checklist |
| `references/document-model.md` | Building custom Actor/Item types, TypeDataModel, defineSchema, flags, lifecycle hooks, Journal Pages, Folder API |
| `references/application-v2.md` | Building sheets, windows, dialogs — ApplicationV2, DocumentSheetV2, HandlebarsApplicationMixin, drag & drop |
| `references/hooks-and-settings.md` | Hook lifecycle, document hooks, canvas hooks, settings API, submenus, keybindings, DataModel settings |
| `references/chat-and-ui.md` | Chat commands, message rendering, context menus, enrichHTML, FilePicker, security/authorization, ProseMirror editor |
| `references/sockets-rolls-packs.md` | Socket communication, dice/Roll extensions, compendium packs, localization |
| `references/canvas-and-pixi.md` | Custom canvas layers, PlaceableObject, PIXI.js integration, coordinate conversion |
| `references/combat-and-tokens.md` | Combat tracker, initiative, Token HUD, scene controls, prototype token configuration |
| `references/regions-and-grid.md` | Scene Regions API, RegionDocument, RegionBehavior, Grid measurement, coordinate conversion, grid highlighting |
| `references/scene-levels.md` | Level documents, `canvas.level`, per-level backgrounds and fog, level-aware placeables |
| `references/active-effects-v2.md` | ActiveEffect V2 — `system.changes`, change types and phases, duration and expiry, the registry, effect subtypes |
| `references/vision-and-lighting.md` | VisionMode, detection modes, lighting system, AmbientLight, fog of war |
| `references/measured-templates.md` | Templates with Regions — area-of-effect shapes, `placeRegion`, token emanations, migrating off MeasuredTemplate |
| `references/audio-and-macros.md` | AudioHelper, playlists, sound effects, Macro creation, hotbar integration |
| `references/module-subtypes.md` | Module-contributed Actor/Item/JournalEntryPage subtypes, htmlFields/filePathFields, deactivation behavior |
| `references/accessibility.md` | ARIA roles, keyboard navigation, focus management, color contrast, prefers-reduced-motion |
| `references/testing-with-quench.md` | Writing in-game tests with Quench (Mocha/Chai), test patterns, CI strategy |
| `references/build-pipeline.md` | Vite & Rollup setup, dev proxy, hot reload, asset paths, pre-build manifest injection |
| `references/handlebars-and-templates.md` | Foundry helper inventory, custom HTML elements, form helpers, custom helpers/partials, template preloading, sheet patterns |
| `references/adventure-documents.md` | Adventure document, packing scenes/actors/items/journals, programmatic import, version updates |
| `references/permissions-and-ownership.md` | User roles vs document ownership, testUserPermission, canUserModify, USER_PERMISSIONS, GM-authoritative pattern |
| `references/migration-guide.md` | Older version migrations (v11→v12→v13), deprecated API detection, data migration scripts |
