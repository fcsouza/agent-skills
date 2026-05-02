---
name: foundry-vtt-module-dev
version: 3.0.0
description: >-
  Covers building, extending, debugging, and maintaining Foundry VTT modules for v13+. This skill
  applies when scaffolding a new module, writing custom Actor/Item types with TypeDataModel, building
  ApplicationV2 sheets or dialogs, registering hooks or settings, implementing socket communication,
  extending the canvas with PIXI.js, managing compendium packs, using ActiveEffects, setting up
  TypeScript with fvtt-types, configuring Vite/Rollup builds, localizing strings, or migrating modules
  between Foundry versions. Triggers on: "Foundry module", "FVTT", "FoundryVTT", "foundryvtt module",
  "ApplicationV2", "TypeDataModel", "actor sheet", "module.json", "fvtt-types", "libWrapper",
  "socketlib", or any task involving Foundry VTT module development.
---

# Foundry VTT Module Development

Build, extend, and maintain modules for Foundry Virtual Tabletop (v13+). This skill covers the full module lifecycle — from scaffolding a new module to migrating between Foundry versions.

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

Every module needs a valid `module.json`. The critical v13 fields:

```json
{
  "id": "my-module",
  "title": "My Module",
  "description": "What this module does.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "13",
    "verified": "13"
  },
  "documentTypes": { "Actor": { "hero": {} } },
  "authors": [{ "name": "Your Name", "url": "https://github.com/you" }],
  "esmodules": ["scripts/main.mjs"],
  "styles": ["styles/my-module.css"],
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
| `id` | Unique lowercase identifier — must match folder name |
| `compatibility` | `minimum` (won't load below), `verified` (tested on). Omit `maximum` unless a confirmed break exists |
| `documentTypes` | Declares custom Actor/Item subtypes your module registers (v13+). Keys must match `CONFIG.Actor.dataModels` keys |
| `esmodules` | ES module entry points — always prefer over legacy `scripts` |
| `socket` | Set `true` to enable `game.socket.emit/on` for your module |
| `packs` | Array of compendium pack definitions |
| `relationships.requires` | Hard dependency on other modules/systems |
| `library` | Set `true` if this module is a shared library, not user-facing |

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

### Styling (CSS Cascade Layers)

v13 uses CSS Cascade Layers (`@layer`). Wrap your module CSS in a layer to avoid specificity conflicts and support Foundry's Light/Dark themes:

```css
@layer my-module {
  .my-module .window-content {
    --accent-color: var(--color-warm-2);
    padding: 0.5rem;
  }
}
```

### CSS Variables (Theme-Aware Styling)

v13 provides CSS custom properties for light/dark theme support. Always prefer these over hardcoded colors:

```css
@layer my-module {
  .my-module-panel {
    /* Text */
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);

    /* Accent palette */
    --my-accent: var(--color-warm-2);
    --my-muted: var(--color-cool-2);

    /* Typography */
    font-family: var(--font-primary);

    /* Elevation */
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius);
  }
}
```

Key variable categories:

| Category | Variables |
|---|---|
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-dark`, `--color-text-hyperlink` |
| Background | `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary` |
| Borders | `--color-border`, `--color-border-light`, `--color-border-dark` |
| Warm accents | `--color-warm-1`, `--color-warm-2`, `--color-warm-3` |
| Cool accents | `--color-cool-1`, `--color-cool-2`, `--color-cool-3` |
| Fonts | `--font-primary`, `--font-body`, `--font-size-13` through `--font-size-48` |

### Local Development

1. Create your module folder in Foundry's data path: `{userData}/Data/modules/my-module/`
2. Or symlink: `ln -s /path/to/your/dev/folder {userData}/Data/modules/my-module`
3. Launch Foundry, go to **Add-on Modules**, enable your module in a world
4. Open browser console (F12) to see logs and errors

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

For full field type reference, lifecycle hooks (`_preCreate`, `_onCreate`, `_preUpdate`, `_onUpdate`, `_preDelete`, `_onDelete`), embedded document management, and flags vs model fields guidance, read `references/document-model.md`.

---

## Application Framework (v2)

All UI in v13 uses `ApplicationV2`. The legacy `Application` and `FormApplication` classes are deprecated.

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

