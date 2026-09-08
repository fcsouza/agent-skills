# Migration & Maintenance Guide

Deep reference for migrating Foundry VTT modules between versions and maintaining data integrity.

---

## Migration Pattern

Store a `schemaVersion` in a world setting. On `ready`, compare the stored version against the target (latest migration number). Run each pending migration in sequence, then update the stored version.

Each migration function is **idempotent** — safe to run twice. Guard with checks before writing.

### Setting Registration

```javascript
Hooks.once("init", () => {
  game.settings.register("my-module", "schemaVersion", {
    name: "Schema Version",  // internal — not shown in UI
    scope: "world",
    config: false,           // hidden from settings menu
    type: Number,
    default: 0,
  });
});
```

### Migration Runner

```javascript
const MIGRATIONS = [
  { version: 1, fn: migrateV1 },
  { version: 2, fn: migrateV2 },
];

Hooks.once("ready", async () => {
  if (!game.user.isGM) return; // Only GM runs migrations

  const current = game.settings.get("my-module", "schemaVersion") ?? 0;
  const target = MIGRATIONS[MIGRATIONS.length - 1].version;

  if (current >= target) return; // Already up to date

  ui.notifications.warn("my-module | Running data migration...");

  for (const { version, fn } of MIGRATIONS) {
    if (current < version) {
      console.log(`my-module | Migrating to schema version ${version}...`);
      await fn();
    }
  }

  await game.settings.set("my-module", "schemaVersion", target);
  ui.notifications.info("my-module | Migration complete.");
});
```

---

## v13 → v14 Breaking Changes

`foundry-vtt-module-dev/references/v14-migration.md` is the canonical list. It carries every deprecation with its replacement and removal version, the breaking data changes, the manifest changes, and a before/after checklist. The table below is the headline set — the twelve changes that break the most module code. Unless noted, the old form still works with a deprecation warning until v16.

| Area | v13 | v14 |
|---|---|---|
| ActiveEffect changes | `changes` at the document root, numeric `mode` | `system.changes`, string `type`, plus a `phase` |
| Roll and message modes | `rollMode`, `CONFIG.Dice.rollModes` | `messageMode`, `CONFIG.ChatMessage.modes` |
| Update keys | `"-=key": null`, `"==key": value` | `key: _del`, `key: _replace(value)` |
| Templates | `MeasuredTemplateDocument` | `RegionDocument` and `canvas.regions.placeRegion` |
| Scene textures | `Scene#background`, `#foregroundElevation` | `Level#background`, `Level#elevation.top` |
| Canvas layer override | `CONFIG.<Doc>.layerClass` | `CONFIG.Canvas.layers.<name>.layerClass` |
| DataModel migration | `migrateSource`, `migrateData` returning nothing | `_migrate(value, options, _state)`, `migrateData` returns the data |
| Wall constants | `CONST.WALL_SENSE_TYPES`, `CONST.WALL_DIRECTIONS` | `CONST.EDGE_SENSE_TYPES`, `CONST.EDGE_DIRECTIONS` |
| Context menu entries | `{name, condition, callback}` | `{label, visible, onClick(event, target)}` |
| Particles | `ParticleEffect`, `effectClass` | `ParticleGenerator`, `particles` config |
| v12 shims | bare `mergeObject`, `Die`, `Math.clamped`, `CONST.DOCUMENT_TYPES` | removed outright — no warning, just errors |
| Manifest and runtime | `template.json`, Node `>=20.18.0 <23`, unvalidated pack names | `documentTypes`, Node `>=24.13.1 <25`, validated pack names |

Two removals land earlier than v16: the `renderChatMessage` hook and `Combat#getCombatantByToken` / `#getCombatantByActor` go in v15.

---

## v11 → v12 → v13 (Compact History)

Still relevant when you maintain code written for older versions. Everything here is already required in v14.

### v12 → v13

