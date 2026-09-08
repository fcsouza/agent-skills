# System Manifest

Deep reference for Foundry VTT v14's `system.json`, and for the deprecated `template.json`.

Every field below is checked against `common/packages/base-package.mjs` and `common/packages/base-system.mjs` in v14.

---

## 1. system.json Full Reference

The `system.json` file is the manifest that declares your system's identity, metadata, compatibility, and entry points. Foundry reads it during installation and startup. The schema is `BasePackage.defineSchema()` plus the system-only fields from `BaseSystem.defineSchema()`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique system identifier. Must match `/^[A-Za-z0-9-_]+$/` (`BasePackage.validateId`). Reserved OS names (`con`, `nul`, `com1`, ...) throw. |
| `type` | `"system"` | Package type. Changed in v14: an explicit `type` field with a single allowed value (`"system"`). Optional; the initial value is `"system"`. |
| `title` | `string` | Human-readable display name shown in the setup screen. Required. |
| `description` | `string` | Description of the system. `HTMLField`, so it may contain HTML. Required (may be blank). |
| `version` | `string` | Version of this release (e.g. `"1.0.0"`). Must not contain `' " < > &`. |
| `compatibility` | `object` | `{minimum, verified, maximum}` core versions. See below. |
| `authors` | `object[]` | Array of `{name, email?, url?, discord?, flags?}`. Other keys (Patreon, etc.) go under `flags`. |
| `url` | `string` | URL to the project repository. |
| `license` | `string` | Path to the LICENSE file within the system folder. |
| `readme` | `string` | Path to the README file within the system folder. |
| `bugs` | `string` | URL for filing bug reports. |
| `changelog` | `string` | Path to the CHANGELOG file within the system folder. |
| `manifest` | `string` | URL to the latest release `system.json` for auto-updates. |
| `download` | `string` | URL to a `.zip` archive of the current version. |
| `media` | `object[]` | Media assets for the package listing. `{type, url, thumbnail?, caption?, loop?, flags?}`. `type: "setup"` shows on the setup screen. |
| `background` | `string` | Path to a default background banner for worlds created with this system. |
| `initiative` | `string` | Default initiative formula (e.g. `"1d20"`). |
| `scripts` | `string[]` | Classic (non-module) scripts loaded at startup. |
| `esmodules` | `string[]` | ES module entry points loaded at startup. Relative to system root. |
| `styles` | `(string \| object)[]` | CSS files loaded at startup. Each entry is `{src, layer?}`; a plain string is migrated to `{src}` by `BasePackage._migrateStyles` (deprecated since v13). `layer` names the CSS cascade layer the stylesheet is placed in. |
| `languages` | `object[]` | Localization files. `{lang, name?, path, system?, module?, flags?}`. `lang` is validated by `Intl.getCanonicalLocales`. `system` and `module` restrict the file to when that package is active and must pass `validateId`. |
| `packs` | `object[]` | Compendium packs shipped with the system. `{name, label, path?, type, system?, banner?, ownership?, flags?}`. See validation rules below. |
| `packFolders` | `object[]` | Folder structure for packs in the sidebar. `{name, sorting?: "a"\|"m", color?, packs: string[], folders?}`, nested up to three levels. |
| `relationships` | `object` | `{systems, requires, recommends, conflicts, flags}`. Each entry is `{id, type?, manifest?, compatibility?, reason?}`. Systems rarely need this. |
| `socket` | `boolean` | Whether the system requires a `system.<id>` socket namespace. |
| `documentTypes` | `object` | Document subtypes provided by this system. The v14 way to declare types. See §2. |
| `grid` | `object` | Default scene grid: `{type, distance, units, diagonals}`. Changed in v14: the flat `gridDistance`/`gridUnits` keys and their v12 shims are gone. |
| `primaryTokenAttribute` | `string` | Resource bar 1 on tokens (e.g. `"attributes.hp"`). Maps to `actor.system.attributes.hp`. |
| `secondaryTokenAttribute` | `string` | Resource bar 2 on tokens. |
| `strictDataCleaning` | `boolean` | Only affects the deprecated `template.json` path: when `true`, keys not in the template are dropped. Not part of the schema; read by the client `System` constructor. |
| `persistentStorage` | `boolean` | Keep the contents of the system's `/storage` folder across updates. |
| `protected` | `boolean` | Uses the protected content access system. |
| `exclusive` | `boolean` | Free Exclusive pack. |
| `flags` | `object` | Free-form flags. Core reads `flags.hotReload`, `flags.compendiumArtMappings`, `flags.tokenRingSubjectMappings`, `flags.canUpload`. |

