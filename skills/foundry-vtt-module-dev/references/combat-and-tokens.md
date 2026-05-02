# Combat & Tokens

Deep reference for Foundry VTT v13's combat tracker, token HUD, scene controls, and prototype token configuration.

---

## 1. Custom Initiative

### Set a default initiative formula

```js
Hooks.once("init", () => {
  // Override the default initiative formula for all combatants
  CONFIG.Combat.initiative = {
    formula: "1d20 + @abilities.dex.mod + @abilities.wis.mod",
    decimals: 2
  };
});
```

The formula uses roll data from the combatant's actor. `decimals` controls rounding precision.

### Per-actor initiative formula

Override `getInitiativeRoll()` on the Combatant document for per-actor formulas:

```js
Hooks.once("init", () => {
  // Patch Combatant to use a custom initiative formula per actor type
  const original = Combatant.prototype.getInitiativeRoll;
  Combatant.prototype.getInitiativeRoll = function (formula) {
    const actor = this.actor;
    if (actor?.type === "hero") {
      formula = "1d20 + @abilities.dex.mod";
    } else if (actor?.type === "npc") {
      formula = "1d10 + @abilities.dex.mod";
    }
    return original.call(this, formula);
  };
});
```

For safer patching that plays well with other modules, use `libWrapper`:

```js
Hooks.once("setup", () => {
  libWrapper.register("my-module", "Combatant.prototype.getInitiativeRoll", function (wrapped, formula) {
    if (this.actor?.type === "hero") {
      formula = "1d20 + @abilities.dex.mod";
    }
    return wrapped(formula);
  }, "WRAPPER");
});
```

---

## 2. Combat Hooks

### Combat lifecycle

```js
// Combat encounter created
Hooks.on("createCombat", (combat, options, userId) => {
  console.log("Combat started:", combat.id);
});

// Combat begins (first turn)
Hooks.on("combatStart", (combat, updateData) => {
  ui.notifications.info("Roll initiative!");
});

// Turn changes — fires on every turn change including the first
Hooks.on("combatTurn", (combat, updateData, updateOptions) => {
  const combatant = combat.combatant;
  const actor = combatant?.actor;
  if (!actor) return;

  console.log(`Turn: ${combatant.name} (Round ${combat.round}, Turn ${combat.turn})`);

  // Decrement effect durations on turn start
  for (const effect of actor.allApplicableEffects()) {
    if (effect.duration?.turns) {
      // Custom turn-tracking logic
    }
  }
});

// Round changes
Hooks.on("combatRound", (combat, updateData, updateOptions) => {
  console.log(`Round ${combat.round} begins.`);
  if (combat.round === 1) {
    ui.notifications.info("First round — combat has begun!");
  }
});

// Combat ends
Hooks.on("deleteCombat", (combat, options, userId) => {
  console.log("Combat ended.");
});
```

### Flags on combatants

Store per-combatant data using flags (e.g., turn timer, custom status):

```js
// Set data on a combatant
await combat.combatant.setFlag("my-module", "turnTimer", 30);
await combat.combatant.setFlag("my-module", "conditions", ["poisoned", "slowed"]);

// Read in a hook
Hooks.on("combatTurn", (combat) => {
  const timer = combat.combatant.getFlag("my-module", "turnTimer");
  if (timer !== undefined) {
    console.log(`${combat.combatant.name} has ${timer}s for their turn.`);
  }
});

// Update multiple combatants at once
const updates = combat.combatants.map(c => ({
  _id: c.id,
  "flags.my-module.turnTimer": 30
}));
await combat.updateEmbeddedDocuments("Combatant", updates);
```

---

## 3. Token HUD

The Token HUD appears when a player right-clicks a token on the canvas. Add custom buttons via the `renderTokenHUD` hook.

