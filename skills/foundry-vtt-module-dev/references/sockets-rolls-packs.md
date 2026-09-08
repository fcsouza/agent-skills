# Sockets, Rolls & Compendium Packs

Deep reference for Foundry VTT v14's socket communication, dice system, compendium packs, and localization. v13 to v14 differences appear as "Changed in v14" callouts; see `foundry-vtt-module-dev/references/v14-migration.md` for the full list.

---

## Sockets

### Setup

Enable sockets in `module.json`:

```json
{
  "socket": true
}
```

The namespace **must** use the `module.` prefix:

```javascript
const SOCKET_NS = "module.my-module";
```

### Emitting and Listening

```javascript
// Broadcast to all connected clients (including self)
game.socket.emit(SOCKET_NS, { type: "ping", payload: { actorId: "abc123" } });

// Listen on all clients
game.socket.on(SOCKET_NS, (data) => {
  console.log("Received:", data);
});
```

Register the listener in `init` or `ready` — registering it multiple times creates duplicate handlers.

### GM-Authoritative Pattern

Only the GM can modify world documents. Non-GM clients must ask the GM to perform writes on their behalf.

**Request types (discriminated union):**

```javascript
// Shared constants
const REQUEST = {
  UPDATE_ACTOR: "UPDATE_ACTOR",
  CREATE_ITEM:  "CREATE_ITEM",
};
```

**GM handler — register once in `ready`:**

```javascript
Hooks.once("ready", () => {
  if (!game.user.isGM) return;

  game.socket.on(SOCKET_NS, async (request) => {
    switch (request.type) {
      case REQUEST.UPDATE_ACTOR: {
        const { actorId, updateData } = request.payload;
        const actor = game.actors.get(actorId);
        if (!actor) return;
        await actor.update(updateData);
        break;
      }
      case REQUEST.CREATE_ITEM: {
        const { actorId, itemData } = request.payload;
        const actor = game.actors.get(actorId);
        if (!actor) return;
        await actor.createEmbeddedDocuments("Item", [itemData]);
        break;
      }
    }
  });
});
```

**Client request function:**

```javascript
function requestActorUpdate(actorId, updateData) {
  // If we're the GM, just do it directly
  if (game.user.isGM) {
    return game.actors.get(actorId)?.update(updateData);
  }

  // Guard: no GM is online — updates will be silently dropped
  const gmOnline = game.users.some(u => u.isGM && u.active);
  if (!gmOnline) {
    ui.notifications.warn("No GM is connected. Action requires a GM.");
    return;
  }

  game.socket.emit(SOCKET_NS, {
    type: REQUEST.UPDATE_ACTOR,
    payload: { actorId, updateData },
  });
}
```

### No-GM Guard

Always check before emitting GM-required requests:

```javascript
function requireGM() {
  const gm = game.users.find(u => u.isGM && u.active);
  if (!gm) {
    ui.notifications.error("This action requires a GM to be connected.");
    return false;
  }
  return true;
}
```

### User Queries (request/response)

`game.socket.emit` is fire-and-forget. When you need an answer from a specific client, use the queries API. Register a handler in `CONFIG.queries` (the name must carry your module prefix), then call `User#query`:

```javascript
// Handler runs on the queried client as (queryData, { timeout, user }) where user is the asker.
// Its return value is sent back (must be JSON-serializable).
Hooks.once("init", () => {
  CONFIG.queries["my-module.confirmTrade"] = async ({ itemName }, { user }) => {
    return foundry.applications.api.DialogV2.confirm({
      content: `<p>Accept ${itemName} from ${user.name}?</p>`,
    });
  };
});

// Ask one user (requires the QUERY_USER permission; throws if the user is not active)
const accepted = await targetUser.query("my-module.confirmTrade", { itemName: "Sword" }, { timeout: 30000 });

// Ask many users at once — returns Map<User, PromiseSettledResult>
const results = await User.queryMany(game.users.filter(u => u.active), "my-module.confirmTrade", { itemName: "Sword" });
for (const [user, result] of results) {
  if (result.status === "fulfilled") console.log(user.name, result.value);
}
```