### compatibility Object

```js
// minimum: oldest supported core version
// verified: version the system was tested against
// maximum: newest supported version (optional, rarely used)
{
  "minimum": "14",
  "verified": "14"
}
```

Use strings. A bare generation (`"14"`) matches every build of that generation; a full build (`"14.367"`) is exact. `BasePackage.testAvailability` returns a `CONST.PACKAGE_AVAILABILITY_CODES` value. Changed in v14: `REQUIRES_CORE_UPGRADE_UNKNOWN` (10) was inserted and `REQUIRES_DEPENDENCY_UPDATE` moved to 11. Compare against the named constants, never the numbers.

### grid Object

```json
{
  "grid": {
    "type": 1,
    "distance": 5,
    "units": "ft",
    "diagonals": 0
  }
}
```

`type` is a `CONST.GRID_TYPES` value (`SQUARE` = 1). `diagonals` is a `CONST.GRID_DIAGONALS` value (`EQUIDISTANT` = 0). `distance` must be positive.

### Full Example

```json
{
  "id": "my-system",
  "type": "system",
  "title": "My System",
  "description": "A custom tabletop RPG system for Foundry VTT.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "14",
    "verified": "14"
  },
  "authors": [
    {
      "name": "Your Name",
      "discord": "yourhandle"
    }
  ],
  "url": "https://github.com/you/my-system",
  "license": "LICENSE.txt",
  "readme": "README.md",
  "bugs": "https://github.com/you/my-system/issues",
  "changelog": "CHANGELOG.md",
  "manifest": "https://github.com/you/my-system/releases/latest/download/system.json",
  "download": "https://github.com/you/my-system/releases/download/1.0.0/system.zip",
  "media": [
    {
      "type": "setup",
      "url": "systems/my-system/assets/banner.webp",
      "thumbnail": "systems/my-system/assets/banner-thumb.webp",
      "caption": "My System character sheet"
    }
  ],
  "background": "systems/my-system/assets/background.webp",
  "initiative": "1d20 + @abilities.dex.mod",
  "esmodules": ["module/my-system.mjs"],
  "styles": [{ "src": "css/my-system.css", "layer": "system" }],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "documentTypes": {
    "Actor": {
      "character": { "htmlFields": ["biography"] },
      "npc": { "htmlFields": ["biography"] }
    },
    "Item": {
      "weapon": { "htmlFields": ["description"] },
      "spell": { "htmlFields": ["description"] }
    }
  },
  "packs": [
    {
      "name": "monsters",
      "label": "Monsters",
      "path": "packs/monsters",
      "type": "Actor",
      "system": "my-system"
    }
  ],
  "packFolders": [],
  "socket": false,
  "grid": { "type": 1, "distance": 5, "units": "ft", "diagonals": 0 },
  "primaryTokenAttribute": "attributes.hp",
  "secondaryTokenAttribute": "attributes.mp",
  "flags": {
    "hotReload": {
      "extensions": ["css", "hbs", "json"],
      "paths": ["css", "templates", "lang"]
    }
  }
}
```

### Manifest Validation Rules (v14)

- Pack `name` must pass `BasePackage.validateId` (`[A-Za-z0-9-_]`). Changed in v14: the v12 shim that slugified bad names is gone; a bad name fails validation.
- Duplicate pack names or duplicate pack paths throw from `PackageCompendiumPacks._validateModel`. Changed in v14: this was a soft validation failure in v13.
- A pack of a `CONST.SYSTEM_SPECIFIC_COMPENDIUM_TYPES` type (`ActiveEffect`, `Actor`, `Item`) must declare `system`. Changed in v14: `ActiveEffect` joined this list.
- `path` defaults to `packs/<name>`; a trailing `.db` is stripped.
- `languages[].system`, `languages[].module`, and `packs[].system` are validated with `validateId`.
- Unknown top-level keys are collected in `package._unknownKeys`. The legacy keys `name`, `author`, `minimumCoreVersion`, `compatibleCoreVersion`, `maximumCoreVersion`, `systems` are recognised and mapped to `id`, `authors`, `compatibility.minimum`, `compatibility.verified`, `compatibility.maximum`, `relationships.systems`. Do not ship them.
- `flags.hotReload` is `{extensions: string[], paths: string[]}`. See `production-patterns.md` §3.

---

## 2. documentTypes in system.json

