# Character Creation

Deep reference for Foundry VTT v14's character creation workflows.

---

## 1. _preCreate() for Default Items

Override `_preCreate()` on your `TypeDataModel` to inject default items when an Actor is created. `ClientDocument#_preCreate` forwards to `this.system._preCreate(data, options, user)`, so it runs before the document is persisted and you can still change the creation data.

Inside a `TypeDataModel`, `this` is the **system** model. `this.updateSource()` writes into `actor.system`. Anything outside `system` — `items`, `effects`, `prototypeToken`, `img` — goes through `this.parent.updateSource()`, where `this.parent` is the Actor. Return `false` to cancel the creation.

```js
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      level: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      biography: new fields.HTMLField({ initial: "" })
    };
  }

  /**
   * Inject default items when a new Hero actor is created.
   * @param {object} data    - The initial creation data for this actor.
   * @param {object} options - Creation options.
   * @param {User}   user    - The user creating the document.
   * @returns {Promise<boolean|void>} Return false to cancel the creation.
   */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Build default items array
    const defaultItems = [
      {
        name: _loc("MY_SYSTEM.UnarmedStrike"),
        type: "weapon",
        img: "icons/weapons/fist/fist-human.webp",
        system: { damage: "1", damageType: "bludgeoning", equipped: true }
      },
      {
        name: _loc("MY_SYSTEM.DefaultArmor"),
        type: "armor",
        img: "icons/equipment/chest/shirt-collared-white.webp",
        system: { armorType: "clothing", armorValue: 10, equipped: true }
      }
    ];

    // Inject items into creation data — `items` lives on the Actor, not on system
    this.parent.updateSource({ items: defaultItems });
  }
}
```

`updateSource()` merges into the pending creation data. `items` adds embedded documents to the actor.

### Operators in updateSource

Changed in v14: the `-=key` and `==key` syntaxes are deprecated (removed in v16). Use the operator globals: `_del` deletes a key, `_replace(value)` assigns without merging.

```js
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);

  // Replace outright instead of deep-merging into whatever was copied in
  this.updateSource({ abilities: _replace({ str: { value: 10 }, dex: { value: 10 } }) });

  // Drop a marker flag carried over from the template actor
  this.parent.updateSource({ "flags.my-system.isTemplate": _del });
}
```

### Active Effects on creation

Changed in v14: an effect's changes live at `effect.system.changes`, and each change is `{key, type, value, phase, priority}` with a string `type`. Numeric `mode` is deprecated.

```js
this.parent.updateSource({
  effects: [{
    name: _loc("MY_SYSTEM.WellRested"),
    img: "icons/magic/life/heart-glowing-red.webp",
    system: {
      changes: [
        { key: "system.hp.max", type: "add", value: 2, phase: "initial", priority: 20 }
      ]
    },
    duration: { value: 8, units: "hours" }
  }]
});
```

`type` is a key of `CONST.ACTIVE_EFFECT_CHANGE_TYPES` (`custom, multiply, add, subtract, downgrade, upgrade, override`) or a custom id in `CONFIG.ActiveEffect.changeTypes`. `phase` is `"initial"` or `"final"`. `duration.units` is a value in `CONST.ACTIVE_EFFECT_DURATION_UNITS` (`years, months, days, hours, minutes, seconds, rounds, turns`). Full model: `foundry-vtt-module-dev/references/active-effects-v2.md`.

---

## 2. preCreateActor Hook

The global `preCreateActor` hook fires for every Actor creation. Use it for defaults that apply across all types, or when you cannot change the TypeDataModel.

```js
Hooks.on("preCreateActor", (document, data, options, userId) => {
  // Only apply defaults for hero type
  if (document.type !== "hero") return;

  // Set default token configuration
  document.updateSource({
    "prototypeToken.name": document.name,
    "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    "prototypeToken.actorLink": true,
    "prototypeToken.sight.enabled": true,
    "prototypeToken.bar1.attribute": "hp"
  });
});
```

