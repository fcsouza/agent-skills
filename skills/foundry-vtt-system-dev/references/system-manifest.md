# System Manifest

Deep reference for Foundry VTT v13's system.json and template.json.

---

## 1. system.json Full Reference

The `system.json` file is the manifest that declares your system's identity, metadata, compatibility, and entry points. Foundry reads it during installation and startup.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique system identifier. Lowercase, no spaces. Used as the package ID throughout Foundry. |
| `title` | `string` | Human-readable display name shown in the setup screen. |
| `description` | `string` | Short description of the system. |
| `version` | `string` | Semantic version of this release (e.g. `"1.0.0"`). |
| `compatibility` | `object` | Minimum and verified core versions. See below. |
| `authors` | `object[]` | Array of `{name, discord?, url?, patreon?, flags?}`. |
| `url` | `string` | URL to the project repository. |
| `license` | `string` | Path to the LICENSE file within the system folder. |
| `readme` | `string` | Path to the README file within the system folder. |
| `bugs` | `string` | URL for filing bug reports. |
| `changelog` | `string` | Path to the CHANGELOG file within the system folder. |
| `manifest` | `string` | URL to the latest release `system.json` for auto-updates. |
| `download` | `string` | URL to a `.zip` archive of the current version. |
| `media` | `object[]` | Media assets for the package listing. `{type, url, thumbnail?, caption?, loop?}`. |
| `background` | `string` | Path to a background image for the setup screen. |
| `esmodules` | `string[]` | ES module entry points loaded at startup. Relative to system root. |
| `styles` | `string[]` | CSS files loaded at startup. Relative to system root. |
| `languages` | `object[]` | Localization files. `{lang, name, path, flags?}`. |
| `packs` | `object[]` | Compendium packs shipped with the system. |
| `packFolders` | `object[]` | Folder structure for organizing packs in the UI. |
| `socket` | `boolean` | Whether the system requires socket communication. |
| `documentTypes` | `object` | Custom Actor/Item subtypes declared at the manifest level (v13). |
| `gridDistance` | `number` | Default grid distance for scenes using this system. |
| `gridUnits` | `string` | Unit label for grid distance (e.g. `"ft"`, `"m"`). |
| `primaryTokenAttribute` | `string` | Resource bar 1 on tokens (e.g. `"health"`). Maps to `actor.system.health.value`. |
| `secondaryTokenAttribute` | `string` | Resource bar 2 on tokens (e.g. `"power"`). |

### compatibility Object

```js
// minimum: oldest supported version
// verified: version the system was tested against
// maximum: newest supported version (optional, rarely used)
{
  "minimum": "13",
  "verified": "13"
}
```

### Full Example

```json
{
  "id": "my-system",
  "title": "My System",
  "description": "A custom tabletop RPG system for Foundry VTT.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": 12,
    "verified": 13
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
  "esmodules": ["module/my-system.mjs"],
  "styles": ["css/my-system.css"],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "packs": [],
  "packFolders": [],
  "socket": false,
  "gridDistance": 5,
  "gridUnits": "ft",
  "primaryTokenAttribute": "attributes.hp",
  "secondaryTokenAttribute": "attributes.mp"
}
```

---

## 2. documentTypes in system.json

In v13, `system.json` supports a `documentTypes` field that declares custom Actor and Item subtypes at the manifest level. This supplements `template.json` and `TypeDataModel` registration.

```json
{
  "documentTypes": {
    "Actor": {
      "vehicle": {}
    },
    "Item": {
      "gear": {}
    }
  }
}
```

### Registering documentTypes in init Hook

The `documentTypes` in `system.json` declares the types exist. You must still register the corresponding `TypeDataModel` classes in your `init` hook so Foundry knows how to validate and structure the data.

```js
import { CharacterData } from "./data/actors/character.mjs";
import { NpcData } from "./data/actors/npc.mjs";
import { WeaponData } from "./data/items/weapon.mjs";
import { SpellData } from "./data/items/spell.mjs";

Hooks.once("init", () => {
  // Register TypeDataModel classes for each Actor subtype
  // Keys must match the types declared in template.json or documentTypes
  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData
  });

  // Register TypeDataModel classes for each Item subtype
  Object.assign(CONFIG.Item.dataModels, {
    weapon: WeaponData,
    spell: SpellData
  });
});
```

### documentTypes vs template.json

- **template.json** defines types with their default data structure (fields and initial values).
- **documentTypes** in `system.json` is a manifest-level declaration that tells Foundry which custom subtypes exist before any data is loaded.
- In v13, both approaches coexist. `template.json` is still the primary way systems define types and default data. `documentTypes` is used primarily by modules that add new document subtypes.
- For systems, prefer `template.json` for type declarations with default data, and register `TypeDataModel` classes in `init`.

