---
name: foundry-vtt-system-dev
version: 2.2.0
description: >-
  Covers building, extending, and maintaining Foundry VTT game systems for v13+.
  This skill applies when scaffolding a new system, defining Actor/Item types with
  TypeDataModel, customizing dice mechanics, implementing combat & initiative,
  building character sheets, handling system data migration, or configuring
  template.json. Triggers on: "Foundry system", "FVTT system", "system.json",
  "template.json", "foundryvtt system", "Actor subclass", "Item subclass",
  "custom dice", "DiceTerm", "system development", "game system", "RPG system",
  "statusEffects", "hotbarDrop", "custom enricher", "JournalEntryPage",
  "TokenDocument", or any task involving Foundry VTT system development.
---

# Foundry VTT System Development

Build game systems for Foundry Virtual Tabletop (v13+). Systems define the core rules — Actor/Item types, dice mechanics, combat, character sheets — while modules extend them. This skill covers the full system lifecycle from manifest to publication.

## Quick Start

### System Structure

```
my-system/
├── system.json           ← manifest (required)
├── template.json         ← type definitions (required)
├── scripts/
│   ├── main.mjs          ← ES module entry point
│   ├── actor.mjs         ← custom Actor class
│   ├── item.mjs          ← custom Item class
│   ├── data/
│   │   ├── character-data.mjs
│   │   └── npc-data.mjs
│   └── sheets/
│       └── character-sheet.mjs
├── templates/
│   └── actor/
│       └── character-sheet.hbs
├── styles/
│   └── my-system.css
├── packs/                ← compendium data
└── lang/
    └── en.json           ← localization strings
```

Use `boilerplate/system.json` and `boilerplate/main.mjs` as starting points.

### System Manifest (system.json)

Every system needs a valid `system.json`. System-specific fields beyond what modules use:

```json
{
  "id": "my-system",
  "title": "My System",
  "description": "A custom game system for Foundry VTT.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "13",
    "verified": "13"
  },
  "documentTypes": {
    "Actor": { "character": {}, "npc": {} },
    "Item": { "weapon": {}, "spell": {} }
  },
  "authors": [{ "name": "Your Name" }],
  "esmodules": ["scripts/main.mjs"],
  "styles": ["styles/my-system.css"],
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" }],
  "background": "systems/my-system/assets/setup-bg.png",
  "gridDistance": 5,
  "gridUnits": "ft",
  "primaryTokenAttribute": "health",
  "secondaryTokenAttribute": "power"
}
```

