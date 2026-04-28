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

## v12 → v13 Breaking Changes

### jQuery Deprecation

v13 removes jQuery from the UI framework. Hooks and `_onRender` now pass native `HTMLElement` instead of jQuery objects.

**Before (v12):**
```javascript
activateListeners(html) {
  html.find(".my-button").click(this._onButtonClick.bind(this));
  html.find(".my-input").val();
}
```

**After (v13):**
```javascript
_onRender(context, options) {
  const html = this.element;
  html.querySelector(".my-button")?.addEventListener("click", this._onButtonClick.bind(this));
  html.querySelector(".my-input")?.value;
}
```

Replace all jQuery patterns:
- `html.find(selector)` → `html.querySelector(selector)` / `html.querySelectorAll(selector)`
- `$(el).click(fn)` → `el.addEventListener("click", fn)`
- `$(el).val()` → `el.value`
- `$(el).text()` → `el.textContent`
- `$(el).addClass/removeClass` → `el.classList.add/remove`
- `$(el).hide/show` → `el.style.display = "none"` / `el.style.display = ""`

### CSS Cascade Layers (ThemeV2)

v13 uses CSS `@layer` for all UI styling and introduces native Light/Dark theme support via CSS variables. Modules should wrap CSS in a layer:

```css
@layer my-module {
  .my-module .window-content { padding: 0.5rem; }
  .my-module .stat { color: var(--color-warm-2); }
}
```

Use Foundry's CSS custom properties (e.g., `--color-warm-1`, `--color-text-primary`, `--color-bg-primary`) to respect theme selection.

### Application Framework Rewrite

**Before (v12):**
```javascript
class MyApp extends Application {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "my-app",
      template: "modules/my-module/templates/my-app.html",
      title: "My App",
      width: 400,
    });
  }

  getData() {
    return { message: "Hello" };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".btn").click(() => this.doSomething());
  }
}
```

**After (v13):**
```javascript
class MyApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "my-app",
    window: { title: "My App" },
    position: { width: 400 },
  };

  static PARTS = {
    main: { template: "modules/my-module/templates/my-app.hbs" },
  };

  async _prepareContext(options) {
    return { message: "Hello" };
  }

  _onRender(context, options) {
    this.element.querySelector(".btn").addEventListener("click", () => this.doSomething());
  }
}
```

### FormApplication → HandlebarsApplicationMixin

**Before (v12):**
```javascript
class MyForm extends FormApplication {
  static get defaultOptions() { ... }
  async _updateObject(event, formData) {
    await game.settings.set("my-module", "key", formData.value);
  }
}
```

**After (v13):**
```javascript
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

class MyForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    form: { handler: MyForm.#onSubmit, submitOnChange: false },
  };

  static PARTS = {
    form: { template: "modules/my-module/templates/my-form.hbs" },
  };

  static async #onSubmit(event, form, formData) {
    await game.settings.set("my-module", "key", formData.object.value);
  }
}
```

### ActorSheet and ItemSheet

**Before (v12):**
```javascript
class MyActorSheet extends ActorSheet { ... }
class MyItemSheet extends ItemSheet { ... }
```

**After (v13):**
```javascript
class MyActorSheet extends foundry.applications.sheets.ActorSheetV2 { ... }
class MyItemSheet extends foundry.applications.sheets.ItemSheetV2 { ... }
```

Registration is unchanged:
```javascript
Actors.registerSheet("my-module", MyActorSheet, { makeDefault: true });
Items.registerSheet("my-module", MyItemSheet, { makeDefault: true });
```

### Dialog API

**Before (v12):**
```javascript
const confirmed = await new Promise(resolve => {
  new Dialog({
    title: "Confirm",
    content: "<p>Are you sure?</p>",
    buttons: {
      yes: { label: "Yes", callback: () => resolve(true) },
      no:  { label: "No",  callback: () => resolve(false) },
    },
    default: "no",
  }).render(true);
});
```

