# Document Model

Deep reference for Foundry VTT v14's document and data model system.

**Changed in v14:** new cleaning pipeline (§3b), data operators replace `-=`/`==` keys (§8), `template.json` deprecated (§3), ActiveEffect rewritten (§8b), `Level` and `CombatantGroup` added, `MeasuredTemplate` removed (§13). Full list: `foundry-vtt-module-dev/references/v14-migration.md`.

---

## 1. TypeDataModel vs DataModel

**DataModel** is the base class for any structured data object with schema validation and field coercion. Use it for arbitrary structured data that doesn't represent an Actor or Item type.

**TypeDataModel** extends DataModel and is the correct base for system-specific or module-specific document data. It adds `type` awareness and is what Foundry expects when you register custom types via `CONFIG.Actor.dataModels` or `CONFIG.Item.dataModels`.

```js
// DataModel — for standalone structured data (not tied to a document type)
class SpellSlotData extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
    };
  }
}

// TypeDataModel — for actor/item type data registered with CONFIG
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      level: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      experience: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
    };
  }
}
```

Use **TypeDataModel** when registering document subtypes. Use **DataModel** when you need schema-validated nested objects embedded inside a TypeDataModel (via `EmbeddedDataField` or `SchemaField`).

---

## 2. defineSchema()

The static `defineSchema()` method returns an object whose keys map to field instances. Foundry uses this to validate, coerce, and migrate data automatically.

All field classes live under `foundry.data.fields`.

### StringField

```js
// required: throws if missing; initial: default value
// blank: false means empty string is invalid
// choices: restricts to enumerated values
// textSearch: indexes this field for the document browser search
name: new fields.StringField({
  required: true,
  blank: false,
  initial: "Unknown",
  choices: ["warrior", "mage", "rogue"],
  textSearch: true
})
```

### NumberField

```js
// integer: coerces to integer
// positive: must be > 0
// nullable: null is a valid value
// range enforced via min/max/step
health: new fields.NumberField({
  required: true,
  initial: 10,
  min: 0,
  max: 999,
  step: 1,
  integer: true,
  positive: false,
  nullable: false
})
```

### BooleanField

```js
isBloodied: new fields.BooleanField({ initial: false })
```

### ArrayField

```js
// Wrap another field as the element type
tags: new fields.ArrayField(
  new fields.StringField({ required: true, blank: false }),
  { initial: [] }
)
```

### SetField

```js
// Like ArrayField but enforces uniqueness
proficiencies: new fields.SetField(
  new fields.StringField(),
  { initial: new Set() }
)
```

### SchemaField

Defines a nested object with its own typed fields.

```js
attributes: new fields.SchemaField({
  strength: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
  dexterity: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
  constitution: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 })
})
```

### ObjectField

Freeform object — no schema validation on the contents. Use for truly dynamic data.

```js
customProperties: new fields.ObjectField({ initial: {} })
```

### HTMLField

Stores sanitized HTML. Foundry strips dangerous tags automatically.

```js
biography: new fields.HTMLField({ initial: "", required: false })
```

### FilePathField

```js
// categories restricts the file picker to specific asset types
portrait: new fields.FilePathField({
  categories: ["IMAGE"],
  initial: ""
}),
theme: new fields.FilePathField({
  categories: ["AUDIO"],
  initial: ""
})
```

### ColorField

```js
auraColor: new fields.ColorField({ initial: "#ff0000" })
```

### DocumentIdField

Reference to another document by its 16-char ID.

```js
mountId: new fields.DocumentIdField({ nullable: true, initial: null })
```

### JSONField

Stores a serialized JSON string. Useful for module interop or complex nested state that doesn't need schema validation.

```js
exportPayload: new fields.JSONField({ initial: null, nullable: true })
```

### TypedObjectField

An object whose keys are free-form but whose values share one field type. Use it for records keyed by id instead of arrays with an `id` element. Core uses it for `TokenDocument#detectionModes` (**changed in v14:** it was an `ArrayField` of `{id, enabled, range}`; it is now keyed by mode id).

```js
// { basicSight: { enabled: true, range: 30 }, ... }
detectionModes: new fields.TypedObjectField(new fields.SchemaField({
  enabled: new fields.BooleanField({ initial: true }),
  range:   new fields.NumberField({ required: true, min: 0, step: 0.01 })
}), {
  validateKey: key => key in CONFIG.Canvas.detectionModes, // optional key predicate
  expandKeys: false                                        // keep dots in keys literal
})
```

