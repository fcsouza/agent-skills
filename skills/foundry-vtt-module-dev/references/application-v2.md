# Application Framework (v2)

Deep reference for Foundry VTT v13's ApplicationV2 UI framework.

---

## 1. ApplicationV2 Base

`foundry.applications.api.ApplicationV2` is the base class for all modern Foundry UI windows. It replaces the legacy `Application` class.

### DEFAULT_OPTIONS

```js
class MyWindow extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "my-window",                    // unique DOM id
    classes: ["my-module", "my-window"],
    tag: "div",                         // wrapper element tag
    window: {
      title: "MY_MODULE.MyWindow.title",  // localization key
      icon: "fa-solid fa-scroll",
      resizable: true,
      minimizable: true,
      positioned: true                  // false = fullscreen overlay
    },
    position: {
      width: 480,
      height: "auto",
      top: null,
      left: null,
      scale: null
    },
    actions: {},
    form: null
  };
}
```

### Lifecycle

```
_preRender(context, options)    → async, can cancel render by throwing
_renderHTML(context, options)   → returns HTMLElement (or HTML string)
_replaceHTML(result, content)   → inserts rendered HTML into the window
_onRender(context, options)     → sync, DOM is ready (native HTMLElement, NOT jQuery), attach listeners here
```

Closing lifecycle:
```
_preClose(options)              → async, can cancel by throwing
_onClose(options)               → sync, cleanup: remove listeners, timers
```

### Minimal standalone window

```js
class InfoWindow extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "info-window",
    classes: ["my-module"],
    window: {
      title: "MY_MODULE.InfoWindow.title",
      icon: "fa-solid fa-info-circle",
      resizable: false
    },
    position: { width: 360, height: "auto" }
  };

  async _renderHTML(context, options) {
    const div = document.createElement("div");
    div.innerHTML = `<p>Hello from InfoWindow!</p>`;
    return div;
  }
}

// Open it
const win = new InfoWindow();
win.render({ force: true });
```

---

## 2. HandlebarsApplicationMixin

The standard pattern for template-driven windows. Mix it into ApplicationV2 to get Handlebars template support.

```js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class MyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "my-app",
    classes: ["my-module", "my-app"],
    window: {
      title: "MY_MODULE.MyApp.title",
      resizable: true
    },
    position: { width: 520, height: "auto" }
  };

  // Each part maps a template path to a named region
  static PARTS = {
    header: { template: "modules/my-module/templates/my-app-header.hbs" },
    body:   { template: "modules/my-module/templates/my-app-body.hbs" },
    footer: { template: "modules/my-module/templates/my-app-footer.hbs" }
  };

  // Context shared across all parts
  async _prepareContext(options) {
    return {
      title:   game.settings.get("my-module", "campaignTitle"),
      players: game.users.filter(u => u.active),
      isGM:    game.user.isGM
    };
  }

  // Per-part overrides — context already contains shared data
  async _preparePartContext(partId, context, options) {
    if (partId === "body") {
      context.items = game.items.contents;
    }
    if (partId === "footer") {
      context.version = game.modules.get("my-module").version;
    }
    return context;
  }
}
```

Parts render independently and can be re-rendered selectively:

```js
// Re-render only the body part
await myApp.render({ parts: ["body"] });
```

---

## 3. DocumentSheetV2

Base class for sheets bound to a document (Actor, Item, JournalEntry, etc.). Extends `ApplicationV2`.

For **Actor sheets**, prefer `foundry.applications.sheets.ActorSheetV2` which extends `DocumentSheetV2` and adds actor-specific drag-drop and token management. Similarly, use `foundry.applications.sheets.ItemSheetV2` for Item sheets.