| Field | Purpose |
|---|---|
| `id` | Unique lowercase identifier — must match folder name |
| `compatibility` | `minimum` (won't load below), `verified` (tested on) |
| `documentTypes` | Declares Actor/Item subtypes — keys must match `CONFIG.*.dataModels` |
| `background` | Background image for the system selection screen |
| `gridDistance` / `gridUnits` | Default grid configuration (e.g., 5 ft) |
| `primaryTokenAttribute` | Resource displayed in bar1 on tokens (maps to `system.health`) |
| `secondaryTokenAttribute` | Resource displayed in bar2 on tokens (maps to `system.power`) |
| `esmodules` | ES module entry points — always prefer over legacy `scripts` |

### Template Types (template.json)

Define Actor and Item types with shared template inheritance:

```json
{
  "Actor": {
    "types": ["character", "npc"],
    "templates": {
      "base": {
        "health": { "value": 10, "max": 10 },
        "biography": ""
      }
    },
    "character": {
      "templates": ["base"],
      "abilities": { "str": { "value": 10 }, "dex": { "value": 10 } }
    },
    "npc": {
      "templates": ["base"],
      "cr": 0
    }
  },
  "Item": {
    "types": ["weapon", "spell"],
    "templates": {
      "base": { "description": "" }
    },
    "weapon": {
      "templates": ["base"],
      "damage": "1d6",
      "quantity": 1
    },
    "spell": {
      "templates": ["base"],
      "level": 0,
      "school": "evocation"
    }
  }
}
```

Types reference templates via the `templates` array. Data from referenced templates is merged into the type. In v13, `template.json` remains the primary way systems define types and default data. Use `TypeDataModel` alongside it for schema validation, derived data, and lifecycle hooks — the data schema comes from `defineSchema()` while `template.json` declares the types.

### Initialization Lifecycle

Systems run through the same hooks as modules, but the `init` hook is where you register core system components:

```javascript
const SYSTEM_ID = "my-system";

Hooks.once("init", () => {
  // Register data models for each type
  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData
  });
  Object.assign(CONFIG.Item.dataModels, {
    weapon: WeaponData,
    spell: SpellData
  });

  // Register custom document classes
  CONFIG.Actor.documentClass = MySystemActor;
  CONFIG.Item.documentClass = MySystemItem;

  // Set initiative formula
  CONFIG.Combat.initiative = {
    formula: "1d20 + @abilities.dex.mod",
    decimals: 2
  };

  // Disable legacy Active Effect transfer
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Unregister core sheets and register system sheets
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet(SYSTEM_ID, CharacterSheet, {
    makeDefault: true,
    types: ["character"]
  });

  // Register settings
  game.settings.register(SYSTEM_ID, "schemaVersion", {
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
});
```

> **Shared API** — see the foundry-vtt-module-dev skill for Hooks lifecycle (init/setup/ready), Settings API, and Localization.

---

## v13 Namespace (`foundry.*`)

Nearly every core API moved into the `foundry.*` namespace in v13. Legacy globals work as deprecation shims (with console warnings) but new code should use the namespaced paths. Critical for system development:

| Legacy / global | v13 namespaced path |
|---|---|
| `TypeDataModel`, `DataModel`, `Document` | `foundry.abstract.*` |
| `fields.NumberField`, `fields.SchemaField`, etc. | `foundry.data.fields.*` |
| `ApplicationV2`, `HandlebarsApplicationMixin`, `DialogV2` | `foundry.applications.api.*` |
| `ActorSheetV2`, `ItemSheetV2` | `foundry.applications.sheets.*` |
| `Roll`, `DiceTerm`, `Die`, `RollTerm` | `foundry.dice.*`, `foundry.dice.terms.*` |
| `Canvas`, `CanvasLayer`, `PlaceableObject` | `foundry.canvas.*` |
| `Actors`, `Items` (sidebar collections) | `foundry.documents.collections.*` |
| `loadTemplates`, `renderTemplate` | `foundry.applications.handlebars.*` |
| (new in v13) | `foundry.applications.fields.*` — form input creation: `createFormGroup`, `createSelectInput`, `createNumberInput`, etc. |
| (new in v13) | `foundry.applications.ux.*` — `Tabs`, `ContextMenu`, `DragDrop`, `FormDataExtended`, `SearchFilter`, `TextEditor` |
| `mergeObject`, `isNewerVersion`, `debounce` | `foundry.utils.*` (38+ helpers) |
| `Hooks` (still global) | `foundry.helpers.Hooks` (alias) |

For the full table, see the `foundry-vtt-module-dev` skill's "v13 Namespace" section. The same migration applies — write new files against namespaced paths, update old files when you touch them.

---

## Production Architecture

Patterns every shipping system uses, extracted from the `foundryvtt/dnd5e` reference implementation. Adopt these before your codebase grows past ~10 source files:

- **Single ESM entry + barrel files** — one `my-system.mjs` declared in `system.json`; each subdirectory exports a `_module.mjs` re-exporting its public API. The entry imports namespaces (`import * as dataModels from "./data/_module.mjs"`).
- **`globalThis.<systemId>` API surface** — expose your system API on one global so modules and macros have a stable contract (`game.mySystem.documents.MySystemActor`).
- **`flags.hotReload` in system.json** — declare which file types Foundry should live-reload (CSS, hbs, JSON). Cuts UI iteration time dramatically.
- **`htmlFields` and `filePathFields` per documentType** — required for proper sanitization, ProseMirror enrichment, asset migration, and search indexing.
- **Migration version flags** — `flags.<systemId>.needsMigrationVersion` + `compatibleMigrationVersion` in `system.json`, gated by `Hooks.once("ready")` + `game.user.isGM`.
- **Single frozen `config.mjs`** — all static system data (abilities, damage types, schools) in one file, assigned to `CONFIG.MY_SYSTEM` in `init`. One source of truth.
- **Staged init hooks** — split work across `init` (CONFIG mutations, sheets, settings) → `i18nInit` (translate CONFIG labels) → `setup` (enrichers, packs) → `ready` (migrations, GM-only side effects).
- **Pack folders** — group compendium packs hierarchically in the sidebar via `packFolders` in `system.json`.
- **Build pipeline** — Rollup ESM bundle + LESS/Sass + `@foundryvtt/foundryvtt-cli` for LevelDB pack compilation.

The updated `boilerplate/system.json` and `boilerplate/main.mjs` demonstrate the namespace, hotReload, htmlFields, packFolders, migration flags, and staged-hook patterns end-to-end.

For the full rationale, dnd5e references, and concrete templates, read `references/production-patterns.md`.

---

## System Manifest (system.json)

System-specific fields that don't exist on `module.json`:

| Field | Type | Purpose |
|---|---|---|
| `background` | string | Background image for the system setup screen |
| `gridDistance` | number | Default grid distance (e.g., `5`) |
| `gridUnits` | string | Default grid units (e.g., `"ft"`, `"m"`, `"sq"`) |
| `primaryTokenAttribute` | string | Token bar1 attribute path (e.g., `"health"`) |
| `secondaryTokenAttribute` | string | Token bar2 attribute path (e.g., `"power"`) |
| `documentTypes` | object | Declares custom Actor/Item subtypes (v13+) |

The `primaryTokenAttribute` and `secondaryTokenAttribute` reference keys in `actor.system`. The attribute must lead to an object with `value` and `max` keys (e.g., `system.health.value` / `system.health.max`).

For full details, read `references/system-manifest.md`.

---

## Template Types (template.json)

`template.json` defines the types your system supports. Each type can reference shared templates:

- **`Actor.types`** — array of Actor type strings (e.g., `["character", "npc"]`)
- **`Actor.templates`** — object of shared data templates referenced by types
- **`Item.types`** — array of Item type strings
- **`Item.templates`** — object of shared data templates for items

Types inherit template data by listing template names in their `templates` array. The data is merged — type-specific fields override template fields.

In v13, use `TypeDataModel` + `documentTypes` in `system.json` alongside `template.json`. The `template.json` declares the types; `TypeDataModel` defines the schema with validation and derived data.

For full details, read `references/system-manifest.md`.

---

## Actor & Item Classes

Systems replace the default Actor and Item classes with custom subclasses:

```javascript
// In init hook
CONFIG.Actor.documentClass = MySystemActor;
CONFIG.Item.documentClass = MySystemItem;
```

### Actor: getRollData()

Override `getRollData()` to expose system data for roll formulas (`@abilities.str.mod`):

```javascript
class MySystemActor extends Actor {
  getRollData() {
    const data = super.getRollData();
    // Add shorthand for abilities
    data.abilities = this.system.abilities;
    data.level = this.system.level;
    return data;
  }
}
```

### Actor: _preCreate() for Default Items

Add starter items when an Actor is created:

```javascript
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);
  const items = this.items.map(i => i.toObject());
  items.push({ name: "Unarmed Strike", type: "weapon", system: { damage: "1" } });
  this.updateSource({ items });
}
```

### Item: roll()

Implement system-specific roll logic:

```javascript
class MySystemItem extends Item {
  async roll() {
    const rollData = this.getRollData();
    const roll = new Roll(this.system.formula, rollData);
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${this.name} — ${this.type}`
    });
  }
}
```

### TypeDataModel & defineSchema

Each Actor/Item type needs a TypeDataModel class that defines its data schema:

```javascript
class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      level: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 1 }),
      abilities: new fields.SchemaField({
        str: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        dex: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 })
      }),
      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),
      biography: new fields.HTMLField({ initial: "" })
    };
  }
}
```

Register in `init` with `Object.assign(CONFIG.Actor.dataModels, { character: CharacterData })`.

### prepareDerivedData()

Override on TypeDataModel to compute derived values (modifiers, max HP, AC). Use helper methods per type to stay organized:

```javascript
class CharacterData extends foundry.abstract.TypeDataModel {
  prepareDerivedData() {
    this._prepareAbilities();
    this._prepareHealth();
  }

