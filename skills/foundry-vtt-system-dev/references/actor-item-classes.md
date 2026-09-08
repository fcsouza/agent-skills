# Actor & Item Classes

Deep reference for Foundry VTT v14+ Actor and Item document subclasses in a system.

---

## 1. CONFIG.Actor.documentClass

Override the default Actor class to add system-specific behavior. Register in the `init` hook.

```js
// my-system-actor.mjs
class MySystemActor extends Actor {
  // Override methods here
}

// main.mjs — register during init
Hooks.once("init", () => {
  CONFIG.Actor.documentClass = MySystemActor;
});
```

### What This Controls

- Every Actor created in the world uses your subclass instead of the base `Actor`.
- Methods you override (like `getRollData`, `_preCreate`) apply to all Actor types.
- Works alongside `CONFIG.Actor.dataModels` — the document class handles behavior, the data model handles schema.

### Relationship to TypeDataModel

```js
// Data model handles schema and validation
class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() { /* ... */ }
}

// Document class handles behavior and methods
class MySystemActor extends Actor {
  getRollData() { /* ... */ }
  async _preCreate(data, options, user) { /* ... */ }
}

Hooks.once("init", () => {
  // Both are needed — they serve different purposes
  Object.assign(CONFIG.Actor.dataModels, { character: CharacterData });
  CONFIG.Actor.documentClass = MySystemActor;
});
```

---

## 2. Actor Subclass Pattern

A complete Actor subclass with roll data, default items, and post-creation logic.

```js
class MySystemActor extends Actor {

  /**
   * Augment the basic actor data with additional dynamic data.
   * Called whenever actor data is prepared. See "Data Preparation Order" below
   * before overriding this — Actor#prepareData applies the "final" Active Effect phase.
   */
  prepareData() {
    super.prepareData(); // Always call super first
    // Type-specific preparation happens in the TypeDataModel's prepareDerivedData()
  }

  /**
   * Prepare data for dice rolls against this actor.
   * @returns {object} Roll data available as @field in Roll formulas
   */
  getRollData() {
    const data = this.system.toObject();
    // Expose shorthand fields for roll formulas
    if (this.type === "character") {
      data.lvl = data.attributes.level.value;
    }
    return data;
  }

  /**
   * Pre-creation hook — modify creation data before the document is inserted.
   * Use this.updateSource() to set defaults.
   * @param {object} data      The initial data object provided to the document creation request
   * @param {object} options   Additional options which modify the creation request
   * @param {User} user        The User document initiating the request
   * @protected
   */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Add default items for character type
    if (data.type === "character") {
      const items = [
        new CONFIG.Item.documentClass({ name: "Basic Attack", type: "weapon" }),
        new CONFIG.Item.documentClass({ name: "Toughness", type: "feature" })
      ];
      this.updateSource({ items: items.map(i => i.toObject()) });
    }

    // Set default token configuration
    this.updateSource({
      prototypeToken: {
        name: data.name,
        texture: {
          src: "systems/my-system/tokens/default.webp"
        },
        bar1: { attribute: "attributes.hp" },
        sight: { enabled: true },
        actorLink: true
      }
    });
  }

  /**
   * Post-creation hook — runs after the document is inserted into the world.
   * Use for side effects that require the document to exist (dialogs, notifications).
   * @param {object} data      The initial data object provided to creation
   * @param {object} options   Additional creation options
   * @param {string} userId    The ID of the requesting user
   * @protected
   */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    // Side effects only — the document is already created at this point
  }
}
```

### Data Preparation Order

`ClientDocument#prepareData` runs these steps in order:

1. `system.prepareBaseData()` (TypeDataModel)
2. `prepareBaseData()` — `Actor` resets `overrides`, `statuses`, `tokenActiveEffectChanges` and the completed-phase set here
3. `prepareEmbeddedDocuments()` — `Actor` then calls `this.applyActiveEffects("initial")`
4. `system.prepareDerivedData()` (TypeDataModel)
5. `prepareDerivedData()`

`Actor#prepareData` calls `super.prepareData()` and then `this.applyActiveEffects("final")`. So `"initial"` changes see base data only; `"final"` changes see derived data. Each change carries its own `phase` (`effect.system.changes[].phase`, default `"initial"`).

**Changed in v14:** `applyActiveEffects()` without a phase string is deprecated (until v16). A phase can run once per preparation cycle; a second call logs an error. To add a phase, register it and call it yourself:

```js
Hooks.once("init", () => {
  CONFIG.ActiveEffect.phases.postItems = {
    label: "MY_SYSTEM.EffectPhase.postItems.label",
    hint: "MY_SYSTEM.EffectPhase.postItems.hint"
  };
});

class MySystemActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    this.applyActiveEffects("postItems"); // runs between "initial" and "final"
  }
}
```