### DocumentUUIDField and AnyField

```js
// A UUID string. relative: true stores UUIDs relative to the owning document when possible.
origin: new fields.DocumentUUIDField({ relative: true }),

// Any JSON-serializable value. ActiveEffect change values use this.
value: new fields.AnyField({ required: true, nullable: true, serializable: true, initial: "" })
```

### Fields added in v14

| Field | Purpose |
|---|---|
| `DataModelSchemaField` | The root `SchemaField` of a DataModel (`Model.schema`). Base class of `EmbeddedDataField`. You rarely construct it yourself. |
| `SceneLevelsSetField` | A `SetField` of `DocumentIdField` naming Scene Levels. Every placeable document has a `levels` field of this type; an empty set means "every level". See `foundry-vtt-module-dev/references/scene-levels.md`. |
| `ShapesField` | An `ArrayField` of `TypedSchemaField(foundry.data.BaseShapeData.TYPES)`. `RegionDocument#shapes` uses it (circle, cone, ellipse, emanation, grid, line, polygon, rectangle, ring, token). |
| `GridOffsetField` / `GridOffsetsField` | A `SchemaField` `{i, j}` (or `{i, j, k}` with `dimensions: 3`) and an `ArrayField` of them. Used by `GridShapeData#offsets`. |

`SchemaField` also gained `extendFields(fields)` and `removeFields(names)` for adding to or trimming a schema after definition. Core uses `extendFields` in `Game#verifyActiveEffectModels` to patch AE models that lack a `changes` field.

### Complete Example

```js
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // Identity
      archetype: new fields.StringField({
        required: true,
        blank: false,
        initial: "warrior",
        choices: ["warrior", "mage", "rogue"],
        textSearch: true
      }),

      // Core stats
      level: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 1 }),
      experience: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),

      // Nested attributes
      attributes: new fields.SchemaField({
        strength:     new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        dexterity:    new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        constitution: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        intelligence: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 })
      }),

      // Health as nested object
      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max:   new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),

      // Free-form tags
      tags: new fields.ArrayField(
        new fields.StringField({ required: true, blank: false }),
        { initial: [] }
      ),

      // Rich text biography
      biography: new fields.HTMLField({ initial: "" }),

      // Portrait image
      portrait: new fields.FilePathField({ categories: ["IMAGE"], initial: "" }),

      // Alive state
      isActive: new fields.BooleanField({ initial: true })
    };
  }
}
```

---

## 3. Registering Custom Types

Register your TypeDataModel classes in the `init` hook so Foundry knows which model to use for each type string.

```js
Hooks.once("init", () => {
  // Actor types
  CONFIG.Actor.dataModels = {
    hero:    HeroData,
    villain: VillainData,
    npc:     NpcData
  };

  // Item types
  CONFIG.Item.dataModels = {
    weapon: WeaponData,
    spell:  SpellData,
    armor:  ArmorData
  };
});
```

When Foundry instantiates an Actor with `type: "hero"`, it automatically creates a `HeroData` instance and attaches it to `actor.system`. The type string in the document's data must exactly match the key in `CONFIG.Actor.dataModels`.

Declare the types in your `system.json` or `module.json` under `documentTypes`. **Changed in v14:** `template.json` is deprecated (since 14, until 16). `game.model` still merges its defaults, but new code should define every type with `documentTypes` plus a `TypeDataModel`:

```json
{
  "documentTypes": {
    "Actor": {
      "hero":    {},
      "villain": {},
      "npc":     {}
    },
    "Item": {
      "weapon": {},
      "spell":  {},
      "armor":  {}
    }
  }
}
```

Two per-document CONFIG keys describe types to the UI:

- `CONFIG.<Doc>.typeLabels` — filled at `i18nInit` from `TYPES.<Doc>.<type>` when unset.
- `CONFIG.<Doc>.typeHints` (new in v14) — filled from `TYPES.HINTS.<Doc>.<type>` when that key exists. The create-document dialog shows the localized hint under the type select. Ship `"TYPES": {"HINTS": {"Actor": {"hero": "A player character."}}}` in `lang/en.json`, or set `CONFIG.Actor.typeHints.hero` in `init`.

---

## 3b. Cleaning and Migration Pipeline

