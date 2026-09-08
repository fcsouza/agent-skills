# Data Migration

Deep reference for Foundry VTT v14's system data migration patterns.

---

## 1. Migration Architecture

Systems and modules take fundamentally different approaches to data migration.

**Systems** own the data schema. They use `TypeDataModel.migrateData()` for automatic per-document migration on load, plus a settings-based version for bulk migrations that cannot be expressed as field transforms.

**Modules** do not own document schemas. They rely entirely on settings-based versioning and run bulk migrations in the `ready` hook.

```
System Migration Strategy:
  1. Per-document: static migrateData() on TypeDataModel
     - Runs automatically when any document of that type is loaded
     - Ideal for field renames, default value injection, path restructuring
  2. Bulk: settings-based version + ready hook
     - Runs once per world load (GM only)
     - Ideal for complex transforms, cross-document fixes, compendium updates

Module Migration Strategy:
  1. Settings-based version only
     - Register a hidden setting in init
     - Compare on ready, run pending migrations
```

System `system.json` declares document types. Foundry automatically uses the registered `TypeDataModel` for migration when documents load.

---

## 2. migrateData() on TypeDataModel

The static `migrateData(source, options)` method receives a raw data object (before it becomes a document instance) and returns the modified data. Foundry calls it through `DataModel.migrateDataSafe` on every document load for types registered in `CONFIG.<Doc>.dataModels`. A thrown error is caught and logged; the unmigrated source is used.

Changed in v14: `migrateData` **must return the data**. An implementation that returns `undefined` logs a deprecation warning (`since: 14, until: 16`) from `TypeDataField#_migrate` and the pre-migration value is used instead. Finish every override with `return super.migrateData(source, options);`.

```js
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      level: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      biography: new fields.HTMLField({ initial: "" }),
      abilities: new fields.SchemaField({
        str: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, initial: 10 }),
          mod: new fields.NumberField({ required: true, integer: true, initial: 0 })
        }),
        dex: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, initial: 10 }),
          mod: new fields.NumberField({ required: true, integer: true, initial: 0 })
        })
      })
    };
  }

  /**
   * Migrate source data before it is validated against the schema.
   * Runs automatically on document load.
   * @param {object} source  - The raw source data for this document.
   * @param {object} options - Additional migration options.
   * @returns {object}       - The migrated source data. Returning nothing is deprecated.
   */
  static migrateData(source, options) {
    // Example: rename "bio" → "biography"
    if (source.bio !== undefined && source.biography === undefined) {
      source.biography = source.bio;
      delete source.bio;
    }

    // Example: inject default mod if missing
    if (source.abilities?.str?.value !== undefined && source.abilities?.str?.mod === undefined) {
      source.abilities.str.mod = Math.floor((source.abilities.str.value - 10) / 2);
    }

    // Always return the data
    return super.migrateData(source, options);
  }
}
```

`migrateData()` operates on raw plain objects, not document instances. Do not call `this.update()` or access document methods inside it.

### Field-level migration

A custom `DataField` subclass migrates its own candidate value. Changed in v14: `DataField#migrateSource` is replaced by `_migrate(value, options, _state)`. Defining `migrateSource` still works but logs a deprecation warning (`since: 14, until: 16`) from the `DataField` constructor.

```js
class DamageField extends foundry.data.fields.StringField {
  /** @override */
  _migrate(value, options, _state) {
    if (typeof value === "number") return `${value}`;   // old numeric damage
    return value;
  }
}
```

`_migrate` runs as a step of `DataField#clean`. The whole cleaning pipeline changed shape in v14: `DataModel.cleanData(data, options, _state)` takes `DataModelCleaningOptions` (`addTypes, copy, fields, expand, migrate, model, partial, prune, persisted, sanitize`) as the second argument and carries recursion state in a third `_state` argument. Passing `{source}` inside the options object is deprecated — pass it as `_state.source`.

---

## 3. Field-Path Migrations