**Changed in v14:** `User.queryMany(users, name, data, options)` is new. `User#query` and `CONFIG.queries` arrived in v13. Set `CONFIG.debug.queries = true` to log query traffic.

### Batched Writes Instead of Socket Round Trips

Many "ask the GM to do N things" sockets exist only to avoid N sequential writes. v14 adds `foundry.documents.modifyBatch(operations)`, which sends several document operations in one request. Either all succeed or none apply, and no operation can read the result of an earlier one in the same batch.

```javascript
await foundry.documents.modifyBatch([
  { action: "update", documentName: "Actor", updates: [{ _id: actor.id, "system.size": "big" }] },
  { action: "update", documentName: "Token", updates: [{ _id: tokenId, width: 2, height: 2 }], parent: scene },
  { action: "create", documentName: "Item", data: [{ name: "Loot", type: "loot" }], parent: actor },
]);
```

Each entry is a `DatabaseWriteOperation`: `action` (`create`/`update`/`delete`), `documentName`, the payload key for that action (`data`, `updates`, `ids`), and `parent`/`pack` where needed. The caller still needs permission for every operation, so the GM-authoritative pattern above still applies for player-initiated writes.

---

## Dice & Rolls

### Basic Usage

```javascript
// Create a roll — variables resolved from the data object
const roll = new Roll("2d6 + @mod + @bonus", { mod: 3, bonus: 1 });

// evaluate() is async — always await it. evaluateSync() exists for deterministic rolls only
await roll.evaluate();

console.log(roll.total);   // e.g. 12
console.log(roll.result);  // e.g. "4 + 3 + 3 + 2" (string)
console.log(roll.dice);    // array of Die instances
console.log(roll.terms);   // array of all RollTerm instances (dice, operators, numbers)
```

### Post to Chat

```javascript
await roll.toMessage({
  flavor: "Attack Roll",
  speaker: ChatMessage.getSpeaker({ actor: actor }),
}, { messageMode: "gm" });   // omit to use the user's core.messageMode setting
```

**Changed in v14:** roll modes became *message modes*. `Roll#toMessage`, `ChatMessage.create`, `RollTable#draw/drawMany` and `Combat#rollInitiative` take `{ messageMode }` instead of `{ rollMode }` (the old option still works but warns, until v16). The modes live in `CONFIG.ChatMessage.modes` (`public`, `gm`, `blind`, `self`, `ic`), not `CONFIG.Dice.rollModes`; the user setting is `core.messageMode`, not `core.rollMode`. `ChatMessage#applyRollMode` became `ChatMessage#applyMode`.

```javascript
// Migrate stored v13 values ("roll", "publicroll", "gmroll", "blindroll", "selfroll")
const mode = foundry.dice.Roll._mapLegacyRollMode(oldValue);   // "roll" → current core.messageMode

// Build a mode picker
const choices = Object.entries(CONFIG.ChatMessage.modes).map(([id, m]) => ({ id, label: _loc(m.label) }));

// Add or inspect chat slash-commands (was ChatLog.MESSAGE_PATTERNS)
const { ChatLog } = foundry.applications.sidebar.tabs;
console.log(Object.keys(ChatLog.CHAT_COMMANDS));   // roll, gmroll, blindroll, selfroll, publicroll, ooc, ic, emote, gm, whisper, reply, players, macro
```

### Formula Data Replacement

`Roll.replaceFormulaData(formula, data, options)` resolves `@attr` references. Options are an object: `missing` (value to substitute for unresolved keys), `warn` (console warning per unresolved key), and `recursive` (resolve `@` references found inside replaced strings, up to three levels deep).

```javascript
const data = { str: { mod: 3 }, weapon: "@str.mod + 1", proficient: true };
Roll.replaceFormulaData("1d20 + @weapon + @proficient", data, { recursive: true, missing: 0 });
// → "1d20 + 3 + 1 + 1"
```