Every DataModel source passes through `cleanData` before validation. **Changed in v14:** the signature is `cleanData(data, options, _state)`.

```js
// options: DataModelCleaningOptions — all default to true unless noted
// addTypes (false), copy, fields, expand, migrate, model, partial (false), prune, persisted, sanitize
const clean = HeroData.cleanData(raw, { partial: true });
```

Passing `options.source` is deprecated (since 14, until 16); the source object now travels in the third `_state` argument. Two static hooks let a model shape the pass: `_preCleanData(data, options, _state)` runs first and may adjust options or state; `_cleanData(data, options, _state)` runs after every field was cleaned. Both mutate in place.

```js
static _cleanData(data, options, _state) {
  if ( data.level > 20 ) data.level = 20;   // do not return a new object
}
```

### migrateData must return data

`static migrateData(source, options)` runs inside the pipeline. **Changed in v14:** it must return the (migrated) source. Implementations that return nothing log a deprecation (since 14, until 16) and the original value is used.

```js
static migrateData(source, options) {
  if ( "hp" in source && !("health" in source) ) {
    source.health = { value: source.hp, max: source.hp };
    delete source.hp;
  }
  return super.migrateData(source, options);
}
```

### Per-field migration: `_migrate`

`DataField#migrateSource(sourceData, fieldData)` is deprecated (since 14, until 16). Override `_migrate(value, options, _state)` and return the migrated value:

```js
_migrate(value, options, _state) {
  if ( typeof value === "string" ) value = parseInt(value, 10);
  return super._migrate(value, options, _state);
}
```

### Looking up the field for a property

`DataModel#getFieldForProperty("attributes.strength")` (new in v14) returns the `DataField` for a dot path (or key array), resolving through `TypeDataField`, `EmbeddedDataField` and `TypedObjectField` with the instance's own source.

---

## 4. Flags

Flags are arbitrary key-value pairs stored on any document, namespaced by module ID. They are ideal for optional metadata, cross-module annotations, and data that should survive module removal gracefully.

**When to use flags vs model fields:**
- Use **model fields** for structural data your module owns and always needs (HP, level, skills).
- Use **flags** for optional or ephemeral metadata, cross-module data, or data another module might attach to your documents.

```js
const actor = game.actors.getName("Aldric");

// Set a flag (async)
await actor.setFlag("my-module", "lastSeenScene", "scene-abc123");

// Set a nested flag — note the dot-notation for sub-paths
await actor.setFlag("my-module", "quest.stage", 3);

// Get a flag
const lastScene = actor.getFlag("my-module", "lastSeenScene"); // "scene-abc123"
const questStage = actor.getFlag("my-module", "quest.stage"); // 3

// Check existence before use
const stage = actor.getFlag("my-module", "quest.stage") ?? 0;

// Unset a flag (async)
await actor.unsetFlag("my-module", "lastSeenScene");

// Read all flags for your module
const allModuleFlags = actor.flags["my-module"] ?? {};
```

Flags persist in the document's database record under `flags["my-module"]`. If your module is uninstalled, the flag data remains but is inert — it doesn't break the document.

---

## 5. Embedded Documents

Items inside an Actor (and similar embeddings) are managed via the embedded document API. Always use these methods instead of directly mutating arrays.

```js
const actor = game.actors.getName("Aldric");

// Create one or more embedded Items
const [sword] = await actor.createEmbeddedDocuments("Item", [
  { name: "Longsword", type: "weapon", system: { damage: "1d8", weight: 3 } }
]);

// Create multiple at once (batched — one DB call)
await actor.createEmbeddedDocuments("Item", [
  { name: "Shield", type: "armor", system: { ac: 2 } },
  { name: "Potion", type: "consumable", system: { uses: 3 } }
]);

// Update one embedded item by ID
await actor.updateEmbeddedDocuments("Item", [
  { _id: sword.id, "system.damage": "1d10" }
]);

// Update multiple at once
await actor.updateEmbeddedDocuments("Item", [
  { _id: "item-id-1", "system.uses": 2 },
  { _id: "item-id-2", "system.equipped": true }
]);

// Delete by ID
await actor.deleteEmbeddedDocuments("Item", [sword.id]);

// Delete multiple
await actor.deleteEmbeddedDocuments("Item", ["id-1", "id-2", "id-3"]);

// Access embedded items
for (const item of actor.items) {
  console.log(item.name, item.system.damage);
}

// Find a specific item
const shield = actor.items.find(i => i.name === "Shield");
```