`Document._addDataFieldMigration(data, oldKey, newKey, apply)` moves a value from one path to another inside raw source data and deletes the old key. It is a static, `@internal` helper on `foundry.abstract.Document` — **not** on `DataModel` or `TypeDataModel`, and there is no `_addDataFieldMigrations()` registration hook. Core uses it inside `static migrateData`, for example `ActiveEffect` moving root `changes` to `system.changes`.

Call it from a Document subclass:

```js
class MyActor extends Actor {
  /** @inheritDoc */
  static migrateData(source, options) {
    // Move a root-level key that used to live outside `system`
    this._addDataFieldMigration(source, "health", "system.hp");

    // The fourth argument transforms the value
    this._addDataFieldMigration(source, "system.armorClass", "system.attributes.ac.value",
      d => Number(d.system.armorClass) || 10);

    return super.migrateData(source, options);
  }
}
```

It returns `true` when it applied a migration, `false` when `newKey` already exists, `oldKey` is absent, or the old property is not writable. Pair it with `Document._logDataFieldMigration(oldKey, newKey, options)` when you want the console warning core emits.

A `TypeDataModel` has no access to that helper, so move paths by hand:

```js
class HeroData extends foundry.abstract.TypeDataModel {
  static migrateData(source, options) {
    const u = foundry.utils;
    if (u.hasProperty(source, "health") && !u.hasProperty(source, "hp")) {
      u.setProperty(source, "hp", u.getProperty(source, "health"));
      delete source.health;
    }
    return super.migrateData(source, options);
  }
}
```

Paths inside a `TypeDataModel` are relative to `system`: `"hp"` here is `actor.system.hp`.

---

## 4. Schema Versioning

Store the current schema version as a hidden system setting. Compare it on world load to determine which migrations to run.

### Register the Setting

```js
Hooks.once("init", () => {
  game.settings.register("my-system", "schemaVersion", {
    name: "Schema Version",
    hint: "Internal schema version for data migration tracking.",
    scope: "world",
    config: false,        // hidden from the settings UI
    type: Number,
    default: 0,
    requiresReload: false
  });
});
```

### Define the Target Version

```js
// The latest schema version — increment when adding a new migration
const SYSTEM_SCHEMA_VERSION = 3;
```

---

## 5. Migration Registry

Define migrations as an ordered array of `{version, fn}` objects. Each function is idempotent — safe to run multiple times without side effects. `_del` below is the global `ForcedDeletion` operator that replaced the `-=key` update syntax in v14 (see §7).

```js
const MIGRATIONS = [
  { version: 1, fn: migrateV1 },
  { version: 2, fn: migrateV2 }
];

async function migrateV1() {
  // v1: Rename "bio" field to "biography" on all hero actors
  for (const actor of game.actors) {
    if (actor.type !== "hero") continue;
    const bio = actor.system.bio;
    if (bio === undefined) continue;

    await actor.update({
      "system.biography": bio,
      "system.bio": _del       // v14: ForcedDeletion operator, was "-=system.bio": null
    });
  }
}

async function migrateV2() {
  // v2: Add default "temp" HP field to all actors
  for (const actor of game.actors) {
    if (actor.system.hp?.temp !== undefined) continue;

    await actor.update({
      "system.hp.temp": 0
    });
  }
}

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  const current = game.settings.get("my-system", "schemaVersion") ?? 0;
  const target = MIGRATIONS[MIGRATIONS.length - 1].version;

  if (current >= target) return;

  ui.notifications.warn("my-system | Running data migration...");

  for (const { version, fn } of MIGRATIONS) {
    if (current < version) {
      console.log(`[my-system] Migrating to schema version ${version}...`);
      await fn();
    }
  }

  await game.settings.set("my-system", "schemaVersion", target);
  ui.notifications.info("my-system | Migration complete.");
});
```

Idempotency guard: each migration checks whether it has already been applied before making changes (e.g., checking if a field exists before renaming it).

---

## 6. Bulk Migration

For large worlds, migrating every document one-by-one via `update()` is slow. Use `updateDocuments()` for batch operations and provide progress feedback.

### Bulk Actor Migration