**After (v13):**
```javascript
// DialogV2.confirm returns true/false directly
const confirmed = await foundry.applications.api.DialogV2.confirm({
  window: { title: "Confirm" },
  content: "<p>Are you sure?</p>",
  yes: { default: false },
  no:  { default: true },
});

// Prompt for a value
const value = await foundry.applications.api.DialogV2.prompt({
  window: { title: "Enter Value" },
  content: '<input type="text" name="value" autofocus />',
  ok: { callback: (event, button) => button.form.elements.value.value },
});

// Full custom dialog
await foundry.applications.api.DialogV2.wait({
  window: { title: "Custom" },
  content: "<p>Content here</p>",
  buttons: [
    { action: "option1", label: "Option 1", default: true },
    { action: "option2", label: "Option 2" },
  ],
  submit: (result) => console.log("Chose:", result),
});
```

### Roll Evaluation

**Before (v12):**
```javascript
const roll = new Roll("2d6").roll(); // synchronous
console.log(roll.total);
```

**After (v13):**
```javascript
const roll = await new Roll("2d6").evaluate(); // always await — sync .roll() is deprecated
console.log(roll.total);
```

### Actor Data Access

The `actor.data.data` double-nesting was removed in v10. If your module still uses it:

**Before (v10-era code):**
```javascript
const hp = actor.data.data.attributes.hp.value;
actor.update({ "data.attributes.hp.value": newHp });
```

**After (v10+ / v13):**
```javascript
const hp = actor.system.attributes.hp.value;
actor.update({ "system.attributes.hp.value": newHp });
```

### Actor Lookup by Name

`game.actors.getName()` still exists in v13, but if it is deprecated in your version:

```javascript
// Safe cross-version approach
const actor = game.actors.getName("Gandalf")
  ?? game.actors.find(a => a.name === "Gandalf");
```

---

## v11 → v12 Breaking Changes (Brief)

- **Document data preparation**: `prepareData()` / `prepareBaseData()` / `prepareDerivedData()` call order changed. Modules that hook into document preparation may fire at the wrong time.
- **Canvas layer changes**: Several layers were reorganized into layer groups. Custom layers registered in the old way may not appear.
- **ActiveEffect application**: The apply/disable lifecycle was reworked. Modules that manually manipulate ActiveEffect application need review.
- **Token document vs. synthetic actor**: `token.actor` returns the synthetic actor; `game.actors.get(token.actorId)` returns the base actor. This distinction is stricter in v12.

See the [official v12 migration notes](https://foundryvtt.com/releases/) for the full list.

---

## Compatibility Flags

In `module.json`:

```json
{
  "compatibility": {
    "minimum": "13",
    "verified": "13.315"
  }
}
```

| Flag | Behavior | Recommendation |
|---|---|---|
| `minimum` | Foundry refuses to load below this version | Set to the lowest major version you've tested |
| `verified` | Shown in the module browser; green checkmark on this version | Update on each Foundry release you test |
| `maximum` | Foundry refuses to load above this version | **Omit unless you've confirmed a real breakage** |

Never set `maximum` preemptively. It blocks users from updating Foundry while waiting for a module update they may not actually need.

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
      await actor.update({ "system.-=removedField": null });
    }
  }
}
```

### Renaming a Field

Read the old field, write the new field, delete the old field — in a single `update()` call:

```javascript
async function migrateV1() {
  for (const actor of game.actors) {
    const old = actor.system?.oldName;
    if (old === undefined) continue; // Already migrated

    await actor.update({
      "system.newName":   old,
      "system.-=oldName": null,
    });
  }

  // Also migrate items embedded in actors
  for (const actor of game.actors) {
    for (const item of actor.items) {
      const old = item.system?.oldName;
      if (old === undefined) continue;
      await item.update({
        "system.newName":   old,
        "system.-=oldName": null,
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

---

## Deprecation Warnings

When deprecating part of your own module's API surface:

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
- After migration, open the browser console and filter for `[Deprecation]` and `[Compatibility]` warnings — these flag the next round of work.
- Enable `CONFIG.debug.hooks = true` in the console to trace hook call order during development.
