# Dice System

Deep reference for Foundry VTT v14+ dice rolling, message modes, and formula customization.

---

## 1. Dice Architecture

Foundry's dice system is built on a class hierarchy that parses, evaluates, and renders dice formulas.

### Class Hierarchy

```
RollTerm (base)
├── DiceTerm (base for all dice)
│   ├── Die (standard dice: d20, d6, etc.)
│   ├── Coin (coin flip)
│   ├── FateDie (Fudge/Fate dice: dF)
│   └── CustomDiceTerm (your custom dice)
├── NumericTerm (static numbers: 5, 10)
├── OperatorTerm (+, -, *, /)
├── ParentheticalTerm ((...))
├── FunctionTerm (Math.floor, etc.)
└── StringTerm (plain text)
```

### Roll Class

`Roll` orchestrates the entire process: parsing a formula string into terms, evaluating them, and producing results.

```js
// Basic roll
const roll = new Roll("2d20kh + 5");
await roll.evaluate();
console.log(roll.total);  // The final result

// Roll with data for @field resolution
const roll = new Roll("d20 + @str", { str: 16 });
await roll.evaluate();
```

### Terms Array

After parsing, `roll.terms` contains an array of `RollTerm` instances:

```js
const roll = new Roll("2d6 + 4");
// roll.terms = [Die(2d6), OperatorTerm(+), NumericTerm(4)]
```

### Building the Configured Roll Class

`new Roll(...)` uses the class you wrote. `Roll.create(formula, data, options)` uses the system's configured class:

```js
Roll.create("d20 + @str", actor.getRollData());   // new Roll.defaultImplementation(...)
Roll.defaultImplementation;                        // === CONFIG.Dice.rolls[0]
```

Use `Roll.create` in shared code so a system that sets `CONFIG.Dice.rolls` wins.

### @field Replacement

`Roll.replaceFormulaData(formula, data, options)` substitutes `@path` references before parsing.

```js
Roll.replaceFormulaData("d20 + @str", data, { missing: 0, warn: true, recursive: true });
```

| Option | Effect |
|--------|--------|
| `missing` | String used for unresolved references. Omit it and the raw `@path` text is left in place, which then fails to parse. |
| `warn` | Log `DICE.WarnMissingData` for each unresolved reference. |
| `recursive` | Resolve `@` references found inside string values, up to three levels deep. |

Booleans become `"0"` or `"1"`, so a flag can be used directly in a formula (`"@prone * -2"`). Numbers and strings pass through; `Set` and `Map` values are serialized.

**Changed in v14:** the third argument is an options object. Callbacks in a custom `RollParser` also take a trailing `offset`.

### Dice Configuration Setting

The per-user dice fulfillment configuration lives in `game.settings.get("core", Roll.DICE_CONFIGURATION_SETTING)`.

**Changed in v14:** the `DiceConfig.SETTING` shim is gone. Use `Roll.DICE_CONFIGURATION_SETTING`.

---

## 2. Custom DiceTerm

Extend `foundry.dice.terms.Die` to create custom dice with special behavior. Register the class in `CONFIG.Dice.terms`.

### Exploding Die Example

```js
/**
 * A die that explodes: when max face is rolled, roll again and add.
 * Triggered by the "x" modifier in formulas like "3dx6".
 */
class ExplodingDie extends foundry.dice.terms.Die {

  /** @inheritdoc */
  get expression() {
    return `${this.number}dx${this.faces}`;
  }

  /**
   * Roll the die with exploding behavior.
   * @param {object} [options]                    Roll options
   * @param {boolean} [options.minimize=false]    Force minimum result
   * @param {boolean} [options.maximize=false]    Force maximum result
   * @returns {Promise<DiceTermResult>}
   */
  async roll({ minimize = false, maximize = false, ...options } = {}) {
    const roll = { result: undefined, active: true };

    if (minimize) {
      roll.result = 1;
    } else if (maximize) {
      roll.result = this.faces;
    } else {
      let result = this.randomFace();
      roll.result = result;

      // Explode: keep rolling while max face is hit
      while (result === this.faces) {
        result = this.randomFace();
        roll.result += result;
      }
    }

    this.results.push(roll);
    return roll;
  }

  /**
   * Factory method to instantiate from a parsed AST node.
   * @param {DiceRollParseNode} node  Parsed node from the formula parser
   * @returns {ExplodingDie}
   */
  static fromParseNode(node) {
    let { number, faces } = node;

    if (!number) number = 1;
    if (number.class) {
      number = Roll.defaultImplementation.fromTerms(
        Roll.defaultImplementation.instantiateAST(number)
      );
    }
    if (faces.class) {
      faces = Roll.defaultImplementation.fromTerms(
        Roll.defaultImplementation.instantiateAST(faces)
      );
    }

    const modifiers = Array.from(
      (node.modifiers || "").matchAll(this.MODIFIER_REGEXP)
    ).map(([m]) => m);

    const data = { ...node, number, faces, modifiers, class: "ExplodingDie" };
    return this.fromData(data);
  }
}
```

