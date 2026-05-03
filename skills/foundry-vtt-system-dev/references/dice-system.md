# Dice System

Deep reference for Foundry VTT v13's dice rolling system and customization.

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
   * @returns {DiceRollParseNode}
   * @protected
   */
  _onDiceTerm(number, faces, modifiers, flavor, formula) {
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
  evaluated: false,
  options: { flavor: "damage" }
}
```

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
    const roll = new Roll(dataset.roll, this.actor.getRollData());
    await roll.evaluate();
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: label,
      rollMode: game.settings.get("core", "rollMode"),
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

In v13, the `RollResolver` provides a UI for players to make choices before a roll is evaluated (e.g., picking which die is the advantage die).

### Basic Roll Resolution

```js
// Simple roll — evaluates immediately
const roll = new Roll("2d20kh + 5");
await roll.evaluate();
roll.toMessage({ speaker, flavor: "Attack Roll" });
```

### Prompting for Choices

```js
// The RollResolver UI appears automatically for complex rolls
// that need player input (e.g., 2d20kh — which die to keep)

const roll = new Roll("2d20kh + @mod", { mod: 3 });
// evaluate() may trigger the RollResolver dialog in v13
await roll.evaluate();
```

### Dice So Nice Integration

If the Dice So Nice module is active, `roll.toMessage()` automatically triggers 3D dice animation. No special code needed — the module hooks into `toMessage`.

```js
// This automatically triggers Dice So Nice if installed
roll.toMessage({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  flavor: "Attack Roll",
  rollMode: game.settings.get("core", "rollMode")
});
```

### Roll Evaluation Flow

```
new Roll(formula, data)
  → parse formula into terms
  → resolve @field references from data
  → evaluate each term (rolls dice, computes math)
  → produce total

roll.toMessage(options)
  → creates ChatMessage with rendered roll HTML
  → Dice So Nice hooks in here for 3D animation
```

---

## 7. Chat Card Customization

Control how rolls appear in chat with `toMessage()` options and custom templates.

### toMessage Options

```js
roll.toMessage({
  // Who is speaking — use ChatMessage.getSpeaker()
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),

  // Flavor text displayed above the roll
  flavor: `[${item.type}] ${item.name}`,

  // Roll visibility mode
  // "roll" = everyone sees, "gmroll" = GM + roller,
  // "blindroll" = GM only, "selfroll" = roller only
  rollMode: game.settings.get("core", "rollMode"),

  // Additional flags for your system
  flags: {
    "my-system": {
      rollType: "attack",
      itemId: item.id
    }
  }
});
```

### ChatMessage.create for Non-Roll Messages

```js
// Post item description or other content without a roll
ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  flavor: `[${item.type}] ${item.name}`,
  content: item.system.description,
  rollMode: game.settings.get("core", "rollMode")
});
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

// Alternative: use a ChatMessage hook to augment the card
Hooks.on("renderChatMessage", (message, html, data) => {
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
