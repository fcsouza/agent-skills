# Hooks & Settings

Deep reference for Foundry VTT v13's hook system and settings API.

---

## 1. Hook Basics

```js
// Register a persistent listener — returns a numeric ID
const hookId = Hooks.on("updateActor", (actor, changes, options, userId) => {
  console.log("Actor updated:", actor.name);
});

// One-shot listener — automatically removed after first call
Hooks.once("ready", () => {
  console.log("Foundry is ready.");
});

// Unregister by ID
Hooks.off("updateActor", hookId);

// Unregister by function reference
const myHandler = () => { /* ... */ };
Hooks.on("updateActor", myHandler);
Hooks.off("updateActor", myHandler);
```

Always store hook IDs when you register inside a class — you'll need them to clean up in `_onClose()` or when your module is disabled.

---

## 2. Lifecycle Hooks

Foundry fires these hooks in order as it initializes. What is safe to access changes at each stage.

### init

```js
Hooks.once("init", () => {
  // Safe: CONFIG, game.system, game.modules
  // Not safe: game.user, game.actors, canvas
  //
  // Register here:
  // - CONFIG.Actor.dataModels / CONFIG.Item.dataModels
  // - Custom sheets via Actors.registerSheet() / Items.registerSheet()
  // - game.settings.register() and game.settings.registerMenu()
  // - Handlebars helpers
  // - Document class overrides

  CONFIG.Actor.dataModels = { hero: HeroData, npc: NpcData };
  Actors.registerSheet("my-module", HeroActorSheet, { types: ["hero"], makeDefault: true });
  game.settings.register("my-module", "enableFeature", { /* ... */ });
});
```

### i18nInit

```js
Hooks.once("i18nInit", () => {
  // Safe: game.i18n is fully loaded — localization strings are available
  // Use to register Handlebars helpers that need localized strings
  Handlebars.registerHelper("myModuleLocalize", key => game.i18n.localize(key));
});
```

### setup

```js
Hooks.once("setup", () => {
  // Safe: all packages initialized, game.system, game.modules, game.settings
  // Documents are available in their collections but NOT yet rendered
  // Not safe: canvas, game.user (not fully resolved yet)
  //
  // Use to:
  // - Further modify CONFIG after other modules have had init
  // - Register keybindings
  // - Set up module API that other modules might need before ready

  game.keybindings.register("my-module", "openMyPanel", {
    name:         "MY_MODULE.Keybinding.openMyPanel",
    hint:         "MY_MODULE.Keybinding.openMyPanelHint",
    editable:     [{ key: "KeyM", modifiers: ["Control"] }],
    onDown:       () => { new MyPanel().render({ force: true }); }
  });
});
```

### ready

```js
Hooks.once("ready", () => {
  // Safe: everything — game.user, game.actors, game.scenes, game.items,
  //       game.settings, canvas, ui.*
  //
  // Use to:
  // - Run data migrations
  // - Start socket listeners
  // - Initialize UI components that need full game state
  // - Register Hooks for runtime events

  runMigrations();
  game.socket.on("module.my-module", handleSocketEvent);
});
```

**Summary table:**

| Stage      | CONFIG | game.settings | game.actors | game.user | canvas |
|------------|--------|---------------|-------------|-----------|--------|
| init       | yes    | yes (register)| no          | no        | no     |
| i18nInit   | yes    | yes           | no          | no        | no     |
| setup      | yes    | yes           | yes (read)  | partial   | no     |
| ready      | yes    | yes           | yes         | yes       | yes    |

---

## 3. Document Hooks

Foundry fires pre/post hooks for every document operation. The naming convention is:
- Pre-hooks: `pre[Action][DocumentType]` — cancellable by returning `false`
- Post-hooks: `[action][DocumentType]` — informational, cannot cancel

### Common hooks and their signatures

