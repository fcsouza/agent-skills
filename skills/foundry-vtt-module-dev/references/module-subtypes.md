# Module Sub-Types

Modules can contribute custom Actor, Item, JournalEntryPage, and other Document subtypes to **any** world running on **any** system. Sub-types travel with the module — uninstall the module and the sub-types disappear (documents that used them become invalid until re-enabled or migrated).

This is the official, supported extension mechanism since v11. Use it instead of monkey-patching `CONFIG.Actor.dataModels` from outside `init`.

---

## When to Use Sub-Types

- You ship a generic, system-agnostic feature (e.g. a "Vehicle" Actor type usable in any system, a "Quest" JournalEntryPage type)
- You want a clean, documented way for a module to add document categories
- You want auto-prefixed IDs so two modules can both ship a "vehicle" sub-type without colliding

Don't use sub-types for system-specific extensions — that's what systems are for.

---

## Three Required Pieces

A module sub-type needs all three to work:

1. **Manifest declaration** in `module.json` under `documentTypes`
2. **TypeDataModel** class registered in `init` on `CONFIG.<Doc>.dataModels`
3. **Sheet registration** for the sub-type (otherwise the user gets the default sheet)

---

## 1. Manifest Declaration

```json
{
  "id": "my-module",
  "documentTypes": {
    "Actor": {
      "vehicle": {
        "htmlFields": ["description", "notes.contents"],
        "filePathFields": {
          "image": ["IMAGE"],
          "blueprintImage": ["IMAGE"]
        }
      }
    },
    "Item": {
      "fuel": {}
    },
    "JournalEntryPage": {
      "quest": {
        "htmlFields": ["description", "rewards.notes"]
      }
    }
  }
}
```

The keys under each Document class become the sub-type IDs. Foundry **auto-prefixes** these with the module ID, so the runtime sub-type id is `my-module.vehicle`, not bare `vehicle`. Two modules can both ship a `vehicle` sub-type without collision.

### `htmlFields`

Schema paths whose values contain rich HTML (entered through ProseMirror). Foundry uses this list for sanitization, search indexing, and migration. Use dot notation for nested paths: `"notes.contents"` for `system.notes.contents`.

### `filePathFields`

Schema paths whose values are file paths (images, audio, video). Maps each path to the categories of files it accepts: `"IMAGE"`, `"AUDIO"`, `"VIDEO"`, `"MEDIA"`, `"GRAPHICS"`, `"TEXT"`, `"FONT"`. Foundry uses this for asset migration, `FilePicker` defaults, and dependency tracking.

Wildcards work for arrays/maps: `"abilities.*.icon"` matches `system.abilities.<anyKey>.icon`.

---

## 2. TypeDataModel Registration

```javascript
// scripts/data/vehicle-data.mjs
export class VehicleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      image: new fields.FilePathField({ categories: ["IMAGE"], required: true }),
      blueprintImage: new fields.FilePathField({ categories: ["IMAGE"] }),
      description: new fields.HTMLField({ initial: "" }),
      capacity: new fields.NumberField({ integer: true, min: 0, initial: 4 }),
      notes: new fields.SchemaField({
        contents: new fields.HTMLField({ initial: "" }),
      }),
    };
  }

  prepareDerivedData() {
    this.spaceUsed = (this.parent.items?.size ?? 0);
    this.spaceLeft = Math.max(0, this.capacity - this.spaceUsed);
  }
}
```

Register in `init`:

```javascript
import { VehicleData } from "./data/vehicle-data.mjs";
import { FuelData } from "./data/fuel-data.mjs";
import { QuestPageData } from "./data/quest-page-data.mjs";

Hooks.once("init", () => {
  // Sub-type IDs are auto-prefixed with the module ID. Use the bare key
  // here — it's the SAME key you put under documentTypes in module.json.
  Object.assign(CONFIG.Actor.dataModels, {
    "my-module.vehicle": VehicleData,
  });
  Object.assign(CONFIG.Item.dataModels, {
    "my-module.fuel": FuelData,
  });
  Object.assign(CONFIG.JournalEntryPage.dataModels, {
    "my-module.quest": QuestPageData,
  });
});
```

**Note on the registration key:** Foundry stores the sub-type as `<moduleId>.<typeKey>`, so the dataModels key must be the prefixed string. Some older guides show the bare key — that worked in v11 but `<moduleId>.<key>` is the canonical form for v12+ and required when two modules ship the same bare type name.