```js
async function migrateActorData() {
  const actors = game.actors.contents;
  const batchSize = 50;
  let migrated = 0;

  for (let i = 0; i < actors.length; i += batchSize) {
    const batch = actors.slice(i, i + batchSize);
    const updates = [];

    for (const actor of batch) {
      const update = buildActorUpdate(actor);
      if (update) updates.push(update);
    }

    if (updates.length) {
      await Actor.updateDocuments(updates);
    }

    migrated += batch.length;
    ui.notifications.info(
      `my-system | Migrated ${migrated}/${actors.length} actors...`
    );
  }
}

function buildActorUpdate(actor) {
  const update = { _id: actor.id };
  let changed = false;

  // Example: add a missing field
  if (actor.system.hp?.temp === undefined) {
    update["system.hp.temp"] = 0;
    changed = true;
  }

  return changed ? update : null;
}
```

### Compendium Content Migration

```js
async function migrateCompendiumPacks() {
  const packs = game.packs.filter(
    (p) => p.metadata.type === "Actor" && p.metadata.package === "my-system"
  );

  for (const pack of packs) {
    const documents = await pack.getDocuments();
    const updates = documents.map((doc) => buildActorUpdate(doc)).filter(Boolean);

    if (updates.length) {
      await pack.documentClass.updateDocuments(updates, { pack: pack.collection });
      console.log(`[my-system] Migrated ${updates.length} in ${pack.collection}`);
    }
  }
}
```

---

## 7. v13 to v14 Migration

The changes below all affect stored data or the code that writes it. Every one of them is a deprecation with a removal version, so a v14 system keeps working while you migrate. The full module-side list is in `foundry-vtt-module-dev/references/v14-migration.md`.

### Deletion and replacement operators

`{"-=key": null}` and `{"==key": value}` are deprecated (`since: 14, until: 16`). They still work and log a warning. Use the operator globals instead — `_del` is a singleton `foundry.data.operators.ForcedDeletion`, `_replace(value)` builds a `ForcedReplacement`:

```js
// Delete a key
await actor.update({ "system.legacy": _del });

// Replace an object outright instead of merging into it
await actor.update({ ownership: _replace({ default: 0, [game.user.id]: 3 }) });

// Same operators work in updateSource
actor.updateSource({ "system.old": _del });
```

`mergeObject(original, other, {performDeletions})` is renamed to `{applyOperators}` (`since: 14, until: 16`), and `foundry.utils.applySpecialKeys` is renamed to `applyDataOperators`. `foundry.utils.objectsEqual` is renamed to `equals`.

```js
foundry.utils.mergeObject(base, { flags: _del }, { applyOperators: true });
```

### migrateData must return data

Covered in §2. Audit every `static migrateData` in your system: an implementation that ends without a `return` now logs a deprecation and its work is discarded.

### DataField#migrateSource → _migrate

Covered in §2. Rename the method and take the wider `(value, options, _state)` signature.

### Bulk writes with modifyBatch

`foundry.documents.modifyBatch(operations)` sends several document operations as one request with no network gap between them. A cancellation or a thrown error rolls back the whole batch, and no operation can read the result of an earlier one. Use it when a migration must touch several document types together:

```js
await foundry.documents.modifyBatch([
  { action: "update", documentName: "Actor", updates: actorUpdates },
  { action: "update", documentName: "Item",  updates: itemUpdates }
]);
```

`Document._onCreateOperation(documents, operation, user)` and `_onUpdateOperation` are the batch-wise hooks that run after the per-document `_onCreate`/`_onUpdate`. Put cross-document follow-up work there rather than in per-document handlers, so one batch produces one follow-up write.

### ActiveEffect data

`changes` moved out of the base ActiveEffect schema into `system.changes`, and numeric `mode` became a string `type`. Core migrates stored effects for you (`BaseActiveEffect.migrateData` calls `_addDataFieldMigration(source, "changes", "system.changes")` and maps `mode` numbers to type strings), but **your code** has to change:

```js
// v13
effect.changes.push({ key: "system.hp.max", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "2" });

// v14
await effect.update({
  "system.changes": [
    ...effect.system.changes,
    { key: "system.hp.max", type: "add", value: 2, phase: "initial", priority: 20 }
  ]
});
```

