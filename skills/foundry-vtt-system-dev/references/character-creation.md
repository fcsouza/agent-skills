# Character Creation

Deep reference for Foundry VTT v13's character creation workflows.

---

## 1. _preCreate() for Default Items

Override `_preCreate()` on your `TypeDataModel` to inject default items when an Actor is created. This runs before the document is persisted, so you can modify creation data safely.

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
   */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Build default items array
    const defaultItems = [
      {
        name: game.i18n.localize("MY_SYSTEM.UnarmedStrike"),
        type: "weapon",
        img: "icons/weapons/fist/fist-human.webp",
        system: {
          damage: "1",
          damageType: "bludgeoning",
          equipped: true
        }
      },
      {
        name: game.i18n.localize("MY_SYSTEM.DefaultArmor"),
        type: "armor",
        img: "icons/equipment/chest/shirt-collared-white.webp",
        system: {
          armorType: "clothing",
          armorValue: 10,
          equipped: true
        }
      },
      {
        name: game.i18n.localize("MY_SYSTEM.BasicFeature"),
        type: "feature",
        img: "icons/skills/trades/mining-pickaxe-yellow.webp",
        system: {
          description: game.i18n.localize("MY_SYSTEM.BasicFeatureDesc")
        }
      }
    ];

    // Inject items into creation data
    this.updateSource({ items: defaultItems });
  }
}
```

`updateSource()` merges the provided data into the pending creation data. The `items` key adds embedded documents to the actor.

---

## 2. preCreateActor Hook

The global `preCreateActor` hook fires for all Actor creation, regardless of type. Use it when you need to set defaults that apply across all actor types or when you cannot modify the TypeDataModel.

```js
Hooks.on("preCreateActor", (document, data, options, userId) => {
  // Only apply defaults for hero type
  if (document.type !== "hero") return;

  // Set default token configuration
  document.updateSource({
    "prototypeToken.name": document.name,
    "prototypeToken.texture.src": "icons/svg/mystery-man.svg",
    "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    "prototypeToken.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER,
    "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    "prototypeToken.actorLink": true,
    "prototypeToken.sight.enabled": true,
    "prototypeToken.sight.range": 60,
    "prototypeToken.light.dim": 10,
    "prototypeToken.bar1.attribute": "hp",
  });
});
```

The first argument is the pending Actor document instance. Use `document.updateSource()` to modify creation data — do not mutate the `data` argument directly.

---

## 3. Prototype Token Defaults

Configure default token settings in `_preCreate()` so every new actor has sensible token behavior out of the box.

```js
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() { /* ... */ }

  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Default token configuration for hero actors
    this.updateSource({
      prototypeToken: {
        name: data.name,
        displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
        displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        actorLink: true,       // linked actors share HP, effects, inventory
        sight: {
          enabled: true,
          range: 60,           // vision range in scene units
          visionMode: "basicVision"
        },
        light: {
          bright: 0,
          dim: 10,             // dim light radius
          color: "#ffeedd",
          alpha: 0.5,
          animation: {
            type: "torch",
            speed: 5,
            intensity: 5
          }
        },
        // Bar 1: HP, Bar 2: empty
        bar1: { attribute: "hp" },
        bar2: { attribute: null },
        // Default texture
        texture: {
          src: "icons/svg/mystery-man.svg",
          scaleX: 1,
          scaleY: 1,
          tint: null
        }
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
    {
      name: "Longsword",
      type: "weapon",
      img: "icons/weapons/swords/sword-guard-steel.webp",
      system: { damage: "1d8", equipped: true, proficient: true }
    },
    {
      name: "Chain Mail",
      type: "armor",
      img: "icons/equipment/chest/chainmail-hauberk-silver.webp",
      system: { armorType: "heavy", armorValue: 16, equipped: true }
    }
  ],
  npc: [
    {
      name: "Natural Weapon",
      type: "weapon",
      img: "icons/weapons/fist/fist-human.webp",
      system: { damage: "1d6", equipped: true, proficient: true }
    }
  ]
};

// Apply in _preCreate
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);
  const items = STARTER_ITEMS[data.type] ?? [];
  if (items.length) this.updateSource({ items });
}
```

---

## 5. Character Creation Dialog

Build a custom creation workflow using `DialogV2` for interactive character setup.

```js
async function showCharacterCreationDialog() {
  const races = ["human", "elf", "dwarf"];
  const classes = ["warrior", "mage", "rogue"];

  const raceOpts = races.map((r) => `<option value="${r}">${game.i18n.localize(`MY_SYSTEM.Race.${r}`)}</option>`).join("");
  const classOpts = classes.map((c) => `<option value="${c}">${game.i18n.localize(`MY_SYSTEM.Class.${c}`)}</option>`).join("");

  const content = `
    <form>
      <div class="form-group">
        <label>${game.i18n.localize("MY_SYSTEM.CharName")}</label>
        <input type="text" name="name" required />
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("MY_SYSTEM.CharRace")}</label>
        <select name="race">${raceOpts}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("MY_SYSTEM.CharClass")}</label>
        <select name="charClass">${classOpts}</select>
      </div>
    </form>
  `;

  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MY_SYSTEM.CreateCharacter") },
    content,
    position: { width: 400 },
    rejectClose: false,
    ok: {
      label: game.i18n.localize("MY_SYSTEM.Create"),
      callback: (event, button) => {
        const form = button.form;
        return {
          name: form.elements.name.value,
          race: form.elements.race.value,
          charClass: form.elements.charClass.value
        };
      }
    }
  });
}
```

### Stat Generation and Full Workflow

```js
// Roll 4d6 drop lowest for each ability
async function rollAbilityScores() {
  const abilities = ["str", "dex", "con", "int", "wis", "cha"];
  const scores = {};
  for (const ability of abilities) {
    const roll = new Roll("4d6kh3");
    await roll.evaluate();  // v13: evaluate() is async
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

  // Get all documents in the pack
  const documents = await pack.getDocuments();

  // Find the matching race document
  const raceDoc = documents.find((d) => d.flags["my-system"]?.raceId === raceId);
  if (!raceDoc) return;

  // Clone the race document's items and add them to the actor
  const raceItems = raceDoc.items.map((item) => item.toObject());
  await actor.createEmbeddedDocuments("Item", raceItems);
}
```

### Importing an Actor from a Compendium

```js
async function importFromCompendium(packId) {
  const pack = game.packs.get(packId);
  if (!pack) return;

  const documents = await pack.getDocuments();
  const template = documents.find((d) => d.documentName === "Actor");
  if (!template) return;

  return Actor.create(template.toObject());
}
```

### Direct UUID Access

```js
// UUID format: "Compendium.my-system.races.Actor.abc123"
const doc = await fromUuid("Compendium.my-system.races.Actor.abc123");
const data = doc?.toObject();
```
