# Data Migration

Deep reference for Foundry VTT v13's system data migration patterns.

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

The static `migrateData()` method receives a raw data object (before it becomes a document instance) and returns the modified data. Foundry calls this automatically on every document load for types registered in `CONFIG.Actor.dataModels` or `CONFIG.Item.dataModels`.

Always call `super.migrateData()` first to ensure parent migrations run.

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
   * @param {object} data   - The raw source data for this document.
   * @param {object} options - Additional migration options.
   * @returns {object}       - The migrated source data.
   */
  static migrateData(data) {
    // Example: rename "bio" → "biography"
    if (data.bio !== undefined && data.biography === undefined) {
      data.biography = data.bio;
      delete data.bio;
    }

    // Example: inject default mod if missing
    if (data.abilities?.str?.value !== undefined && data.abilities?.str?.mod === undefined) {
      data.abilities.str.mod = Math.floor((data.abilities.str.value - 10) / 2);
    }

    // Always conclude with return super.migrateData(data)
    return super.migrateData(data);
  }
}
```

`migrateData()` operates on raw plain objects, not document instances. Do not call `this.update()` or access document methods inside it.

---

## 3. Document._addDataFieldMigration

For moving data from old field paths to new ones, use the static `_addDataFieldMigration` helper. This is Foundry's built-in mechanism for path-level field migrations and runs before `migrateData()`.

```js
class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      hp: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, initial: 10 }),
        temp: new fields.NumberField({ required: true, integer: true, initial: 0 })
      }),
      attributes: new fields.SchemaField({
        ac: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, initial: 10 })
        })
      })
    };
  }

  /** @override */
  static _addDataFieldMigrations() {
    super._addDataFieldMigrations();

    // Move old "health" field to new "hp" path
    this._addDataFieldMigration("health", "hp");

    // Move old nested path to new location
    this._addDataFieldMigration("data.health", "system.hp");

    // Rename a single nested field
    this._addDataFieldMigration("attributes.armorClass", "attributes.ac");
  }
}
```

`_addDataFieldMigration(oldPath, newPath)` copies the value from `oldPath` to `newPath` in the source data and deletes the old key. It handles nested dot-notation paths automatically.

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

### Version Comparison

```js
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  const current = game.settings.get("my-system", "schemaVersion") ?? 0;
  const target = SYSTEM_SCHEMA_VERSION;

  if (current >= target) return;

  console.log(
    `[my-system] Schema version ${current} detected, target is ${target}. Running migrations.`
  );

  // ... run migrations ...

  await game.settings.set("my-system", "schemaVersion", target);
});
```

---

## 5. Migration Registry

Define migrations as an ordered array of `{version, fn}` objects. Each function is idempotent — safe to run multiple times without side effects.

```js
const MIGRATIONS = [
  { version: 1, fn: migrateV1 },
  { version: 2, fn: migrateV2 },
  { version: 3, fn: migrateV3 }
];