**Changed in v14:** `recursive` is new (v13 only had `missing` and `warn`, and never followed nested `@` references). Booleans in formula data now evaluate to `1`/`0`, so `@proficient` works without a ternary.

### Which Roll Class Runs

`Roll.create(formula, data, options)` builds a `Roll.defaultImplementation`, which is `CONFIG.Dice.rolls[0]`. Replace that entry to make every core-created roll (inline rolls, chat commands, tables) use your subclass. The user's dice-fulfillment configuration lives under the `Roll.DICE_CONFIGURATION_SETTING` core setting key (`"diceConfiguration"`); `DiceConfig.SETTING` still resolves to it but logs a deprecation warning.

### Reroll

```javascript
// Creates a new Roll with the same formula and data
const newRoll = await roll.reroll();
await newRoll.toMessage({ flavor: "Rerolled!" });
```

### Custom DiceTerm — Exploding Die

Extend `foundry.dice.terms.Die` to implement custom mechanics:

```javascript
class ExplodingDie extends foundry.dice.terms.Die {
  constructor(termData) {
    super(termData);
    this.explosionThreshold = termData.explosionThreshold ?? this.faces;
  }

  /** @override */
  async _evaluateAsync(options = {}) {
    await super._evaluateAsync(options);

    // Re-roll any result that meets the explosion threshold
    const extras = [];
    for (const result of this.results) {
      if (result.result >= this.explosionThreshold) {
        const bonus = new foundry.dice.terms.Die({ number: 1, faces: this.faces });
        await bonus.evaluate();
        extras.push(...bonus.results);
      }
    }
    this.results.push(...extras);
    return this;
  }
}

// Register so Roll can parse it
CONFIG.Dice.terms["x"] = ExplodingDie;

// Usage: "2x6" rolls 2d6, exploding on 6
const roll = new Roll("2x6");
await roll.evaluate();
```

`DiceTerm#_evaluate` dispatches to `_evaluateSync` for deterministic evaluation (`minimize`/`maximize`) and to `_evaluateAsync` otherwise, so override the async branch rather than `_evaluate` itself.

**Changed in v14:** `RollParser` callbacks (`_onDiceTerm`, `_onNumericTerm`, `_onFunctionTerm`, ...) receive a trailing `offset` argument with the term's position in the formula string; subclasses that override them must accept it. `DiceTerm.MODIFIER_REGEXP` is now built from a shared argument pattern (`[^A-z\s()+\-*/]*`): the argument group always captures a string, empty for argument-less modifiers such as `4d6ex`. Custom modifier methods should treat a missing argument as `""`, not `undefined`.

### Roll Fulfillment

Foundry uses a `RollResolver` application to fulfill dice results. For most modules, the standard `Roll.evaluate()` flow is sufficient. Custom roll resolution (e.g., prompting the player to choose a die face) is an advanced pattern — consult the v14 API docs for `RollResolver` if needed. `RollResolver` and `CONFIG.Dice.fulfillment` did not change in v14.

### Deferred Inline Rolls

Use `[[/roll 2d6]]` syntax in chat messages, journal entries, and item descriptions. Foundry renders these as clickable roll links — the roll executes when the user clicks.

```javascript
// In a chat message body:
const content = `Roll for initiative: [[/roll 1d20 + @init]]`;
ChatMessage.create({ content, speaker: ChatMessage.getSpeaker() });
```

---

## Compendium Packs

### Declaring Packs in module.json

```json
{
  "packs": [
    {
      "name": "monsters",
      "label": "Monsters",
      "path": "packs/monsters",
      "type": "Actor",
      "ownership": { "PLAYER": "OBSERVER", "TRUSTED": "OBSERVER" }
    },
    {
      "name": "spells",
      "label": "Spell Compendium",
      "path": "packs/spells",
      "type": "Item",
      "system": "dnd5e"
    },
    {
      "name": "conditions",
      "label": "Conditions",
      "path": "packs/conditions",
      "type": "ActiveEffect",
      "system": "dnd5e"
    }
  ],
  "packFolders": [
    { "name": "Bestiary", "sorting": "a", "color": "#8a2b2b", "packs": ["monsters"] }
  ]
}
```