---

## 6. Lifecycle Hooks

These are instance methods on your TypeDataModel (or on the Document itself). Override them to hook into the document lifecycle.

### _preCreate(data, options, user)

Called before the document is saved to the database. Modify `data` directly to change what gets stored. Return `false` to cancel creation.

```js
async _preCreate(data, options, user) {
  // Enforce that new heroes always start at level 1
  if (data.system?.level > 1) {
    this.updateSource({ "system.level": 1 });
  }
  // Cancel creation if the actor has no name
  if (!data.name?.trim()) return false;
}
```

### _onCreate(data, options, userId)

Called after the document is created. Use for side effects that depend on the document now existing (e.g., creating child documents, sending chat messages).

```js
_onCreate(data, options, userId) {
  if (game.userId !== userId) return; // only the creating user runs this
  console.log(`Actor "${this.parent.name}" was created.`);
}
```

### _preUpdate(changes, options, user)

Called before an update is applied. `changes` contains only the modified fields. Return `false` to cancel. Ideal for validation.

```js
async _preUpdate(changes, options, user) {
  // Clamp health to [0, max] before saving
  if (changes.system?.health?.value !== undefined) {
    const max = this.health.max;
    changes.system.health.value = Math.clamp(changes.system.health.value, 0, max);
  }
  // Prevent reducing level below 1
  if (changes.system?.level < 1) return false;
}
```

### _onUpdate(changes, options, userId)

Called after the update is applied. Use for reactions to changes (recalculate tokens, trigger animations).

```js
_onUpdate(changes, options, userId) {
  if (changes.system?.health !== undefined) {
    console.log(`${this.parent.name} HP changed.`);
  }
}
```

### _preDelete(options, user)

Called before the document is deleted. Return `false` to cancel.

```js
async _preDelete(options, user) {
  if (this.parent.getFlag("my-module", "protected")) {
    ui.notifications.warn("This actor is protected and cannot be deleted.");
    return false;
  }
}
```

### _onDelete(options, userId)

Called after deletion. Use for cleanup — removing references in other documents, etc.

```js
_onDelete(options, userId) {
  if (game.userId !== userId) return;
  console.log(`Actor "${this.parent.name}" was deleted. Cleaning up references...`);
}
```

### Batch statics: _onCreateOperation / _onUpdateOperation / _onDeleteOperation

Document classes (not TypeDataModels) also get one static call per batch: `static async _onCreateOperation(documents, operation, user)` and the update/delete twins receive every document touched by the operation. **Changed in v14:** the v12 names `_onCreateDocuments`, `_onUpdateDocuments` and `_onDeleteDocuments` are gone (their shim expired). Only the `*Operation` statics exist.

---

## 7. prepareDerivedData()

Override `prepareDerivedData()` to compute values that are derived from stored data but not themselves stored in the database. This method is called every time the document's data is prepared (after loading, after updates).

```js
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      attributes: new fields.SchemaField({
        strength:     new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        constitution: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 }),
        dexterity:    new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 10 })
      }),
      level: new fields.NumberField({ required: true, integer: true, min: 1, max: 20, initial: 1 }),
      health: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max:   new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 })
      })
    };
  }

  prepareDerivedData() {
    // Ability modifiers (D&D-style: floor((score - 10) / 2))
    this.abilities = {};
    for (const [key, score] of Object.entries(this.attributes)) {
      this.abilities[key] = { score, mod: Math.floor((score - 10) / 2) };
    }

    // Max HP derived from CON modifier and level
    const conMod = this.abilities.constitution.mod;
    this.health.max = (10 + conMod) + ((this.level - 1) * (6 + conMod));

    // Armor Class derived from DEX modifier + base 10
    this.armorClass = 10 + this.abilities.dexterity.mod;

    // Proficiency bonus from level
    this.proficiencyBonus = Math.ceil(this.level / 4) + 1;
  }
}
```

`prepareDerivedData()` should never trigger database writes — it's purely in-memory computation. Access these derived values on `actor.system.armorClass`, `actor.system.abilities.strength.mod`, etc.

---

## 8. Document CRUD