Changes whose key starts with `token.` are not applied to the actor. They are stored in `actor.tokenActiveEffectChanges[phase]` and applied by `TokenDocument#applyActiveEffects(phase)`.

---

## 3. getRollData()

`getRollData()` returns a flat object whose keys become available as `@field` references in Roll formulas. This is the bridge between your system data and the dice roller.

### How @field Resolution Works

```js
// Actor's getRollData returns:
{ str: 16, dex: 12, lvl: 5, mod: 3 }

// Roll formula can use:
new Roll("d20 + @str", actor.getRollData())   // d20 + 16
new Roll("d20 + @mod", actor.getRollData())   // d20 + 3
```

### Actor getRollData Implementation

```js
class MySystemActor extends Actor {
  /** @override */
  getRollData() {
    // Start with a shallow copy of system data
    const data = this.system.toObject();

    // Add shorthand fields for common roll formulas
    if (this.type === "character") {
      data.lvl = data.attributes.level.value;

      // Compute ability modifiers
      for (const [key, ability] of Object.entries(data.abilities)) {
        ability.mod = Math.floor((ability.value - 10) / 2);
        data[key] = ability.mod; // @str, @dex, etc.
      }
    }

    return data;
  }
}
```

### Item getRollData — Including Actor Data

Items can also override `getRollData()` to include their parent actor's data. This lets item roll formulas reference actor attributes.

```js
class MySystemItem extends Item {
  /** @override */
  getRollData() {
    // Start with item system data
    const rollData = { ...super.getRollData() };

    // If there's a parent actor, include its roll data under "actor"
    if (this.actor) {
      rollData.actor = this.actor.getRollData();
    }

    return rollData;
  }
}
```

```js
// Now an item formula can reference actor data:
// Formula: "1d20 + @actor.str + @actor.lvl"
// Where @actor.str comes from the actor's getRollData()
```

---

## 4. _preCreate() for Default Items

The `_preCreate` hook fires before a document is persisted. Use `this.updateSource()` (not `this.update()`) to modify creation data. The document does not exist in the database yet — `update()` would fail.

### Adding Default Items

```js
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);

  if (data.type === "character") {
    // Create default items using the Item document class
    const starterWeapon = new CONFIG.Item.documentClass({
      name: game.i18n.localize("MY_SYSTEM.Item.StarterWeapon"),
      type: "weapon"
    });

    const starterArmor = new CONFIG.Item.documentClass({
      name: game.i18n.localize("MY_SYSTEM.Item.StarterArmor"),
      type: "gear"
    });

    // Convert to plain objects and add to creation data
    const items = this.items.map(i => i.toObject());
    items.push(starterWeapon.toObject(), starterArmor.toObject());

    this.updateSource({ items });
  }
}
```

### Setting Prototype Token Defaults

```js
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);

  // Configure the prototype token (the template for tokens placed on canvas)
  this.updateSource({
    prototypeToken: {
      name: data.name,
      texture: {
        src: "systems/my-system/tokens/default.webp"
      },
      bar1: { attribute: "attributes.hp" },
      bar2: { attribute: "attributes.mp" },
      sight: { enabled: true },
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    }
  });
}
```

### Deleting or Replacing Keys with Operators

`updateSource()` and `update()` accept the data operators from `foundry.data.operators`. The globals `_del` (a shared `ForcedDeletion` instance) and `_replace(value)` (`ForcedReplacement.create`) are shortcuts.

```js
this.updateSource({
  "system.legacyField": _del,                       // delete the key
  "system.tags": _replace(["starter"]),             // replace the array instead of merging
  "flags.my-system.notes": new foundry.data.operators.ForcedDeletion()
});
```

**Changed in v14:** the `{"-=key": null}` and `{"==key": value}` syntaxes are deprecated (until v16). `mergeObject({performDeletions})` became `mergeObject({applyOperators})`.

### Key Rules

- Always call `await super._preCreate(data, options, user)` first.
- Use `this.updateSource()` — it modifies the creation data in-place.
- Never call `this.update()` in `_preCreate` — the document doesn't exist yet.
- `data` contains the raw creation data passed to `Actor.create()`.
- Return from the hook to allow creation, or throw to cancel.
- Batch hooks are static: `_onCreateOperation(documents, operation, user)`, `_onUpdateOperation`, `_onDeleteOperation`. **Changed in v14:** the `_onCreateDocuments` / `_onUpdateDocuments` / `_onDeleteDocuments` shims are gone.

---

## 5. CONFIG.Item.documentClass

Override the default Item class to add system-specific behavior. Register in the `init` hook.