`documentTypes` declares your subtypes. In v14 this is the primary declaration; `template.json` is deprecated (§3). Keys are document names, then subtype names, then a per-type config object.

```json
{
  "documentTypes": {
    "Actor": {
      "character": {
        "htmlFields": ["biography"],
        "filePathFields": { "portrait": ["IMAGE"] }
      },
      "npc": {}
    },
    "Item": {
      "weapon": {},
      "spell": {}
    },
    "ActiveEffect": {
      "condition": {}
    }
  }
}
```

Rules enforced by `AdditionalTypesField`:

- The document must support subtypes (`Document.hasTypeData`). In v14 that is `ActiveEffect`, `Actor`, `Card`, `Cards`, `ChatMessage`, `Combat`, `Combatant`, `CombatantGroup`, `Item`, `JournalEntryPage`, `RegionBehavior`. Changed in v14: `ActiveEffect` gained subtypes.
- A subtype name may not collide with the document's `metadata.coreTypes`.
- Each subtype config must be a plain object.

Per-subtype config keys (`ServerSanitizationFields`, paths relative to `system`):

| Key | Type | Purpose |
|-----|------|---------|
| `htmlFields` | `string[]` | HTML fields the server sanitizes. |
| `filePathFields` | `Record<string, string[]>` | Field path to allowed `CONST.FILE_CATEGORIES` keys. |
| `gmOnlyFields` | `string[]` | Fields only a GM may update. |

Type labels and hints come from the language file, not the manifest. `Localization` fills `CONFIG.<Doc>.typeLabels[type]` from `TYPES.<Doc>.<type>` and `CONFIG.<Doc>.typeHints[type]` from `TYPES.HINTS.<Doc>.<type>` when that key exists. The create dialog shows the hint under the type select.

```json
{
  "TYPES": {
    "Actor": { "character": "Character", "npc": "NPC" },
    "HINTS": { "Actor": { "character": "A player-controlled hero." } }
  }
}
```

### Registering documentTypes in init Hook

`documentTypes` says a type exists. The `TypeDataModel` registered in `init` defines its schema. Every declared type should have a model; without one, `system` is cleaned as a plain object.

```js
import { CharacterData } from "./data/actors/character.mjs";
import { NpcData } from "./data/actors/npc.mjs";
import { WeaponData } from "./data/items/weapon.mjs";
import { SpellData } from "./data/items/spell.mjs";
import { ConditionData } from "./data/effects/condition.mjs";

Hooks.once("init", () => {
  // Keys must match the subtype names declared in documentTypes
  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData
  });

  Object.assign(CONFIG.Item.dataModels, {
    weapon: WeaponData,
    spell: SpellData
  });

  // ActiveEffect subtypes (v14): the model must keep a `changes` ArrayField
  Object.assign(CONFIG.ActiveEffect.dataModels, {
    condition: ConditionData
  });
});
```

### ActiveEffect Subtypes

`CONFIG.ActiveEffect.dataModels.base` is `foundry.data.ActiveEffectTypeDataModel`, whose schema is `changes: ArrayField<{key, type, value, phase, priority}>`. A custom subtype must extend it, or at least keep a `changes` ArrayField whose element schema has a string `type`, a string `phase`, and a numeric `priority`. Foundry verifies every registered ActiveEffect data model at setup and throws on a bad shape. The full change model is in `foundry-vtt-module-dev/references/active-effects-v2.md`.

```js
class ConditionData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),          // keeps `changes`
      severity: new fields.NumberField({ integer: true, min: 1, initial: 1 })
    };
  }
}
```

### documentTypes vs template.json

- `documentTypes` is the manifest-level list of subtypes. It is what `game.documentTypes` and the create dialogs read.
- `template.json` is deprecated since v14 (until v16). It still loads, but only fills defaults for types with no registered `TypeDataModel`.
- Declare every type in `documentTypes` and give every type a `TypeDataModel`. Defaults live in field `initial` values.

---

## 3. template.json Structure (Deprecated)

Deprecated since v14, scheduled for removal in v16. Keep this section to read old systems, not to write new ones.

### Exact v14 behaviour

