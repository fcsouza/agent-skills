---
name: foundry-vtt-system-dev
version: 3.0.0
description: >-
  Covers building, extending, and maintaining Foundry VTT game systems for v14+.
  This skill applies when scaffolding a new system, declaring Actor/Item types
  with documentTypes + TypeDataModel, customizing dice mechanics, implementing
  combat & initiative, building character sheets, handling system data migration,
  registering Active Effect V2 change types or subtypes, or migrating a v13
  system (template.json, rollMode, MeasuredTemplate) to v14. Triggers on:
  "Foundry system", "FVTT system", "system.json", "template.json", "foundryvtt
  system", "Actor subclass", "Item subclass", "custom dice", "DiceTerm", "system
  development", "game system", "RPG system", "statusEffects", "hotbarDrop",
  "custom enricher", "JournalEntryPage", "TokenDocument", "ActiveEffect V2",
  "changeTypes", "messageMode", "Scene Levels", "Regions templates", or any task
  involving Foundry VTT system development.
---

# Foundry VTT System Development

Build game systems for Foundry Virtual Tabletop (v14+). Systems define the core rules — Actor/Item types, dice mechanics, combat, character sheets — while modules extend them. This skill covers the full system lifecycle from manifest to publication. v13→v14 differences appear as "Changed in v14" notes; for the full list read `foundry-vtt-module-dev/references/v14-migration.md`.

## Quick Start

### System Structure

```
my-system/
├── system.json           ← manifest (required) — declares types via documentTypes
├── template.json         ← legacy type defaults (optional, deprecated since v14, removed in v16)
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
  "type": "system",
  "title": "My System",
  "description": "A custom game system for Foundry VTT.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "14",
    "verified": "14"
  },
  "documentTypes": {
    "Actor": { "character": {}, "npc": {} },
    "Item": { "weapon": {}, "spell": {} }
  },
  "authors": [{ "name": "Your Name" }],
  "esmodules": ["scripts/main.mjs"],
  "styles": [{ "src": "styles/my-system.css" }],
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" }],
  "background": "systems/my-system/assets/setup-bg.png",
  "grid": { "type": 1, "distance": 5, "units": "ft", "diagonals": 0 },
  "primaryTokenAttribute": "health",
  "secondaryTokenAttribute": "power"
}
```