### Registering Custom Dice

```js
Hooks.once("init", () => {
  // Register under a single-letter key for formula shorthand
  if (!("x" in CONFIG.Dice.terms)) {
    CONFIG.Dice.terms.x = ExplodingDie;
  }
});
```

### Custom Modifiers

Map a modifier string to a handler method in `static MODIFIERS`. The handler receives the matched modifier text and returns `false` when it does not apply.

```js
class MySystemDie extends foundry.dice.terms.Die {
  static MODIFIERS = { ...super.MODIFIERS, br: "burn" };

  /**
   * "br" burns the lowest die; "brN" burns the N lowest.
   * @param {string} modifier
   * @returns {false|void}
   */
  burn(modifier) {
    const match = modifier.match(/br([0-9]*)/i);
    if (!match) return false;
    const count = match[1] ? parseInt(match[1]) : 1;   // bare "br" means one
    const sorted = this.results.filter(r => r.active).sort((a, b) => a.result - b.result);
    for (const r of sorted.slice(0, count)) r.active = false;
  }
}
```

**Changed in v14:** `DiceTerm.MODIFIER_REGEXP` is built from `#MODIFIER_ARG_REGEXP_STRING = [^A-z\s()+\-*/]*`, so the argument group always matches — an empty string rather than `undefined` in v13. Handlers that tested the argument for `undefined` must test for falsy instead.

---

## 3. Custom Roll Class

Extend `foundry.dice.Roll` to control how parsed AST nodes are instantiated into `RollTerm` objects. This is needed when your custom die requires special instantiation logic.

### Implementation

```js
import { ExplodingDie } from "./dice/exploding-die.mjs";

class MySystemRoll extends foundry.dice.Roll {
  /**
   * Instantiate AST nodes into RollTerm instances.
   * Overrides default behavior to handle custom dice terms.
   * @param {RollParseNode} ast  Root of the parsed AST sub-tree
   * @returns {RollTerm[]}
   */
  static instantiateAST(ast) {
    return CONFIG.Dice.parser.flattenTree(ast).map((node) => {
      // Route custom die nodes to our class
      if (node.class === "ExplodingDie") {
        const { formula } = node;
        const die = ExplodingDie.fromParseNode(node);
        die.original = formula;
        return die;
      }

      // Fall back to standard instantiation
      const cls = foundry.dice.terms[node.class] ?? foundry.dice.terms.RollTerm;
      return cls.fromParseNode(node);
    });
  }
}
```

### Registration

```js
Hooks.once("init", () => {
  // Replace the default Roll class
  CONFIG.Dice.rolls = [MySystemRoll];
});
```

### When You Need a Custom Roll Class

- Custom dice terms that need non-standard instantiation.
- Modifying how parsed results are converted to RollTerm objects.
- Intercepting specific formula patterns before evaluation.
- Most simple custom dice only need a custom `DiceTerm` — only create a custom `Roll` class if `fromParseNode` is insufficient.

---

## 4. CONFIG.Dice.parser

The parser converts formula strings into an AST (Abstract Syntax Tree). Override `CONFIG.Dice.parser` with a custom `RollParser` subclass to intercept dice terms during parsing.

### Custom Parser

