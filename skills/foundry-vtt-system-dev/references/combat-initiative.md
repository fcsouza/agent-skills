# Combat & Initiative

Deep reference for Foundry VTT v13's combat tracker and initiative customization.

---

## 1. CONFIG.Combat.initiative

Set the global initiative formula and precision in the `init` hook. The formula string is evaluated using roll data from the combatant's actor — `@abilities.dex.mod`, `@attributes.init.total`, etc. resolve against `actor.getRollData()`.

```js
Hooks.once("init", () => {
  // Global initiative formula for all combatants in this system
  CONFIG.Combat.initiative = {
    formula: "1d20 + @abilities.dex.mod + @abilities.wis.mod",
    decimals: 2  // number of decimal places to retain on the rolled value
  };
});
```

`decimals` defaults to `0` (integer). Setting it to `2` allows fractional initiative, useful for tie-breaking without additional rolls.

The formula can reference any field on the actor's roll data object. Nested paths like `@skills.initiative.total` work if the actor's `getRollData()` returns that structure.

```js
// System-specific formula referencing a custom field
CONFIG.Combat.initiative = {
  formula: "1d20 + @attributes.init.total + @bonuses.initiative",
  decimals: 2
};
```

---

## 2. Custom Combatant

Override `getInitiativeRoll()` to provide per-actor formulas. Register a custom document class via `CONFIG.Combatant.documentClass`.

```js
Hooks.once("init", () => {
  // Register custom Combatant document class
  CONFIG.Combatant.documentClass = MySystemCombatant;
});

class MySystemCombatant extends Combatant {
  /**
   * Override to provide per-type initiative formulas.
   * @param {string} [formula] - The formula passed by the system (may be null).
   * @returns {Roll} The Roll instance for initiative.
   */
  getInitiativeRoll(formula) {
    const actor = this.actor;
    if (!actor) return super.getInitiativeRoll(formula);

    // Per-type formula selection
    switch (actor.type) {
      case "hero":
        formula = "1d20 + @abilities.dex.mod + @abilities.wis.mod";
        break;
      case "npc":
        formula = "1d10 + @abilities.dex.mod";
        break;
      case "vehicle":
        formula = "1d6 + @piloting.skill";
        break;
      default:
        formula = formula ?? CONFIG.Combat.initiative.formula;
    }

    const roll = new Roll(formula, actor.getRollData());
    return roll;
  }
}
```

For safer patching that plays well with other modules, use `libWrapper` instead of direct prototype overriding:

```js
Hooks.once("setup", () => {
  if (typeof libWrapper === "undefined") return;

  libWrapper.register(
    "my-system",
    "Combatant.prototype.getInitiativeRoll",
    function (wrapped, formula) {
      const actor = this.actor;
      if (actor?.type === "hero") {
        formula = "1d20 + @abilities.dex.mod + @abilities.wis.mod";
      }
      return wrapped(formula);
    },
    "WRAPPER"
  );
});
```

---

## 3. Combat Lifecycle

Hooks fire at each stage of the combat encounter lifecycle. Use them to trigger system-specific logic like effect expiration, resource spending, or turn announcements.

```js
// Combat encounter created in the sidebar (not yet started)
Hooks.on("createCombat", (combat, options, userId) => {
  console.log(`[my-system] Combat created: ${combat.id}`);
});

// Combat begins — fires once when the GM clicks "Start Combat"
Hooks.on("combatStart", (combat, updateData) => {
  ui.notifications.info(game.i18n.localize("MY_SYSTEM.CombatStarted"));
});

// Turn changes — fires on every turn change, including the first turn
Hooks.on("combatTurn", (combat, updateData, updateOptions) => {
  const combatant = combat.combatant;
  const actor = combatant?.actor;
  if (!actor) return;

  console.log(
    `[my-system] Turn: ${combatant.name} (Round ${combat.round}, Turn ${combat.turn})`
  );
});

// Round changes — fires when the round counter increments
Hooks.on("combatRound", (combat, updateData, updateOptions) => {
  console.log(`[my-system] Round ${combat.round} begins`);
});

// Combat encounter deleted
Hooks.on("deleteCombat", (combat, options, userId) => {
  console.log(`[my-system] Combat ended: ${combat.id}`);
});
```

Access the current combatant and its actor safely:

```js
Hooks.on("combatTurn", (combat) => {
  const combatant = combat.combatant;
  if (!combatant) return;

  const actor = combatant.actor;
  if (!actor) return;

  const token = combatant.token;  // TokenDocument reference
  const name = combatant.name;    // display name (may differ from actor name)
  const initiative = combatant.initiative;  // numeric initiative value
});
```

---

## 4. Initiative Dialog

Customize how initiative is rolled for your system. `Combat.rollInitiative()` is the top-level method that rolls for one or more combatants.

