# Advanced System Features

System-specific patterns for status effects, macros, custom enrichers, token customization, and journal pages. These extend the shared APIs covered in the **foundry-vtt-module-dev** skill with system-specific context.

---

## 1. Status Effects (CONFIG.statusEffects)

Every RPG system needs custom conditions on the Token HUD. Override `CONFIG.statusEffects` in `init` to replace the generic defaults with system-specific conditions.

### Replacing Core Status Effects

```js
Hooks.once("init", () => {
  // Replace the entire array for a system (modules should push, systems should replace)
  CONFIG.statusEffects = [
    {
      id: "my-system.prone",
      name: "MY_SYSTEM.Conditions.Prone",
      icon: "systems/my-system/icons/conditions/prone.svg",
      changes: [
        { key: "system.attributes.ac", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-2" },
      ],
    },
    {
      id: "my-system.stunned",
      name: "MY_SYSTEM.Conditions.Stunned",
      icon: "systems/my-system/icons/conditions/stunned.svg",
      changes: [],
    },
    {
      id: "my-system.poisoned",
      name: "MY_SYSTEM.Conditions.Poisoned",
      icon: "systems/my-system/icons/conditions/poisoned.svg",
      changes: [
        { key: "system.abilities.con", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-2" },
      ],
    },
    {
      id: "my-system.dead",
      name: "MY_SYSTEM.Conditions.Dead",
      icon: "systems/my-system/icons/conditions/dead.svg",
      overlay: true,
      changes: [],
    },
  ];

  // Set the special "defeated" status for combat tracker
  CONFIG.specialStatusEffects.DEFEATED = "my-system.dead";
});
```

### Status Effect Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID, namespaced with system ID (e.g. `"my-system.prone"`) |
| `name` | `string` | Localization key for the condition name |
| `icon` | `string` | Path to the icon displayed on the Token HUD |
| `overlay` | `boolean` | If `true`, the icon covers the entire token (used for "dead") |
| `changes` | `object[]` | Active Effect changes applied when the status is toggled |

### Active Effect Change Modes

| Constant | Value | Behavior |
|----------|-------|----------|
| `CONST.ACTIVE_EFFECT_MODES.CUSTOM` | 0 | No automatic application — handle in `prepareDerivedData()` |
| `CONST.ACTIVE_EFFECT_MODES.MULTIPLY` | 1 | Multiply the current value |
| `CONST.ACTIVE_EFFECT_MODES.ADD` | 2 | Add to the current value |
| `CONST.ACTIVE_EFFECT_MODES.DOWNGRADE` | 3 | Set to the lower of current and effect value |
| `CONST.ACTIVE_EFFECT_MODES.UPGRADE` | 4 | Set to the higher of current and effect value |
| `CONST.ACTIVE_EFFECT_MODES.OVERRIDE` | 5 | Replace the current value entirely |

### Checking Active Conditions

```js
// Check if a token has a specific condition
const isProne = actor.statuses.has("my-system.prone");

// Toggle a condition programmatically
await token.toggleActiveEffect({ id: "my-system.stunned" });

// Get all active conditions on a token
for (const statusId of actor.statuses) {
  console.log(`Active condition: ${statusId}`);
}
```

---

## 2. Hotbar Macro Support

Players expect to drag items from character sheets onto the macro hotbar. Systems register a `hotbarDrop` hook in `ready` and provide a helper function to create item macros.

### Registration

```js
// In main.mjs — register in ready hook
Hooks.once("ready", () => {
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (data.type === "Item") {
      createItemMacro(data, slot);
      return false;
    }
  });
});
```

### Creating the Macro

```js
async function createItemMacro(data, slot) {
  const item = await fromUuid(data.uuid);
  if (!item) return;

  const command = `(async () => {
    const item = fromUuidSync("${data.uuid}");
    if (!item) return ui.notifications.warn("Item not found on this actor.");
    await item.roll();
  })();`;

  const existing = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );

  const macro =
    existing ??
    (await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command,
      flags: { "my-system": { itemMacro: true } },
    }));

  await game.user.assignHotbarMacro(macro, slot);
}
```

### Key Points

- Register `hotbarDrop` in `ready` (not `init`) so modules can register earlier.
- Return `false` to prevent Foundry's default drop handling.
- Use `fromUuidSync()` in the macro command for items the actor owns — it resolves synchronously from the local collection.
- Store a flag to identify system macros for cleanup or identification.

---

## 3. Custom Text Enrichers

Custom enrichers transform inline syntax like `@Check[strength]` or `@Damage[2d6+3]` into interactive HTML when `TextEditor.enrichHTML()` processes rich text fields.

### Registering Enrichers

```js
Hooks.once("init", () => {
  // @Check[ability]{optional label} — clickable ability check
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Check\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: async (match, options) => {
      const [, ability, label] = match;
      const anchor = document.createElement("a");
      anchor.classList.add("inline-check");
      anchor.dataset.action = "rollCheck";
      anchor.dataset.ability = ability;
      anchor.innerHTML = `<i class="fa-solid fa-dice-d20"></i> ${label ?? `${ability} Check`}`;
      return anchor;
    },
  });

  // @Damage[formula]{label} — clickable damage roll
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Damage\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: async (match, options) => {
      const [, formula, label] = match;
      const anchor = document.createElement("a");
      anchor.classList.add("inline-damage");
      anchor.dataset.action = "rollDamage";
      anchor.dataset.formula = formula;
      anchor.innerHTML = `<i class="fa-solid fa-burst"></i> ${label ?? formula}`;
      return anchor;
    },
  });
});
```