```js
class MySystemRollParser extends foundry.dice.RollParser {
  /**
   * Handle a dice term during parsing.
   * Intercepts formulas with "!" modifier to route to custom die.
   * @param {NumericRollParseNode|null} number     Number of dice
   * @param {string|NumericRollParseNode|null} faces  Face count or denomination
   * @param {string|null} modifiers                Modifier string
   * @param {string|null} flavor                   Flavor text
   * @param {string} formula                       Original matched text
   * @param {RollParseOffset} offset               {start, end} of the term in the formula
   * @returns {DiceRollParseNode}
   * @protected
   */
  _onDiceTerm(number, faces, modifiers, flavor, formula, offset) {
    const sanitizedModifiers = modifiers === null ? "" : modifiers;

    // Check for "!" marker to use exploding die
    const loc = sanitizedModifiers.indexOf("!");
    if (loc !== -1) {
      // Remove the "!" since it's been consumed as a die type marker
      const alteredModifiers =
        sanitizedModifiers.slice(0, loc) + sanitizedModifiers.slice(loc + 1);

      return {
        class: "ExplodingDie",
        formula,
        modifiers: alteredModifiers,
        number,
        faces,
        offset,
        evaluated: false,
        options: { flavor }
      };
    }

    // Default: standard die
    return {
      class: "DiceTerm",
      formula,
      modifiers: sanitizedModifiers,
      number,
      faces,
      offset,
      evaluated: false,
      options: { flavor }
    };
  }
}
```

### Registration

```js
Hooks.once("init", () => {
  CONFIG.Dice.parser = MySystemRollParser;
  CONFIG.Dice.rolls = [MySystemRoll];

  if (!("x" in CONFIG.Dice.terms)) {
    CONFIG.Dice.terms.x = ExplodingDie;
  }
});
```

### AST Node Structure

Each parsed dice term produces a node like:

```js
{
  class: "DiceTerm",          // Which DiceTerm class to instantiate
  formula: "4d6",             // Original formula text
  number: 4,                  // Number of dice (can be nested AST node)
  faces: 6,                   // Number of faces (can be nested AST node)
  modifiers: "kh",            // Modifier string
  offset: { start: 0, end: 3 },// Position of the term in the source formula
  evaluated: false,
  options: { flavor: "damage" }
}
```

**Changed in v14:** every `RollParser` callback (`_onDiceTerm`, `_onNumericTerm`, `_onFunctionTerm`, ...) receives a trailing `offset` argument, and the node it returns is expected to carry it. Forward `offset` from every branch of an overridden callback.

---

## 5. System-Specific Formulas

Build roll formulas dynamically from actor and item data using `@field` syntax and `getRollData()`.

### Formula Field on Items

```js
// In your TypeDataModel
class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      formula: new fields.StringField({ required: true, initial: "1d8" }),
      ability: new fields.StringField({ required: true, initial: "str" })
    };
  }
}
```

### Editing Formulas in Sheets

**New in v14:** `<formula-input>` is a form element for formula fields, with a button that opens the `FormulaEditor` application. The editor autocompletes `@` references from a registered context.

```html
<formula-input name="system.formula" context="my-system.weapon" value="{{system.formula}}"></formula-input>
```

Register the context in `init`. `labels` maps a data path to the human-readable label shown in autocomplete:

```js
Hooks.once("init", () => {
  CONFIG.formulaEditor.contexts["my-system.weapon"] = {
    labels: {
      "@actor.str": "MY_SYSTEM.Ability.str",
      "@actor.lvl": "MY_SYSTEM.Level",
      "@prof": "MY_SYSTEM.Proficiency"
    }
  };
});
```

The element fires a cancelable `edit` event before opening the editor. Call `preventDefault()` on it to open your own dialog instead. `formula-input` is in `CONST.ALLOWED_HTML_TAGS`, so it survives HTML sanitization.

### Dynamic Formula Building

```js
// Build formula from item data + actor data
class MySystemItem extends Item {
  getRollData() {
    const rollData = { ...super.getRollData() };
    if (this.actor) {
      rollData.actor = this.actor.getRollData();
    }
    return rollData;
  }
}

// The item's formula field might be: "1d20 + @actor.str"
// When rolled with getRollData(), @actor.str resolves to the actor's strength modifier
const roll = new Roll(item.system.formula, item.getRollData());
await roll.evaluate();
```