For `DocumentSheetV2`, `DialogV2`, the parts system, action handlers, form submission, and Handlebars template patterns, read `references/application-v2.md`.

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
await roll.evaluate();       // ALWAYS await — sync .roll() is deprecated in v13
await roll.toMessage({ flavor: "Damage Roll" });
console.log(roll.total);     // e.g. 11

// Use getRollData() on actors to expose system data to roll formulas
const rollData = actor.getRollData(); // { abilities: { str: 16, ... }, health: 50, ... }
const abilityRoll = new Roll("1d20 + @abilities.str", rollData);
```

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

For full socket patterns, custom DiceTerm, Roll.RESOLVERS, compendium querying, `fromUuid()`, and localization setup, read `references/sockets-rolls-packs.md`.

---

## Canvas Extensions

Extend the Foundry canvas with custom layers and placeable objects using PIXI.js:

```javascript
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

v13 also introduced **Scene Regions** — interactive areas on the canvas (difficult terrain, teleporters, trigger zones) via the `Region` and `RegionGeometry` APIs, replacing drawing-based workarounds.

Most modules never need canvas extensions. For custom layers, `PlaceableObject` subclasses, Scene Regions, coordinate conversion, `CanvasAnimation.animate()`, and PIXI performance tips, read `references/canvas-and-pixi.md`.

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

v13 types are in beta — expect some gaps. Check the repo for current status.

### Build Tools (Vite / Rollup)

Foundry modules are standard web apps — use Vite or Rollup for TypeScript compilation, SCSS, and bundling:

1. Keep source in `src/`, output bundled module to `dist/`
2. Symlink `dist/` into Foundry's `Data/modules/my-module`
3. Use `rollup-plugin-copy` or Vite equivalents to move `module.json`, `templates/`, `lang/` to `dist/`
4. Vite's dev server can proxy to Foundry's port (default 30000) for CSS/JS hot reload

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
    await Tour.fromJSON("/modules/my-module/tours/welcome.json")
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

In-game testing framework using Mocha/Chai that runs inside the Foundry environment — necessary because Foundry's APIs require an initialized game state.

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

```javascript
// Create an effect on an actor
await actor.createEmbeddedDocuments("ActiveEffect", [{
  name: "Blessed",
  icon: "icons/svg/angel.svg",
  changes: [{
    key: "system.abilities.str",
    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
    value: "2",
  }],
  duration: { rounds: 10 },
}]);

// Toggle an effect
const effect = Array.from(actor.allApplicableEffects()).find(e => e.name === "Blessed");
await effect.update({ disabled: !effect.disabled });
```

Change modes: `ADD` (numeric add), `MULTIPLY`, `OVERRIDE`, `UPGRADE` (keep higher), `DOWNGRADE` (keep lower), `CUSTOM` (system-defined).

Effects apply automatically during data preparation — the `changes` array modifies the actor's data before `prepareDerivedData()` runs.

### Global Status Effects

Add custom conditions to the Token HUD's status effect palette:

```js
Hooks.once("init", () => {
  CONFIG.statusEffects.push({
    id: "my-module.burning",
    name: "MY_MODULE.Effect.burning",
    icon: "modules/my-module/icons/burning.svg",
    overlay: false,
    changes: [{
      key: "system.abilities.dex",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: "-2"
    }]
  });
});
```

### Retrieving all effects (v13 critical change)

In v13, `actor.effects` only contains effects directly on the actor. Effects transferred from Items require `allApplicableEffects()`:

```js
// v13 — gets ALL effects including item-transferred
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

Key properties: `e.disabled` (inactive), `e.isTemporary` (has duration), `e.overlay` (token overlay icon).

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

For v12→v13 breaking changes (Application→ApplicationV2, sync roll removal), data migration patterns, compatibility flags, bulk migration with `migrateWorld`, and the full migration registry pattern, read `references/migration-guide.md`.

---

## Boilerplate Files

Copy these as starting points for new modules:

| File | Purpose |
|---|---|
| `boilerplate/module.json` | Valid v13 manifest with all common fields |
| `boilerplate/main.mjs` | ES module entry with init/setup/ready + settings + sheet registration |
| `boilerplate/type-data-model.mjs` | Custom Actor type with TypeDataModel + defineSchema |
| `boilerplate/actor-sheet.mjs` | ActorSheetV2 + HandlebarsApplicationMixin |
| `boilerplate/sheet.hbs` | Handlebars template with character info, abilities, and inventory |
| `boilerplate/socket-handler.mjs` | GM-authoritative socket pattern |

---

## Common Pitfalls

1. **Using deprecated v1 classes** — `Application`, `FormApplication`, `ActorSheet`, `ItemSheet` are all deprecated in v13. Use `ApplicationV2`, `DocumentSheetV2`.
2. **Synchronous roll evaluation** — `roll.roll()` is deprecated in v13. Always `await roll.evaluate()`. `Roll.evaluateSync()` exists only for deterministic rolls (`maximize`/`minimize`).
3. **Missing socket prefix** — Socket events must use `"module.my-module"` format. Without the `module.` prefix, messages won't route.
4. **Accessing game.user in init** — `game.user` is not set during `init`. Use `ready` hook for user-dependent logic.
5. **Non-GM modifying world documents** — Only GM clients can modify world-level documents. Use the GM-authoritative socket pattern for player-initiated changes.
6. **Using `scripts` instead of `esmodules`** — The `scripts` field loads files as classic scripts (no module scope). Always use `esmodules` for proper ES module support.
7. **Forgetting `config: false` for internal settings** — Settings with `config: true` show in the module settings menu. Use `config: false` for programmatic-only values like schema versions.
8. **Hardcoded English strings** — Use `game.i18n.localize()` for any user-visible text, even if you only support English. It makes future localization trivial.
9. **Not cleaning up hooks** — Store the hook ID from `Hooks.on()` and call `Hooks.off()` when your application closes. Leaked hooks cause memory issues and duplicate behavior.
10. **Setting `compatibility.maximum` too aggressively** — Prevents users from running your module on newer Foundry versions. Only set it if you've confirmed a breaking incompatibility.
11. **Running side effects on all clients in lifecycle hooks** — `_onCreate`, `_onUpdate`, `_onDelete` fire on every connected client. Guard with `if (game.userId !== userId) return;` to run side effects only on the originating client.
12. **Patching core methods without libWrapper** — Direct monkey-patching breaks when multiple modules modify the same method. Use `libWrapper` for safe, conflict-free patching of core Foundry functions.
13. **Missing `getRollData()` on custom Actor types** — Without implementing `getRollData()`, roll formulas like `@abilities.str` won't resolve. Return the system data your rolls need.
14. **Using jQuery in v13** — v13 deprecates jQuery. Hooks and `_onRender` now pass native `HTMLElement`, not jQuery objects. Use `querySelector`, `addEventListener`, `classList` instead of `$()`.
15. **CSS without `@layer`** — v13 uses CSS Cascade Layers. Wrap module styles in `@layer my-module { ... }` to avoid specificity wars and support Foundry's native Light/Dark themes via CSS variables.

---

## Reference Files

Read these for deep API details — they're loaded on demand:

| File | When to read |
|---|---|
| `references/document-model.md` | Building custom Actor/Item types, TypeDataModel, defineSchema, flags, lifecycle hooks, Journal Pages |
| `references/application-v2.md` | Building sheets, windows, dialogs — ApplicationV2, DocumentSheetV2, HandlebarsApplicationMixin, drag & drop |
| `references/hooks-and-settings.md` | Hook lifecycle, document hooks, canvas hooks, settings API, submenus, keybindings, DataModel settings |
| `references/chat-and-ui.md` | Chat commands, message rendering, context menus, enrichHTML, FilePicker, security/authorization, ProseMirror editor |
| `references/sockets-rolls-packs.md` | Socket communication, dice/Roll extensions, compendium packs, localization |
| `references/canvas-and-pixi.md` | Custom canvas layers, PlaceableObject, PIXI.js integration, coordinate conversion |
| `references/combat-and-tokens.md` | Combat tracker, initiative, Token HUD, scene controls, prototype token configuration |
| `references/regions-and-grid.md` | Scene Regions API, RegionDocument, RegionBehavior, Grid measurement, coordinate conversion, grid highlighting |
| `references/vision-and-lighting.md` | VisionMode, detection modes, lighting system, AmbientLight, fog of war |
| `references/measured-templates.md` | MeasuredTemplateDocument, area-of-effect shapes, template creation and targeting |
| `references/audio-and-macros.md` | AudioHelper, playlists, sound effects, Macro creation, hotbar integration |
| `references/migration-guide.md` | Version migration (v11→v12→v13), deprecated API detection, data migration scripts |