`packFolders` (`{name, sorting: "a"|"m", color, packs, folders}`, nested up to four levels) groups packs in the Compendium sidebar.

**Changed in v14:**
- `name` must match `[A-Za-z0-9_-]+` (`BasePackage.validateId`). The v12 slugify shim is gone, so `"name": "my spells"` now fails validation. Two packs with the same `name` or `path` throw at package load.
- `"type": "ActiveEffect"` packs are allowed. `CONST.SYSTEM_SPECIFIC_COMPENDIUM_TYPES` is `["ActiveEffect", "Actor", "Item"]`; a pack of one of those types that omits `system` throws at package load.

### Accessing Packs

```javascript
// Get by collection key: "<module-name>.<pack-name>"
const pack = game.packs.get("my-module.monsters");

// Filter packs by type
const actorPacks = game.packs.filter(p => p.metadata.type === "Actor");
```

### Loading Documents

```javascript
// Lightweight — returns index entries: { _id, name, type, img }
const index = await pack.getIndex();
const entry = index.find(e => e.name === "Goblin");

// Load one document by ID (use the index to find the ID first)
const goblin = await pack.getDocument(entry._id);

// Load all documents — expensive, avoid in hot paths
const allMonsters = await pack.getDocuments();

// Resolve any UUID (works for world docs, compendium docs, embedded docs)
const doc = await fromUuid("Compendium.my-module.monsters.abc123");
```

### Importing Documents

```javascript
// Import a compendium document into the world
const pack = game.packs.get("my-module.monsters");
const goblin = await pack.getDocument("abc123");
const [worldActor] = await game.actors.importFromCompendium(pack, goblin.id);

// Import a world document into a compendium (requires module ownership)
const actor = game.actors.getName("My Custom Goblin");
await pack.importDocument(actor, { dialog: true });
```

**Changed in v14:** `importDocument` keeps the source `_id` by default (`keepId: true`). If a document with that id already exists in the pack and you pass `dialog: true`, the user is asked to replace it, create a copy, or cancel; without `dialog` the existing document is replaced.

### Relative UUIDs and Persistence

```javascript
// Relative UUID from one document to another (e.g. an ActiveEffect origin on the same actor)
const rel = foundry.utils.buildRelativeUuid(item, actor);   // ".Item.abc123"

// True once the document has an id, sits in a collection and resolves via fromUuid
if (actor.persisted) await actor.update({ "flags.my-module.seen": true });
```

**Changed in v14:** `ClientDocument#getRelativeUUID(relative)` is deprecated (until v16) in favor of `foundry.utils.buildRelativeUuid(target, origin)`. `ClientDocument#persisted` is new; use it to skip writes on ephemeral clones and unsaved documents.

### Compendium Art Mapping

A module can supply portrait and token art for documents in another package's packs. Declare a mapping file in the manifest under `flags.compendiumArtMappings`, keyed by the system id:

```json
{
  "flags": {
    "compendiumArtMappings": {
      "dnd5e": { "mapping": "art/dnd5e.json", "credit": "Art by Someone" }
    }
  }
}
```

The mapping file is `{ "<pack collection id, e.g. dnd5e.monsters>": { "<documentId>": { "img": "...", "token": "..." | { prototype token overrides } } } }`. Foundry applies it through `game.compendiumArt` (`CompendiumArt`, a `Map<uuid, CompendiumArtInfo>`) when a compendium Actor or Item is initialized, and fires the `applyCompendiumArt(documentClass, source, pack, art)` hook. Users toggle portraits, tokens and items per package in the Compendium Art settings.

**Changed in v14:** Item packs are supported (`img` only); the per-package settings gain an `items` toggle. The `actor` key of a mapping entry is kept as an alias of `img`.

### Compendium Index (Performance)

Loading an entire compendium with `getDocuments()` is expensive. Use `getIndex()` for lightweight lookups:

```js
const pack = game.packs.get("my-module.monsters");

// Get only names and images (fast — doesn't load full documents)
const index = await pack.getIndex();
for (const entry of index) {
  console.log(entry.name, entry.img, entry.uuid);
}

// Include specific fields in the index
const detailedIndex = await pack.getIndex({
  fields: ["system.cr", "system.type", "flags.my-module.category"]
});
const dragons = detailedIndex.filter(e => e.system?.type === "dragon");

// Get a single document by ID (only when you need the full data)
const dragon = await pack.getDocument("someId");
```

`getIndex()` returns lightweight metadata without deserializing full documents. Always prefer it over `getDocuments()` when you only need names, images, or a few fields.

---

## Localization (i18n)

### lang/en.json Structure

```json
{
  "MY_MODULE.settingName": "Track Resources",
  "MY_MODULE.settingHint": "Enable automatic resource tracking.",
  "MY_MODULE.greeting": "Hello, {name}!",
  "MY_MODULE.error.noActor": "No actor selected.",
  "MY_MODULE.button.confirm": "Confirm"
}
```

### Register in module.json

```json
{
  "languages": [
    { "lang": "en", "name": "English", "path": "lang/en.json" },
    { "lang": "de", "name": "German",  "path": "lang/de.json" }
  ]
}
```

### JavaScript API

```javascript
// Simple lookup
const label = game.i18n.localize("MY_MODULE.settingName");

// With variable substitution — uses {placeholder} syntax
const msg = game.i18n.localize("MY_MODULE.greeting", { name: "Gandalf" });
// → "Hello, Gandalf!"

// _loc is a global alias of game.i18n.localize (bound to the same instance)
const short = _loc("MY_MODULE.greeting", { name: "Gandalf" });

// Check if a key exists (useful for optional overrides)
if (game.i18n.has("MY_MODULE.optional.label")) {
  // use it
}

// Intl.PluralRules for the active language
const rule = game.i18n.pluralRules.select(count);   // "one" | "other" | ...
const text = _loc(`MY_MODULE.items.${rule}`, { count });
```

**Changed in v14:** `game.i18n.localize(stringId, data)` formats when `data` is given. `game.i18n.format` is now a plain alias of `localize` (same function, no warning), so existing calls keep working; prefer `localize`/`_loc` in new code. `game.i18n.pluralRules` is new. Full-text search across documents and packs now needs 3 characters (`CONFIG.i18n.searchMinimumCharacterLength`, was 4) and skips `CONFIG.i18n.searchStopWords`.

### Handlebars Templates

```handlebars
<label>{{localize "MY_MODULE.settingName"}}</label>
<button>{{localize "MY_MODULE.button.confirm"}}</button>
<p>{{localize "MY_MODULE.greeting" name=user.name}}</p>
```

The `{{localize}}` helper passes its hash to `_loc`, so formatting works inline.

### Settings with i18n

Pass i18n keys as `name` and `hint` — Foundry auto-localizes them in the Settings UI:

```javascript
game.settings.register("my-module", "trackResources", {
  name: "MY_MODULE.settingName",   // auto-localized
  hint: "MY_MODULE.settingHint",   // auto-localized
  scope: "world",
  config: true,
  type: Boolean,
  default: true,
});
```

---

## Performance

Foundry can run worlds with thousands of compendium entries, hundreds of active scene tokens, and multiple players synchronizing in real time. The patterns below prevent the most common performance mistakes; ignore them and a 50-token combat encounter takes 5 seconds per turn.

### Compendium Loads — Index, Don't Hydrate

`pack.getDocuments()` deserializes **every** document in the pack into a full `Actor`/`Item` instance with a hydrated `system` model. For a 1,000-entry SRD pack that's hundreds of milliseconds of CPU and tens of MB of memory.

```javascript
// SLOW — full hydration of every document
const monsters = await pack.getDocuments();
const dragons = monsters.filter(m => m.system.cr >= 10);

// FAST — index lookup, project only the fields you need
const index = await pack.getIndex({ fields: ["system.cr", "system.type"] });
const dragonIds = index.filter(e => e.system?.cr >= 10).map(e => e._id);
const dragons = await Promise.all(dragonIds.map(id => pack.getDocument(id)));
```