```js
// Create a new actor
const actor = await Actor.create({
  name: "Aldric",
  type: "hero",
  system: {
    level: 3,
    attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10 }
  }
});

// Update using dot-notation for nested fields (only sends changed fields)
await actor.update({
  name: "Aldric the Bold",
  "system.level": 4,
  "system.health.value": 28,
  "system.attributes.strength": 18
});

// Force replacement of a whole object (no recursive merge) or deletion of a key — data operators
await actor.update({ "system.attributes": _replace({ strength: 18 }) });
await actor.update({ "system.legacyField": _del });

// Delete the actor
await actor.delete();

// Retrieve from collections
const byName = game.actors.getName("Aldric the Bold");
const byId   = game.actors.get("actorId1234567890ab");

// Create with embedded items in one call
const [newActor] = await Actor.createDocuments([{
  name: "Brigand",
  type: "npc",
  items: [
    { name: "Dagger", type: "weapon", system: { damage: "1d4" } }
  ]
}]);
```

Dot-notation updates are the preferred pattern for partial changes — they avoid overwriting fields you didn't intend to touch and minimize the data sent to the server.

### Data operators (`_del`, `_replace`)

**Changed in v14:** the special update keys `{"-=key": null}` (delete) and `{"==key": value}` (replace without merge) are deprecated (since 14, until 16). Use operator values from `foundry.data.operators`:

```js
const { ForcedDeletion, ForcedReplacement } = foundry.data.operators;

await actor.update({
  "system.oldName": new ForcedDeletion(),          // same as the global `_del`
  "system.tags": ForcedReplacement.create(["a"])   // same as the global `_replace(["a"])`
});

// Globals provided by core
await actor.update({ "flags.my-module.cache": _del });
await actor.update({ "flags.my-module.state": _replace({ step: 1 }) });
```

`foundry.utils.mergeObject` only applies operators when asked: `mergeObject(a, b, { applyOperators: true })` (the old `performDeletions` option is deprecated). `foundry.utils.applyDataOperators(obj)` strips them from a plain object; it replaces `applySpecialKeys`.

### Batched multi-document writes

`foundry.documents.modifyBatch(operations)` (new in v14) sends several create/update/delete operations in one request. Operations run in sequence with no network gap; a cancelled `_preUpdate` or a thrown error cancels the whole batch.

```js
await foundry.documents.modifyBatch([
  { action: "update", documentName: "Actor", updates: [{ _id: actor.id, "system.size": "big" }] },
  { action: "update", documentName: "Token", parent: sceneA,
    updates: [{ _id: tokenA.id, width: 2, height: 2 }] }
]);
// resolves to Document[][] — one array per operation
```

An operation cannot read the result of an earlier one in the same batch.

### Is this document saved? `persisted`

`ClientDocument#persisted` (new in v14) is `true` when the document's id resolves in its collection (or compendium index) and every ancestor is persisted. Clones and unsaved `new Actor({...})` instances report `false`. Core APIs such as `Scene#updateTokenRegions` and `RegionDocument.createTokenEmanation` throw on non-persisted documents.

---

## 8b. ActiveEffect (v14 summary)

**Changed in v14:** ActiveEffect was rewritten. The `changes` array now lives at `effect.system.changes` (from `foundry.data.ActiveEffectTypeDataModel`), each entry is `{ key, type, value, phase, priority }` with a string `type` (`"add"`, `"multiply"`, `"override"`, `"upgrade"`, `"downgrade"`, `"subtract"`, `"custom"`) instead of a numeric `mode`. `duration` became `{ value, units, expiry, expired }` with a separate `start` object, `origin` is a `DocumentUUIDField({relative: true})`, and ActiveEffect has `type`/`system` — systems and modules may register subtypes via `documentTypes.ActiveEffect` and `CONFIG.ActiveEffect.dataModels`. Application is phased: `Actor#applyActiveEffects("initial")` and `("final")`.

```js
await actor.createEmbeddedDocuments("ActiveEffect", [{
  name: "Blessed",
  img: "icons/svg/aura.svg",
  system: { changes: [{ key: "system.attributes.strength", type: "add", value: 2, phase: "initial" }] },
  duration: { value: 10, units: "rounds" }
}]);
```

Full model, expiry registry (`ActiveEffect.registry`), `CONFIG.ActiveEffect.changeTypes/phases/expiryEvents`, and migration from numeric modes: `foundry-vtt-module-dev/references/active-effects-v2.md`.

