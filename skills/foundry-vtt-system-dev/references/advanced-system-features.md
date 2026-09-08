# Advanced System Features

System-specific patterns for status effects, macros, custom enrichers, token customization, journal pages, Active Effect subtypes, and region behaviors. These extend the shared APIs covered in the **foundry-vtt-module-dev** skill with system-specific context.

---

## 1. Status Effects (CONFIG.statusEffects)

Every RPG system needs custom conditions on the Token HUD. Add them to `CONFIG.statusEffects` in `init`, and remove the core defaults your system does not use.

### Registering Status Effects

**Changed in v14:** `CONFIG.statusEffects` is a Proxy over an array that also indexes entries by `id`. Assign by id to add or replace one condition; `delete` removes it. Both keep the array and the id index in sync.

```js
Hooks.once("init", () => {
  CONFIG.statusEffects["my-system.prone"] = {
    id: "my-system.prone",
    name: "MY_SYSTEM.Conditions.Prone",
    img: "systems/my-system/icons/conditions/prone.svg",
    system: {
      changes: [
        { key: "system.attributes.ac", type: "add", value: -2 }
      ]
    }
  };

  CONFIG.statusEffects["my-system.stunned"] = {
    id: "my-system.stunned",
    name: "MY_SYSTEM.Conditions.Stunned",
    img: "systems/my-system/icons/conditions/stunned.svg"
  };

  CONFIG.statusEffects["my-system.dead"] = {
    id: "my-system.dead",
    name: "MY_SYSTEM.Conditions.Dead",
    img: "systems/my-system/icons/conditions/dead.svg"
  };

  // Drop a core condition your system does not use
  delete CONFIG.statusEffects.paralysis;

  // Set the special "defeated" status for the combat tracker
  CONFIG.specialStatusEffects.DEFEATED = "my-system.dead";
});
```

Assigning a whole array (`CONFIG.statusEffects = [...]`) still works — the setter clears the proxy and pushes each entry — but it is marked deprecated since v14. Prefer keyed assignment, which lets modules and systems coexist.

### Status Effect Fields

A status entry is `{id, order?, hud?}` merged with partial `ActiveEffectData`. `ActiveEffect.fromStatusEffect(statusId)` strips `id` and `hud`, localizes `name`, folds `id` into `statuses`, and defaults `showIcon` to `ALWAYS`. Everything else is passed to the `ActiveEffect` constructor unchanged.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID, namespaced with your system ID (`"my-system.prone"`) |
| `name` | `string` | Localization key for the condition name |
| `img` | `string` | Icon shown on the Token HUD |
| `hud` | `boolean \| {actorTypes: string[]}` | Show in the Token HUD, optionally only for certain actor sub-types |
| `order` | `number` | Sort order in the HUD |
| `showIcon` | `number` | `CONST.ACTIVE_EFFECT_SHOW_ICON`: `NEVER` 0, `CONDITIONAL` 1, `ALWAYS` 2 |
| `system.changes` | `object[]` | The Active Effect changes applied when the status is toggled |
| `_id` | `string` | Required if the entry declares extra `statuses` beyond its own id |

**Changed in v14:** `label` and `icon` are deprecated aliases of `name` and `img`. `showIcon` is new and decides when the icon appears on the token. Overlay display is a flag — `actor.toggleStatusEffect(id, {overlay: true})` sets `flags.core.overlay`. Changes live under `system.changes`, not at the root; a root `changes` array is still migrated by `BaseActiveEffect.migrateData`, but write the new shape.

### Active Effect Change Types

**Changed in v14:** numeric `mode` is deprecated in favour of a string `type`, and `"subtract"` is a type of its own. `CONST.ACTIVE_EFFECT_CHANGE_TYPES` maps each type to its default priority.

For the full change-type list and the default priorities, read `foundry-vtt-module-dev/references/active-effects-v2.md`.

`value` is an `AnyField`, so a number stays a number. Strings may contain `@` references resolved against the target's roll data. Each change also carries `phase` (`"initial"` or `"final"`, or a phase you registered) and an optional `priority` that overrides the default.

### Checking Active Conditions

```js
// Check if an actor has a specific condition
const isProne = actor.statuses.has("my-system.prone");

// Toggle a condition programmatically
await actor.toggleStatusEffect("my-system.stunned");
await actor.toggleStatusEffect("my-system.dead", { active: true, overlay: true });

// Build the effect without applying it
const effect = await ActiveEffect.fromStatusEffect("my-system.prone");

// Get all active conditions
for (const statusId of actor.statuses) {
  console.log(`Active condition: ${statusId}`);
}
```