- The server still parses `template.json` and sends it to the client. `game.model` is the frozen result, keyed `game.model[documentName][type]`. `Game#setupPackages` derives `game.documentTypes` from the keys of `game.model` (`client/game.mjs`), so `game.documentTypes` is only as complete as the model the server sends.
- `TypeDataField#_cleanType` first looks for a registered model (`CONFIG.<Doc>.dataModels[type]`). If one exists, the template is never consulted. Only when no model is registered does it fall back to `mergeObject(game.model[doc][type], value, {insertKeys})`, where `insertKeys` is `false` if `game.system.strictDataCleaning` is `true`. That fallback carries the `@deprecated since v14 until v16` marker in `common/data/fields.mjs`.
- No client-side `logCompatibilityWarning` fires for merely shipping a `template.json`. The only warning on this client path is for a `migrateData` implementation that returns `undefined` (see `data-migration.md` §2). The server may warn separately.
- `Game#template` and `System#template` were removed in v14 (their v12 shims expired). Use `game.model` or, better, `game.documentTypes`.

### Top-Level Structure

```json
{
  "Actor": {
    "types": ["character", "npc"],
    "templates": { },
    "character": { },
    "npc": { }
  },
  "Item": {
    "types": ["weapon", "spell"],
    "templates": { },
    "weapon": { },
    "spell": { }
  }
}
```

- **`types`**: Array of subtype strings.
- **`templates`**: Named base templates that types can inherit from.
- **Type entries** (e.g. `"character"`): Default data for that type. Can reference templates.

### Example

```json
{
  "Actor": {
    "types": ["character", "npc"],
    "templates": {
      "base": {
        "health": { "value": 10, "min": 0, "max": 10 },
        "biography": ""
      }
    },
    "character": {
      "templates": ["base"],
      "abilities": {
        "str": { "value": 10 },
        "dex": { "value": 10 }
      }
    },
    "npc": {
      "templates": ["base"],
      "cr": 0
    }
  },
  "Item": {
    "types": ["weapon"],
    "weapon": { "description": "", "damage": "1d8" }
  }
}
```

---

## 4. Template Inheritance (Deprecated)

Templates listed in a type's `templates` array are merged in order, then the type's own keys are merged on top. The merge is deep. Later entries win.

```js
// "character" with templates: ["base"] → base + character-specific fields
{
  health: { value: 10, min: 0, max: 10 },
  biography: "",
  abilities: { str: { value: 10 }, dex: { value: 10 } }
}
```

In v14 code, express the same sharing with class inheritance or a mixin, not JSON:

```js
// A base model replaces a template.json "templates" entry
class BaseActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),
      biography: new fields.HTMLField({ initial: "" })
    };
  }
}

// Subclasses extend the schema with `...super.defineSchema()`
class CharacterData extends BaseActorData {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      abilities: new fields.SchemaField({
        str: new fields.SchemaField({ value: new fields.NumberField({ integer: true, initial: 10 }) }),
        dex: new fields.SchemaField({ value: new fields.NumberField({ integer: true, initial: 10 }) })
      })
    };
  }
}

// Mixins work when a type needs more than one shared block
const ResourcesMixin = Base => class extends Base {
  static defineSchema() {
    const fields = foundry.data.fields;
    return { ...super.defineSchema(), mana: new fields.NumberField({ integer: true, min: 0, initial: 5 }) };
  }
};
class NpcData extends ResourcesMixin(BaseActorData) {}
```

---

## 5. Moving from template.json to TypeDataModel

Each `template.json` concept has a direct replacement.

| template.json concept | v14 replacement |
|-----------------------|-----------------|
| `Actor.types` / `Item.types` | Keys under `documentTypes.Actor` / `documentTypes.Item` in `system.json` |
| Per-type default object | `TypeDataModel.defineSchema()` with `initial` on each field |
| `templates` block | A base `TypeDataModel` class, or a mixin, extended via `...super.defineSchema()` |
| `"templates": ["base"]` on a type | `class CharacterData extends BaseActorData` |
| `strictDataCleaning: true` | Default behaviour of a schema: unknown keys are pruned |
| Reading defaults from `game.model` | `CONFIG.Actor.dataModels[type].cleanData({})` |

### Recipe

1. Copy the `types` arrays into `documentTypes` (empty objects are fine; add `htmlFields` where you have HTML).
2. For every type, write a `TypeDataModel` whose `initial` values equal the old defaults. Register it in `init`.
3. Turn each `templates` entry into a base class or mixin.
4. Delete `template.json`. Nothing in v14 requires it once every type has a model.
5. If existing worlds hold keys the new schema does not define, add a `static migrateData(source, options)` that renames or drops them and returns `source` (see `data-migration.md`).

### Why not keep both

- With a model registered, `template.json` defaults are ignored, so the two files drift apart silently.
- The fallback is removed in v16. Systems that still depend on it will lose their defaults.
- `game.model` still exists in v14 for reading, but nothing in a new system should write to it or depend on it.