| Field | Purpose |
|---|---|
| `id` | Unique lowercase identifier — must match folder name. Pack `name` values follow the same rule: `[A-Za-z0-9_-]` only, duplicates throw |
| `type` | `"system"`. Optional (it is the schema initial) but explicit in v14 manifests |
| `compatibility` | `minimum` (won't load below), `verified` (tested on). Use `"14"` |
| `documentTypes` | Declares subtypes for every typed document (Actor, Item, JournalEntryPage, ActiveEffect, ...) — keys must match `CONFIG.*.dataModels`. This is the primary type declaration in v14 |
| `background` | Background image for the system selection screen |
| `grid` | Default grid: `{ type, distance, units, diagonals }`. `type` takes a `CONST.GRID_TYPES` value (1 = square), `diagonals` a `CONST.GRID_DIAGONALS` value (0 = equidistant). **Changed in v14:** the flat `gridDistance` / `gridUnits` pair is removed — no shim, no migration; the manifest must use the `grid` object |
| `primaryTokenAttribute` | Resource displayed in bar1 on tokens (maps to `system.health`) |
| `secondaryTokenAttribute` | Resource displayed in bar2 on tokens (maps to `system.power`) |
| `esmodules` | ES module entry points — always prefer over legacy `scripts` |
| `styles` | Array of `{ src, layer? }`. A bare array of strings is the v12 shape; it auto-migrates with a warning and gives up control of the cascade layer |

### Declaring Types

Declare every subtype in `system.json` under `documentTypes`, then give each one a `TypeDataModel`. The manifest declares the type; `defineSchema()` supplies the fields, defaults, validation, and derived data:

```json
{
  "documentTypes": {
    "Actor": {
      "character": { "htmlFields": ["biography"] },
      "npc": {}
    },
    "Item": {
      "weapon": { "htmlFields": ["description"] },
      "spell": { "htmlFields": ["description"] }
    }
  }
}
```

```javascript
// scripts/data/weapon-data.mjs
export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      damage: new fields.StringField({ initial: "1d6" }),
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 })
    };
  }
}
// init: Object.assign(CONFIG.Item.dataModels, { weapon: WeaponData });
```

Shared fields go in a base class (`class BaseItemData extends TypeDataModel`) that subtypes extend — that replaces template.json's `templates` inheritance.

**Changed in v14:** `template.json` is deprecated. The server still reads it and logs a package warning. Every type listed in `template.json` gets its `documentTypes` entry reset to `{}` and then only `htmlFields`, `filePathFields` and `gmOnlyFields` from the template's document-level block are copied back, so per-subtype declarations in `system.json` are lost for those types. Defaults go into `game.model`. The warning reads: "System template.json is deprecated ... Support for template.json will be removed in V16." `strictDataCleaning` still works while the file exists. Keep the file only for a system that has not yet moved to data models; new systems ship without it. `Game#template` and `System#template` are gone — read `game.system.documentTypes` and `game.model`.

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

  // Register system sheets. Core registers no default Actor/Item sheet,
  // so there is nothing to unregister first.
  foundry.documents.collections.Actors.registerSheet(SYSTEM_ID, CharacterSheet, {
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

**Changed in v14:** `CONFIG.ActiveEffect.legacyTransferral` no longer exists — delete the line. Effects on owned Items with `transfer: true` apply to the Actor in place through `Actor#allApplicableEffects()`; nothing is copied onto the Actor. If you still need the AppV1 sheet class for a fallback, it lives at `foundry.appv1.sheets.ActorSheet` (deprecated since v13, removed in v16).

> **Shared API** — see the foundry-vtt-module-dev skill for Hooks lifecycle (init/setup/ready), Settings API, and Localization.

---

## Namespaces (`foundry.*`)

Nearly every core API moved into the `foundry.*` namespace in v13. In v14 the legacy globals are deprecation shims scheduled for removal in v15 (most) or v16 (the AppV1 framework); the bare `foundry.utils` globals (`mergeObject`, `getProperty`, ...) and the dice-term globals (`Die`, `DiceTerm`, ...) are already gone. Write against the namespaced paths:

| Legacy / global | Namespaced path |
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
| `mergeObject`, `isNewerVersion`, `debounce` | `foundry.utils.*` (bare globals removed in v14) |
| `Hooks` (still global) | `foundry.helpers.Hooks` (alias) |
| (new in v14) | `foundry.data.operators.*` — `ForcedDeletion`, `ForcedReplacement` (globals `_del`, `_replace`) |
| (new in v14) | `foundry.data.ActiveEffectTypeDataModel` — base type data for Active Effects |

For the full table, see the `foundry-vtt-module-dev` skill's "Namespaces" section. The same migration applies — write new files against namespaced paths, update old files when you touch them.

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
| `type` | string | `"system"` — the only allowed value; explicit in v14 manifests |
| `background` | string | Background image for the system setup screen |
| `grid` | object | Default grid — `{ type, distance, units, diagonals }`. The flat v12 `gridDistance` / `gridUnits` pair is removed in v14 (no shim) |
| `initiative` | string | Default initiative formula (overridden by `CONFIG.Combat.initiative.formula` at runtime) |
| `primaryTokenAttribute` | string | Token bar1 attribute path (e.g., `"health"`) |
| `secondaryTokenAttribute` | string | Token bar2 attribute path (e.g., `"power"`) |
| `documentTypes` | object | Declares subtypes per document (`Actor`, `Item`, `JournalEntryPage`, `ActiveEffect`, ...). Each subtype value is an object; `htmlFields`, `filePathFields`, `gmOnlyFields` are the known keys. Primary declaration in v14 |

The `primaryTokenAttribute` and `secondaryTokenAttribute` reference keys in `actor.system`. The attribute must lead to an object with `value` and `max` keys (e.g., `system.health.value` / `system.health.max`).

For full details, read `references/system-manifest.md`.

---

## Declaring Types

The v14 way has two parts, and both are required for every subtype:

1. **`documentTypes` in `system.json`** — the declaration. Any document with `hasTypeData` (Actor, Item, JournalEntryPage, Cards, Card, ChatMessage, Combat, Combatant, RegionBehavior, ActiveEffect, ...) accepts subtypes. Core type names (`base`, `text`, `image`, ...) are reserved and throw.
2. **`TypeDataModel` in `CONFIG.<Document>.dataModels`** — the schema. Field defaults come from `initial`, shared fields from class inheritance, validation from field options, derived values from `prepareDerivedData()`.

```javascript
Hooks.once("init", () => {
  Object.assign(CONFIG.Actor.dataModels, { character: CharacterData, npc: NpcData });
  Object.assign(CONFIG.Item.dataModels, { weapon: WeaponData, spell: SpellData });
});
```

### Legacy: template.json (deprecated since v14, removed in v16)

`template.json` still loads. Its `types` arrays merge into `documentTypes`; its default data lands in `game.model` and is used only for types that have no registered `TypeDataModel` (a data model wins outright). `strictDataCleaning` still applies to that fallback path. The server logs a warning on every start while the file exists.

Migration path for an existing system:

- Move each type name into `documentTypes` in `system.json` (keep `htmlFields` / `filePathFields` / `gmOnlyFields` — they live on the subtype object now).
- Move each template's default values into `initial` options on the matching `TypeDataModel` fields; shared `templates` become a base class.
- Delete `template.json`. Stored documents keep their data; run `migrateData()` only where field paths changed.

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
  async roll({ messageMode } = {}) {
    const rollData = this.getRollData();
    const roll = new foundry.dice.Roll(this.system.formula, rollData);
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${this.name} — ${this.type}`
    }, { messageMode }); // undefined → the user's core.messageMode setting
  }
}
```

**Changed in v14:** the `rollMode` option of `Roll#toMessage` / `ChatMessage.create` is deprecated (until v16) in favour of `messageMode`, a key of `CONFIG.ChatMessage.modes` (`public`, `gm`, `blind`, `self`, `ic`, `epic`, `mc`). Map an old value with `foundry.dice.Roll._mapLegacyRollMode(rollMode)`; read the user default from `game.settings.get("core", "messageMode")`.

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

### Sending Rolls to Chat

`Roll#toMessage(messageData, { messageMode, create })` posts the roll. `messageMode` is a key of `CONFIG.ChatMessage.modes`; leave it undefined to honour the user's `core.messageMode` setting. Blind rolls (`"blind"`) skip interactive dice fulfillment. Chat commands (`/gmroll`, `/blindroll`, ...) are defined in `foundry.applications.sidebar.tabs.ChatLog.CHAT_COMMANDS`; add a system command there, not in the deprecated `MESSAGE_PATTERNS`.

**Changed in v14:** `CONFIG.Dice.rollModes` and `CONST.DICE_ROLL_MODES` are deprecation proxies over `CONFIG.ChatMessage.modes`. A system that offered its own roll-mode selector should iterate `CONFIG.ChatMessage.modes` and pass the chosen key as `messageMode`.

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

The formula uses roll data from the combatant's actor. `@abilities.dex.mod` resolves via `getRollData()`. When the CONFIG formula is empty, `Combatant#_getInitiativeFormula()` falls back to the manifest's `initiative` field.

`Combat#rollInitiative(ids, { formula, updateTurn, messageMode, messageOptions })` posts one chat message per combatant. Hidden combatants roll with `messageMode: "gm"` unless you pass a mode.

**Changed in v14:**
- `messageOptions.rollMode` → top-level `messageMode` (deprecated until v16).
- `Combat#getCombatantByActor` / `getCombatantByToken` → `getCombatantsByActor(actor)` / `getCombatantsByToken(token)`, which return arrays (deprecated until v15).
- `Combat` has a `name` field (editable from the tracker header); `Combatant` has `roundJoined` (the round it entered, initial 1).
- Active Effect expiry is driven by the combat lifecycle: `Combat` calls `ActiveEffect.registry.refresh(event, { combat })` for `combatStart`, `roundStart`, `turnStart`, `turnEnd`, `roundEnd`, `combatEnd` (the values of `CONST.ACTIVE_EFFECT_EXPIRY_EVENTS`), plus `combatRewind` and `updateWorldTime`. An effect's `duration.expiry` names the event that ends it (default `"turnStart"` for numeric durations); `CONFIG.ActiveEffect.expiryAction` (`"update"` sets `duration.expired`, `"delete"` removes the effect, `null` does nothing) decides what happens. A system with its own timing (e.g. "end of the scene") registers a label in `CONFIG.ActiveEffect.expiryEvents` and calls `ActiveEffect.registry.refresh("myEvent", context)` itself.

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

`static migrateData(source, options)` runs on the raw `system` object every time a document is constructed, before validation. Rename fields and transform values here. **It must return the data** — v14 warns (until v16) on implementations that return nothing:

```javascript
class CharacterData extends foundry.abstract.TypeDataModel {
  static migrateData(source, options) {
    // Field rename: hp → health
    if ( "hp" in source && !("health" in source) ) {
      source.health = source.hp;
      delete source.hp;
    }
    // Value transform: string level → number
    if ( typeof source.level === "string" ) source.level = Number(source.level) || 1;
    return super.migrateData(source, options);
  }
}
```

**Field-level migration:** `DataField#_migrate(value, options, _state)` replaces `migrateSource` (deprecated until v16). Override it on a custom field to migrate that field's value wherever the field is used.

### Update Operators

Deleting or replacing keys in an `update()` uses data operators. The `-=key` / `==key` special keys still work but warn (deprecated until v16):

```javascript
// Delete a key
await actor.update({ "system.legacy": _del });                    // global alias
await actor.update({ "system.legacy": new foundry.data.operators.ForcedDeletion() });

// Replace an object wholesale instead of merging into it
await actor.update({ "system.abilities": _replace({ str: 10 }) }); // global alias of ForcedReplacement.create
```

`foundry.utils.mergeObject(..., { applyOperators })` replaces `{ performDeletions }`; `foundry.utils.objectsEqual` → `foundry.utils.equals`.

### template.json → TypeDataModel

Moving a type off `template.json` changes no stored data — the `system` object keeps its keys. Give the `TypeDataModel` the same field paths and the documents load unchanged. Only a path rename needs `migrateData()`. Unknown keys are dropped on the next save unless a field declares them, so audit each template key against `defineSchema()` before deleting the file.

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

**Changed in v14:** `PrototypeToken` uses an allow-list of Token fields: `name`, `displayName`, `actorLink`, `width`, `height`, `depth`, `texture`, `lockRotation`, `rotation`, `alpha`, `disposition`, `displayBars`, `bar1`, `bar2`, `light`, `sight`, `detectionModes`, `occludable`, `ring`, `turnMarker`, `movementAction`, `flags`, plus `randomImg`, `appendNumber`, `prependAdjective`. `depth` is new. `level` and `elevation` are *not* prototype fields — a Token gets those when it is placed on a Scene. Writing them in `_preCreate()` does nothing.

A GM can also set per-type prototype defaults in the world (`PrototypeTokenOverrides`, stored in the `core.prototypeTokenOverrides` setting). Those overrides apply on top of your `_preCreate()` values for `sight.enabled`, `ring.enabled`, `turnMarker`, `displayName`, `displayBars`, `disposition`, and `lockRotation`.

> **Shared API** — see the foundry-vtt-module-dev skill for DialogV2, Active Effects, and compendium import.

For full details, read `references/character-creation.md`.

---

## Advanced System Features

### Status Effects

Replace the core status effects with system-specific conditions in `init`:

```javascript
CONFIG.statusEffects = [
  {
    id: "my-system.prone",
    name: "MY_SYSTEM.Conditions.Prone",
    img: "systems/my-system/icons/conditions/prone.svg",
    system: {
      changes: [{ key: "system.attributes.ac", type: "add", value: -2 }]
    }
  },
  {
    id: "my-system.dead",
    name: "MY_SYSTEM.Conditions.Dead",
    img: "systems/my-system/icons/conditions/dead.svg",
    overlay: true
  }
];
CONFIG.specialStatusEffects.DEFEATED = "my-system.dead";
```

A system may still assign a whole array — the setter clears the old entries and pushes the new ones. `ActiveEffect.fromStatusEffect(id)` copies each entry (minus `id` and `hud`) into the effect data, so any `ActiveEffectData` field works here: `changes` under `system`, `duration`, `statuses`, `showIcon`, `_id`.

**Changed in v14:**
- `CONFIG.statusEffects` is a Proxy over the array and is also indexed by status id. A module adds one condition with `CONFIG.statusEffects["my-module.dazed"] = {...}` instead of pushing; `delete CONFIG.statusEffects["dead"]` removes one. Read with `Object.values(CONFIG.statusEffects)` or `foundry.utils.iterateValues`.
- `icon` and `label` are deprecated aliases for `img` and `name`.
- Changes live in `system.changes` with a string `type` (`"add"`, `"multiply"`, `"override"`, `"upgrade"`, `"downgrade"`, `"subtract"`, `"custom"`), not a numeric `mode`. A root-level `changes` array still loads — `migrateData` moves it to `system.changes` and maps the mode — but it warns. An entry with no `type` field gets `"base"`, so `system.changes` uses `ActiveEffectTypeDataModel`.
- `hud: false` (or `hud: {actorTypes: ["character"]}`) controls whether the condition shows in the Token HUD.

### Active Effect Subtypes

Active Effects are typed documents in v14. Declare subtypes in `system.json` under `documentTypes.ActiveEffect` and register a data model per subtype (a system uses bare names; a module prefixes them with its id). Every model must keep a `changes` ArrayField whose element schema defines `type`, `phase`, and `priority` — Foundry verifies this at startup and throws otherwise:

```javascript
class SpellEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return Object.assign(super.defineSchema(), {
      spellLevel: new fields.NumberField({ integer: true, min: 0, initial: 1 }),
      isSuppressed: new fields.BooleanField()
    });
  }
}

Hooks.once("init", () => {
  Object.assign(CONFIG.ActiveEffect.dataModels, { spell: SpellEffectData });

  // Register a system-specific change type
  CONFIG.ActiveEffect.changeTypes["my-system.percent"] = {
    label: "MY_SYSTEM.Changes.Percent",
    defaultPriority: 30,
    handler: (targetDoc, change, { modifyTarget = true } = {}) => {
      const current = foundry.utils.getProperty(targetDoc, change.key) ?? 0;
      const update = current * (1 + (Number(change.value) / 100));
      if ( modifyTarget ) foundry.utils.setProperty(targetDoc, change.key, update);
      return { [change.key]: update };
    }
  };
});
```

`ActiveEffect` is a compendium document type in v14, so a system can ship a pack of conditions. Effects apply in phases: `Actor#applyActiveEffects("initial")` runs in `prepareEmbeddedDocuments()`, `applyActiveEffects("final")` after `prepareDerivedData()`. Register extra phases in `CONFIG.ActiveEffect.phases` and call `applyActiveEffects("myPhase")` yourself. `ActiveEffect.CHANGE_TYPES` is the merged, cached view of `CONST.ACTIVE_EFFECT_CHANGE_TYPES` and your registrations — register in `init`, before it is first read. To change how a core type applies, override the static `_applyChangeAdd` / `_applyChangeSubtract` / `_applyChangeMultiply` / `_applyChangeOverride` / `_applyChangeUpgrade` / `_applyChangeCustom` / `_applyChangeUnguided` methods on your `ActiveEffect` subclass. Read `foundry-vtt-module-dev/references/active-effects-v2.md` for the whole model.

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

Now `@Check[strength]{STR Save}` in any enriched text becomes a clickable link. Handle clicks via `data-action` in your sheet's action handlers. Give the enricher an `id` if you also need an `onRender` callback.

**Changed in v14:** TinyMCE is gone; ProseMirror is the only editor. Register an alternative engine in `CONFIG.TextEditor.engines`. `CONFIG.TextEditor.inserts` lets a system add its own ProseMirror insert menu entries (`{ action, title, html, inline?, children? }`) — a readaloud block, a stat-block wrapper — without writing a ProseMirror plugin.

### Token Customization

Override `CONFIG.Token.objectClass` to customize token rendering (e.g., custom resource bars):

```javascript
CONFIG.Token.objectClass = MySystemToken;
```

Override `CONFIG.Token.documentClass` for custom token data handling. Set per-type prototype token defaults in `_preCreate()` — characters get `actorLink: true` and friendly disposition, NPCs get `actorLink: false` and hostile disposition.

Resource bar colors come from `CONFIG.Token.barConfig` (`{ bar1: { colors: { empty, full } }, bar2: {...} }`, `Color` values). Override `Token#_getBarColors(index, data)` on your `CONFIG.Token.objectClass` to color a bar from the actor's state — green while healthy, red when bloodied:

```javascript
class MySystemToken extends foundry.canvas.placeables.Token {
  _getBarColors(index, data) {
    if ( index !== 0 ) return super._getBarColors(index, data);
    const pct = data.value / data.max;
    return pct < 0.5
      ? { empty: foundry.utils.Color.from("#400"), full: foundry.utils.Color.from("#f22") }
      : super._getBarColors(index, data);
  }
}
```

**Changed in v14:** `CONFIG.<Document>.layerClass` is deprecated. Replace a canvas layer through `CONFIG.Canvas.layers.<name>.layerClass` instead. Tokens carry `level` and `depth` fields — see `foundry-vtt-module-dev/references/scene-levels.md`.

### Custom Journal Entry Pages

Define system-specific journal page types (class descriptions, bestiary entries) using `TypeDataModel`:

```javascript
CONFIG.JournalEntryPage.dataModels["class"] = ClassPageData;
foundry.applications.apps.DocumentSheetConfig.registerSheet(
  foundry.documents.JournalEntryPage, "my-system", ClassPageSheet,
  { types: ["class"], makeDefault: true }
);
```

Declare custom page types in `system.json` under `documentTypes.JournalEntryPage`. Core reserves the `text`, `image`, `pdf`, and `video` type names.

**Changed in v14:** the bare `DocumentSheetConfig` global is a deprecation shim — use `foundry.applications.apps.DocumentSheetConfig`. `JournalEntryCategory` is a new embedded document; pages carry a `category` field for grouping in the journal sidebar.

### Templates with Regions

The `MeasuredTemplate` document is gone in v14. Area-of-effect shapes are Regions. `RegionDocument` has ten shape types — `circle`, `cone`, `ellipse`, `emanation`, `grid`, `line`, `polygon`, `rectangle`, `ring`, `token` — and `canvas.regions` places them interactively:

```javascript
// Ask the user to place a 30-unit radius burst, then read who is inside it.
const region = await canvas.regions.placeRegion({
  name: "Fireball",
  shapes: [{ type: "circle", x: 0, y: 0, radius: canvas.dimensions.distancePixels * 30 }],
  visibility: CONST.REGION_VISIBILITY.ALWAYS,
  levels: [canvas.level.id]
}, { create: false });
if ( region ) {
  const targets = canvas.tokens.placeables.filter(t =>
    region.testPoint({ ...t.center, elevation: t.document.elevation }));
}
```

`placeRegion(data, options)` returns the placed `RegionDocument`, or `null` if the user cancelled. `create: false` gives an unsaved preview document — the right choice for a throwaway template. `placeRegions(dataArray, options)` places several in one gesture. Both accept `attachToToken`, `allowRotation`, `allowEmpty`, and the `onMove` / `onRotate` / `preConfirm` / `preCommit` callbacks.

For an aura that follows its owner, use `RegionDocument.createTokenEmanation(token, range, regionData, { excludeToken, gridBased })` — it creates the Region, sizes it from the token's own shape, and attaches it.

`canvas.regions.templateMode` is the player-facing toggle: on, the Region tools place one-off templates; off, the GM edits persistent Regions. It defaults to on for non-GM users.

Read `foundry-vtt-module-dev/references/measured-templates.md` for the full replacement guide.

For full details on these topics, read `references/advanced-system-features.md`.

---

## Styling & Themes

Systems carry the bulk of CSS in any Foundry world — character sheets, item sheets, chat cards. The patterns below are extracted from the two largest production systems (`foundryvtt/dnd5e` and `foundryvtt/pf2e`) and codify what works at scale on v14. The mechanism did not change in v14 — the same `body.theme-light` / `body.theme-dark` classes, the same `.themed` marker, the same `@layer` names — v14 only adds custom properties.

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
| Active Effects (V2) | `references/active-effects-v2.md` | `system.changes[]` with string `type`; register subtypes and change types in `init`; iterate with `allApplicableEffects()` |
| v13 → v14 migration | `references/v14-migration.md` | Breaking changes, deprecations with removal versions, checklist |
| Scene Levels | `references/scene-levels.md` | `scene.levels`, `canvas.level`, `levels` on placeables, Token `level` / `depth` |
| Templates with Regions | `references/measured-templates.md` | `MeasuredTemplate` removed — place area effects with `canvas.regions.placeRegion` |
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
3. **Declaring types in template.json only** — `documentTypes` in `system.json` is the declaration in v14. A type that lives only in `template.json` still loads, but the file warns on every start and goes away in v16. Move the type names into `documentTypes`.
4. **getRollData() not returning system data** — Roll formulas like `@abilities.str.mod` won't resolve if `getRollData()` doesn't return the right structure. The returned object is what `@` references resolve against.
5. **_preCreate() calling update() instead of updateSource()** — In `_preCreate()`, use `this.updateSource()` to modify creation data. Using `update()` tries to write to the DB before the document exists.
6. **Custom DiceTerm not registered** — Setting `CONFIG.Dice.terms["x"] = MyTerm` in `init` is required. Without registration, `Roll.parse()` can't recognize the custom operator.
7. **Initiative formula referencing missing data** — `CONFIG.Combat.initiative.formula` uses actor roll data. If the referenced fields don't exist in `getRollData()`, initiative rolls fail silently or produce NaN.
8. **migrateData() not returning the data** — The signature is `static migrateData(source, options)` and it must return the migrated source. v14 warns (until v16) on an implementation that returns nothing. End with `return super.migrateData(source, options)`.
9. **System ID mismatch** — `system.json` `id` must match the folder name exactly. Foundry uses the folder name to locate the system.
10. **Leaving template.json in place after moving to data models** — Defaults in `game.model` are only a fallback for types with no registered `TypeDataModel`. Once every type has a model, the file does nothing but log a deprecation warning. Delete it.
11. **Item.roll() not using getRollData()** — Item rolls should use `this.getRollData()` (which includes parent actor data) not just `this.system`. Otherwise `@abilities.str` won't resolve.
12. **Confusing module documentTypes with system documentTypes** — Modules can also declare `documentTypes`, but systems own the core types. A system's types are the primary game types; module types are extensions.
13. **Numeric Active Effect modes** — `mode: CONST.ACTIVE_EFFECT_MODES.ADD` and a root-level `changes` array still load through a shim, but they warn and go away in v16. Write `system.changes` with a string `type`.
14. **`rollMode` on chat messages** — Pass `messageMode` (a key of `CONFIG.ChatMessage.modes`) instead. `rollMode` is deprecated until v16 and the user's default now lives in the `core.messageMode` setting.
15. **`-=` and `==` update keys** — Use `_del` and `_replace` (or `foundry.data.operators.ForcedDeletion` / `ForcedReplacement`). The special key prefixes warn and go away in v16.
16. **Flat `gridDistance` / `gridUnits` in system.json** — The v13 migration shim is gone in v14. The keys are ignored and the system falls back to the default grid. Use the `grid` object.
17. **CONFIG values in static initializers** — `static PARTS = { template: CONFIG.mySystem.templates.foo }` fails because CONFIG is undefined during class static initialization. Use string literals for template paths, or resolve CONFIG values in `_prepareContext()` or `static get PARTS()`.

---

## Boilerplate Files

| File | Purpose |
|---|---|
| `boilerplate/system.json` | v14 manifest — `type: "system"`, compatibility 14, `documentTypes` with htmlFields/filePathFields, `grid` object, hotReload, packFolders, migration version flags |
| `boilerplate/template.json` | Legacy type list kept as a v13 compatibility example. Deprecated since v14, removed in v16 — a new system omits the file |
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
| `references/data-migration.md` | migrateData(), schema versioning, migration registry, bulk migration |
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
| `foundry-vtt-module-dev/references/v14-migration.md` | Every v13 → v14 breaking change, each deprecation with its replacement and removal version |
| `foundry-vtt-module-dev/references/active-effects-v2.md` | The Active Effect V2 model — `system.changes`, change types, phases, duration and expiry |
| `foundry-vtt-module-dev/references/scene-levels.md` | The `Level` document, `canvas.level`, level-aware placeables, fog modes |
| `foundry-vtt-module-dev/references/measured-templates.md` | Replacing MeasuredTemplate with Regions — shapes, `placeRegion`, emanations |