```js
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

class HeroActorSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    id: "hero-actor-sheet",
    classes: ["my-module", "actor-sheet", "hero"],
    window: {
      title: "MY_MODULE.HeroSheet.title",
      icon: "fa-solid fa-shield",
      resizable: true
    },
    position: { width: 680, height: 720 },
    form: {
      submitOnChange: true,   // auto-submit when any input changes
      closeOnSubmit: false
    }
  };

  static PARTS = {
    header: { template: "modules/my-module/templates/actor/header.hbs" },
    tabs:   { template: "modules/my-module/templates/shared/tabs.hbs" },
    body:   { template: "modules/my-module/templates/actor/body.hbs" }
  };

  // this.document is the bound Actor
  async _prepareContext(options) {
    const actor  = this.document;
    const system = actor.system;

    return {
      actor,
      system,
      items:         actor.items.contents,
      weapons:       actor.items.filter(i => i.type === "weapon"),
      effects:       actor.effects.contents,
      abilities:     system.abilities,      // derived in prepareDerivedData
      health:        system.health,
      armorClass:    system.armorClass,
      isEditable:    this.isEditable,       // false if user lacks Owner permission
      isGM:          game.user.isGM,
      enrichedBiography: await TextEditor.enrichHTML(system.biography, {
        relativeTo: actor,
        rollData: actor.getRollData()
      })
    };
  }
}
```

`this.isEditable` is automatically `false` when the current user doesn't have Owner permission — use this to disable inputs in your template.

---

## 4. Registering Sheets

Register sheets in the `init` hook. The `types` array must match strings declared in `CONFIG.Actor.dataModels` and your manifest's `documentTypes`.

```js
Hooks.once("init", () => {
  // Register Actor sheets
  Actors.registerSheet("my-module", HeroActorSheet, {
    types:       ["hero"],
    makeDefault: true,
    label:       "MY_MODULE.Sheets.HeroSheet"
  });

  Actors.registerSheet("my-module", NpcActorSheet, {
    types:       ["npc"],
    makeDefault: true,
    label:       "MY_MODULE.Sheets.NpcSheet"
  });

  // Register Item sheets
  Items.registerSheet("my-module", WeaponItemSheet, {
    types:       ["weapon"],
    makeDefault: true,
    label:       "MY_MODULE.Sheets.WeaponSheet"
  });

  Items.registerSheet("my-module", SpellItemSheet, {
    types:       ["spell"],
    makeDefault: true,
    label:       "MY_MODULE.Sheets.SpellSheet"
  });
});
```

Players will see the sheet type picker in the document's header only when multiple sheets are registered for that type. The `makeDefault: true` sheet is selected automatically for new documents.

---

## 5. Actions System

Actions wire DOM elements to JavaScript handlers without manual `addEventListener` calls.

### Defining actions

```js
class HeroActorSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    // ...
    actions: {
      rollAbility:  HeroActorSheet.#onRollAbility,
      addItem:      HeroActorSheet.#onAddItem,
      deleteItem:   HeroActorSheet.#onDeleteItem
    }
  };

  // Handler receives the triggering event and the target element
  static async #onRollAbility(event, target) {
    const ability = target.dataset.ability;  // e.g. "strength"
    const actor   = this.document;
    const mod     = actor.system.abilities[ability]?.mod ?? 0;
    await new Roll(`1d20 + ${mod}`).toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `${ability.capitalize()} Check`
    });
  }

  static async #onAddItem(event, target) {
    const type = target.dataset.type ?? "weapon";
    await Item.create({ name: "New Item", type }, { parent: this.document });
  }

  static async #onDeleteItem(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    const item   = this.document.items.get(itemId);
    await item?.delete();
  }
}
```

### Template binding