async function migrateV1() {
  // v1: Rename "bio" field to "biography" on all hero actors
  for (const actor of game.actors) {
    if (actor.type !== "hero") continue;
    const bio = actor.system.bio;
    if (bio === undefined) continue;

    await actor.update({
      "system.biography": bio,
      "-=system.bio": null     // Foundry syntax to delete a field
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

async function migrateV3() {
  // v3: Restructure item data — move weapon.damage into a schema field
  for (const item of game.items) {
    if (item.type !== "weapon") continue;
    if (item.system.damageDie !== undefined) continue;

    const oldDamage = item.system.damage;
    if (typeof oldDamage !== "string") continue;

    await item.update({
      "system.damageDie": oldDamage,
      "-=system.damage": null
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

### Bulk Item Migration

```js
async function migrateItemData() {
  const updates = game.items.contents
    .filter((i) => i.type === "weapon" && i.system.damageDie === undefined)
    .map((i) => ({
      _id: i.id,
      "system.damageDie": i.system.damage ?? "1d6",
      "-=system.damage": null
    }));

  if (updates.length) {
    await Item.updateDocuments(updates);
    ui.notifications.info(`my-system | Migrated ${updates.length} items.`);
  }
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

## 7. v12 to v13 Breaking Changes

Key deprecations relevant to system developers migrating from v12 to v13.

### jQuery Removal

v13 removes jQuery. All UI methods now pass native `HTMLElement`.

```js
// v12
activateListeners(html) {
  html.find(".my-button").click(this._onClick.bind(this));
  html.find(".my-input").val();
}

// v13 — ApplicationV2 uses _onRender
_onRender(context, options) {
  const html = this.element;
  html.querySelector(".my-button")?.addEventListener("click", this._onClick.bind(this));
  html.querySelector(".my-input")?.value;
}
```

### {{editor}} to <prose-mirror>

The `{{editor}}` Handlebars helper is replaced by `<prose-mirror>` custom elements in v13.

```html
<!-- v12 -->
{{editor content=system.biography target="system.biography" button=true owner=owner editable=editable}}

<!-- v13 -->
{{#if editable}}
  <prose-mirror name="system.biography" button="true" editable="{{editable}}" toggled="false" value="{{system.biography}}">
    {{{enrichedBiography}}}
  </prose-mirror>
{{else}}
  {{{enrichedBiography}}}
{{/if}}
```

### actor.effects to allApplicableEffects()

`actor.effects` no longer returns inherited effects. Use `allApplicableEffects()` to get all active effects including those from items and ancestry.

```js
// v12
const effects = actor.effects;

// v13
const effects = actor.allApplicableEffects();
```

### measureDistance to measurePath

The `measureDistance()` utility is replaced by `measurePath()` in v13, which returns a full path object.

```js
// v12
const distance = canvas.grid.measureDistance(origin, target);

// v13
const path = canvas.grid.measurePath(origin, target);
const distance = path.distance;
```

### Array to Object Scene Controls

Scene controls are now defined as an object of objects (not array of objects).

```js
// v12 — array-based
controls.push({
  name: "my-tools",
  title: "My Tools",
  icon: "fas fa-hammer",
  tools: [
    { name: "tool1", title: "Tool 1", icon: "fas fa-star", onClick: () => {} }
  ]
});

// v13 — object-based
controls["my-tools"] = {
  name: "my-tools",
  title: "My Tools",
  icon: "fas fa-hammer",
  tools: {
    tool1: { name: "tool1", title: "Tool 1", icon: "fas fa-star", onClick: () => {} }
  }
};
```

### Application Framework Rewrite

`FormApplication`, `ActorSheet`, and `ItemSheet` are replaced by `ApplicationV2`-based classes.

```js
// v12
class MyActorSheet extends ActorSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, { template: "...", width: 600 });
  }
  getData() { return { actor: this.actor }; }
  activateListeners(html) { html.find(".btn").click(() => {}); }
}

// v13
const { HandlebarsApplicationMixin } = foundry.applications.api;
class MyActorSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    position: { width: 600 },
    actions: { myAction: MyActorSheet.#onMyAction },
  };
  static PARTS = {
    header: { template: "my-system/templates/actor/header.hbs" },
    body:   { template: "my-system/templates/actor/body.hbs" }
  };
  async _prepareContext() { return { actor: this.document }; }
  static #onMyAction(event, target) { /* handle click */ }
}

// Registration unchanged
Actors.registerSheet("my-system", MyActorSheet, { makeDefault: true });
```

Key changes:
- `getData()` becomes async `_prepareContext()`
- `activateListeners(html)` becomes `_onRender(context, options)` with `this.element`
- `static get defaultOptions()` becomes `static DEFAULT_OPTIONS`
- Templates split into `static PARTS`
- `_updateObject(event, formData)` becomes `form.handler` in DEFAULT_OPTIONS