The first argument is the pending Actor document instance. Use `document.updateSource()` to modify creation data — do not mutate the `data` argument directly.

---

## 3. Prototype Token Defaults

Configure default token settings in `_preCreate()` so every new actor has sensible token behavior out of the box. `prototypeToken` is an Actor-level field, so write it through `this.parent`.

`PrototypeToken` carries a subset of the Token schema: `name, displayName, actorLink, width, height, depth, texture, lockRotation, rotation, alpha, disposition, displayBars, bar1, bar2, light, sight, detectionModes, occludable, ring, turnMarker, movementAction, flags`, plus `randomImg`, `appendNumber`, `prependAdjective`. Changed in v14: `depth` was added, and `detectionModes` is an object keyed by mode id rather than an array. Scene-scoped Token fields — `x`, `y`, `elevation`, `shape`, `level` — are **not** on the prototype.

```js
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() { /* ... */ }

  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Default token configuration for hero actors
    this.parent.updateSource({
      prototypeToken: {
        name: data.name,
        displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
        displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        actorLink: true,       // linked actors share HP, effects, inventory
        depth: 1,              // v14: vertical extent in grid units
        sight: {
          enabled: true,
          range: 60,           // vision range in scene units
          visionMode: "basic"   // a key of CONFIG.Canvas.visionModes
        },
        light: { bright: 0, dim: 10, color: "#ffeedd", alpha: 0.5,
          animation: { type: "torch", speed: 5, intensity: 5 } },
        // Bar attribute paths are relative to `system`
        bar1: { attribute: "hp" },
        bar2: { attribute: null },
        texture: { src: "icons/svg/mystery-man.svg", scaleX: 1, scaleY: 1, tint: null }
      }
    });
  }
}
```

NPC tokens typically differ: `actorLink: false`, `disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE`, and `displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS`.

---

## 4. Default Item Templates

Define starter item sets per actor type. Store item data as plain objects and inject them during creation.

```js
const STARTER_ITEMS = {
  hero: [
    { name: "Longsword", type: "weapon", img: "icons/weapons/swords/sword-guard-steel.webp",
      system: { damage: "1d8", equipped: true, proficient: true } },
    { name: "Chain Mail", type: "armor", img: "icons/equipment/chest/chainmail-hauberk-silver.webp",
      system: { armorType: "heavy", armorValue: 16, equipped: true } }
  ],
  npc: [
    { name: "Natural Weapon", type: "weapon", img: "icons/weapons/fist/fist-human.webp",
      system: { damage: "1d6", equipped: true, proficient: true } }
  ]
};

// Apply in _preCreate on the type's TypeDataModel
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);
  const items = STARTER_ITEMS[this.parent.type] ?? [];
  if (items.length) this.parent.updateSource({ items });
}
```

---

## 5. Character Creation Dialog

Build a custom creation workflow using `DialogV2`. Changed in v14: `DialogV2.wait` accepts `renderOptions`, forwarded to the render call. `DialogV2.input` is the shortcut when you only need the form data back — it wraps `prompt` with a callback that returns `new FormDataExtended(button.form).object`.

```js
async function showCharacterCreationDialog() {
  const opts = (list, prefix) => list
    .map(v => `<option value="${v}">${_loc(`${prefix}.${v}`)}</option>`).join("");

  const content = `
    <div class="form-group"><label>${_loc("MY_SYSTEM.CharName")}</label>
      <input type="text" name="name" required /></div>
    <div class="form-group"><label>${_loc("MY_SYSTEM.CharRace")}</label>
      <select name="race">${opts(["human", "elf", "dwarf"], "MY_SYSTEM.Race")}</select></div>
    <div class="form-group"><label>${_loc("MY_SYSTEM.CharClass")}</label>
      <select name="charClass">${opts(["warrior", "mage", "rogue"], "MY_SYSTEM.Class")}</select></div>
  `;

  // DialogV2.input returns the form object, or null when dismissed
  return foundry.applications.api.DialogV2.input({
    window: { title: _loc("MY_SYSTEM.CreateCharacter") },
    position: { width: 400 },
    content,
    ok: { label: _loc("MY_SYSTEM.Create") }
  });
}
```