---

## 3. Sheet Registration

```javascript
import { VehicleSheet } from "./sheets/vehicle-sheet.mjs";

Hooks.once("init", () => {
  // Use foundry.documents.collections.Actors to get the v13-namespaced collection
  foundry.documents.collections.Actors.registerSheet("my-module", VehicleSheet, {
    types: ["my-module.vehicle"],
    makeDefault: true,
    label: "MY_MODULE.SheetLabels.vehicle",
  });
});
```

For JournalEntryPage sub-types, use `DocumentSheetConfig.registerSheet`:

```javascript
DocumentSheetConfig.registerSheet(JournalEntryPage, "my-module", QuestPageSheet, {
  types: ["my-module.quest"],
  makeDefault: true,
});
```

---

## Localization

Sub-type names appear in the "Create Actor" dropdown, on document headers, and in compendium browsers. Localize them via `lang/en.json`:

```json
{
  "TYPES": {
    "Actor": {
      "my-module.vehicle": "Vehicle"
    },
    "Item": {
      "my-module.fuel": "Fuel"
    },
    "JournalEntryPage": {
      "my-module.quest": "Quest"
    }
  },
  "MY_MODULE.SheetLabels.vehicle": "Vehicle Sheet"
}
```

Foundry reads `TYPES.<DocClass>.<prefixedTypeId>` automatically — no JS code required.

---

## Detecting Sub-Type Documents

```javascript
// Check if a document uses a TypeDataModel
if (actor.system instanceof foundry.abstract.TypeDataModel) {
  // It's a typed document — system is a real DataModel instance
}

// Check the sub-type id
if (actor.type === "my-module.vehicle") { /* ... */ }

// Find all vehicles in the world
const vehicles = game.actors.filter(a => a.type === "my-module.vehicle");

// hasTypeData — true when this Document class uses sub-type schemas
if (Actor.hasTypeData) { /* ... */ }
```

---

## Deactivation Behavior

When a user disables your module:

- All documents whose `type` equals one of your sub-types are flagged as **invalid** (visible in the world but not editable)
- Their `system` data is preserved as a plain object — nothing is deleted
- Re-enabling the module restores them; uninstalling the module without conversion strands them

**Always provide a conversion path.** Either:

1. A migration macro that converts sub-type documents to a core type (e.g. `vehicle` → generic `npc`) before uninstall, OR
2. A `closeModule` hook (or settings menu button) that lets the GM run the conversion

```javascript
// Example: convert vehicles to NPCs before module removal
async function convertVehiclesToNpcs() {
  const vehicles = game.actors.filter(a => a.type === "my-module.vehicle");
  for (const v of vehicles) {
    const data = v.toObject();
    data.type = "npc";
    data.system = { health: { value: data.system.capacity * 10, max: data.system.capacity * 10 } };
    await Actor.create(data, { keepId: true });
    await v.delete();
  }
}
```

---

## Module Sub-Types vs System Sub-Types

| | System sub-types | Module sub-types |
|---|---|---|
| Manifest field | `system.json` `documentTypes` | `module.json` `documentTypes` |
| ID format | bare key (`character`) | auto-prefixed (`my-module.vehicle`) |
| Survives system change | No (tied to active system) | Yes (cross-system) |
| Default sheet | Required | Required |
| Use case | Core game types | Generic add-ons |

A system can also enable a module's sub-types by listing the module under `system.json` `relationships.requires` — but the sub-type still belongs to the module.

---

## Pitfalls

1. **Bare key in `dataModels`** — Use `"my-module.vehicle"`, not `"vehicle"`. The latter silently fails to bind in v12+.
2. **Missing `htmlFields`** — Without declaring HTML fields, ProseMirror enrichment, search, and security sanitization don't apply.
3. **Forgetting `filePathFields`** — Asset migration tools and `FilePicker` defaults can't find your file paths without the declaration.
4. **Sheet registered for bare key** — `types: ["vehicle"]` won't match. Use the prefixed id.
5. **Hard-coding the prefix in templates** — Use `{{actor.type}}` in templates rather than literal strings; the prefix changes if you rename the module.
6. **Modifying `documentTypes` after init** — The list is locked once `init` fires. Late additions are ignored without warning.
7. **No conversion path** — Users will eventually disable your module. Without a migration tool their data becomes orphaned.
