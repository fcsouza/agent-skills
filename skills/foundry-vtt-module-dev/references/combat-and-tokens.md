# Combat & Tokens

Deep reference for Foundry VTT v14's combat tracker, token HUD, scene controls, token movement, and prototype token configuration.

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

### Finding combatants

**Changed in v14:** the single-result lookups are deprecated (removed in v15). Both replacements return an array, because one Actor or Token can back several Combatants.

```js
// v13
const c = combat.getCombatantByActor(actor);
const t = combat.getCombatantByToken(tokenDoc);

// v14
const [c] = combat.getCombatantsByActor(actor);      // accepts an Actor or an Actor id
const [t] = combat.getCombatantsByToken(tokenDoc);   // accepts a TokenDocument or a Token id
```

### New Combat and Combatant fields

**New in v14:** `Combat#name` is a real schema field — encounters can be named, and the tracker offers an inline rename. `Combatant#roundJoined` records the round a combatant entered an already-started encounter (integer, minimum 1, default 1).

```js
await combat.update({ name: "Ambush at the Bridge" });

for ( const c of combat.combatants ) {
  if ( c.roundJoined > 1 ) console.log(`${c.name} joined on round ${c.roundJoined}`);
}
```

`CombatantGroup` (grouped combatants sharing an initiative) is not new in v14 — it shipped in v13 and is unchanged.

### Initiative message visibility

**Changed in v14:** roll modes became message modes. `Combat#rollInitiative` takes `messageMode` instead of `rollMode`.

```js
// v13
await combat.rollInitiative(ids, { rollMode: "gmroll" });

// v14
await combat.rollInitiative(ids, { messageMode: "gm" });
```

`CONFIG.ChatMessage.modes` holds the available modes (`public`, `gm`, `blind`, `self`, `ic`). `foundry.dice.Roll._mapLegacyRollMode(rollMode)` converts a stored v13 value.

### Turn marker

`CONFIG.Combat.fallbackTurnMarker` is the image used when a combatant has no turn marker of its own. Its default changed in v14 to `"canvas/tokens/turn-marker-square-circle-orange.webp"`.

---

## 3. Active Effect durations in combat

**New in v14.** `ActiveEffect.registry` is an `ActiveEffectRegistry` singleton that tracks which effects are due to expire. Call `refresh` when a custom expiry event fires.

```js
Hooks.once("init", () => {
  // Register a custom expiry event
  CONFIG.ActiveEffect.expiryEvents.myModuleShortRest = "MY_MODULE.Expiry.shortRest";
});

// Later, when a short rest happens
await foundry.documents.ActiveEffect.registry.refresh("myModuleShortRest");
```

`CONFIG.ActiveEffect.expiryAction` decides what the registry does on expiry: `"update"` (default, sets `duration.expired`), `"delete"`, or `null` to do nothing.

`Actor#onUpdateEffectDurations(effects, event, context)` is an empty hook method on the Actor for systems to override — it runs when the registry updates durations. See `foundry-vtt-module-dev/references/active-effects-v2.md` for the full model.

---

## 4. Token HUD

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

`html` is a native `HTMLElement`. The HUD structure has `.col.left` and `.col.right` sections for placing custom controls.

**New in v14:** the Token HUD has a level selector when the scene has more than one Scene Level. `TokenHUD#_getLevelChoices()` builds it from `token.document.parent.levels.reverseSorted`, and the `level` action changes the token's level. The elevation input is now relative to `canvas.level.elevation.base`.

---

## 5. Scene Controls

Scene controls are the toolbar buttons on the left side of the canvas. Add custom tools via `getSceneControlButtons`.

A tool's callback is `onChange(event, active)`. Tools also accept `order`, `visible`, `interaction`, `control`, `creation`, `createData` and `shapeData`.