  _prepareAbilities() {
    for (const [key, score] of Object.entries(this.abilities)) {
      this.abilities[key] = { score, mod: Math.floor((score - 10) / 2) };
    }
  }

  _prepareHealth() {
    const conMod = this.abilities.con?.mod ?? 0;
    this.health.max = 10 + this.level + conMod;
  }
}
```

Never write to the database in `prepareDerivedData()` — it is purely in-memory computation.

### Sheet Registration

System sheets use `ActorSheetV2` / `ItemSheetV2` with `HandlebarsApplicationMixin`:

```javascript
const { HandlebarsApplicationMixin } = foundry.applications.api;

class CharacterSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static PARTS = {
    header: { template: "systems/my-system/templates/actor/header.hbs" },
    body:   { template: "systems/my-system/templates/actor/body.hbs" }
  };

  async _prepareContext(options) {
    return { actor: this.document, system: this.document.system };
  }
}
```

> **Shared API** — see the foundry-vtt-module-dev skill for ApplicationV2, Active Effects, and Hooks lifecycle.

For full details, read `references/actor-item-classes.md`.

---

## Dice System

### Custom DiceTerm

Extend `foundry.dice.terms.Die` for custom mechanics (e.g., exploding dice):

```javascript
class ExplodingDie extends foundry.dice.terms.Die {
  async _evaluate(options = {}) {
    await super._evaluate(options);
    for (const result of [...this.results]) {
      if (result.result >= this.faces) {
        const bonus = new foundry.dice.terms.Die({ number: 1, faces: this.faces });
        await bonus._evaluate();
        this.results.push(...bonus.results);
      }
    }
    return this;
  }
}