**Changed in v14:** `TokenDocument#toggleActiveEffect` and `Token#toggleEffect` are gone. Use `Actor#toggleStatusEffect(statusId, {active, overlay})`.

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
| `replaceParent` | `boolean` | Hoist the replacement out of its container when it replaces the whole contents |
| `onRender` | `function` | Called with the `HTMLEnrichedContentElement` once the enriched content enters the DOM |

### ProseMirror Inserts

**New in v14:** `CONFIG.TextEditor.inserts` adds entries to the editor's insert menu. Each entry is `{action, title, inline?, html?, children?}`. A `<selection>` placeholder inside `html` wraps the current selection; content inside the placeholder is the fallback when nothing is selected.

```js
Hooks.once("init", () => {
  CONFIG.TextEditor.inserts.push({
    action: "my-system-readaloud",
    title: "MY_SYSTEM.Insert.Readaloud",
    html: `
      <div class="readaloud">
        <selection><blockquote>Read this aloud.</blockquote></selection>
      </div>
    `
  });
});
```

`children` nests inserts under a submenu; `inline: true` marks the insert as inline rather than block content.

**Changed in v14:** TinyMCE is gone. `CONFIG.TinyMCE`, `JournalTextTinyMCESheet` and `TextEditor.create({engine: "tinymce"})` were removed. ProseMirror is the only bundled editor; register another with `CONFIG.TextEditor.engines`.

### Customizing @Embed Output

`CONFIG.<Doc>.embedHandlers` is an array of `(doc, content, config, options) => Promise<HTMLElement|HTMLCollection|null>`. Handlers post-process the element produced by `@Embed[...]`; returning `null` cancels the embed.

```js
CONFIG.Item.embedHandlers.push(async (item, content, config, options) => {
  if (content && item.type === "spell") content.classList.add("spell-embed");
  return content;
});
```

For work that must happen after the embed reaches the DOM, override `TypeDataModel#onEmbed(element)` on the document's data model.

---

## 4. Token Customization

Systems customize token behavior through CONFIG overrides and prototype token defaults.

### CONFIG.Token.objectClass

Override the Token PlaceableObject to customize rendering, interaction, or drawing:

```js
Hooks.once("init", () => {
  CONFIG.Token.objectClass = MySystemToken;
});

class MySystemToken extends foundry.canvas.placeables.Token {
  /**
   * Pick the empty/full colors for a resource bar.
   * Core mixes between them by percentage in _drawBar.
   * @param {number} index          0 for bar1, 1 for bar2
   * @param {object} data           The tracked attribute data
   * @returns {{empty: Color, full: Color}}
   * @override
   */
  _getBarColors(index, data) {
    const pct = Number(data.value) / Number(data.max);
    if (index === 0 && pct <= 0.25) {
      return { empty: Color.from("#7F0000"), full: Color.from("#FF3B30") };
    }
    return super._getBarColors(index, data);
  }
}
```

**New in v14:** `Token#_getBarColors(index, data)` reads `CONFIG.Token.barConfig`, so a system can retint the bars without touching `_drawBar`:

```js
Hooks.once("init", () => {
  CONFIG.Token.barConfig.bar1.colors = { empty: Color.from("#3F0000"), full: Color.from("#00C853") };
  CONFIG.Token.barConfig.bar2.colors = { empty: Color.from("#001F3F"), full: Color.from("#40C4FF") };
});
```

`Math.clamped` was removed; use `Math.clamp`.

### Movement Actions

**Changed in v14:** `CONFIG.Token.movement.actions` entries are declarative. `getAnimationOptions`, `deriveTerrainDifficulty` and `getCostFunction` closures are replaced by `speedMultiplier`, `terrainAction` and `costMultiplier`; `canSelect` can be a plain boolean.

```js
Hooks.once("init", () => {
  CONFIG.Token.movement.actions.blink = {
    label: "MY_SYSTEM.Movement.blink",
    icon: "fa-solid fa-bolt",
    order: 20,
    teleport: true,
    measure: false,
    walls: null,          // an EdgeRestrictionType, or null to ignore walls
    canSelect: false,     // not offered in the Token HUD or cycling
    terrainAction: null,  // terrain difficulty is always 1
    costMultiplier: 1
  };
});

// Plan a move from code, then commit it
const plan = await token.planMovement({ allowedActions: ["blink"], direct: true, maxDistance: 30 });
if (plan) await token.document.startMovement(plan.id);
```