```hbs
{{! Roll button — data-ability is passed to the handler via target.dataset }}
<button type="button" data-action="rollAbility" data-ability="strength">
  Roll STR ({{system.abilities.strength.mod}})
</button>

<button type="button" data-action="rollAbility" data-ability="dexterity">
  Roll DEX ({{system.abilities.dexterity.mod}})
</button>

{{! Add/delete items }}
<button type="button" data-action="addItem" data-type="weapon">
  <i class="fa-solid fa-plus"></i> Add Weapon
</button>

{{#each weapons as |item|}}
  <div class="item" data-item-id="{{item.id}}">
    <span>{{item.name}}</span>
    <button type="button" data-action="deleteItem">
      <i class="fa-solid fa-trash"></i>
    </button>
  </div>
{{/each}}
```

The `this` context inside action handlers is the sheet instance — you have access to `this.document`, `this.element`, etc.

---

## 6. DialogV2

Modern replacement for the legacy `Dialog` class. All variants return a Promise.

### confirm — yes/no prompt

```js
const confirmed = await foundry.applications.api.DialogV2.confirm({
  window:  { title: "Delete Actor" },
  content: "<p>Are you sure you want to delete this actor? This cannot be undone.</p>",
  yes: {
    label:    "Delete",
    icon:     "fa-solid fa-trash",
    callback: () => true         // return value resolves the promise
  },
  no: {
    label:    "Cancel",
    callback: () => false
  }
});
if (confirmed) await actor.delete();
```

### prompt — single input

```js
const newName = await foundry.applications.api.DialogV2.prompt({
  window:  { title: "Rename Actor" },
  content: `<input type="text" name="name" value="${actor.name}" autofocus />`,
  ok: {
    label:    "Rename",
    callback: (event, button) => {
      return button.form.elements.name.value;
    }
  }
});
if (newName) await actor.update({ name: newName });
```

### wait — fully custom buttons

```js
const result = await foundry.applications.api.DialogV2.wait({
  window:  { title: "Choose Action" },
  content: "<p>What does the player do?</p>",
  buttons: [
    {
      action:   "attack",
      label:    "Attack",
      icon:     "fa-solid fa-sword",
      callback: () => "attack"
    },
    {
      action:   "defend",
      label:    "Defend",
      icon:     "fa-solid fa-shield",
      callback: () => "defend"
    },
    {
      action:   "flee",
      label:    "Flee",
      icon:     "fa-solid fa-person-running",
      default:  true,
      callback: () => "flee"
    }
  ],
  close: () => null    // resolves to null if dialog is closed without choosing
});
console.log("Player chose:", result);
```

---

## 7. Form Handling

For sheets with `form.submitOnChange: true`, Foundry automatically serializes the form and calls the submit handler. Override `_prepareSubmitData` to transform or validate data before it reaches the handler.

```js
class HeroActorSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    // ...
    form: {
      handler:        HeroActorSheet.#onSubmitForm,
      submitOnChange: true,
      closeOnSubmit:  false
    }
  };

  static async #onSubmitForm(event, form, formData) {
    // formData is a plain object with dot-notation keys: "system.health.value"
    await this.document.update(foundry.utils.expandObject(formData));
  }

  // Override to transform or validate before submission
  _prepareSubmitData(event, form, formData) {
    const data = super._prepareSubmitData(event, form, formData);
    // Clamp health value before it reaches the handler
    if (data["system.health.value"] !== undefined) {
      const max = this.document.system.health.max;
      data["system.health.value"] = Math.clamp(Number(data["system.health.value"]), 0, max);
    }
    return data;
  }
}
```

Input names in your template must use dot-notation to map to the document's data structure:

```hbs
<input type="number" name="system.health.value" value="{{system.health.value}}" />
<input type="number" name="system.attributes.strength" value="{{system.attributes.strength}}" />
<input type="text"   name="name" value="{{actor.name}}" />
```

---

## 8. Template Patterns

Complete Handlebars template for an actor sheet body part.