---

## 3. template.json Structure

`template.json` defines the data schema for your system's Actor and Item types. It declares which types exist, shared template data, and per-type default values.

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

- **`types`**: Array of subtype strings. Each becomes a valid value for `actor.type` or `item.type`.
- **`templates`**: Object of named base templates that types can inherit from.
- **Type entries** (e.g. `"character"`): Default data for that specific type. Can reference templates.

### Full Example

```json
{
  "Actor": {
    "types": ["character", "npc"],
    "templates": {
      "base": {
        "health": {
          "value": 10,
          "min": 0,
          "max": 10
        },
        "power": {
          "value": 5,
          "min": 0,
          "max": 5
        },
        "biography": ""
      }
    },
    "character": {
      "templates": ["base"],
      "attributes": {
        "level": { "value": 1 }
      },
      "abilities": {
        "str": { "value": 10 },
        "dex": { "value": 10 },
        "con": { "value": 10 },
        "int": { "value": 10 },
        "wis": { "value": 10 },
        "cha": { "value": 10 }
      }
    },
    "npc": {
      "templates": ["base"],
      "cr": 0
    }
  },
  "Item": {
    "types": ["weapon", "spell"],
    "templates": {
      "base": {
        "description": ""
      }
    },
    "weapon": {
      "templates": ["base"],
      "damage": "1d8",
      "range": "melee"
    },
    "spell": {
      "templates": ["base"],
      "spellLevel": 1,
      "school": "evocation"
    }
  }
}
```

---

## 4. Template Inheritance

Templates in `template.json` allow multiple types to share common data structures. A type references one or more templates via its `templates` array.

### How It Works

```json
{
  "Actor": {
    "templates": {
      "attributes": {
        "strength": { "value": 10 },
        "dexterity": { "value": 10 }
      },
      "resources": {
        "health": { "value": 10, "max": 10 },
        "mana": { "value": 5, "max": 5 }
      }
    },
    "hero": {
      "templates": ["attributes", "resources"],
      "goodness": { "value": 5, "max": 10 }
    },
    "pawn": {
      "templates": ["resources"]
    }
  }
}
```

### Merging Behavior

- Templates listed in the `templates` array are merged in order. Later templates override earlier ones for duplicate keys.
- Type-specific data is merged on top of template data. Type fields always win over template fields.
- The merge is deep — nested objects are recursively merged, not replaced.

```js
// For "hero" type with templates: ["attributes", "resources"]:
// Final system data = attributes + resources + hero-specific fields
// Result:
{
  strength: { value: 10 },
  dexterity: { value: 10 },
  health: { value: 10, max: 10 },
  mana: { value: 5, max: 5 },
  goodness: { value: 5, max: 10 }
}
```

### Best Practices

- Use templates for data shared across multiple types (e.g. base stats, biography).
- Keep templates focused — one concern per template.
- A type with no `templates` array uses only its own type-specific data.
- Templates are purely a data-default mechanism. They do not affect behavior or methods.

---

## 5. template.json vs TypeDataModel

Both `template.json` and `TypeDataModel` define what data an Actor or Item type has. In v13 systems, you typically need both.

### template.json

- Declares which types exist (`types` array).
- Provides default/initial values for each type.
- Supports template inheritance for shared data.
- Pure JSON — no code execution.
- Required for Foundry to recognize your types during world setup.

### TypeDataModel

- Defines a proper schema using `foundry.data.fields` (StringField, NumberField, SchemaField, etc.).
- Provides validation, type coercion, and migration.
- Can include computed/dynamic properties (getters, methods).
- Registered in the `init` hook via `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels`.
- Required for schema-driven validation and the modern data architecture.

### When to Use Which

| Use Case | template.json | TypeDataModel |
|----------|:---:|:---:|
| Declare that a type exists | Required | Optional |
| Set initial default values | Required | Optional (via `initial`) |
| Schema validation | No | Yes |
| Computed properties | No | Yes |
| Data migration | No | Yes |
| Template inheritance | Yes | No (use class inheritance) |

### Migration Path

In v13, systems should use both:

1. **template.json** declares types and their default values.
2. **TypeDataModel** defines the validated schema with fields.
3. The TypeDataModel's `defineSchema()` takes precedence for validation, while `template.json` provides the initial values that get passed through the schema.

```js
// TypeDataModel for the "character" Actor type
class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),
      biography: new fields.StringField({ initial: "" })
    };
  }
}
```

```json
// template.json — provides the default values that flow through the schema
{
  "Actor": {
    "types": ["character"],
    "character": {
      "health": { "value": 10, "max": 10 },
      "biography": ""
    }
  }
}
```