`controls` is an **object keyed by control name** (not an array). Access existing controls by name and add new ones by assignment. This has been true since v13.

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
    order: 10,
    onChange: (event, active) => {
      for ( const token of canvas.tokens.placeables ) {
        const radius = token.document.getFlag("my-module", "auraRadius");
        if ( radius ) myModule.setAuraVisible(token, active);
      }
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
        order: 0,
        button: true,       // single-click button, not the active tool
        onChange: () => { /* activate paint mode */ }
      },
      "erase-mode": {
        name: "erase-mode",
        title: "MY_MODULE.SceneControls.eraseMode",
        icon: "fa-solid fa-eraser",
        order: 1,
        toggle: true,
        active: false,
        onChange: (event, active) => { /* toggle erase mode */ }
      }
    }
  };
});
```

---

## 6. Prototype Token Configuration

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

  // Token size (grid units); depth is new in v14
  this.updateSource({
    "prototypeToken.width": 1,
    "prototypeToken.height": 1,
    "prototypeToken.depth": 1
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

## 7. User Selection & Targeting

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

---

## 8. Token Movement

**Changed in v14:** moving a token is no longer a plain `update({x, y})`. `TokenDocument#move` drives an animated, cost-measured, collision-checked path.

```js
const completed = await token.document.move([
  { x: 100, y: 200 },                    // move to a point
  { elevation: 5, explicit: true },      // change elevation; the user placed this waypoint
  { x: 500, y: 500, checkpoint: true },  // movement can pause/stop here
  { width: 2, height: 2, depth: 2 },     // change size mid-path
  { x: 1000, action: "swim" },           // swim the rest
  { x: 0, y: 0, snapped: true }
], {
  autoRotate: true,
  constrainOptions: { ignoreWalls: true, ignoreCost: true }
});
if ( !completed ) console.log("movement stopped or prevented");
```

Resizing keeps the centre point:

```js
await token.document.resize({ width: 2, height: 2, depth: 2 });
```

Both delegate to `Scene#moveTokens(instructions, options)`, which moves or resizes many tokens in one operation. Instructions are keyed by token id; the result is a record of token id to boolean.

```js
const results = await canvas.scene.moveTokens({
  [tokenA.id]: { destination: { x: 800, y: 600 } },
  [tokenB.id]: { dimensions: { width: 2, height: 2 } }
}, { showRuler: true });
```

### Planning a move

`Token#planMovement` computes a path without committing it.

```js
const plan = await token.planMovement({
  allowedActions: ["walk", "fly"],
  direct: false,
  minCost: 0, maxCost: Infinity, minDistance: 0
});
```

The `planToken(document)` hook fires when movement is planned.

**Changed in v14:** `Token#findMovementPath(waypoints, {ignoreWalls, ignoreCost, history})` is deprecated — pass those three inside `constrainOptions` instead. `Token#getMovementAdjustedPoint` is deprecated; use the unadjusted, rounded point.

### Movement actions

`CONFIG.Token.movement.actions` maps action ids to configs. In v14 the built-ins are declarative: `speedMultiplier`, `terrainAction`, `costMultiplier` and `canSelect` replace the `getAnimationOptions`, `deriveTerrainDifficulty` and `getCostFunction` closures the v13 defaults used. The function forms still exist and take precedence when you set them.

```js
Hooks.once("init", () => {
  CONFIG.Token.movement.actions.hover = {
    label: "MY_MODULE.Movement.hover",
    icon: "fa-solid fa-feather",
    order: 10,
    speedMultiplier: 0.5,
    terrainAction: null,   // terrain difficulty is always 1
    costMultiplier: 1,
    walls: null,           // null = ignores walls; otherwise an EdgeRestrictionType
    teleport: false,
    measure: true,
    visualize: true,
    canSelect: true
  };
});
```

### Keyboard movement

Arrow/WASD movement drives the same pipeline. **New in v14:** `core.ascend` (default `E`) and `core.descend` (default `Q`) move the token up and down Scene Levels.

### Ruler styling

`TokenRuler#_getWaypointStyle(waypoint)` and `#_getSegmentStyle(waypoint)` are the protected hooks for recolouring the movement ruler.

```js
class MyRuler extends foundry.canvas.placeables.tokens.TokenRuler {
  _getWaypointStyle(waypoint) {
    const style = super._getWaypointStyle(waypoint);
    if ( waypoint.action === "fly" ) style.color = 0x66ccff;
    return style;
  }
}
Hooks.once("init", () => { CONFIG.Token.rulerClass = MyRuler; });
```

