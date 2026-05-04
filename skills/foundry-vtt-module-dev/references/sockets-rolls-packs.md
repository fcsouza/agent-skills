# Sockets, Rolls & Compendium Packs

Deep reference for Foundry VTT v13's socket communication, dice system, compendium packs, and localization.

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

### SocketInterface (v13)

v13 expands socket utilities. The core pattern for module sockets remains `game.socket.emit/on` with the `"module.my-module"` namespace (shown above). For most module use cases, the GM-authoritative emit/on pattern is sufficient and preferred.

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
});
```

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
  async _evaluate(options = {}) {
    await super._evaluate(options);

    // Re-roll any result that meets the explosion threshold
    let extras = [];
    for (const result of this.results) {
      if (result.result >= this.explosionThreshold) {
        const bonus = new foundry.dice.terms.Die({ number: 1, faces: this.faces });
        await bonus._evaluate();
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

### Roll Fulfillment

v13 uses a `RollResolver` application to fulfill dice results. For most modules, the standard `Roll.evaluate()` flow is sufficient. Custom roll resolution (e.g., prompting the player to choose a die face) is an advanced pattern — consult the v13 API docs for `RollResolver` if needed.

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
      "type": "Item"
    }
  ]
}
```

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
await pack.importDocument(actor);
```

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
const msg = game.i18n.format("MY_MODULE.greeting", { name: "Gandalf" });
// → "Hello, Gandalf!"

// Check if a key exists (useful for optional overrides)
if (game.i18n.has("MY_MODULE.optional.label")) {
  // use it
}
```

### Handlebars Templates

```handlebars
<label>{{localize "MY_MODULE.settingName"}}</label>
<button>{{localize "MY_MODULE.button.confirm"}}</button>
```

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