### Handling Enricher Clicks

In your sheet's action handlers (or via a global listener):

```js
// In ActorSheetV2 DEFAULT_OPTIONS.actions
static DEFAULT_OPTIONS = {
  actions: {
    rollCheck: MySheet.#onRollCheck,
    rollDamage: MySheet.#onRollDamage,
  },
};

static async #onRollCheck(event, target) {
  const ability = target.dataset.ability;
  const actor = this.actor;
  const mod = actor.system.abilities[ability]?.mod ?? 0;
  const roll = new Roll(`1d20 + ${mod}`, actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${ability.capitalize()} Check`,
  });
}

static async #onRollDamage(event, target) {
  const formula = target.dataset.formula;
  const roll = new Roll(formula, this.actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    flavor: "Damage",
  });
}
```

### Enricher Config Fields

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | `RegExp` | Global regex matching the inline syntax |
| `enricher` | `async function` | Receives `(match, options)`, returns `HTMLElement` or `null` |
| `replaceParent` | `boolean` | If `true`, replaces the parent element instead of inserting inline |

---

## 4. Token Customization

Systems customize token behavior through CONFIG overrides and prototype token defaults.

### CONFIG.Token.objectClass

Override the Token PlaceableObject to customize rendering, interaction, or drawing:

```js
Hooks.once("init", () => {
  CONFIG.Token.objectClass = MySystemToken;
});

class MySystemToken extends Token {
  // Override the resource bar drawing
  _drawBar(number, bar, data) {
    const val = Number(data.value);
    const max = Number(data.max);
    const pct = Math.clamped(val, 0, max) / max;

    // Custom color based on percentage
    let color;
    if (pct > 0.5) color = 0x4caf50;      // green
    else if (pct > 0.25) color = 0xff9800; // orange
    else color = 0xf44336;                 // red

    bar.clear();
    bar.beginFill(0x000000, 0.5).drawRoundedRect(0, 0, this.w, 8, 2).endFill();
    bar.beginFill(color, 0.8).drawRoundedRect(0, 0, pct * this.w, 8, 2).endFill();
    bar.position.set(0, number === 0 ? this.h - 8 : 0);
  }
}
```

### CONFIG.Token.documentClass

Override the TokenDocument to customize data handling:

```js
Hooks.once("init", () => {
  CONFIG.Token.documentClass = MySystemTokenDocument;
});

class MySystemTokenDocument extends TokenDocument {
  // Override to add system-specific computed properties
  prepareDerivedData() {
    super.prepareDerivedData();
    // Custom derived data on the token document
  }
}
```

### Prototype Token Defaults by Actor Type

Set different token defaults per actor type in `_preCreate()`:

```js
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);

  const updates = {};

  if (data.type === "character") {
    updates.prototypeToken = {
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      sight: { enabled: true, range: 60 },
      displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
    };
  } else if (data.type === "npc") {
    updates.prototypeToken = {
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
      sight: { enabled: false },
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
    };
  }

  this.updateSource(updates);
}
```

---

## 5. Custom Journal Entry Pages

Systems can define custom Journal page types using `TypeDataModel` and register a dedicated sheet. This is used for stylized compendium entries like class descriptions, bestiary pages, or rule references.

### Defining the Page Data Model

```js
class ClassPageData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      hitDie: new fields.StringField({ initial: "d8" }),
      primaryAbility: new fields.StringField({ initial: "" }),
      savingThrows: new fields.ArrayField(new fields.StringField()),
      description: new fields.HTMLField({ required: false, blank: true }),
      features: new fields.ArrayField(
        new fields.SchemaField({
          level: new fields.NumberField({ integer: true, min: 1, max: 20 }),
          name: new fields.StringField(),
          description: new fields.HTMLField(),
        })
      ),
    };
  }
}
```

### Registration

```js
Hooks.once("init", () => {
  // Register the data model for the custom page type
  CONFIG.JournalEntryPage.dataModels["class"] = ClassPageData;

  // Register a sheet for the custom page type
  DocumentSheetConfig.registerSheet(JournalEntryPage, "my-system", ClassPageSheet, {
    types: ["class"],
    makeDefault: true,
    label: "MY_SYSTEM.Sheet.ClassPage",
  });
});
```

### Declaring in system.json

Custom journal page types must be declared in `documentTypes`:

```json
{
  "documentTypes": {
    "Actor": { "character": {}, "npc": {} },
    "Item": { "weapon": {}, "spell": {} },
    "JournalEntryPage": { "class": {} }
  }
}
```

### Creating Custom Pages

```js
// Create a journal entry with a custom page
const journal = await JournalEntry.create({ name: "Player's Handbook" });
await JournalEntryPage.create(
  {
    name: "Fighter",
    type: "class",
    system: {
      hitDie: "d10",
      primaryAbility: "Strength or Dexterity",
      savingThrows: ["str", "con"],
      description: "<p>A master of martial combat...</p>",
    },
  },
  { parent: journal }
);
```

### Building the Sheet

Use `HandlebarsApplicationMixin(DocumentSheetV2)` for journal page sheets:

```js
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { DocumentSheetV2 } = foundry.applications.sheets;

class ClassPageSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["my-system", "class-page"],
  };

  static PARTS = {
    page: { template: "systems/my-system/templates/journal/class-page.hbs" },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.document.system;
    context.enrichedDescription = await TextEditor.enrichHTML(
      context.system.description,
      { relativeTo: this.document, async: true }
    );
    return context;
  }
}
```