- **jQuery is out of the UI framework.** `_onRender` and V2 hooks pass `HTMLElement`. `html.find(sel)` → `this.element.querySelector(sel)`; `.click(fn)` → `addEventListener("click", fn)`; `.val()` → `.value`; `.addClass` → `classList.add`. jQuery is still bundled and `renderChatMessage` still fires with a jQuery arg (deprecated until v15) — prefer `renderChatMessageHTML`.
- **ApplicationV2.** `Application`/`FormApplication`/`Dialog` (`foundry.appv1.*`) are deprecated until v16. `static DEFAULT_OPTIONS`, `static PARTS`, `_prepareContext`, `_onRender`, `form.handler`. Sheets: `foundry.applications.sheets.ActorSheetV2` / `ItemSheetV2`; registration through `foundry.documents.collections.Actors.registerSheet(...)`.
- **DialogV2.** `foundry.applications.api.DialogV2.confirm/prompt/wait` return values directly instead of resolve callbacks. v14 adds `wait({ renderOptions })`.
- **CSS `@layer` and themes.** Put module CSS in a layer through the manifest (`styles: [{ src, layer: "modules" }]`) and use `--color-*` custom properties; `body.theme-light|dark` unchanged in v14.
- **Namespaces (`foundry.*`).** v13 moved every class under `foundry.<package>` (`foundry.applications`, `foundry.canvas`, `foundry.documents`, `foundry.dice`, `foundry.utils`, ...). The bare globals (`Actors`, `TextEditor`, `DocumentSheetConfig`, ...) are shims scheduled for removal in v15; v12-era ones were removed in v14.
- **Rolls.** `await new Roll("2d6").evaluate()`; synchronous `.roll()` is gone.
- **Data access.** `actor.system.*`, never `actor.data.data`.

### v11 → v12

- `prepareData()` / `prepareBaseData()` / `prepareDerivedData()` call order changed.
- Canvas layers regrouped into `primary`/`interface` groups; register through `CONFIG.Canvas.layers`.
- `token.actor` is the synthetic actor; `game.actors.get(token.actorId)` is the base actor.
- v12-only deprecations (bare `foundry.utils` globals, dice-term globals, `Math.clamped`) expired in v14 — see item 11 above.

---

## Compatibility Flags

In `module.json`:

```json
{
  "compatibility": {
    "minimum": "14",
    "verified": "14.367"
  }
}
```

| Flag | Behavior | Recommendation |
|---|---|---|
| `minimum` | Foundry refuses to load below this version | Set to the lowest major version you've tested |
| `verified` | Shown in the module browser; green checkmark on this version | Update on each Foundry release you test |
| `maximum` | Foundry refuses to load above this version | **Omit unless you've confirmed a real breakage** |

Never set `maximum` preemptively. It blocks users from updating Foundry while waiting for a module update they may not actually need. When `maximum` is a bare integer (`"14"`) the check compares generations only; a full version (`"14.367"`) compares builds.

Supporting both v13 and v14 from one branch is rarely worth it: the ActiveEffect, Level and template changes differ in data shape, not just API names. Branch per generation and set `minimum` accordingly.

---

## Data Migration Patterns

### Adding a Field (No Migration Needed)

Define the field in `defineSchema()` with an `initial` value. TypeDataModel populates it automatically the next time the document is loaded.

```javascript
static defineSchema() {
  return {
    ...super.defineSchema(),
    newField: new foundry.data.fields.NumberField({ initial: 0 }),
  };
}
```

### Removing a Field

Remove from `defineSchema()`. Old data remains in the database but is silently ignored. To clean it up:

```javascript
async function migrateRemoveField() {
  for (const actor of game.actors) {
    if ("removedField" in (actor.system ?? {})) {
      await actor.update({ "system.removedField": _del });   // v13: "system.-=removedField": null
    }
  }
}
```

### Renaming a Field

Prefer `static migrateData` on the TypeDataModel — it runs when documents load, needs no world pass, and covers compendium content. **Changed in v14:** it must return the source.

```javascript
static migrateData(source, options) {
  if ("oldName" in source && !("newName" in source)) {
    source.newName = source.oldName;
    delete source.oldName;
  }
  return super.migrateData(source, options);
}
```

`migrateData` only changes the in-memory model. To persist, read the old field, write the new field, delete the old field — in a single `update()` call:

```javascript
async function migrateV1() {
  for (const actor of game.actors) {
    const old = actor.system?.oldName;
    if (old === undefined) continue; // Already migrated

    await actor.update({
      "system.newName": old,
      "system.oldName": _del,
    });
  }

  // Also migrate items embedded in actors
  for (const actor of game.actors) {
    for (const item of actor.items) {
      const old = item.system?.oldName;
      if (old === undefined) continue;
      await item.update({
        "system.newName": old,
        "system.oldName": _del,
      });
    }
  }
}
```

### Changing Field Type (e.g., String → Number)

```javascript
async function migrateV2() {
  for (const actor of game.actors) {
    const raw = actor.system?.level;
    if (typeof raw !== "string") continue; // Skip if already a number (or missing)

    const parsed = parseInt(raw, 10);
    await actor.update({
      "system.level": Number.isNaN(parsed) ? 0 : parsed,
    });
  }
}
```