// Register in init
CONFIG.Dice.terms["x"] = ExplodingDie;
// Usage: "2x6" → 2d6, exploding on max
```

### Custom Roll Class

Extend `foundry.dice.Roll` for system-specific behavior:

```javascript
class MySystemRoll extends foundry.dice.Roll {
  static instantiateAST(ast) {
    // Custom AST processing for system-specific terms
    return CONFIG.Dice.parser.flattenTree(ast).map(node => {
      const cls = foundry.dice.terms[node.class] ?? foundry.dice.terms.RollTerm;
      return cls.fromParseNode(node);
    });
  }
}

// Register in init
CONFIG.Dice.rolls = [MySystemRoll];
```

For full details, read `references/dice-system.md`.

---

## Combat & Initiative

### Global Initiative Formula

```javascript
// In init hook
CONFIG.Combat.initiative = {
  formula: "1d20 + @abilities.dex.mod + @abilities.wis.mod",
  decimals: 2
};
```

The formula uses roll data from the combatant's actor. `@abilities.dex.mod` resolves via `getRollData()`.

### Per-Actor Initiative

Override `getInitiativeRoll()` on a custom Combatant for per-actor formulas:

```javascript
const original = Combatant.prototype.getInitiativeRoll;
Combatant.prototype.getInitiativeRoll = function (formula) {
  if (this.actor?.type === "character") {
    formula = "1d20 + @abilities.dex.mod";
  } else if (this.actor?.type === "npc") {
    formula = "1d10 + @abilities.dex.mod";
  }
  return original.call(this, formula);
};
```

For safer patching, use `libWrapper`:

```javascript
libWrapper.register("my-system", "Combatant.prototype.getInitiativeRoll", function (wrapped, formula) {
  if (this.actor?.type === "character") formula = "1d20 + @abilities.dex.mod";
  return wrapped(formula);
}, "WRAPPER");
```

> **Shared API** — see the foundry-vtt-module-dev skill for combat hooks (combatStart, combatTurn, combatRound) and Token HUD.

For full details, read `references/combat-initiative.md`.

---

## Data Migration

### Schema Versioning

Track the current schema version in settings and run migrations on world load:

```javascript
const MIGRATIONS = [
  { version: 1, fn: migrateV1 },
  { version: 2, fn: migrateV2 }
];

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const current = game.settings.get("my-system", "schemaVersion") ?? 0;
  const target = MIGRATIONS.at(-1).version;
  if (current >= target) return;

  for (const { version, fn } of MIGRATIONS) {
    if (current < version) await fn();
  }
  await game.settings.set("my-system", "schemaVersion", target);
  ui.notifications.info("my-system | Migration complete.");
});
```

### migrateData() on TypeDataModel

Static method for transforming data between schema versions. Override `_addDataFieldMigrations()` for field renames, and `migrateData()` for value transformations:

```javascript
class CharacterData extends foundry.abstract.TypeDataModel {
  // Field renames — called automatically before migrateData
  static _addDataFieldMigrations() {
    this._addDataFieldMigration("system.oldField", "system.newField");
  }