`duration.startTime/startRound/startTurn/combat` moved to `start.time/round/turn/combat`. `duration.seconds/rounds/turns` became `duration.value` plus `duration.units`. `origin` is a `DocumentUUIDField({relative: true})`. If your migration writes effect data directly, write the new paths. The full model is in `foundry-vtt-module-dev/references/active-effects-v2.md`.

### MeasuredTemplate content becomes Regions

The `MeasuredTemplate` document is gone as a real document (deprecated, removed in v16), and `Scene#templates` with it. Stored templates in your compendium scenes must become Regions with shapes:

```js
// v13 template data → v14 region data
const region = await RegionDocument.create({
  name: "Fireball",
  shapes: [{ type: "circle", x: t.x, y: t.y, radius: t.distance * scene.grid.size / scene.grid.distance }]
}, { parent: scene });
```

Shape types are `circle, cone, ellipse, emanation, grid, line, polygon, rectangle, ring, token`. For a template that follows a token, use `RegionDocument.createTokenEmanation(token, range, regionData, {excludeToken, gridBased, createOptions})`, which attaches the Region to the token via `attachment.token`. `RegionDocument#spawnTokens` and `#teleportTokens` replace hand-rolled placement helpers. The rewrite is in `foundry-vtt-module-dev/references/measured-templates.md`.

### Scene background moves to Levels

`Scene#background`, `#foreground`, `#foregroundElevation` and `#backgroundColor` are deprecated. A Scene now owns an embedded `Level` collection (`scene.levels`), and the image lives on the level: `Level#background.src`, `Level#background.color`, `Level#foreground.src`, `Level#elevation.top`. `canvas.level` is the level in view. Migration code that patched `scene.background.src` on packed scenes must write into the scene's levels instead. Details in `foundry-vtt-module-dev/references/scene-levels.md`.

### template.json to TypeDataModel

`template.json` is deprecated since v14, removed in v16. The steps are in `system-manifest.md` §5. From a migration standpoint: once a `TypeDataModel` is registered, the template defaults are no longer consulted, so any document whose stored data relied on a template default and never had the value written now falls back to the field's `initial`. Set `initial` on each field to the old template default before you delete the file, and add a `migrateData` for keys the new schema does not define.

### Re-importing from compendiums

`_stats.compendiumSource` holds the UUID a document was imported from (the old `flags.core.sourceId`, which core migrates into it). Use it to find world documents that came from a pack you have since updated:

```js
const stale = game.actors.filter(a => a._stats.compendiumSource?.startsWith("Compendium.my-system.monsters."));
for (const actor of stale) {
  const source = await fromUuid(actor._stats.compendiumSource);
  if (source) await actor.update({ system: _replace(source.toObject().system) });
}
```

---

## 8. v12 to v13 Breaking Changes

Two generations back. Kept as a lookup table for old code you still meet.

| v12 | v13 and later |
|-----|---------------|
| `activateListeners(html)` with jQuery | `_onRender(context, options)` with `this.element` (native `HTMLElement`) |
| `{{editor}}` helper | `<prose-mirror name="..." value="...">` custom element |
| `actor.effects` for all effects | `actor.allApplicableEffects()` |
| `canvas.grid.measureDistance(a, b)` | `canvas.grid.measurePath([a, b]).distance` |
| Scene controls as an array | Scene controls as an object keyed by control name, `tools` keyed by tool name |
| `FormApplication`, `ActorSheet`, `ItemSheet` | `ApplicationV2` + `HandlebarsApplicationMixin`, `foundry.applications.sheets.ActorSheetV2` |
| `static get defaultOptions()` | `static DEFAULT_OPTIONS` |
| `getData()` | `async _prepareContext()` |
| one `template` | `static PARTS` |
| `_updateObject(event, formData)` | `form.handler` in `DEFAULT_OPTIONS` |

The appv1 classes still ship in v14 under `foundry.appv1` and are deprecated until v16. Bare `foundry.utils` globals (`mergeObject`, `getProperty`, `duplicate`, ...) and the dice-term globals (`Die`, `RollTerm`, ...) were removed in v14 — use `foundry.utils.*` and `foundry.dice.terms.*`.