`_getWaypointStyle` returns `{radius, shape, color, alpha}` — `radius: 0` draws nothing. `shape` is one of `"circle"`, `"square"`, `"diamond"`, `"triangleUp"`, `"triangleDown"`, `"hexagonFlat"`, `"hexagonPointy"`, `"octagon"`. `_getSegmentStyle` returns `{width, color, alpha}`.

### Interactive placement

`TokenLayer#placeTokens(data, options)` gives the drag-place-and-rotate flow, mirroring `RegionLayer#placeRegion`.

```js
const tokens = await canvas.tokens.placeTokens([tokenData], {
  create: true, allowRotation: true, onMove, onRotate, onChange, preConfirm
});
```

---

## 9. Removed Token methods

These shims were deprecated in v12/v13 and are **gone** in v14. Calling them throws.

| Removed | Replacement |
|---|---|
| `Token#toggleCombat()` | `TokenDocument#toggleCombatant({active})` |
| `TokenLayer#toggleCombat()` | `TokenDocument.implementation.createCombatants(tokens, {combat})` / `deleteCombatants` |
| `Token#toggleEffect()`, `TokenDocument#toggleActiveEffect()` | `Actor#toggleStatusEffect(statusId, {active, overlay})` |
| `Token#toggleVisibility()` | `token.document.update({hidden: !token.document.hidden})` |
| `Token#owner` | `Token#isOwner` |
| `Token#getCenter(x, y)` | `Token#getCenterPoint(point)` |
| `Token#updateSource()` | `Token#initializeSources()` |
| `Token#getSize()` | `TokenDocument#getSize()` |
| `Token#target` | `Token#targetArrows` / `Token#targetPips` |
| `TokenDocument#effects`, `#overlayEffect` | ActiveEffects on the Actor |

```js
// v13
await token.toggleCombat();
await token.toggleEffect(CONFIG.statusEffects.find(e => e.id === "prone"));

// v14
await token.document.toggleCombatant();
await token.actor.toggleStatusEffect("prone");
```

**Changed in v14:** `CONFIG.statusEffects` is a Proxy that also indexes by id, so modules should add entries by id rather than pushing onto the array.

```js
Hooks.once("init", () => {
  CONFIG.statusEffects.myCondition = {
    id: "myCondition",
    name: "MY_MODULE.Status.myCondition",
    img: "modules/my-module/icons/condition.svg"
  };
});
```

---

## 10. Token bars and dependent tokens

**New in v14:** `CONFIG.Token.barConfig` holds the empty/full colours for each resource bar, and `Token#_getBarColors(index, data)` is the protected hook to override them per token.

```js
CONFIG.Token.barConfig.bar1.colors.full = foundry.utils.Color.from("#00ff88");

class MyToken extends foundry.canvas.placeables.Token {
  _getBarColors(index, data) {
    const colors = super._getBarColors(index, data);
    if ( this.actor?.type === "npc" ) colors.full = foundry.utils.Color.from("#aa0000");
    return colors;
  }
}
```

`Actor#getDependentTokens({scenes, linked, concreteOnly})` lists the tokens that draw their data from an Actor. **New in v14:** `concreteOnly: true` excludes synthetic tokens.

```js
const tokens = actor.getDependentTokens({ scenes: canvas.scene, concreteOnly: true });
```

---

## 11. Tokens and Scene Levels

**New in v14:** every Token carries `level` (a Level document id, default `"defaultLevel0000"`) and `depth` (vertical extent, minimum 0, default 1) alongside `x`, `y`, `elevation`, `width`, `height` and `shape`. All of these are movement fields, so they can change mid-path in `move()`.

```js
tokenDoc.level;                          // Level id
tokenDoc.depth;                          // vertical size
tokenDoc.includedInLevel(level);         // is this token part of the given Level?
tokenDoc.locatedInLevel(level);          // is it currently standing in that Level?
tokenDoc.getOccupiedGridSpaceOffsets();  // GridOffset3D[]
```

See `foundry-vtt-module-dev/references/scene-levels.md`.