```hbs
{{! modules/my-module/templates/actor/body.hbs }}
<form class="hero-sheet-body" autocomplete="off">

  {{! ── Header info ─────────────────────────────── }}
  <section class="identity">
    <div class="portrait">
      <img src="{{actor.img}}" alt="{{actor.name}}" data-edit="img" />
    </div>
    <div class="name-block">
      <input type="text" name="name" value="{{actor.name}}" placeholder="{{localize 'MY_MODULE.Actor.namePlaceholder'}}" />
      <span class="level">{{localize "MY_MODULE.Actor.level"}} {{system.level}}</span>
    </div>
  </section>

  {{! ── Ability scores ──────────────────────────── }}
  <section class="attributes">
    <h3>{{localize "MY_MODULE.Actor.attributes"}}</h3>
    {{#each system.abilities as |ability key|}}
      <div class="ability">
        <label>{{localize (concat "MY_MODULE.Ability." key)}}</label>
        <input type="number" name="system.attributes.{{key}}" value="{{ability.score}}" min="1" max="20" />
        <span class="mod">{{#if (gte ability.mod 0)}}+{{/if}}{{ability.mod}}</span>
        <button type="button" data-action="rollAbility" data-ability="{{key}}">
          <i class="fa-solid fa-dice-d20"></i>
        </button>
      </div>
    {{/each}}
  </section>

  {{! ── Health ──────────────────────────────────── }}
  <section class="health">
    <h3>{{localize "MY_MODULE.Actor.health"}}</h3>
    <input type="number" name="system.health.value" value="{{system.health.value}}" min="0" />
    <span class="separator">/</span>
    <span class="max">{{system.health.max}}</span>
  </section>

  {{! ── Inventory ────────────────────────────────── }}
  <section class="inventory">
    <header>
      <h3>{{localize "MY_MODULE.Actor.inventory"}}</h3>
      <button type="button" data-action="addItem" data-type="weapon">
        <i class="fa-solid fa-plus"></i>
      </button>
    </header>
    {{#each weapons as |item|}}
      <div class="item" data-item-id="{{item.id}}">
        <img src="{{item.img}}" alt="{{item.name}}" />
        <span class="item-name">{{item.name}}</span>
        <span class="item-damage">{{item.system.damage}}</span>
        <button type="button" data-action="deleteItem">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    {{else}}
      <p class="empty">{{localize "MY_MODULE.Actor.noItems"}}</p>
    {{/each}}
  </section>

  {{! ── Biography (rich text editor) ───────────── }}
  <section class="biography">
    <h3>{{localize "MY_MODULE.Actor.biography"}}</h3>
    {{editor enrichedBiography target="system.biography" button=true editable=isEditable}}
  </section>

</form>
```

Key conventions:
- `{{localize "KEY"}}` for all user-visible strings — never hardcode English text.
- `data-action="..."` on buttons to wire the Actions system.
- `data-*` attributes on elements to pass context to action handlers.
- `name="system.field.path"` on inputs for automatic form submission.
- `{{editor ...}}` for ProseMirror rich text fields.
- `{{#each}} ... {{else}} ... {{/each}}` for graceful empty states.

---

## Reactive Frameworks (Svelte / Lit)

ApplicationV2 makes it straightforward to mount a reactive framework instead of Handlebars — override `_renderHTML()` to create your framework's root element, and `_onClose()` to tear it down.

Svelte is the community favorite for complex module UIs due to zero virtual DOM overhead:

```javascript
import App from './App.svelte';

class MySvelteApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "my-svelte-app",
    window: { title: "Svelte App" },
    position: { width: 500, height: 400 },
  };

  #svelteApp = null;

  async _renderHTML(context, options) {
    const target = document.createElement("div");
    this.#svelteApp = new App({ target, props: context });
    return target;
  }

  async _replaceHTML(result, content, options) {
    content.replaceChildren(result);
  }

  _onClose(options) {
    this.#svelteApp?.$destroy();
    this.#svelteApp = null;
  }
}
```

The same pattern works with Lit, React, or any framework that mounts to a DOM element. Requires a bundler (Vite) to compile the framework — not suitable for simple, template-only modules where Handlebars is more appropriate.