```js
// Roll initiative for specific combatant IDs
const combat = game.combat;
if (combat) {
  const combatantIds = combat.combatants.map((c) => c.id);
  await combat.rollInitiative(combatantIds);

  // Or roll for a single combatant
  await combat.rollInitiative([combat.combatant.id]);
}
```

Override the initiative dialog to present system-specific options:

```js
class MySystemCombatant extends Combatant {
  getInitiativeRoll(formula) {
    const actor = this.actor;
    formula = formula ?? "1d20 + @abilities.dex.mod";
    return new Roll(formula, actor.getRollData());
  }
}
```

To present a custom dialog before rolling, override `Combat.rollInitiative()`:

```js
// Provide a custom initiative roll with dialog
Hooks.on("combatStart", async (combat) => {
  for (const combatant of combat.combatants) {
    if (!combatant.actor) continue;

    const roll = combatant.getInitiativeRoll();
    await roll.evaluate();  // v13: evaluate() is async

    // Optionally show the roll in chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
      flavor: game.i18n.localize("MY_SYSTEM.InitiativeRoll")
    });

    await combatant.update({ initiative: roll.total });
  }

  // Re-sort the turn order after all rolls
  await combat.update({ turn: 0 });
});
```

---

## 5. Turn & Round Automation

Automate per-turn effects, resource expenditure, and duration tracking.

### Effect Expiration on Turn Start

```js
Hooks.on("combatTurn", async (combat) => {
  const combatant = combat.combatant;
  const actor = combatant?.actor;
  if (!actor) return;

  // Iterate active effects and decrement remaining duration
  for (const effect of actor.allApplicableEffects()) {
    const duration = effect.duration;
    if (!duration?.turns || duration.startTurn === undefined) continue;

    // Check if this effect started on a previous turn in this round
    const roundsElapsed = combat.round - (duration.startRound ?? 0);
    const turnsElapsed = combat.turn - (duration.startTurn ?? 0);
    const totalTurns = roundsElapsed * combat.turns.length + turnsElapsed;

    if (totalTurns >= duration.turns) {
      await effect.delete();
      ui.notifications.info(
        `${effect.name} ${game.i18n.localize("MY_SYSTEM.Expired")}`
      );
    }
  }
});
```

### Resource Expenditure Per Turn

```js
Hooks.on("combatTurn", async (combat) => {
  const actor = combat.combatant?.actor;
  if (!actor || actor.type !== "hero") return;

  // Decrement a per-turn resource (e.g., stamina)
  const stamina = actor.system.stamina;
  if (stamina.value > 0) {
    await actor.update({
      "system.stamina.value": Math.max(0, stamina.value - 1)
    });
  }
});
```

### Turn Timer Pattern

```js
let turnTimer = null;

Hooks.on("combatTurn", (combat) => {
  // Clear previous timer
  if (turnTimer) clearTimeout(turnTimer);

  const SECONDS_PER_TURN = 60;
  turnTimer = setTimeout(() => {
    ui.notifications.warn(game.i18n.localize("MY_SYSTEM.TurnTimerExpired"));
  }, SECONDS_PER_TURN * 1000);
});

Hooks.on("deleteCombat", () => {
  if (turnTimer) clearTimeout(turnTimer);
});
```

---

## 6. Combat Flags & State

Store per-combatant custom data using flags. Flags are namespaced by your system ID and survive document updates.

```js
// Set a flag on a combatant
const combatant = game.combat.combatant;
await combatant.setFlag("my-system", "actionTaken", true);
await combatant.setFlag("my-system", "conditionsApplied", ["frightened"]);

// Read a flag
const acted = combatant.getFlag("my-system", "actionTaken");  // true
const conditions = combatant.getFlag("my-system", "conditionsApplied");  // ["frightened"]

// Delete a flag
await combatant.unsetFlag("my-system", "actionTaken");
```

### Batch Updating Combatants

```js
// Reset all combatants' flags at the start of a new round
Hooks.on("combatRound", async (combat) => {
  const updates = combat.combatants.map((c) => ({
    _id: c.id,
    flags: {
      "my-system": {
        actionTaken: false,
        bonusActionUsed: false
      }
    }
  }));

  await combat.updateEmbeddedDocuments("Combatant", updates);
});
```

### Storing Per-Combat State

```js
// Track system-level combat state on the Combat document itself
await game.combat.setFlag("my-system", "encounterDifficulty", "hard");
await game.combat.setFlag("my-system", "environmentEffects", ["dim-light", "rain"]);

// Read it back
const difficulty = game.combat.getFlag("my-system", "encounterDifficulty");
```

### Using Flags in Initiative Sorting

```js
class MySystemCombatant extends Combatant {
  getInitiativeRoll(formula) {
    // Apply a flag-based bonus
    const bonus = this.getFlag("my-system", "initiativeBonus") ?? 0;
    formula = `1d20 + @abilities.dex.mod + ${bonus}`;
    return new Roll(formula, this.actor.getRollData());
  }
}
```