Rules of thumb:
- **Browsing / search UI** — `getIndex` only, project required fields.
- **Need 1–10 specific docs** — `getIndex`, then `getDocument(id)` for each match.
- **Need >50 docs** — re-evaluate. Usually you can move work into the index.

### Projection Fields

The `fields` array on `getIndex({ fields })` controls which fields beyond the default (`_id`, `name`, `img`, `type`, `sort`, `folder`) are loaded into the index entries. Projecting saves memory and parse time:

```javascript
const index = await pack.getIndex({ fields: ["system.level", "system.school"] });
// each entry has: { _id, name, img, type, sort, folder, system: { level, school } }
```

Don't project the whole document — that defeats the point. Pick 1–5 fields you actually filter or sort by.

### Batch CRUD (Plural Forms)

Single-document CRUD methods (`Actor.create`, `actor.update`, `actor.delete`) each fire a complete hook chain (`preCreate`, `create`, `createActor`, ready chain). For N documents, that's N round trips and N hook chains.

```javascript
// SLOW — N round trips
for (const data of monsterData) {
  await Actor.create(data);
}

// FAST — one round trip, one batched hook chain
await Actor.createDocuments(monsterData);
```

Plural forms exist on every Document class:

| Single | Batch |
|---|---|
| `Actor.create(data)` | `Actor.createDocuments(dataArray)` |
| `actor.update(changes)` | `Actor.updateDocuments(changesArray)` |
| `actor.delete()` | `Actor.deleteDocuments(idArray)` |
| `actor.createEmbeddedDocuments("Item", [data])` | same — already batched |

For embedded documents, **always pass an array** even when creating one — there is no non-batch single-embedded API.

### Avoid Render Loops in Update Hooks

If your `updateActor` handler triggers another update on the same actor, you're in a loop. Move derived values to `prepareDerivedData` (not persisted, computed every prepare cycle) or use `_preUpdate` (mutates the changes object before the write).

### Hook De-duplication

`updateActor` fires for every connected client. If your handler does anything expensive (re-render a panel, recompute a derived view), debounce or guard:

```javascript
// Run only on the originating client
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (game.userId !== userId) return;
  refreshMyPanel();
});

// Or debounce so multiple updates in quick succession collapse
const debouncedRefresh = foundry.utils.debounce(refreshMyPanel, 100);
Hooks.on("updateActor", debouncedRefresh);
```

### `prepareDerivedData` Cost

`prepareDerivedData` runs on **every** call to `actor.prepareData()` — which fires after every update, every login, every scene switch, and many other moments. For a world with 200 actors, an O(n²) algorithm in `prepareDerivedData` becomes a perceptible freeze.

- Keep it linear in the size of the actor's own data.
- Cache results that depend on world state in `flags`, not in derived properties.
- Don't call `await` from `prepareDerivedData` — it's synchronous and Foundry won't wait.

### PIXI Texture Cache

Custom canvas layers that load textures should reuse them. The PIXI texture cache is keyed on URL:

```javascript
// FAST — cached on second use
const tex = await PIXI.Assets.load("modules/my-module/img/sparkle.png");

// FASTER — preload during init for known assets
Hooks.once("init", () => {
  PIXI.Assets.add({ alias: "sparkle", src: "modules/my-module/img/sparkle.png" });
});
Hooks.once("ready", () => PIXI.Assets.load("sparkle"));
```

Destroying a sprite removes its display object but **not** the underlying texture — that stays cached. Don't manually destroy textures unless you're sure no one else uses them.

### Profiling

Foundry exposes debug flags for performance tracing:

```javascript
CONFIG.debug.time = true;           // log data preparation timing
CONFIG.debug.hooks = true;          // log every hook fire
CONFIG.debug.applications = true;   // log ApplicationV2 lifecycle
CONFIG.debug.dice = true;           // log roll evaluation steps
```

For deep profiling, use the browser DevTools Performance tab — record a 5-second slice while the slow action runs, then look for hot frames in the flame chart.