  // Value transformations — conclude with return super.migrateData(data)
  static migrateData(data) {
    // Transform values if needed
    return super.migrateData(data);
  }
}
```

For full details, read `references/data-migration.md`.

---

## Character Creation

### Default Items in _preCreate()

Add starter items when an Actor is created:

```javascript
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);
  const starterItems = [
    { name: "Unarmed Strike", type: "weapon", system: { damage: "1" } },
    { name: "Basic Spell", type: "spell", system: { level: 0 } }
  ];
  this.updateSource({ items: starterItems });
}
```

### Prototype Token Defaults

Set default token properties in `_preCreate()`:

```javascript
this.updateSource({
  "prototypeToken.texture.src": this.parent.img,
  "prototypeToken.name": this.parent.name,
  "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
  "prototypeToken.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER,
  "prototypeToken.bar1": { attribute: "health" },
  "prototypeToken.bar2": { attribute: "power" },
  "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
  "prototypeToken.sight": { enabled: true, range: 60 }
});
```

> **Shared API** — see the foundry-vtt-module-dev skill for DialogV2, Active Effects, and compendium import.

For full details, read `references/character-creation.md`.

---

## Advanced System Features

### Status Effects

Replace the core status effect array with system-specific conditions in `init`:

```javascript
CONFIG.statusEffects = [
  {
    id: "my-system.prone",
    name: "MY_SYSTEM.Conditions.Prone",
    icon: "systems/my-system/icons/conditions/prone.svg",
    changes: [{ key: "system.attributes.ac", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-2" }],
  },
  {
    id: "my-system.dead",
    name: "MY_SYSTEM.Conditions.Dead",
    icon: "systems/my-system/icons/conditions/dead.svg",
    overlay: true,
    changes: [],
  },
];
CONFIG.specialStatusEffects.DEFEATED = "my-system.dead";
```

Systems replace the entire `CONFIG.statusEffects` array (modules should push). Each entry can include `changes` to auto-apply Active Effect modifications when toggled.

### Hotbar Macros

Register a `hotbarDrop` hook in `ready` to let players drag items to the macro bar:

```javascript
Hooks.once("ready", () => {
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (data.type === "Item") {
      createItemMacro(data, slot);
      return false;
    }
  });
});
```

Return `false` to prevent default handling. The helper creates a script macro that calls `item.roll()` via UUID.

### Custom Enrichers

Register inline syntax patterns via `CONFIG.TextEditor.enrichers` in `init`:

```javascript
CONFIG.TextEditor.enrichers.push({
  pattern: /@Check\[([^\]]+)\](?:\{([^}]+)\})?/g,
  enricher: async (match, options) => {
    const [, ability, label] = match;
    const anchor = document.createElement("a");
    anchor.classList.add("inline-check");
    anchor.dataset.action = "rollCheck";
    anchor.dataset.ability = ability;
    anchor.innerHTML = `<i class="fa-solid fa-dice-d20"></i> ${label ?? ability}`;
    return anchor;
  },
});
```

Now `@Check[strength]{STR Save}` in any enriched text becomes a clickable link. Handle clicks via `data-action` in your sheet's action handlers.

### Token Customization

Override `CONFIG.Token.objectClass` to customize token rendering (e.g., custom resource bars):

```javascript
CONFIG.Token.objectClass = MySystemToken;
```

Override `CONFIG.Token.documentClass` for custom token data handling. Set per-type prototype token defaults in `_preCreate()` — characters get `actorLink: true` and friendly disposition, NPCs get `actorLink: false` and hostile disposition.

### Custom Journal Entry Pages

Define system-specific journal page types (class descriptions, bestiary entries) using `TypeDataModel`:

```javascript
CONFIG.JournalEntryPage.dataModels["class"] = ClassPageData;
DocumentSheetConfig.registerSheet(JournalEntryPage, "my-system", ClassPageSheet, {
  types: ["class"],
  makeDefault: true,
});
```

Declare custom page types in `system.json` under `documentTypes.JournalEntryPage`.

For full details on all five topics, read `references/advanced-system-features.md`.

---

## Styling & Themes

Systems carry the bulk of CSS in any Foundry world — character sheets, item sheets, chat cards. The patterns below are extracted from the two largest production systems (`foundryvtt/dnd5e` and `foundryvtt/pf2e`) and codify what works at scale on v13.

**Nine rules every shipping system follows:**

1. **Single compiled CSS file** declared in `system.json` `styles[]`. Never list LESS/SCSS partials.
2. **Marker class** on every Application root via `DEFAULT_OPTIONS.classes: ["my-system", ...]`.
3. **Component CSS is unlayered.** Only wrap variable/token definitions in `@layer variables`. Component CSS without a layer wins against Foundry's `@layer applications` automatically.
4. **CSS custom properties as the abstraction** — not LESS/SCSS mixins.
5. **Two coexisting variable strategies:** override Foundry's `--color-*`/`--font-*` for skinning **and** namespace your own as `--my-system-*`.
6. **Body-class theming** — `body.theme-light` / `body.theme-dark`. No `prefers-color-scheme`, no `[data-theme]`.
7. **`.themed.theme-{light,dark}`** for popouts and per-application theme overrides. Always pair with body-class selectors.
8. **Per-version sheet folders** — `styles/v1/` for AppV1 fallbacks, `styles/v2/` for current AppV2 styles.
9. **Sheet scoping by document chain** — `.my-system.sheet.actor.character`.

```less
// styles/my-system.less — entry, only @imports
@import "variables/base.less";    // wrapped in @layer variables
@import "variables/light.less";   // body.theme-light + .themed.theme-light
@import "variables/dark.less";    // body.theme-dark + .themed.theme-dark
@import "v2/sheets.less";         // UNLAYERED — wins over Foundry's base
@import "v2/character.less";
@import "v2/chat.less";
```

```less
// Per-theme variables via mixin pattern
.mixin-theme-dark() {
  --my-system-bg-card: #2a2018;
  --my-system-text-primary: #e9d8a6;
}