---

## 9. Journal Pages

`JournalEntryPage` is the document type for individual pages within a `JournalEntry`. Each page has a `type` field (`text`, `image`, `video`, `pdf`) and can have a custom sheet.

### Built-in page types

- `text` — rich text content
- `image` — a single image with optional caption
- `video` — video or animated content
- `pdf` — embedded PDF viewer

Three core sheets are registered for `text` pages (`foundry.applications.sheets.journal.*`): `JournalEntryPageProseMirrorSheet` (default), `JournalEntryPageMarkdownSheet`, and `JournalEntryPageHTMLSheet` (a CodeMirror source editor, built on `JournalEntryPageCodeMirrorSheet`). **Changed in v14:** TinyMCE is gone — `CONFIG.TinyMCE`, `JournalTextTinyMCESheet` and `TextEditor.create({engine: "tinymce"})` no longer exist. `TextEditor.create()` defaults to ProseMirror; custom engines register under `CONFIG.TextEditor.engines`.

### Page categories

`JournalEntryCategory` (new in v14) is an embedded document of `JournalEntry` (`journal.categories`, schema `{_id, name, sort, flags}`). A page points at one through `page.category` (a `DocumentIdField`). The sheet for editing them is `foundry.applications.sheets.journal.JournalEntryCategoryConfig`.

```js
const [cat] = await journal.createEmbeddedDocuments("JournalEntryCategory", [{ name: "Locations" }]);
await page.update({ category: cat.id });
```

### Register a custom page type

```js
Hooks.once("init", () => {
  CONFIG.JournalEntryPage.dataModels["statblock"] = StatblockPageData;
});

class StatblockPageData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      creatureType: new fields.StringField({ required: true, initial: "humanoid" }),
      challenge:    new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      abilities:    new fields.SchemaField({
        strength:     new fields.NumberField({ initial: 10 }),
        dexterity:    new fields.NumberField({ initial: 10 }),
        constitution: new fields.NumberField({ initial: 10 })
      }),
      description:  new fields.HTMLField({ initial: "" })
    };
  }
}
```

### Register a custom page sheet

```js
const { JournalEntryPageHandlebarsSheet } = foundry.applications.sheets.journal;
const { TextEditor } = foundry.applications.ux;

class StatblockPageSheet extends JournalEntryPageHandlebarsSheet {
  static PARTS = {
    content: { template: "modules/my-module/templates/journal/statblock.hbs" }
  };

  static DEFAULT_OPTIONS = {
    classes: ["my-module", "statblock-page"]
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const page = this.document;
    context.system = page.system;
    context.enriched = await TextEditor.implementation.enrichHTML(page.system.description, {
      relativeTo: page
    });
    return context;
  }
}

// Register during init
Hooks.once("init", () => {
  foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, "my-module", StatblockPageSheet, {
    types: ["statblock"],
    makeDefault: true
  });
});
```

`JournalEntryPageHandlebarsSheet` is `HandlebarsApplicationMixin(JournalEntryPageSheet)`; core's image, video and PDF sheets extend it.

### Embedding pages: `@Embed` and `embedHandlers`

`TypeDataModel#toEmbed(config, options)` returns the element rendered for `@Embed[uuid]`; `onEmbed(element)` fires once it is in the DOM. **New in v14:** `CONFIG.<Doc>.embedHandlers` is an array of `(doc, content, config, options) => Promise<HTMLElement|HTMLCollection|null>` callbacks. Each handler receives the candidate element and may replace it, wrap it, or return `null` to block the embed. Handlers exist on every document config (`CONFIG.JournalEntryPage.embedHandlers`, `CONFIG.Actor.embedHandlers`, ...).

```js
CONFIG.JournalEntryPage.embedHandlers.push(async (page, content, config, options) => {
  if ( page.type === "statblock" ) content?.classList.add("my-module-statblock");
  return content;
});
```

### Creating pages programmatically

```js
const journal = game.journals.getName("Monster Manual");

// Add a text page
await JournalEntryPage.create({
  name: "Goblin",
  type: "text",
  text: { content: "<h2>Goblin</h2><p>A small, cruel humanoid.</p>", format: 1 },
  title: { show: true, level: 1 }
}, { parent: journal });

// Add a custom statblock page
await JournalEntryPage.create({
  name: "Dragon",
  type: "statblock",
  system: {
    creatureType: "dragon",
    challenge: 17,
    abilities: { strength: 27, dexterity: 10, constitution: 25 }
  }
}, { parent: journal });
```

