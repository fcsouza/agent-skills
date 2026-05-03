# Actor & Item Classes

Deep reference for Foundry VTT v13's Actor and Item document subclasses in a system.

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
   * Called whenever actor data is prepared.
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

### Key Rules

- Always call `await super._preCreate(data, options, user)` first.
- Use `this.updateSource()` — it modifies the creation data in-place.
- Never call `this.update()` in `_preCreate` — the document doesn't exist yet.
- `data` contains the raw creation data passed to `Actor.create()`.
- Return from the hook to allow creation, or throw to cancel.

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
    // Get speaker and roll mode
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get("core", "rollMode");
    const label = `[${this.type}] ${this.name}`;

    // If the item has no roll formula, post its description to chat
    if (!this.system.formula) {
      ChatMessage.create({
        speaker,
        rollMode,
        flavor: label,
        content: this.system.description ?? ""
      });
      return;
    }

    // Build and evaluate the roll
    const rollData = this.getRollData();
    const roll = new Roll(this.system.formula, rollData);
    await roll.evaluate();

    // Send to chat
    await roll.toMessage({
      speaker,
      rollMode,
      flavor: label,
    });

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
  const rollMode = game.settings.get("core", "rollMode");
  const label = `[${this.type}] ${this.name}`;

  // No formula — post description only
  if (!this.system.formula) {
    ChatMessage.create({
      speaker,
      rollMode,
      flavor: label,
      content: this.system.description ?? ""
    });
    return;
  }

  // Evaluate roll with item data (includes actor data via getRollData)
  const rollData = this.getRollData();
  const roll = new Roll(this.system.formula, rollData);

  // Evaluate and send to chat
  await roll.evaluate();
  await roll.toMessage({
    speaker,
    rollMode,
    flavor: label,
  });

  return roll;
}
```

### ChatMessage.create Options

| Option | Type | Description |
|--------|------|-------------|
| `speaker` | `object` | `ChatMessage.getSpeaker({ actor })` — identifies who spoke |
| `rollMode` | `string` | `"roll"`, `"gmroll"`, `"blindroll"`, `"selfroll"` |
| `flavor` | `string` | Descriptive text shown above the roll result |
| `content` | `string` | HTML content of the message (for non-roll messages) |

### Roll.toMessage Options

Same as `ChatMessage.create` — `toMessage` is a convenience that creates the message and embeds the evaluated roll.

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

Items can carry Active Effects that modify the parent actor's data. When an item is added to an actor, its effects automatically apply. When removed, they stop.

```js
// An effect on an item modifies the actor when the item is equipped
const effect = {
  name: "Strength Bonus",
  changes: [
    { key: "system.abilities.str.value", mode: 2, value: "2" }
    // mode 2 = ADD
  ]
};
```

### Retrieving All Effects (v13 critical)

In v13 with `CONFIG.ActiveEffect.legacyTransferral = false`, `actor.effects` only contains effects directly on the actor. Effects transferred from items require `allApplicableEffects()`:

```js
// v13 — gets ALL effects including item-transferred
for (const effect of actor.allApplicableEffects()) {
  console.log(effect.name, effect.disabled, effect.isTemporary);
}
```

Always use `allApplicableEffects()` when building effect lists for sheets or checking active conditions.

Active Effects use `change.key` to target actor data paths. The `mode` determines how the value is applied (ADD, MULTIPLY, OVERRIDE, etc.).
