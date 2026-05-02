# Document Model

Deep reference for Foundry VTT v13's document and data model system.

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

To declare valid type labels in your `system.json` or `module.json` (v13+):

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

// Full system object replacement (replaces entire system block)
await actor.update({ system: { ...actor.system, level: 5 } });

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

---

## 9. Journal Pages

`JournalEntryPage` is the document type for individual pages within a `JournalEntry`. Each page has a `type` field (`text`, `image`, `video`, `pdf`) and can have a custom sheet.

### Built-in page types

- `text` — rich text content (ProseMirror editor)
- `image` — a single image with optional caption
- `video` — video or animated content
- `pdf` — embedded PDF viewer

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
const { JournalPageSheet, HandlebarsApplicationMixin } = foundry.applications.sheets;

class StatblockPageSheet extends HandlebarsApplicationMixin(JournalPageSheet) {
  static PARTS = {
    content: { template: "modules/my-module/templates/journal/statblock.hbs" }
  };

  static DEFAULT_OPTIONS = {
    classes: ["my-module", "statblock-page"]
  };

  async _prepareContext(options) {
    const page = this.document;
    return {
      page,
      system: page.system,
      enriched: await TextEditor.enrichHTML(page.system.description, {
        relativeTo: page, async: true
      })
    };
  }
}

// Register during init
Hooks.once("init", () => {
  JournalEntryPage.registerSheet("my-module", StatblockPageSheet, {
    types: ["statblock"],
    makeDefault: true
  });
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
```

`mergeObject` is critical — it's how Foundry processes document updates internally. Understanding it prevents bugs when working with `actor.update()` and `item.update()`.