### Accessing pages

```js
const journal = game.journals.getName("Session Notes");
for (const page of journal.pages) {
  console.log(`${page.name} (${page.type})`);
}
const specificPage = journal.pages.getName("Session 1");
```

---

## 10. UUID Resolution

Documents are referenced by UUID strings throughout Foundry. A UUID encodes the full path to a document, including compendium and embedded document hierarchy.

### UUID format

```
Actor.abc123xyz789                    — world document
Compendium.my-module.monsters.Item.456  — compendium document
Scene.sceneId.Token.tokenId            — embedded document
Actor.actorId.Item.itemId              — embedded item on an actor
```

### fromUuid (async)

Resolves any UUID to its document instance, including from compendiums:

```js
const actor = await fromUuid("Actor.abc123xyz789");
const item  = await fromUuid("Compendium.my-module.monsters.Item.456");
const token = await fromUuid("Scene.sceneId.Token.tokenId");

// In drag & drop handlers
const dropped = await fromUuid(data.uuid);
```

### fromUuidSync (synchronous)

Resolves UUIDs for already-loaded documents only. Returns `null` if the document hasn't been loaded:

```js
const token = fromUuidSync("Scene.sceneId.Token.tokenId");   // null if scene not loaded
```

Use `fromUuid` (async) whenever possible — `fromUuidSync` only works for documents in memory.

### Relative UUIDs

`foundry.utils.buildRelativeUuid(target, origin)` (new in v14) returns the shortest UUID of `target` relative to `origin` — `.Item.itemId` for an item on the origin actor — or the absolute UUID when no relative form exists. Both arguments accept a Document or a UUID string. It replaces `ClientDocument#getRelativeUUID` (deprecated since 14, until 16). `DocumentUUIDField({relative: true})` uses the same rule when storing.

```js
const rel = foundry.utils.buildRelativeUuid(item, actor);   // ".Item.abc123"
const doc = await fromUuid(rel, { relative: actor });
```

---

## 11. Essential Utilities (foundry.utils)

Foundry provides core utilities under `foundry.utils`. Always prefer these over lodash or custom implementations.

```js
// Deep merge objects (used internally by document updates)
const merged = foundry.utils.mergeObject(target, changes, { inplace: false });

// Get nested property by dot-path
const value = foundry.utils.getProperty(actor, "system.abilities.str.mod");

// Set nested property by dot-path
foundry.utils.setProperty(data, "system.health.value", 42);

// Deep clone (safe for documents and complex objects)
const copy = foundry.utils.deepClone(original);

// Check if object has no own keys
foundry.utils.isEmpty({});   // true

// Generate a random 16-char hex ID
const id = foundry.utils.randomID();   // "a1b2c3d4e5f6g7h8"

// Deep equality for primitives, plain objects, and anything with an equals() method
foundry.utils.equals({ a: [1, 2] }, { a: [1, 2] });   // true
```

`mergeObject` is critical — it's how Foundry processes document updates internally. Understanding it prevents bugs when working with `actor.update()` and `item.update()`.

**Changed in v14:** these helpers exist only under `foundry.utils` — the bare globals (`mergeObject`, `getProperty`, `deepClone`, ...) were removed. `objectsEqual` is deprecated (since 14, until 16) in favour of `equals`; `applySpecialKeys` in favour of `applyDataOperators`.

### Querying other clients: `User.queryMany`

```js
// CONFIG.queries.myQuery = async data => ({ ok: true }) — registered in init on every client
const results = await User.queryMany(game.users.filter(u => u.active), "myQuery", { foo: 1 }, { timeout: 5000 });
for ( const [user, r] of results ) if ( r.status === "fulfilled" ) console.log(user.name, r.value);
```

`User#query(name, data, options)` targets one user; `User.queryMany` (new in v14) returns a `Map<User, PromiseSettledResult>`. Both need the `QUERY_USER` permission and a query registered in `CONFIG.queries`.

---

## 12. Folder API