### @field Resolution Chain

```js
// Actor getRollData returns: { str: 14, strMod: 2, lvl: 5 }
// Item getRollData returns:   { formula: "1d8", actor: { str: 14, strMod: 2, lvl: 5 } }

// Formula "1d8 + @actor.strMod" resolves to: 1d8 + 2
// Formula "1d20 + @actor.str" resolves to: 1d20 + 14
```

### Rollable Buttons in Sheets

```js
// In your ActorSheetV2, use a static action handler
static async #onRoll(event, target) {
  const dataset = target.dataset;

  // Item roll — delegate to the item
  if (dataset.rollType === "item") {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) return item.roll();
  }

  // Direct formula roll from data attribute
  if (dataset.roll) {
    const label = dataset.label ? `[ability] ${dataset.label}` : "";
    const roll = Roll.create(dataset.roll, this.actor.getRollData());
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: label
    });
    return roll;
  }
}
```

Register the handler in `DEFAULT_OPTIONS.actions`:
```js
static DEFAULT_OPTIONS = {
  actions: { roll: MySheet.#onRoll },
};
```

```html
<!-- In your Handlebars template — use data-action to trigger the handler -->
<button type="button" data-action="roll" data-roll="d20 + @str" data-label="Strength Check">
  Roll STR
</button>

<button class="rollable" data-roll-type="item" data-item-id="abc123">
  Roll Weapon
</button>
```

---

## 6. Roll Prompt & Resolution

`RollResolver` provides a UI for players to supply die results before a roll finishes evaluating — manual entry, or an external dice-reading integration.

### Basic Roll Resolution

```js
// Simple roll — evaluates immediately
const roll = new Roll("2d20kh + 5");
await roll.evaluate();
roll.toMessage({ speaker, flavor: "Attack Roll" });
```

### Prompting for Choices

```js
// The resolver only appears when an interactive fulfillment method is configured
// (game.settings.get("core", Roll.DICE_CONFIGURATION_SETTING)) and evaluation allows it.
const roll = new Roll("2d20kh + @mod", { mod: 3 });
await roll.evaluate();                          // allowInteractive defaults to true
await roll.evaluate({ allowInteractive: false }); // never prompt
```

`Roll.resolverImplementation` picks the class: `foundry.applications.dice.RollResolver` unless exactly one interactive method is configured and that method declares its own `resolver`. Register a method in `CONFIG.Dice.fulfillment.methods`:

```js
Hooks.once("init", () => {
  CONFIG.Dice.fulfillment.methods.myTray = {
    label: "MY_SYSTEM.Fulfillment.Tray",
    icon: '<i class="fa-solid fa-dice"></i>',
    interactive: true,
    resolver: MyTrayResolver   // optional; extends foundry.applications.dice.RollResolver
  };
});
```

`Roll#toMessage` calls `evaluate({ allowInteractive: messageMode !== "blind" })`, so blind messages never prompt.

### Dice So Nice Integration

If the Dice So Nice module is active, `roll.toMessage()` automatically triggers 3D dice animation. No special code needed — the module hooks into `toMessage`.

```js
// This automatically triggers Dice So Nice if installed
await roll.toMessage({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  flavor: "Attack Roll"
});
```

### Roll Evaluation Flow

```
new Roll(formula, data)
  → parse formula into terms
  → resolve @field references from data
  → evaluate each term (rolls dice, computes math)
  → produce total

roll.toMessage(messageData, {messageMode})
  → creates ChatMessage with rendered roll HTML
  → applyMode sets whisper targets and blind state
  → Dice So Nice hooks in here for 3D animation
```

---

## 7. Chat Card Customization

Control how rolls appear in chat with `toMessage()` options and custom templates.

### Message Data vs. Options

`Roll#toMessage(messageData, options)` and `ChatMessage.create(data, options)` take the visibility mode as an **option**, not as message data.