`planMovement` resolves to `null` if the user cancels, the token is released, or the token is locked.

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
const { DocumentSheetConfig } = foundry.applications.apps;

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

### Core Text Page Sheets

**Changed in v14:** TinyMCE is gone, so the sheet lineup for built-in `text` pages changed. `JournalEntryPageCodeMirrorSheet` extends `JournalEntryPageTextSheet`; the HTML and Markdown sheets extend the CodeMirror sheet. `JournalEntryPageHTMLSheet` is registered for `text` pages under the label `EDITOR.HTML`, taking the slot the TinyMCE sheet held. If your system registered a sheet against `JournalTextTinyMCESheet`, retarget it.

### Journal Entry Categories

`JournalEntryCategory` is an embedded document in `JournalEntry#categories` (`{_id, name, sort, flags, _stats}`). Pages reference one through `JournalEntryPage#category`. Use categories to group system compendium pages instead of a custom flag scheme.

```js
const [category] = await journal.createEmbeddedDocuments("JournalEntryCategory", [{ name: "Classes" }]);
await page.update({ category: category.id });
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
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description,
      { relativeTo: this.document }
    );
    return context;
  }
}
```

---

## 6. Active Effect Subtypes and Custom Change Types

**New in v14:** `ActiveEffect` is a typed document. `changes` moved out of the base schema into `system` via `ActiveEffectTypeDataModel`, so a system can add its own effect subtypes with extra fields.

### Declaring a Subtype

Declare the type in `system.json` (`"documentTypes": { "ActiveEffect": { "condition": {} } }`), then register the model:

```js
class ConditionEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),        // keeps `changes`
      stacks: new fields.NumberField({ integer: true, min: 1, initial: 1 })
    };
  }
}

Hooks.once("init", () => {
  CONFIG.ActiveEffect.dataModels.condition = ConditionEffectData;
  CONFIG.ActiveEffect.typeLabels.condition = "MY_SYSTEM.EffectType.condition";
});
```

At startup Foundry verifies that every model in `CONFIG.ActiveEffect.dataModels` declares a `changes` ArrayField with the expected sub-schema, and logs an error if it does not — so keep `...super.defineSchema()` in your override. `ActiveEffect` is now indexed, foldable, and allowed in system-specific compendia (`CONST.SYSTEM_SPECIFIC_COMPENDIUM_TYPES`), so effects can ship in packs.

### Registering a Change Type

`CONFIG.ActiveEffect.changeTypes` holds types beyond the seven core ones. Each entry is `{label, defaultPriority, handler?, render?}`.

```js
Hooks.once("init", () => {
  CONFIG.ActiveEffect.changeTypes.diceUpgrade = {
    label: "MY_SYSTEM.ChangeType.diceUpgrade",
    defaultPriority: 45,
    // (targetDoc, change, {field, replacementData, modifyTarget}) => overrides|void
    async handler(targetDoc, change, { modifyTarget } = {}) {
      const stepped = stepDieUp(foundry.utils.getProperty(targetDoc, change.key), change.value);
      if (modifyTarget) foundry.utils.setProperty(targetDoc, change.key, stepped);
      return { [change.key]: stepped };
    }
  };
});
```

`render(context)` returns the markup for the change row in `ActiveEffectConfig`; `context` is `{change, index, fields, defaultPriority}`.

**Changed in v14:** the per-instance `_applyAdd`, `_applyMultiply`, `_applyOverride`, `_applyUpgrade`, `_applyCustom` and `applyField` methods are deprecated. Override the statics `ActiveEffect._applyChangeAdd`, `._applyChangeMultiply`, `._applyChangeOverride`, `._applyChangeUpgrade`, `._applyChangeCustom`, `._applyChangeUnguided` and `.applyChangeField`. `ActiveEffect#apply` became `ActiveEffect.applyChange`. `ActiveEffectConfig.DEFAULT_PRIORITIES` is gone; priorities come from `CONFIG.ActiveEffect.changeTypes[type].defaultPriority`.

See `foundry-vtt-module-dev/references/active-effects-v2.md` for the full model.

