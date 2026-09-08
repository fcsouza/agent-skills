# Combat & Initiative

Deep reference for Foundry VTT v14+ combat tracker and initiative customization.

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

`decimals` defaults to `2`, so fractional initiative works out of the box for tie-breaking. Set it to `0` for integer initiative. `formula` defaults to `null`, and there is no core default behind it: `Combatant#_getInitiativeFormula` returns `String(CONFIG.Combat.initiative.formula || game.system.initiative)`. `game.system.initiative` is the `initiative` string in `system.json`. Leave both unset and there is nothing to roll — `Roll.create` throws. Set one of them.

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

    // Roll.create uses CONFIG.Dice.rolls[0], so a custom Roll class is respected
    return Roll.create(formula, actor.getRollData());
  }
}
```

For safer patching that plays well with other modules, use `libWrapper` instead of direct prototype overriding. Target paths use the deprecated document globals or, preferably, the namespaced classes — `foundry.documents.Combatant.prototype.getInitiativeRoll`, `foundry.documents.Combat.prototype.rollInitiative`, `foundry.documents.Actor.prototype.applyActiveEffects`:

```js
Hooks.once("setup", () => {
  if (typeof libWrapper === "undefined") return;

  libWrapper.register(
    "my-system",
    "foundry.documents.Combatant.prototype.getInitiativeRoll",
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

### Combat, Combatant, and Group Fields

| Member | Notes |
|--------|-------|
| `combat.name` | **New in v14.** A user-editable encounter name (`CombatTracker#onEditName`). Falls back to a generated label when blank. |
| `combatant.roundJoined` | **New in v14.** The round on which the combatant entered the encounter (integer, initial `1`). `Combatant#_preCreate` stamps it with `combat.round` when the encounter has already started. Use it to date effects and "since you joined" counters. |
| `combat.groups` | `EmbeddedCollection<CombatantGroup>`. Groups hold a shared `initiative`, `name`, `img`, `type`/`system`, and `ownership`; `group.members` is a `Set<Combatant>`. `combatant.group` stores the group id. |
| `combat.getCombatantsByActor(actor)` | Returns **an array** of every combatant for that actor or actor id. |
| `combat.getCombatantsByToken(token)` | Returns **an array** of every combatant for that token document or id. |

**Changed in v14:** `Combat#getCombatantByActor` and `#getCombatantByToken` (singular) are deprecated until v15. They now return the first match of the plural methods, so replace them explicitly rather than relying on the shim:

```js
// Before
const c = combat.getCombatantByActor(actor);
// After — decide what a multi-token actor should do
const [c] = combat.getCombatantsByActor(actor);
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

`rollInitiative(ids, options)` takes:

| Option | Default | Effect |
|--------|---------|--------|
| `formula` | `null` | Overrides the per-combatant formula for this call. |
| `updateTurn` | `true` | Keep the current turn on the same combatant after re-sorting. |
| `messageMode` | — | A key of `CONFIG.ChatMessage.modes`. Hidden combatants fall back to `"gm"`. |
| `messageOptions` | `{}` | Merged into the chat message data (flavor, flags, speaker). |

```js
await combat.rollInitiative(ids, {
  formula: "1d20 + @attributes.init.total",
  messageMode: "gm",
  messageOptions: { flags: { "my-system": { initiative: true } } }
});
```

**Changed in v14:** `messageOptions.rollMode` is deprecated (until v16). Pass `messageMode` as a top-level option. `Combatant#getInitiativeRoll` now builds the roll with `Roll.create`, so `CONFIG.Dice.rolls[0]` is used.

Override the initiative dialog to present system-specific options:

```js
class MySystemCombatant extends Combatant {
  getInitiativeRoll(formula) {
    const actor = this.actor;
    formula = formula ?? "1d20 + @abilities.dex.mod";
    return Roll.create(formula, actor.getRollData());
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
    await roll.evaluate();  // evaluate() is async

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

### Effect Expiration

**Changed in v14:** do not walk durations by hand. Core tracks expiry in `ActiveEffect.registry`, an `ActiveEffectRegistry` singleton, and calls `ActiveEffect.registry.refresh(event, context)` whenever time or the turn order moves.

`CONST.ACTIVE_EFFECT_EXPIRY_EVENTS` holds the six values valid in `duration.expiry`:

| Expiry event | Fired by |
|--------------|----------|
| `combatStart` | `Combat#startCombat`, and when combatants join a started encounter |
| `roundStart` / `roundEnd` | round advance |
| `turnStart` / `turnEnd` | turn advance |
| `combatEnd` | combat deletion |

Two more identifiers reach `refresh` but are not expiry choices: `combatRewind` (stepping backwards through the tracker) and `updateWorldTime` (`GameTime`).

An effect's duration is `{value, units, expiry, expired}` plus a separate `start: {combat, combatant, initiative, round, turn, time}`. `units` is one of `CONST.ACTIVE_EFFECT_DURATION_UNITS` (the time units plus `rounds` and `turns`). `expiry` names the event at which the effect lapses; it initializes to `"turnStart"` when `duration.value` is a number.

`CONFIG.ActiveEffect.expiryAction` decides what the registry does on expiry: `"update"` (default) sets `duration.expired`, `"delete"` deletes the effect, `null` does nothing.

```js
Hooks.once("init", () => {
  CONFIG.ActiveEffect.expiryAction = "delete";   // system prefers removal
});
```

React to the refresh by overriding `Actor#onUpdateEffectDurations(effects, event, context)`. It is an empty async method on the base class, called for every user:

```js
class MySystemActor extends Actor {
  /** @override */
  async onUpdateEffectDurations(effects, event, context) {
    for (const effect of effects) {
      if (!effect.duration.expired) continue;
      ui.notifications.info(`${effect.name} ${game.i18n.localize("MY_SYSTEM.Expired")}`);
    }
  }
}
```

### Custom Expiry Events

Register an event id and label in `CONFIG.ActiveEffect.expiryEvents`, then trigger it yourself. If the event also advances world time, advance the time first.

```js
Hooks.once("init", () => {
  CONFIG.ActiveEffect.expiryEvents.shortRest = "MY_SYSTEM.Expiry.shortRest";
});

async function shortRest(actor) {
  await game.time.advance(3600);
  await ActiveEffect.registry.refresh("shortRest", { actors: new Set([actor]) });
}
```

`refresh` accepts `{combat, actors}` in its context. Pass `actors` to limit the sweep.

**Changed in v14:** `duration.rounds`, `duration.seconds`, `duration.turns`, `duration.startRound`, `duration.startTurn`, `duration.startTime` and `duration.combat` are deprecated. Read `duration.value` + `duration.units` and `start.*` instead.

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
    return Roll.create(formula, this.actor.getRollData());
  }
}
```

---

## 7. Turn Marker

`CONFIG.Combat.fallbackTurnMarker` is the texture drawn under the active combatant when a token has no turn marker of its own.

```js
Hooks.once("init", () => {
  CONFIG.Combat.fallbackTurnMarker = "systems/my-system/ui/turn-marker.webp";
});
```

**Changed in v14:** the core default moved to `canvas/tokens/turn-marker-square-circle-orange.webp`. If your system relied on the old path, set it explicitly.