```js
await roll.toMessage({
  // Who is speaking — use ChatMessage.getSpeaker()
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),

  // Flavor text displayed above the roll
  flavor: `[${item.type}] ${item.name}`,

  // Additional flags for your system
  flags: {
    "my-system": {
      rollType: "attack",
      itemId: item.id
    }
  }
}, {
  messageMode: "gm",   // omit to use the user's core.messageMode setting
  create: true         // false returns the prepared message data instead
});
```

### Message Modes

`CONFIG.ChatMessage.modes` is the registry of visibility modes. Core ships five:

| Key | Meaning |
|-----|---------|
| `public` | Out-of-character, visible to everyone |
| `gm` | Visible to gamemasters and the sender |
| `blind` | Visible to gamemasters only, not the sender |
| `self` | Visible only to the sender |
| `ic` | In-character, visible to everyone; sets `style` to `CHAT_MESSAGE_STYLES.IC` |

Each entry is `{label, icon}` plus an optional `handler(chatData)`. A handler takes over entirely: `ChatMessage.applyMode` calls it and returns, skipping the built-in whisper and blind logic.

```js
Hooks.once("init", () => {
  CONFIG.ChatMessage.modes.party = {
    label: "MY_SYSTEM.Modes.party",
    icon: "fa-solid fa-users",
    handler: data => {
      data.whisper = game.users.filter(u => u.character).map(u => u.id);
      data.blind = false;
    }
  };
});
```

`ChatMessage#applyMode(mode)` applies a mode to an unsaved message; `ChatMessage.applyMode(chatData, mode)` is the static form that mutates plain data.

**Changed in v14:** `rollMode` is deprecated (until v16) in favour of `messageMode`, everywhere it appeared — `Roll#toMessage`, `ChatMessage.create`, `RollTable#draw`/`#drawMany`, `Combat#rollInitiative`. The setting is `core.messageMode`, not `core.rollMode`. `CONFIG.Dice.rollModes` is a deprecation proxy over `CONFIG.ChatMessage.modes` and `CONST.DICE_ROLL_MODES` is deprecated. Convert stored legacy values with `Roll._mapLegacyRollMode(rollMode)`:

```js
// "roll" → the user's core.messageMode setting
// publicroll → public, gmroll → gm, blindroll → blind, selfroll → self
const messageMode = Roll._mapLegacyRollMode(legacyValue);
```

`ChatMessage#applyRollMode` / `ChatMessage.applyRollMode` are deprecated aliases of `applyMode`.

### ChatMessage.create for Non-Roll Messages

```js
// Post item description or other content without a roll
await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  flavor: `[${item.type}] ${item.name}`,
  content: item.system.description
}, { messageMode: game.settings.get("core", "messageMode") });
```

### Custom Roll Chat Card Template

Override the default roll rendering by providing a custom `createMessage` or modifying the roll's HTML output.

```js
// In your system's init hook — register a custom roll template
Hooks.once("init", () => {
  // The default template is "dice/roll"
  // To customize, you would override the Roll class's render method
  // or use a ChatMessage hook to modify the HTML
});

// Alternative: use a ChatMessage hook to augment the card.
// Changed in v14: renderChatMessage still fires but is deprecated (until v15) and
// passes jQuery. Use renderChatMessageHTML, which passes an HTMLElement.
Hooks.on("renderChatMessageHTML", (message, html, context) => {
  // Add custom buttons or styling to roll cards
  if (message.isRoll && message.getFlag("my-system", "rollType")) {
    const btn = document.createElement("button");
    btn.className = "my-system-reroll";
    btn.textContent = "Reroll";
    btn.addEventListener("click", () => {
      // Handle reroll logic
    });
    html.querySelector(".message-content")?.appendChild(btn);
  }
});
```

### Roll Flags for Identification

```js
// Tag rolls with system-specific data for later retrieval
roll.toMessage({
  speaker,
  flavor: "Damage Roll",
  flags: {
    "my-system": {
      rollType: "damage",
      weaponId: item.id,
      isCritical: isCrit
    }
  }
});

// Later, retrieve tagged rolls
const damageRolls = game.messages
  .filter(m => m.getFlag("my-system", "rollType") === "damage")
  .slice(-5); // Last 5 damage rolls
```