---

## 7. Region Behaviors for Systems

Regions replace MeasuredTemplates in v14, and a `RegionBehavior` subtype is how a system attaches rules to an area.

### Core Behaviors Worth Knowing

| Type | What it does |
|------|--------------|
| `applyActiveEffect` | Creates the configured effects on a token's actor while the token is inside; deletes them on exit. Its schema is `effects: SetField<DocumentUUIDField>` of ActiveEffect UUIDs. |
| `defineSurface` | Turns the region into a surface that blocks or filters `light`, `move`, `sight`, `sound`, `occlusion`, `exposure`, `culling` on a chosen side (`bottom`, `top`, `both`). |
| `changeLevel` | Moves a token to another scene level. |
| `teleportToken` | Teleports to one of `destinations` (plural — `destination` is deprecated). |

### Writing a Custom Behavior

```js
class SacredGroundBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["MY_SYSTEM.BEHAVIOR.sacredGround", "BEHAVIOR.TYPES.base"];

  static defineSchema() {
    return {
      events: this._createEventsField({
        events: [CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_EXIT]
      }),
      damagePerTurn: new foundry.data.fields.StringField({ initial: "1d6" })
    };
  }

  // Handlers are bound to the behavior instance
  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: async function (event) {
      if (!event.user.isSelf) return;
      if (event.data.token.actor?.system.undead) {
        ui.notifications.warn("MY_SYSTEM.Warn.SacredGround", { localize: true });
      }
    }
  };
}

Hooks.once("init", () => {
  CONFIG.RegionBehavior.dataModels.sacredGround = SacredGroundBehavior;
  CONFIG.RegionBehavior.typeLabels.sacredGround = "MY_SYSTEM.BEHAVIOR.sacredGround.label";
  CONFIG.RegionBehavior.typeIcons.sacredGround = "fa-solid fa-place-of-worship";
});
```

Declare the subtype in `system.json` under `documentTypes.RegionBehavior`. `this.behavior`, `this.region` and `this.scene` reach the containing documents.

### Areas of Effect

`RegionLayer#placeRegion(data, options)` runs the interactive placement workflow and returns the created `RegionDocument` (or the prepared data with `{create: false}`). `placeRegions` does the same for several at once.

```js
const region = await canvas.regions.placeRegion({
  name: "Fireball",
  shapes: [{ type: "circle", x: 0, y: 0, radius: canvas.dimensions.distancePixels * 20, gridBased: true }],
  levels: [canvas.level.id],
  displayMeasurements: true
});
```

Shape types are `circle, cone, ellipse, emanation, grid, line, polygon, rectangle, ring, token`. For a burst centred on a token, `RegionDocument.createTokenEmanation(token, range, regionData, options)` builds the emanation and sets `attachment.token`, so the region follows the token. `RegionDocument#spawnTokens` and `#teleportTokens` place or move tokens within a region. `RegionLayer#templateMode` toggles the transient placement mode the old template tools used.

**Changed in v14:** `MeasuredTemplateDocument`, the `MeasuredTemplate` placeable, `TemplateLayer`, `MeasuredTemplateConfig`, `Scene#templates`, `CONST.MEASURED_TEMPLATE_TYPES` and the `TEMPLATE_CREATE` permission are all deprecated until v16. The permission is now `REGION_CREATE`. See `foundry-vtt-module-dev/references/measured-templates.md`.

---

## 8. Scene Levels

**New in v14:** a Scene holds an embedded `Level` collection. Scene `background`, `foreground`, `foregroundElevation` and `backgroundColor` moved onto `Level`, and every placeable document gained a `levels` set that decides which levels it appears on. Tokens gained `level` and `depth`.

```js
// scene.background.src is deprecated. Read the Level instead:
const level = canvas.level;                   // the viewed Level document
const img = level.background.src;
const bottom = level.elevation.bottom;        // null means -Infinity
```

`Scene#levels`, `Scene#availableLevels`, `Scene#cycleLevel(±1)`, `canvas.level` and `CONFIG.Level` are the entry points. `Scene#fog.exploration` (boolean) became `Scene#fog.mode` (`CONST.FOG_EXPLORATION_MODES`: `DISABLED` 0, `INDIVIDUAL` 1, `SHARED` 2).

Full reference: `foundry-vtt-module-dev/references/scene-levels.md`.