### Stat Generation and Full Workflow

```js
// Roll 4d6 drop lowest for each ability
async function rollAbilityScores() {
  const scores = {};
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const roll = new Roll("4d6kh3");
    await roll.evaluate();  // evaluate() is async
    scores[ability] = roll.total;
  }
  return scores;
}

// Full creation workflow
async function createCharacter() {
  const info = await showCharacterCreationDialog();
  if (!info) return;

  const scores = await rollAbilityScores();

  const actor = await Actor.create({
    name: info.name,
    type: "hero",
    system: {
      race: info.race,
      charClass: info.charClass,
      abilities: Object.fromEntries(
        Object.entries(scores).map(([k, v]) => [k, { value: v }])
      )
    }
  });

  await applyRaceItems(actor, info.race);
  actor.sheet.render(true);
}
```

---

## 6. Import from Compendium

Load character templates, race packages, or class features from compendium packs.

### Loading a Single Document from a Pack

```js
async function applyRaceItems(actor, raceId) {
  const pack = game.packs.get("my-system.races");
  if (!pack) return;
  const documents = await pack.getDocuments();
  const raceDoc = documents.find(d => d.flags["my-system"]?.raceId === raceId);
  if (!raceDoc) return;
  await actor.createEmbeddedDocuments("Item", raceDoc.items.map(i => i.toObject()));
}
```

### Importing an Actor from a Compendium

Use the world collection rather than `Actor.create(doc.toObject())`. `WorldCollection#importFromCompendium(pack, id, updateData, options)` runs `fromCompendium`, which clears folder, sort, ownership and state, and records `_stats.compendiumSource` so you can find the origin later.

```js
async function importActor(packId, docId) {
  const pack = game.packs.get(packId);
  if (!pack) return;
  return game.actors.importFromCompendium(pack, docId, { name: "Copy of Goblin" }, { keepId: false });
}
```

### Import prompt

Let the user pick and confirm before you write. `DialogV2.input` returns the form object, or `null` if the dialog is dismissed.

```js
async function promptImport(packId) {
  const pack = game.packs.get(packId);
  const index = await pack.getIndex();
  const opts = index.map(e =>
    `<option value="${e._id}">${foundry.utils.escapeHTML(e.name)}</option>`).join("");
  const picked = await foundry.applications.api.DialogV2.input({
    window: { title: _loc("MY_SYSTEM.ImportCharacter") },
    content: `<div class="form-group"><select name="docId">${opts}</select></div>`,
    ok: { label: _loc("MY_SYSTEM.Import") }
  });
  return picked ? game.actors.importFromCompendium(pack, picked.docId) : undefined;
}
```

### Direct UUID Access

```js
// UUID format: "Compendium.my-system.races.Actor.abc123"
const doc = await fromUuid("Compendium.my-system.races.Actor.abc123");
const data = doc?.toObject();
```

---

## 7. Starting Conditions with toggleStatusEffect

`Actor#toggleStatusEffect(statusId, {active, overlay})` creates or removes the ActiveEffect for a configured status. `statusId` must be a key of `CONFIG.statusEffects`; anything else throws. It resolves to the created `ActiveEffect`, `true` if one already existed, `false` if one was removed, or `undefined` if nothing changed.

```js
// After creating a character, apply its starting condition
await actor.toggleStatusEffect("blind", { active: true, overlay: false });
```

Changed in v14: `CONFIG.statusEffects` is a Proxy over the array that also indexes by id. `CONFIG.statusEffects.blind` reads an entry, `CONFIG.statusEffects.myCondition = {id: "myCondition", name: "...", img: "..."}` adds one, and `delete CONFIG.statusEffects.blind` removes one. Assigning a whole array is deprecated since v14: the setter empties the list first, so it wipes conditions other packages added earlier in `init`.