```js
class MySystemItem extends Item {
  // Override methods here
}

Hooks.once("init", () => {
  CONFIG.Item.documentClass = MySystemItem;
});
```

### What This Controls

- Every Item created in the world uses your subclass.
- Methods like `roll()` and `getRollData()` are available system-wide.
- Works alongside `CONFIG.Item.dataModels` for schema validation.

---

## 6. Item Subclass Pattern

A complete Item subclass with rolling and data preparation.

```js
class MySystemItem extends Item {

  /**
   * Augment the basic item data with additional dynamic data.
   */
  prepareData() {
    super.prepareData();
    // Derived data computation happens here or in the TypeDataModel
  }

  /**
   * Prepare roll data for this item.
   * Includes parent actor data so formulas can reference @actor fields.
   * @returns {object} Roll data object
   */
  getRollData() {
    const rollData = { ...super.getRollData() };

    if (this.actor) {
      rollData.actor = this.actor.getRollData();
    }

    return rollData;
  }

  /**
   * Handle a clickable roll from the item sheet or chat.
   * @returns {Promise<Roll|ChatMessage|void>}
   */
  async roll() {
    // Get speaker and the user's current message visibility mode
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const messageMode = game.settings.get("core", "messageMode");
    const label = `[${this.type}] ${this.name}`;

    // If the item has no roll formula, post its description to chat
    if (!this.system.formula) {
      ChatMessage.create({
        speaker,
        flavor: label,
        content: this.system.description ?? ""
      }, { messageMode });
      return;
    }

    // Build and evaluate the roll
    const rollData = this.getRollData();
    const roll = new Roll(this.system.formula, rollData);
    await roll.evaluate();

    // Send to chat — messageMode is an option, not message data
    await roll.toMessage({ speaker, flavor: label }, { messageMode });

    return roll;
  }
}
```

---

## 7. Item.roll() Implementation

The `roll()` method builds a `Roll` from item data and posts it to chat.

### Building the Roll

```js
async roll() {
  const speaker = ChatMessage.getSpeaker({ actor: this.actor });
  const messageMode = game.settings.get("core", "messageMode");
  const label = `[${this.type}] ${this.name}`;

  // No formula — post description only
  if (!this.system.formula) {
    ChatMessage.create({
      speaker,
      flavor: label,
      content: this.system.description ?? ""
    }, { messageMode });
    return;
  }

  // Evaluate roll with item data (includes actor data via getRollData)
  const rollData = this.getRollData();
  const roll = new Roll(this.system.formula, rollData);

  // Evaluate and send to chat
  await roll.evaluate();
  await roll.toMessage({ speaker, flavor: label }, { messageMode });

  return roll;
}
```

### Message Data vs. Options

`ChatMessage.create(data, options)` and `Roll#toMessage(messageData, options)` split the payload:

| Where | Key | Description |
|-------|-----|-------------|
| data | `speaker` | `ChatMessage.getSpeaker({ actor })` — identifies who spoke |
| data | `flavor` | Descriptive text shown above the roll result |
| data | `content` | HTML content of the message (for non-roll messages) |
| options | `messageMode` | A key of `CONFIG.ChatMessage.modes`: `"public"`, `"gm"`, `"blind"`, `"self"`, `"ic"` |
| options | `create` | `toMessage` only — `false` returns the prepared data instead of creating |

`toMessage` embeds the evaluated roll, then calls `ChatMessage#applyMode(messageMode)` to set whisper targets and blind state. Omit `messageMode` to use the user's `core.messageMode` setting.

**Changed in v14:** `rollMode` (`"roll"`, `"gmroll"`, `"blindroll"`, `"selfroll"`) and the `core.rollMode` setting are deprecated (until v16). `Roll._mapLegacyRollMode(rollMode)` converts old values; `CONFIG.Dice.rollModes` is a deprecation proxy over `CONFIG.ChatMessage.modes`.

---

## 8. Actor-Item Relationship

### Accessing Items from an Actor

```js
// Get all items on an actor
const items = actor.items; // Collection<Item>

// Find a specific item
const sword = actor.items.getName("Longsword");
const weapon = actor.items.get("itemId123");

// Filter items by type
const spells = actor.items.filter(i => i.type === "spell");
```

### Accessing the Actor from an Item

```js
// Get the parent actor (null if item is not owned)
const actor = item.actor;

// Check if an item is owned
if (item.actor) {
  // This item belongs to an actor
}
```

### Embedded Document CRUD

```js
// Create an item on an actor
const newItem = await Item.create(
  { name: "Fireball", type: "spell" },
  { parent: actor }
);

// Update an owned item
await item.update({ "system.spellLevel": 3 });

// Delete an owned item
await item.delete();

// Bulk update via actor (avoids individual item update cycles)
await actor.update({
  items: [
    { _id: "itemId1", "system.damage": "2d8" },
    { _id: "itemId2", img: "icons/new-icon.webp" }
  ]
});
```