```js
// Actor CRUD
Hooks.on("preCreateActor",  (document, data, options, userId) => { /* return false to cancel */ });
Hooks.on("createActor",     (document, options, userId) => { });
Hooks.on("preUpdateActor",  (document, changes, options, userId) => { /* return false to cancel */ });
Hooks.on("updateActor",     (document, changes, options, userId) => { });
Hooks.on("preDeleteActor",  (document, options, userId) => { /* return false to cancel */ });
Hooks.on("deleteActor",     (document, options, userId) => { });

// Item CRUD
Hooks.on("preCreateItem",   (document, data, options, userId) => { });
Hooks.on("createItem",      (document, options, userId) => { });
Hooks.on("preUpdateItem",   (document, changes, options, userId) => { });
Hooks.on("updateItem",      (document, changes, options, userId) => { });
Hooks.on("preDeleteItem",   (document, options, userId) => { });
Hooks.on("deleteItem",      (document, options, userId) => { });

// Chat
Hooks.on("preCreateChatMessage", (document, data, options, userId) => { });
Hooks.on("createChatMessage",    (document, options, userId) => { });

// Combat lifecycle
Hooks.on("preCreateCombat",  (document, data, options, userId) => { });
Hooks.on("createCombat",     (document, options, userId) => { });
Hooks.on("updateCombat",     (document, changes, options, userId) => { });
Hooks.on("deleteCombat",     (document, options, userId) => { });
Hooks.on("combatStart",      (combat, updateData) => { });
Hooks.on("combatTurn",       (combat, updateData, updateOptions) => { });
Hooks.on("combatRound",      (combat, updateData, updateOptions) => { });
```

### Practical example — enforce constraint in a pre-hook

```js
// Prevent any actor from exceeding their maximum HP
Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
  if (changes.system?.health?.value !== undefined) {
    const maxHP = actor.system.health.max;
    changes.system.health.value = Math.min(changes.system.health.value, maxHP);
  }
});

// Cancel deletion of "protected" actors
Hooks.on("preDeleteActor", (actor, options, userId) => {
  if (actor.getFlag("my-module", "protected")) {
    ui.notifications.warn(`${actor.name} is protected and cannot be deleted.`);
    return false;
  }
});
```

---

## 4. Render Hooks

Fired when any Application renders. The class name is appended to `render` or `get`.

```js
// Fires every time any ActorSheet renders
Hooks.on("renderActorSheet", (app, html, data) => {
  // app  — the ApplicationV2 instance
  // html — the rendered HTML element
  // data — the context object passed to the template
  html.querySelector(".window-content")?.classList.add("my-module-style");
});

// Add a custom button to actor sheet headers
Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
  buttons.unshift({
    label:   "My Tool",
    class:   "my-module-tool",
    icon:    "fa-solid fa-wand-magic-sparkles",
    onclick: () => new MyTool(app.document).render({ force: true })
  });
});

// Handle drag-and-drop onto actor sheets
Hooks.on("dropActorSheetData", (actor, sheet, data) => {
  // data.type — e.g. "Item", "Actor", "Macro"
  if (data.type === "Item") {
    console.log(`Item dropped onto ${actor.name}`);
    // return false to prevent the default handling
  }
});

// React to a specific app rendering — e.g. the settings window
Hooks.on("renderSettingsConfig", (app, html, data) => {
  // Inject a custom control after a specific setting
  const target = html.querySelector(`[name="my-module.enableFeature"]`);
  if (target) {
    target.closest(".form-group").insertAdjacentHTML("afterend", `
      <div class="form-group">
        <label>Custom Info</label>
        <p class="notes">This is injected by my-module.</p>
      </div>
    `);
  }
});
```

---

## 5. Canvas Hooks

```js
// Canvas is initialized but layers are not yet ready
Hooks.on("canvasInit", (canvas) => {
  console.log("Canvas initializing for scene:", canvas.scene.name);
});

// Canvas is fully ready — all layers, tokens, and tiles are rendered
Hooks.on("canvasReady", (canvas) => {
  const scene = canvas.scene;
  console.log(`Canvas ready: ${scene.name}, ${canvas.tokens.placeables.length} tokens`);

  // Safe to interact with canvas layers here
  canvas.tokens.placeables.forEach(token => {
    if (token.actor?.getFlag("my-module", "glowing")) {
      addGlowEffect(token);
    }
  });
});

// Canvas view panned or zoomed
Hooks.on("canvasPan", (canvas, position) => {
  // position: { x, y, scale }
  console.log("Canvas panned to:", position);
});

// Something was dropped onto the canvas
Hooks.on("canvasDrop", (canvas, event) => {
  // event is the native DragEvent
  const data = JSON.parse(event.dataTransfer.getData("text/plain"));
  console.log("Dropped onto canvas:", data);
});

// Highlight objects on the canvas (e.g. during targeting)
Hooks.on("highlightObjects", (active) => {
  // active: boolean
});
```