```js
Hooks.on("renderTokenHUD", (hud, html, data) => {
  // Get the token being displayed
  const token = hud.object;
  const actor = token?.actor;
  if (!actor) return;

  // Build custom button that opens a dialog
  const button = document.createElement("div");
  button.classList.add("control-icon");
  button.innerHTML = '<i class="fa-solid fa-heart-pulse"></i>';
  button.title = game.i18n.localize("MY_MODULE.TokenHUD.quickHeal");
  button.addEventListener("click", async () => {
    const current = actor.system.health.value;
    const max = actor.system.health.max;
    const healed = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${actor.name} — Quick Heal` },
      content: `<p>Current HP: ${current} / ${max}</p>
        <label>New HP <input type="number" name="hp" value="${max}" min="0" max="${max}" /></label>`,
      ok: {
        label: "Heal",
        icon: "fa-solid fa-heart",
        callback: (event, button) => Number(button.form.elements.hp.value)
      }
    });
    if (healed !== undefined) {
      await actor.update({ "system.health.value": healed });
    }
  });

  // Inject into the left column of the HUD
  html.querySelector(".col.left")?.appendChild(button);
});
```

`html` is a native `HTMLElement` in v13. The HUD structure has `.col.left` and `.col.right` sections for placing custom controls.

---

## 4. Scene Controls

Scene controls are the toolbar buttons on the left side of the canvas. Add custom tools via `getSceneControlButtons`.

In v13, `controls` is an **object keyed by control name** (not an array). Access existing controls by name and add new ones by assignment.

### Adding a tool to an existing control group

```js
Hooks.on("getSceneControlButtons", (controls) => {
  // Access the "token" control group by key
  const tokenControls = controls.token;
  if (!tokenControls) return;

  // Add a tool to the token controls — tools is also an object keyed by name
  tokenControls.tools["my-module-aura"] = {
    name: "my-module-aura",
    title: "MY_MODULE.SceneControls.showAuras",
    icon: "fa-solid fa-circle-nodes",
    toggle: true,           // shows as an on/off toggle
    active: false,          // default state
    onClick: (active) => {
      // Toggle aura visibility on all tokens
      canvas.tokens.placeables.forEach(token => {
        const aura = token.document.getFlag("my-module", "auraRadius");
        if (aura) {
          token.mesh?.visible = active ? true : token.mesh?.visible;
        }
      });
    }
  };
});
```

### Adding a new control group

```js
Hooks.on("getSceneControlButtons", (controls) => {
  controls["my-module"] = {
    name: "my-module",
    title: "MY_MODULE.SceneControls.title",
    icon: "fa-solid fa-wand-magic-sparkles",
    layer: "myLayer",       // optional: bind to a canvas layer
    tools: {
      "paint-mode": {
        name: "paint-mode",
        title: "MY_MODULE.SceneControls.paintMode",
        icon: "fa-solid fa-paintbrush",
        onClick: () => { /* activate paint mode */ },
        button: true        // single-click button, not a toggle
      },
      "erase-mode": {
        name: "erase-mode",
        title: "MY_MODULE.SceneControls.eraseMode",
        icon: "fa-solid fa-eraser",
        toggle: true,
        active: false,
        onClick: (active) => { /* toggle erase mode */ }
      }
    }
  };
});
```

---

## 5. Prototype Token Configuration

The `prototypeToken` on an Actor defines the default appearance and behavior of tokens when they're placed on a scene. Configure it in `_preCreate`.

### Full _preCreate token setup

```js
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);

  // Set default token image (same as actor image)
  this.updateSource({
    "prototypeToken.texture.src": this.parent.img
  });

  // Token name and visibility
  this.updateSource({
    "prototypeToken.name": this.parent.name,
    "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    "prototypeToken.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER
  });

  // Disposition (affects color-coding on the canvas)
  this.updateSource({
    "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY
  });

  // Bar configuration — bar1 = primary (usually HP), bar2 = secondary
  this.updateSource({
    "prototypeToken.bar1": { attribute: "health" },       // maps to system.health
    "prototypeToken.bar2": { attribute: "mana" }           // maps to system.mana (if your system has it)
  });

  // Vision settings
  this.updateSource({
    "prototypeToken.sight": {
      enabled: true,
      range: 60,                              // sight range in scene units
      brightness: 0,                          // how bright the vision area is
      visionMode: "basic"                     // "basic", "darkvision", "lightAmplification", etc.
    },
    "prototypeToken.light": {
      dim: 10,                                // dim light radius
      bright: 5,                              // bright light radius
      color: "#ffaa00",                       // light color
      animation: { type: "torch", speed: 3, intensity: 3 }
    }
  });

  // Token size (grid units)
  this.updateSource({
    "prototypeToken.width": 1,
    "prototypeToken.height": 1
  });
}
```

### Bar attribute mapping

`bar1.attribute` and `bar2.attribute` reference keys in `actor.system`. For example, `{ attribute: "health" }` displays `system.health.value` as the current value and `system.health.max` as the maximum. The attribute path must lead to an object with `value` and `max` keys (or whatever the system's resource schema expects).

### PrototypeToken vs placed TokenDocument

- `actor.prototypeToken` — the template. Editing it changes defaults for *future* token placements.
- `token.document` (a `TokenDocument`) — a placed token on the scene. Editing it changes only that specific token.
- When a token is placed, its data is copied from `prototypeToken`. After placement, the `TokenDocument` is independent.

```js
// Update the prototype (affects future placements)
await actor.update({ "prototypeToken.light.dim": 20 });

// Update a placed token (affects only this token)
const token = canvas.tokens.controlled[0];
await token.document.update({ "light.dim": 20 });
```

---

## 6. User Selection & Targeting

### Selected tokens

```js
// Get all tokens the current user has selected (Ctrl+click)
const controlled = canvas.tokens.controlled;   // Token[]
for (const token of controlled) {
  console.log(token.actor.name, token.document.x, token.document.y);
}

// Apply an effect to all selected tokens
for (const token of canvas.tokens.controlled) {
  await token.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
}
```

### Targeted tokens

```js
// Get tokens the current user has targeted (right-click)
const targets = game.user.targets;   // Set<Token>
for (const token of targets) {
  console.log(token.actor.name);
}
```

### Hooks

```js
// Fires when a user targets/untargets a token
Hooks.on("targetToken", (user, token, targeted) => {
  if (targeted) {
    console.log(`${user.name} targeted ${token.name}`);
  }
});

// Fires when token selection changes
Hooks.on("controlToken", (token, controlled) => {
  if (controlled) {
    console.log(`Selected: ${token.name}`);
  }
});
```