### Active Effects Transfer

Items can carry Active Effects that modify the parent actor's data. An item effect with `transfer: true` (the default) applies to the owning actor while the item is owned.

```js
// An effect on an item modifies the actor while the item is owned
const effect = {
  name: "Strength Bonus",
  system: {
    changes: [
      { key: "system.abilities.str.value", type: "add", value: 2 }
    ]
  }
};
```

Changes live at `effect.system.changes` (`ActiveEffectTypeDataModel`). Each change is `{ key, type, value, phase, priority }`; `type` is a string from `CONST.ACTIVE_EFFECT_CHANGE_TYPES` (`custom`, `multiply`, `add`, `subtract`, `downgrade`, `upgrade`, `override`) or a custom type you register in `CONFIG.ActiveEffect.changeTypes`. `value` is an `AnyField`, so numbers stay numbers. String values may contain `@` references resolved against `actor.getRollData()`.

**Changed in v14:** root-level `changes` with numeric `mode` is migrated on load but deprecated. `CONFIG.ActiveEffect.legacyTransferral` is gone. See `foundry-vtt-module-dev/references/active-effects-v2.md` for the full model.

### Retrieving All Effects

`actor.effects` only contains effects embedded on the actor. `allApplicableEffects()` yields those plus every item effect with `transfer: true`:

```js
for (const effect of actor.allApplicableEffects()) {
  console.log(effect.name, effect.active, effect.isTemporary);
}
```

Always use `allApplicableEffects()` when building effect lists for sheets or checking active conditions.

---

## 9. Sheet Registration & Drag-Drop

Register sheets in `init`. Both entry points are namespaced; the bare `Actors`, `Items` and `DocumentSheetConfig` globals are deprecation shims (since v13, until v15).

```js
const { Actors, Items } = foundry.documents.collections;
const { DocumentSheetConfig } = foundry.applications.apps;

Hooks.once("init", () => {
  Actors.registerSheet("my-system", CharacterSheet, { types: ["character"], makeDefault: true });
  Items.registerSheet("my-system", WeaponSheet, { types: ["weapon"], makeDefault: true });
  // Equivalent generic form
  DocumentSheetConfig.registerSheet(Actor, "my-system", NpcSheet, { types: ["npc"], makeDefault: true });
});
```

`ActorSheetV2` and `ItemSheetV2` ship with a bound `DragDrop` handler. Override the protected hooks instead of wiring your own:

| Method | Default behavior |
|--------|------------------|
| `_canDragStart(selector)` / `_canDragDrop(selector)` | permission checks |
| `_onDragStart(event)` / `_onDragOver(event)` | build drag data |
| `_onDrop(event)` | calls the `dropActorSheetData(actor, sheet, data)` (or `dropItemSheetData(item, sheet, data)`) hook, then `_onDropDocument` |
| `_onDropDocument(event, document)` | routes by `documentName` |
| `_onDropActiveEffect(event, effect)` | creates the effect on the actor or item |
| `_onDropItem(event, item)` | actor sheets only: sorts an owned item, or creates a copy (compendium items go through `game.items.fromCompendium`) |
| `_onDropActor(event, actor)` / `_onDropFolder(event, folder)` | actor sheets only: no-op, return `null` |

```js
class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  async _onDropItem(event, item) {
    if (item.type === "class" && this.actor.items.some(i => i.type === "class")) {
      ui.notifications.warn("MY_SYSTEM.OneClassOnly", { localize: true });
      return null;
    }
    return super._onDropItem(event, item);
  }
}
```

---

## 10. Tokens and Document CONFIG Extras

```js
// Tokens that represent this actor. concreteOnly skips unpersisted/preview tokens
// (it becomes the default in v15).
const tokens = actor.getDependentTokens({ scenes: canvas.scene, linked: true, concreteOnly: true });

Hooks.once("init", () => {
  // Hint text shown under each type in the create-document dialog
  CONFIG.Actor.typeHints.character = "MY_SYSTEM.TypeHints.character";
  CONFIG.Item.typeHints.weapon = "MY_SYSTEM.TypeHints.weapon";

  // Post-process @Embed[...] output for Items: (doc, content, config, options) => element|null
  CONFIG.Item.embedHandlers.push(async (item, content, config, options) => {
    if (!content || item.type !== "spell") return content;
    content.classList.add("spell-embed");
    return content;
  });
});
```

`typeHints` and `embedHandlers` exist on every typed document CONFIG (`Actor`, `Item`, `ActiveEffect`, `JournalEntryPage`, ...). Returning `null` from an embed handler cancels the embed.