---

## 6. Hooks.callAll vs Hooks.call

```js
// Hooks.callAll — runs ALL listeners regardless of return value
// Used for post-hooks (informational, no cancellation)
Hooks.callAll("myModule.dataReady", payload);

// Hooks.call — stops if ANY listener returns false
// Used for pre-hooks (cancellable operations)
const allowed = Hooks.call("myModule.beforeAction", context);
if (allowed === false) return; // cancelled by a listener
```

When writing your own hooks:
- Use `Hooks.call` when the action can be cancelled by another module.
- Use `Hooks.callAll` when you're broadcasting an event and all listeners should run.

```js
// Exposing a cancellable hook from your module
async function doImportantThing(actor) {
  const context = { actor, cancel: false };
  if (Hooks.call("myModule.preImportantThing", context) === false) return;

  // do the thing...

  Hooks.callAll("myModule.importantThingDone", actor);
}
```

---

## 7. Settings Registration

Register all settings in the `init` hook.

```js
Hooks.once("init", () => {
  const moduleId = "my-module";

  // Boolean toggle (shows as checkbox)
  game.settings.register(moduleId, "enableFeature", {
    name:    "MY_MODULE.Settings.enableFeature.name",
    hint:    "MY_MODULE.Settings.enableFeature.hint",
    scope:   "world",    // "world" = DB, GM-only write | "client" = localStorage, per-user
    config:  true,       // true = visible in Settings UI; false = hidden (API-only)
    type:    Boolean,
    default: true,
    onChange: value => {
      console.log("enableFeature changed to:", value);
    }
  });

  // Dropdown (choices object)
  game.settings.register(moduleId, "difficulty", {
    name:    "MY_MODULE.Settings.difficulty.name",
    hint:    "MY_MODULE.Settings.difficulty.hint",
    scope:   "world",
    config:  true,
    type:    String,
    choices: {
      easy:   "MY_MODULE.Settings.difficulty.easy",
      normal: "MY_MODULE.Settings.difficulty.normal",
      hard:   "MY_MODULE.Settings.difficulty.hard"
    },
    default: "normal"
  });

  // Number with range slider
  game.settings.register(moduleId, "volumeLevel", {
    name:    "MY_MODULE.Settings.volumeLevel.name",
    hint:    "MY_MODULE.Settings.volumeLevel.hint",
    scope:   "client",
    config:  true,
    type:    Number,
    range:   { min: 0, max: 100, step: 5 },
    default: 80,
    onChange: value => setVolume(value / 100)
  });

  // Free text
  game.settings.register(moduleId, "campaignTitle", {
    name:    "MY_MODULE.Settings.campaignTitle.name",
    hint:    "MY_MODULE.Settings.campaignTitle.hint",
    scope:   "world",
    config:  true,
    type:    String,
    default: ""
  });

  // Hidden setting (no UI, API access only)
  game.settings.register(moduleId, "migrationVersion", {
    scope:   "world",
    config:  false,
    type:    Number,
    default: 0
  });
});
```

`scope: "world"` — stored in the server database. Only GMs can write. All connected clients read the same value.
`scope: "client"` — stored in `localStorage`. Each player has their own value. GMs cannot override other players' settings.

---

## 8. Settings Get / Set