---

## Bulk Migration — migrateWorld

Pattern for iterating all world documents:

```javascript
async function migrateActors() {
  for (const actor of game.actors) {
    const updateData = buildActorUpdate(actor);
    if (Object.keys(updateData).length === 0) continue; // Nothing to update
    await actor.update(updateData);

    // Also migrate items embedded in this actor
    for (const item of actor.items) {
      const itemUpdate = buildItemUpdate(item);
      if (Object.keys(itemUpdate).length === 0) continue;
      await item.update(itemUpdate);
    }
  }
}

async function migrateScenes() {
  for (const scene of game.scenes) {
    for (const tokenDoc of scene.tokens) {
      // tokenDoc.actor is the synthetic actor — has its own system data
      if (!tokenDoc.actor) continue;
      const updateData = buildActorUpdate(tokenDoc.actor);
      if (Object.keys(updateData).length === 0) continue;
      // Update via the synthetic actor (actorData was removed in v10+)
      await tokenDoc.actor.update(updateData);
    }
  }
}

async function migrateItems() {
  for (const item of game.items) {
    const updateData = buildItemUpdate(item);
    if (Object.keys(updateData).length === 0) continue;
    await item.update(updateData);
  }
}

// Full world migration
async function migrateWorld() {
  await migrateActors();
  await migrateItems();
  await migrateScenes();
}
```

`buildActorUpdate` returns a plain diff. Deletions use `_del`, whole-object replacements use `_replace(value)`; never emit `-=`/`==` keys (deprecated until v16). Because `migrateData` already runs on load, `actor.system` reflects the new shape — read old keys from `actor._source.system` when you need to know whether the stored record still needs the write.

Batch the writes instead of one `update()` per document:

```javascript
async function migrateActors() {
  const updates = [];
  for (const actor of game.actors) {
    const src = actor._source.system;
    if (!("oldName" in src)) continue;
    updates.push({ _id: actor.id, "system.newName": src.oldName, "system.oldName": _del });
  }
  if (updates.length) await Actor.updateDocuments(updates);
}
```

Cross-document batches (an Actor plus its Tokens on several Scenes) go through `foundry.documents.modifyBatch([...])` so a failure rolls back the whole set.

---

## Deprecation Warnings

### Detecting deprecated core API in your module

Core logs every deprecated call through `foundry.utils.logCompatibilityWarning`. v14 deprecations read `Deprecated since Version 14` / `Backwards-compatible support will be removed in Version 16` (a few say 15). Tune what you see through `CONFIG.compatibility`:

```javascript
// In the console, or a dev-only init hook
CONFIG.compatibility.mode = CONST.COMPATIBILITY_MODES.ERROR;   // SILENT 0, WARNING 1 (default), ERROR 2, FAILURE 3
CONFIG.compatibility.includePatterns.push(/modules\/my-module\//); // only warnings whose stack mentions my code
CONFIG.compatibility.excludePatterns.push(/systems\/dnd5e\//);     // hide someone else's
```

`ERROR` logs with a stack trace, `FAILURE` throws — useful in a test world to make a v13 call site fail loudly. Patterns test both the message and the stack, so `includePatterns` with your module path is the fastest way to isolate your own leftovers.

### Deprecating your own API

```javascript
function oldHelperFunction(actor) {
  foundry.utils.logCompatibilityWarning(
    "my-module | `oldHelperFunction` is deprecated. Use `newHelperFunction` instead.",
    {
      since: "1.3.0",  // your module version when deprecated
      until: "2.0.0",  // your module version when it will be removed
      once: true,       // only log once per session
    }
  );
  return newHelperFunction(actor);
}
```

---

## Testing Across Versions

- Keep a separate Foundry installation for each major version you support.
- Use the `--world <worldName>` CLI flag to launch a specific world without the UI launcher.
- Before running migrations against real data: **make a backup** of the world folder (`Data/worlds/my-world/`).
- Run migrations on a copy first, then promote to production.
- After migration, open the browser console and filter for `Deprecated since Version 14` — these flag the next round of work. Set `CONFIG.compatibility.mode = CONST.COMPATIBILITY_MODES.FAILURE` in a scratch world to turn each one into a thrown error.
- Enable `CONFIG.debug.hooks = true` in the console to trace hook call order during development.
- v13 and v14 need different Node versions (20–22 vs 24). Keep one Node per install, or run each through its own version manager entry.