Folders organize documents in the sidebar. Supported types are `CONST.FOLDER_DOCUMENT_TYPES`: `ActiveEffect`, `Actor`, `Adventure`, `Item`, `Scene`, `JournalEntry`, `Playlist`, `RollTable`, `Cards`, `Macro`, `Compendium`. **Changed in v14:** `ActiveEffect` joined the list (effects can live in world folders and compendiums).

### Creating folders

```js
// Root-level folder
const folder = await Folder.create({
  name: "NPCs",
  type: "Actor",
  sorting: "a",              // "a" = alphabetical, "m" = manual
  color: "#ff0000"            // optional sidebar color
});

// Nested folder — use `folder` field (NOT `parent`)
const subfolder = await Folder.create({
  name: "Bandits",
  type: "Actor",
  folder: folder.id,          // nest under parent folder
  sorting: "a"
});
```

### Moving documents into folders

```js
// Move an actor into a folder
await actor.update({ folder: folder.id });

// Batch move multiple items
const updates = items.map(i => ({ _id: i.id, folder: folder.id }));
await Item.updateDocuments(updates);
```

### Querying folder structure

```js
// Get all Actor folders
const actorFolders = game.folders.filter(f => f.type === "Actor");

// Get child folders
const children = folder.getSubfolders();         // direct children
const allDescendants = folder.getSubfolders(true); // recursive

// Get parent chain
const parents = folder.getParentFolders();

// Get documents in a folder
const contents = folder.contents;   // documents directly in this folder

// Folder depth in the sidebar tree
console.log(folder.depth);   // 0 = root, 1 = nested, etc.
```

### Bulk export to compendium

```js
// Export an entire folder to a compendium pack
const pack = game.packs.get("my-module.monsters");
await folder.exportToCompendium(pack, {
  folderName: "Imported Monsters",
  keepId: true                // preserve document IDs
});
```

Key rules:
- Nesting uses the `folder` field in the data object, NOT `parent`. `parent` is a runtime property for document embedding (e.g., Actor → Item).
- A folder's `type` must match the documents it contains — you can't put Items in an Actor folder.
- `CONST.FOLDER_DOCUMENT_TYPES` lists all valid types.
- `Folder#exportDialog(pack)` opens the core export dialog; `Folder#exportToCompendium` is the headless path and uses `foundry.documents.modifyBatch` internally.

---

## 13. Documents Added and Removed in v14

### Level (embedded in Scene)

Scenes are stacks of `Level` documents (`scene.levels`, collection name `levels`). The visual fields moved off Scene: `Level#background {color, src, tint, alphaThreshold}`, `Level#foreground {src, tint, alphaThreshold}`, `Level#elevation {bottom, top}` (null = unbounded), `Level#fog.src`, `Level#textures {anchorX, anchorY, offsetX, offsetY, fit, scaleX, scaleY, rotation}`, `Level#visibility.levels`. `Scene#background`, `Scene#foreground`, `Scene#foregroundElevation` and `Scene#backgroundColor` are deprecated shims (since 14, until 16). Read the viewed level with `canvas.level`; the scene's start level is `scene.initialLevel`. `CONFIG.Level.documentClass` configures the class.

```js
const src = canvas.level.background.src;          // was scene.background.src
await scene.updateEmbeddedDocuments("Level", [{ _id: canvas.level.id, "elevation.top": 40 }]);
```

Every placeable document (Token, Tile, Wall, AmbientLight, AmbientSound, Drawing, Note, Region) carries `levels: SceneLevelsSetField`; Token also has `level` (id) and `depth`. Details: `foundry-vtt-module-dev/references/scene-levels.md`.

### CombatantGroup (embedded in Combat)

`CombatantGroup` (`combat.groups`) has `type`/`system` (subtype-capable, `baseTypeAllowed: true`), `name`, `img`, `initiative`, `ownership`, `flags`. Combatants reference it through `combatant.group`. Related v14 additions: `Combat#name` (`StringField`) and `Combatant#roundJoined` (integer, initial 1).

### MeasuredTemplate removed

`MeasuredTemplateDocument`, `Scene#templates`, `TemplateLayer`, `CONST.MEASURED_TEMPLATE_TYPES` and the `TEMPLATE_CREATE` permission are deprecated shims (since 14, until 16). Templates are Regions with shapes (`RegionDocument#shapes`, `canvas.regions.placeRegion()`, `RegionDocument.createTokenEmanation()`, `REGION_CREATE` permission). See `foundry-vtt-module-dev/references/measured-templates.md`.