```js
const moduleId = "my-module";

// Get is synchronous
const isEnabled = game.settings.get(moduleId, "enableFeature");    // Boolean
const difficulty = game.settings.get(moduleId, "difficulty");       // "easy"|"normal"|"hard"
const volume     = game.settings.get(moduleId, "volumeLevel");      // Number

// Set is async — returns a Promise
await game.settings.set(moduleId, "enableFeature", false);
await game.settings.set(moduleId, "migrationVersion", 3);

// Pattern: read-modify-write
const currentVersion = game.settings.get(moduleId, "migrationVersion");
if (currentVersion < 3) {
  await runMigrationV3();
  await game.settings.set(moduleId, "migrationVersion", 3);
}
```

---

## 9. Settings Submenus

For complex settings that don't fit in a single row, register a submenu pointing to an ApplicationV2.

```js
Hooks.once("init", () => {
  const moduleId = "my-module";

  // Register the submenu entry (appears as a button in the settings list)
  game.settings.registerMenu(moduleId, "advancedConfig", {
    name:       "MY_MODULE.Settings.advancedConfig.name",
    label:      "MY_MODULE.Settings.advancedConfig.label",   // button text
    hint:       "MY_MODULE.Settings.advancedConfig.hint",
    icon:       "fa-solid fa-cog",
    type:       AdvancedConfigApp,   // ApplicationV2 class to open
    restricted: true                 // true = GM only
  });
});

// The ApplicationV2 that handles the submenu
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class AdvancedConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "my-module-advanced-config",
    classes: ["my-module", "settings-submenu"],
    window: {
      title: "MY_MODULE.Settings.advancedConfig.title",
      icon:  "fa-solid fa-cog"
    },
    position: { width: 480, height: "auto" },
    form: {
      handler:        AdvancedConfigApp.#onSubmit,
      closeOnSubmit:  true
    }
  };

  static PARTS = {
    form: { template: "modules/my-module/templates/settings/advanced-config.hbs" }
  };

  async _prepareContext(options) {
    const moduleId = "my-module";
    return {
      specialMode:    game.settings.get(moduleId, "specialMode"),
      debugLevel:     game.settings.get(moduleId, "debugLevel"),
      customEndpoint: game.settings.get(moduleId, "customEndpoint")
    };
  }

  static async #onSubmit(event, form, formData) {
    const moduleId = "my-module";
    const data     = foundry.utils.expandObject(formData.object);
    await game.settings.set(moduleId, "specialMode",    data.specialMode);
    await game.settings.set(moduleId, "debugLevel",     data.debugLevel);
    await game.settings.set(moduleId, "customEndpoint", data.customEndpoint);
    ui.notifications.info("Advanced settings saved.");
  }
}
```

The submenu's backing settings (`specialMode`, `debugLevel`, `customEndpoint`) should be registered with `config: false` since they're managed by the submenu UI, not the auto-generated settings rows.

---

## 10. Cleanup Pattern

Always clean up hook registrations when an application closes. Unregistered hooks continue to run even after the window is gone, causing memory leaks and ghost behavior.

```js
class MyPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  // Store hook IDs registered during this instance's lifetime
  #hookIds = [];

  async _onRender(context, options) {
    // Register runtime hooks and track their IDs
    this.#hookIds.push(
      Hooks.on("updateActor", this.#onActorUpdate.bind(this)),
      Hooks.on("updateCombat", this.#onCombatUpdate.bind(this)),
      Hooks.on("canvasReady", this.#onCanvasReady.bind(this))
    );
  }

  async _onClose(options) {
    // Remove every registered hook
    for (const id of this.#hookIds) {
      Hooks.off("updateActor",   id);
      Hooks.off("updateCombat",  id);
      Hooks.off("canvasReady",   id);
    }
    this.#hookIds = [];
  }

  #onActorUpdate(actor, changes, options, userId) {
    // React to actor updates while this panel is open
    this.render({ parts: ["body"] });
  }

  #onCombatUpdate(combat, changes, options, userId) {
    if (changes.turn !== undefined || changes.round !== undefined) {
      this.render({ parts: ["initiative"] });
    }
  }

  #onCanvasReady(canvas) {
    this.render({ force: true });
  }
}
```

For module-level hooks (registered once at module load, not tied to a specific window), store IDs in your module's global scope and remove them only if the module provides an explicit teardown path. These are rare — most dynamic listeners belong to an application instance.