@layer variables {
  body.theme-dark .my-system,
  .themed.theme-dark.my-system {
    .mixin-theme-dark();
  }
}
```

The boilerplate ships a complete starter: [styles/my-system.less](boilerplate/styles/my-system.less), [variables/](boilerplate/styles/variables/) (base + light + dark), [v2/sheets.less](boilerplate/styles/v2/sheets.less), [v2/chat.less](boilerplate/styles/v2/chat.less). Compile with `lessc styles/my-system.less styles/my-system.css --source-map` or integrate via Vite (see the foundry-vtt-module-dev skill's `references/build-pipeline.md`).

For the full rationale — Foundry's cascade-layer mechanics, why component CSS stays unlayered, marker class via `DEFAULT_OPTIONS.classes`, dnd5e vs PF2e tooling tradeoffs, sheet/chat scoping patterns, token & HUD customization, and 12 pitfalls — read `references/styling-and-themes.md`.

---

## Shared APIs

These APIs are covered in the **foundry-vtt-module-dev skill** — read that skill for deep details:

| Topic | Module Dev Reference | System-Specific Notes |
|---|---|---|
| ApplicationV2 / Sheets | `references/application-v2.md` | Use `HandlebarsApplicationMixin(ActorSheetV2)` / `HandlebarsApplicationMixin(ItemSheetV2)` |
| TypeDataModel / defineSchema | `references/document-model.md` | Register via `CONFIG.*.dataModels` in init |
| Active Effects | `references/document-model.md` | Set `CONFIG.ActiveEffect.legacyTransferral = false`; use `allApplicableEffects()` |
| Hooks Lifecycle | `references/hooks-and-settings.md` | init → CONFIG registration, ready → migration |
| Settings API | `references/hooks-and-settings.md` | Use for schema version and system options |
| Localization | `references/sockets-rolls-packs.md` | Use `MY_SYSTEM.` prefix, include `TYPES.Actor.*` and `TYPES.Item.*` |
| Canvas Extensions | `references/canvas-and-pixi.md` | Custom layers for system-specific visuals |
| Sockets | `references/sockets-rolls-packs.md` | GM-authoritative pattern for player actions |
| Compendium Packs | `references/sockets-rolls-packs.md` | Declare packs in system.json |
| CSS / Styling | `references/styling-and-themes.md` | Marker classes via `DEFAULT_OPTIONS.classes`, `@layer variables` for tokens, body-class theming with `.themed.theme-*` for popouts |
| Basic Dice Rolls | `references/sockets-rolls-packs.md` | `Roll`, `evaluate()`, `toMessage()` |
| Combat Hooks | `references/combat-and-tokens.md` | combatStart, combatTurn, combatRound |
| Data Migration (modules) | `references/migration-guide.md` | Systems use `migrateData()` on TypeDataModel |

---

## Common Pitfalls

1. **Not registering documentClass** — Systems MUST set `CONFIG.Actor.documentClass` and `CONFIG.Item.documentClass` in `init`. Without this, the default Actor/Item class is used and system-specific methods (`getRollData`, `roll`) are lost.
2. **Forgetting to register dataModels** — `CONFIG.Actor.dataModels` and `CONFIG.Item.dataModels` must be populated for each type declared in `documentTypes`. Mismatched keys cause silent failures.
3. **template.json and TypeDataModel mismatch** — If using TypeDataModel, `template.json` still needs the type declarations but the data schema comes from `defineSchema()`. The two must agree on field paths.
4. **getRollData() not returning system data** — Roll formulas like `@abilities.str.mod` won't resolve if `getRollData()` doesn't return the right structure. The returned object is what `@` references resolve against.
5. **_preCreate() calling update() instead of updateSource()** — In `_preCreate()`, use `this.updateSource()` to modify creation data. Using `update()` tries to write to the DB before the document exists.
6. **Custom DiceTerm not registered** — Setting `CONFIG.Dice.terms["x"] = MyTerm` in `init` is required. Without registration, `Roll.parse()` can't recognize the custom operator.
7. **Initiative formula referencing missing data** — `CONFIG.Combat.initiative.formula` uses actor roll data. If the referenced fields don't exist in `getRollData()`, initiative rolls fail silently or produce NaN.
8. **migrateData() not calling super** — Always call `return super.migrateData(data)` at the end. Skipping this breaks Foundry's own migration pipeline.
9. **System ID mismatch** — `system.json` `id` must match the folder name exactly. Foundry uses the folder name to locate the system.
10. **Using template.json without TypeDataModel** — template.json alone works for basic data definition, but without TypeDataModel you lose `prepareDerivedData()`, `migrateData()`, and lifecycle hooks. Use both together.
11. **Item.roll() not using getRollData()** — Item rolls should use `this.getRollData()` (which includes parent actor data) not just `this.system`. Otherwise `@abilities.str` won't resolve.
12. **Confusing module documentTypes with system documentTypes** — Modules can also declare `documentTypes`, but systems own the core types. A system's types are the primary game types; module types are extensions.
13. **CONFIG values in static initializers** — `static PARTS = { template: CONFIG.mySystem.templates.foo }` fails because CONFIG is undefined during class static initialization. Use string literals for template paths, or resolve CONFIG values in `_prepareContext()` or `static get PARTS()`.

---

## Boilerplate Files

| File | Purpose |
|---|---|
| `boilerplate/system.json` | Valid v13 manifest with hotReload, htmlFields/filePathFields per documentType, packFolders, migration version flags |
| `boilerplate/template.json` | Actor/Item type definitions with template inheritance |
| `boilerplate/main.mjs` | Entry point — barrel imports, globalThis API, staged init/i18nInit/setup/ready hooks |
| `boilerplate/config.mjs` | Single source of truth for system constants (MY_SYSTEM) |
| `boilerplate/settings.mjs` | `registerSystemSettings()` — all game.settings.register calls in one place |
| `boilerplate/migration.mjs` | `migrateWorld()` with version-gated migration registry |
| `boilerplate/actor.mjs` | Custom Actor class with getRollData and _preCreate |
| `boilerplate/item.mjs` | Custom Item class with roll() and getRollData |
| `boilerplate/data/_module.mjs` | Barrel re-exporting every TypeDataModel class |
| `boilerplate/data/character-data.mjs` | TypeDataModel for character type with prepareDerivedData |
| `boilerplate/data/npc-data.mjs` | TypeDataModel for NPC type with simplified schema |
| `boilerplate/data/weapon-data.mjs` | TypeDataModel for weapon type with damage, quantity, weight |
| `boilerplate/data/spell-data.mjs` | TypeDataModel for spell type with level, school, formula |
| `boilerplate/documents/_module.mjs` | Barrel re-exporting MySystemActor and MySystemItem |
| `boilerplate/sheets/_module.mjs` | Barrel re-exporting CharacterSheet |
| `boilerplate/sheets/character-sheet.mjs` | ActorSheetV2 for character type with actions |
| `boilerplate/templates/actor/character-sheet.hbs` | Handlebars template with abilities, inventory, and effects |
| `boilerplate/styles/my-system.less` | LESS entry — imports all partials, no rules |
| `boilerplate/styles/variables/base.less` | Theme-agnostic `:root` tokens (spacing scale, sheet dims, namespaced colors) |
| `boilerplate/styles/variables/light.less` | Light theme mixin + `body.theme-light` / `.themed.theme-light` selectors |
| `boilerplate/styles/variables/dark.less` | Dark theme mixin + `body.theme-dark` / `.themed.theme-dark` selectors |
| `boilerplate/styles/v2/sheets.less` | Shared sheet chrome — header, tabs, inputs, buttons (unlayered) |
| `boilerplate/styles/v2/typography.less` | Font loading and typographic scale |
| `boilerplate/styles/v2/character.less` | Character sheet specific (ability block, health bar with prefers-reduced-motion) |
| `boilerplate/styles/v2/items.less` | Item sheet patterns chained by item type (`.weapon`, `.spell`) |
| `boilerplate/styles/v2/apps.less` | Dialogs, configs, popout themed override pattern |
| `boilerplate/styles/v2/chat.less` | Chat card scoping pattern under `:is(.chat-popout, #chat-log, .chat-log)` |

---

## Reference Files

Read these for deep API details — they're loaded on demand:

| File | When to read |
|---|---|
| `references/system-manifest.md` | system.json fields, documentTypes, template.json structure, template inheritance |
| `references/actor-item-classes.md` | Extending Actor/Item, getRollData, _preCreate, Item.roll(), document class registration |
| `references/dice-system.md` | Custom DiceTerm, custom Roll class, CONFIG.Dice, formula parsing, RollResolver |
| `references/combat-initiative.md` | Initiative formulas, custom Combatant, combat lifecycle, turn automation |
| `references/data-migration.md` | migrateData(), schema versioning, migration registry, bulk migration, v12→v13 changes |
| `references/character-creation.md` | Default items, prototype tokens, creation dialogs, compendium import |
| `references/advanced-system-features.md` | Status effects, hotbar macros, custom enrichers, token customization, journal pages |
| `references/production-patterns.md` | Production architecture: barrel files, globalThis API, hotReload, htmlFields/filePathFields, build pipeline, migration version flags, pack folders, staged init hooks |
| `references/styling-and-themes.md` | CSS architecture: marker classes, cascade layers (when to layer, when not), CSS variables, body-class theming, sheet/chat scoping, dnd5e vs PF2e patterns, 12 pitfalls |

### Cross-Skill References

These live in the `foundry-vtt-module-dev` skill but apply to systems too:

| File | When to read |
|---|---|
| `foundry-vtt-module-dev/references/accessibility.md` | Sheet a11y — ARIA, keyboard nav, focus management |
| `foundry-vtt-module-dev/references/testing-with-quench.md` | Writing in-game tests with Quench |
| `foundry-vtt-module-dev/references/module-subtypes.md` | When extending your system with module-contributed subtypes |
| `foundry-vtt-module-dev/references/build-pipeline.md` | Vite/Rollup setup, dev proxy, fixed-name output, hot reload integration |
| `foundry-vtt-module-dev/references/handlebars-and-templates.md` | Foundry helper inventory, v13 HTML elements, form helpers, template preloading |
| `foundry-vtt-module-dev/references/adventure-documents.md` | Shipping pre-made content (campaigns, one-shots) via the Adventure document type |
| `foundry-vtt-module-dev/references/permissions-and-ownership.md` | Roles, ownership levels, testUserPermission, GM-authoritative pattern, USER_PERMISSIONS |
