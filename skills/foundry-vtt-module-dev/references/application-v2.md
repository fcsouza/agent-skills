# Application Framework (v2)

Deep reference for Foundry VTT v14's ApplicationV2 UI framework.

**Changed in v14:** applications can detach into their own browser window (§12), `preRender<Class>` hooks fire before every render, header controls use the `label/visible/onClick` entry shape, `_getFrameButtons` adds header buttons, `_insertElement` is async, and the `bringToTop` shim is gone (use `bringToFront`). Sheets gain built-in drag-drop (§9). See `foundry-vtt-module-dev/references/v14-migration.md` for the full list.

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
_preFirstRender(context, options) → async, first render only
_preRender(context, options)    → async, can cancel render by throwing; fires the preRender<Class> hook
_renderHTML(context, options)   → returns HTMLElement (or HTML string)
_replaceHTML(result, content)   → inserts rendered HTML into the window
_insertElement(element, options) → async (v14), puts the element in the host document
_onFirstRender(context, options) → async, first render only
_onRender(context, options)     → async, DOM is ready (native HTMLElement, NOT jQuery), attach listeners here
```

Hooks fire for every class in the inheritance chain: `preRenderApplicationV2`, `preRenderMyApp`, then `renderApplicationV2`, `renderMyApp`. Both use `Hooks.callAll`, so returning `false` from a hook does not cancel the render — throw inside `_preRender` instead.

Detach lifecycle (v14): `_onDetach(from, to)` runs after the app moves into its own browser window and `_onAttach(from, to)` after it returns. `from`/`to` are `Document` objects. See §12.

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

// Find open instances of a class (v14)
for (const app of InfoWindow.instances()) app.bringToFront();
```

`ApplicationV2.instances()` is a static generator over `foundry.applications.instances` filtered by `instanceof`. `bringToFront()` raises the z-index; the old `bringToTop` alias was removed in v14.

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
      closeOnSubmit: false    // there is no submitOnClose in ApplicationV2
    },
    canImport: true,          // "Import" frame button when viewing a compendium document (default true)
    ownershipConfig: true     // "Configure Ownership" header control for GMs (default true)
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
      effects:       Array.from(actor.allApplicableEffects()),
      abilities:     system.abilities,      // derived in prepareDerivedData
      health:        system.health,
      armorClass:    system.armorClass,
      isEditable:    this.isEditable,       // false if user lacks Owner permission
      isGM:          game.user.isGM,
      enrichedBiography: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.biography, {
        relativeTo: actor,
        rollData: actor.getRollData()
      })
    };
  }
}
```

`this.isEditable` is automatically `false` when the current user doesn't have Owner permission — use this to disable inputs in your template.

`DocumentSheetV2` options beyond the base class: `viewPermission`, `editPermission`, `canCreate`, `canImport`, `sheetConfig`, `ownershipConfig`. Its default header controls are Detach, Attach (inherited), Configure Sheet and Configure Ownership; frame buttons are Copy UUID and, for compendium documents, Import.

`submitOnClose` is an appv1 option. ApplicationV2 ignores it — use `submitOnChange: true` if you need edits to persist without an explicit save.

---

## 4. Registering Sheets

Register sheets in the `init` hook. The `types` array must match strings declared in `CONFIG.Actor.dataModels` and your manifest's `documentTypes`.

```js
Hooks.once("init", () => {
  const { Actors, Items } = foundry.documents.collections;

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
    const roll = new Roll(`1d20 + ${mod}`);
    await roll.evaluate();
    await roll.toMessage({
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
  close: () => null,   // resolves to null if dialog is closed without choosing
  renderOptions: { window: { detached: true } }   // v14: forwarded to dialog.render()
});
console.log("Player chose:", result);
```

`renderOptions` (v14) is spread into the `render()` call, so any `RenderOptions` key works — `window.detached: true` opens the dialog in its own browser window. `rejectClose: true` makes the promise reject instead of resolving `null` on dismiss.

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

On `DocumentSheetV2` the default form handler calls `_processSubmitData(event, form, submitData, options)`, which updates an existing document or creates a new one. Since v14 it returns `{updated}` or `{created}` (or `{}` when nothing changed) so overrides can tell which happened:

```js
async _processSubmitData(event, form, submitData, options) {
  const result = await super._processSubmitData(event, form, submitData, options);
  if (result.created) ui.notifications.info(`Created ${result.created.name}`);
  return result;
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
    {{#if isEditable}}
      <prose-mirror name="system.biography" button="true" editable="{{isEditable}}" toggled="false" value="{{system.biography}}">
        {{{enrichedBiography}}}
      </prose-mirror>
    {{else}}
      {{{enrichedBiography}}}
    {{/if}}
  </section>

</form>
```

Key conventions:
- `{{localize "KEY"}}` for all user-visible strings — never hardcode English text.
- `data-action="..."` on buttons to wire the Actions system.
- `data-*` attributes on elements to pass context to action handlers.
- `name="system.field.path"` on inputs for automatic form submission.
- `<prose-mirror>` for rich text fields.
- `{{#each}} ... {{else}} ... {{/each}}` for graceful empty states.

---

## 9. Drag & Drop

`ActorSheetV2` and `ItemSheetV2` ship a built-in `DragDrop` instance (v14). The `_dragDrop` getter creates it lazily with `dragSelector: ".draggable"`, permission callbacks `_canDragStart(selector)` / `_canDragDrop(selector)`, and event callbacks `_onDragStart(event)` / `_onDragOver(event)` / `_onDrop(event)`. `_onRender` binds it to `this.element`. Override the `_onDrop*` methods to customize what happens when documents are dropped onto your sheet.

The drop pipeline resolves the payload to a document before calling the type handler: `_onDrop(event)` reads the drag data, fires the `dropActorSheetData` (or `dropItemSheetData`) hook, resolves `documentClass.fromDropData(data)`, then calls `_onDropDocument(event, document)`, which dispatches to `_onDropItem(event, item)`, `_onDropActor(event, actor)`, `_onDropActiveEffect(event, effect)` or `_onDropFolder(event, folder)`. The second argument is the resolved document, not the raw drag data.

### Override _onDropItem to filter drops

```js
class HeroActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // Only accept specific item types
  async _onDropItem(event, item) {
    // Reject items that don't belong on this actor type
    const allowedTypes = ["weapon", "armor", "consumable"];
    if (!allowedTypes.includes(item.type)) {
      ui.notifications.warn(`Cannot add ${item.type} items to this actor.`);
      return null;
    }

    // Call super to handle the default drop behavior (sort or create)
    return super._onDropItem(event, item);
  }
}
```

### Transfer items between actors

```js
async _onDropItem(event, item) {
  // If the item belongs to a different actor, transfer it
  const sourceActor = item.parent;
  if (sourceActor && sourceActor.id !== this.document.id) {
    // Create on the target actor
    const [newItem] = await this.document.createEmbeddedDocuments("Item", [item.toObject()]);
    // Remove from the source actor
    await sourceActor.deleteEmbeddedDocuments("Item", [item.id]);
    return newItem;
  }

  return super._onDropItem(event, item);
}
```

### ActiveEffect drops

Both sheets implement `_onDropActiveEffect(event, effect)`: it creates a copy of the effect on the actor or item unless the effect already belongs there. Override it to reject or transform effects:

```js
async _onDropActiveEffect(event, effect) {
  if (effect.type !== "base") return null;   // v14: effects have subtypes
  return super._onDropActiveEffect(event, effect);
}
```

### Resolve dropped data with fromUuid

```js
// fromUuid resolves any document UUID to its document instance
const actor = await fromUuid("Actor.abc123xyz789");
const item = await fromUuid("Item.xyz789abc123");
const scene = await fromUuid("Scene.sceneIdHere");

// fromUuidSync for synchronous access (returns null if not yet loaded)
const token = fromUuidSync("Scene.sceneId.Token.tokenId");
```

### Custom drop zones in templates

Add `data-drop-target` attributes to create specific drop zones:

```hbs
<div class="equipment-slot" data-drop-target="equipment" data-slot="head">
  {{#if equipped.head}}
    <img src="{{equipped.head.img}}" />
  {{else}}
    <p>{{localize "MY_MODULE.Actor.dropHeadgear"}}</p>
  {{/if}}
</div>
```

Handle custom drop zones by overriding `_onDrop` and checking the target:

```js
async _onDrop(event) {
  const target = event.target.closest("[data-drop-target]");
  if (target?.dataset.dropTarget === "equipment") {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const item = await fromUuid(data.uuid);
    if (item?.type === "armor") {
      const slot = target.dataset.slot;
      await this.document.update({ [`system.equipment.${slot}`]: item.id });
    }
    return;
  }
  return super._onDrop(event);
}
```

### Hooks for drop events

The `dropActorSheetData(actor, sheet, data)` hook fires before the sheet resolves a drop; `dropItemSheetData(item, sheet, data)` (v14) does the same for `ItemSheetV2`. Both use `Hooks.call`, so returning `false` cancels the default handling:

```js
Hooks.on("dropActorSheetData", (actor, sheet, data) => {
  if (data.type === "JournalEntry") {
    console.log(`Journal "${data.uuid}" dropped onto ${actor.name}`);
  }
});

Hooks.on("dropItemSheetData", (item, sheet, data) => {
  if (data.type === "ActiveEffect" && item.type === "consumable") return false;
});
```

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

---

## 10. Drag & Drop Deep Dive

The basic `_onDropItem` override in section 9 covers the common "Item → Actor" case. Real systems and modules need more: cross-document drops (Folder → Sheet, JournalEntry → Sheet), canvas drops (sidebar Actor → Scene), drag previews, and custom drag sources inside a sheet.

### `dataTransfer` Payload Convention

Foundry sets a single string on `event.dataTransfer` under the `application/json` (or `text/plain` fallback) MIME type. The payload always has at least `{ type, uuid }`:

```javascript
{ type: "Item", uuid: "Actor.abc.Item.def" }
{ type: "Actor", uuid: "Actor.abc" }
{ type: "Folder", uuid: "Folder.xyz", documentName: "Item" }
{ type: "JournalEntry", uuid: "JournalEntry.qrs" }
{ type: "ActiveEffect", uuid: "Actor.abc.ActiveEffect.tuv" }
```

Read it consistently:

```javascript
const TextEditor = foundry.applications.ux.TextEditor.implementation;
const data = TextEditor.getDragEventData(event);
// => { type: "Item", uuid: "..." }
const doc = await fromUuid(data.uuid);
```

`TextEditor.getDragEventData` handles the JSON parse, MIME fallback, and base64 edge cases. Always use it instead of `event.dataTransfer.getData` directly. Documents produce this payload with `document.toDragData()`.

### Per-Document-Type Drop Handlers

`ActorSheetV2#_onDrop` resolves the payload and dispatches through `_onDropDocument(event, document)` — override the handler you need:

| Override | Fires when |
|---|---|
| `_onDropItem(event, item)` | An Item document is dropped |
| `_onDropActor(event, actor)` | An Actor is dropped (default: no-op) |
| `_onDropFolder(event, folder)` | A Folder of documents is dropped (default: no-op) |
| `_onDropActiveEffect(event, effect)` | An ActiveEffect is dropped |
| `_onDrop(event)` | Entry point — override for non-document payloads |

`ItemSheetV2` only dispatches `_onDropActiveEffect`; everything else resolves to `null`. Each handler returns the resulting document, or `null` when it took no action.

### Folder Drops (Multi-Document Import)

```javascript
async _onDropFolder(event, folder) {
  if (folder.type !== "Item") return null; // wrong document kind
  const items = folder.contents.map(i => i.toObject());
  await this.document.createEmbeddedDocuments("Item", items);
  ui.notifications.info(`Imported ${items.length} items from "${folder.name}".`);
}
```

Always validate `folder.type` matches the embedded collection — a Scene folder dropped on an Actor sheet should be rejected, not imported.

### Canvas Drops (Sidebar → Scene)

Canvas drops bypass sheets entirely. Hook `dropCanvasData` to react to a sidebar Actor being dragged onto the scene:

```javascript
Hooks.on("dropCanvasData", (canvas, data) => {
  if (data.type !== "Item") return true; // let core handle
  // Custom: drop an Item to spawn a loot pile
  createLootPile(data.uuid, { x: data.x, y: data.y });
  return false; // suppress core drop
});
```

The hook receives `{ x, y }` in canvas (world) coordinates already. Return `false` to suppress the default behavior.

### Drag Sources Inside a Sheet

Make sheet items draggable so users can drag from one sheet to another, or to the hotbar. On `ActorSheetV2` the built-in `DragDrop` already watches `.draggable` elements and the default `_onDragStart` reads `data-item-id` / `data-effect-id` from the drag target:

```hbs
<li class="item draggable" draggable="true" data-item-id="{{item.id}}">
  {{item.name}}
</li>
```

For a plain `ApplicationV2` (no sheet base class), build the `DragDrop` yourself:

```javascript
async _onRender(context, options) {
  await super._onRender(context, options);
  const dragDrop = new foundry.applications.ux.DragDrop.implementation({
    dragSelector: ".item[draggable='true']",
    dropSelector: ".inventory",
    permissions: {
      dragstart: () => this.isEditable,
      drop: () => this.isEditable,
    },
    callbacks: {
      dragstart: this.#onDragStart.bind(this),
      drop: this._onDrop.bind(this),
    },
  });
  dragDrop.bind(this.element);
}

#onDragStart(event) {
  const id = event.currentTarget.dataset.itemId;
  const item = this.document.items.get(id);
  if (!item) return;
  event.dataTransfer.setData("application/json", JSON.stringify({
    type: "Item",
    uuid: item.uuid,
  }));
}
```

The `DragDrop` helper manages event listeners, permission checks, and target matching — much cleaner than rolling your own.

### Custom Drag Preview

The default drag preview is the dragged element. To customize:

```javascript
#onDragStart(event) {
  // ...payload setup...
  const preview = document.createElement("div");
  preview.className = "drag-preview";
  preview.textContent = item.name;
  document.body.appendChild(preview);
  event.dataTransfer.setDragImage(preview, 10, 10);
  // Clean up after the browser captures the image
  setTimeout(() => preview.remove(), 0);
}
```

The setTimeout is required — the browser snapshots the element on the next frame. Removing it synchronously gives an empty preview.

### Cross-Sheet Item Move (Source Cleanup)

The basic example in section 9 transfers an item between actors but leaves a race condition: if `createEmbeddedDocuments` succeeds and `deleteEmbeddedDocuments` fails (network, permissions), the item is duplicated. Sequence them and roll back on failure:

```javascript
async _onDropItem(event, item) {
  if (!item.parent || item.parent.id === this.document.id) {
    return super._onDropItem(event, item);
  }
  let created;
  try {
    [created] = await this.document.createEmbeddedDocuments("Item", [item.toObject()]);
    await item.parent.deleteEmbeddedDocuments("Item", [item.id]);
    return created;
  } catch (err) {
    if (created) await this.document.deleteEmbeddedDocuments("Item", [created.id]);
    ui.notifications.error("Item transfer failed; rolled back.");
    throw err;
  }
}
```

For cross-client transfers (player A → player B), the GM must mediate via socket. Use `socketlib` or the GM-authoritative socket pattern from `references/sockets-rolls-packs.md`.

---

## 11. Async Patterns & Race Conditions

Foundry's CRUD methods are async. Most data corruption bugs come from running them concurrently when they should be sequential, or sequentially when they could be batched.

### Always `await` Document CRUD

```javascript
// Wrong — concurrent. Final state is undefined.
actor.update({ "system.health": 10 });
actor.update({ "system.mana": 5 });

// Right — sequential. Each update sees the previous one.
await actor.update({ "system.health": 10 });
await actor.update({ "system.mana": 5 });

// Better — single update merges both fields atomically.
await actor.update({ "system.health": 10, "system.mana": 5 });
```

Never fire-and-forget Foundry CRUD. The hook chain assumes each operation completes before the next is scheduled.

### Batch Embedded CRUD

```javascript
// Wrong — N round trips, N hook chains.
for (const data of itemsToCreate) {
  await actor.createEmbeddedDocuments("Item", [data]);
}

// Right — one round trip, one hook chain.
await actor.createEmbeddedDocuments("Item", itemsToCreate);
```

The same applies to `updateEmbeddedDocuments` and `deleteEmbeddedDocuments` — the plural forms always batch.

### Sequencing in `_preCreate`

`_preCreate` is a chain — every override calls `super._preCreate` first, then adds its own changes via `updateSource`. Never fork the chain:

```javascript
// Wrong — super isn't awaited.
async _preCreate(data, options, user) {
  super._preCreate(data, options, user);
  this.updateSource({ "system.starterItems": [...] });
}

// Right — await super, then update source synchronously.
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);
  this.updateSource({ "system.starterItems": [...] });
}
```

`updateSource` is **synchronous** — it mutates the in-memory document before creation. Don't `await` it.

### Avoiding Render Loops

Updating the actor inside an `updateActor` hook can re-trigger the same hook:

```javascript
// DANGER — infinite loop if `myDerived` itself triggers updateActor.
Hooks.on("updateActor", async (actor, changes) => {
  if (!("system.power" in changes)) return;
  await actor.update({ "system.myDerived": actor.system.power * 2 });
});
```

Three fixes:
1. **Compute it in `prepareDerivedData`** — derived values shouldn't be persisted.
2. **Guard with `options.diff`** — skip if no real change happened.
3. **Use `_preUpdate` instead** — modify the changes object before the write commits.

```javascript
// Best: compute in-place during _preUpdate
async _preUpdate(changes, options, user) {
  if (foundry.utils.hasProperty(changes, "system.power")) {
    foundry.utils.setProperty(changes, "system.myDerived", changes.system.power * 2);
  }
  return super._preUpdate(changes, options, user);
}
```

### Debouncing High-Frequency Hooks

Token movement, ruler updates, and combat hooks fire dozens of times per second. Heavy work in those handlers freezes the UI. Debounce:

```javascript
const debouncedRefresh = foundry.utils.debounce(() => {
  myCustomHud.refresh();
}, 100);

Hooks.on("refreshToken", debouncedRefresh);
```

`foundry.utils.debounce` is built in. Use 50–200 ms for UI work; up to 1 s for non-time-critical bookkeeping.

### Awaiting Hook Consumers

`Hooks.callAll` is **synchronous** — it ignores async listeners. If you need consumers to finish before continuing, dispatch and `await` manually:

```javascript
const results = [];
Hooks.callAll("my-module.preDamage", actor, payload, (promise) => results.push(promise));
await Promise.all(results);
```

Or use `Hooks.call` (which does respect a `false` return for cancellation) and document that listeners should be sync. Most modules don't need this — `callAll` is enough for fire-and-forget notifications.

### `requestAnimationFrame` for Visual Updates

Pixi-based effects (token glows, particle bursts) belong inside `canvas.app.ticker` callbacks or `requestAnimationFrame`, not in update hooks. Update hooks fire when data changes; visual frames fire when the next paint is ready. Mixing them causes janky animations and dropped frames.

```javascript
let pending = false;
Hooks.on("refreshToken", (token) => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    drawCustomOverlay(token);
  });
});
```

The flag de-duplicates multiple hook fires per frame.

---

## 12. Header Controls, Frame Buttons and Detached Windows (v14)

### Header controls

The `window.controls` array feeds the "⋯" menu in the window header. Each entry is an `ApplicationHeaderControlsEntry`: a `ContextMenuEntry` (`label`, `icon`, `visible`, `onClick`) plus an `action` name that maps to `DEFAULT_OPTIONS.actions`. `DocumentSheetV2` entries may also set `ownership` to hide the control below a `CONST.DOCUMENT_OWNERSHIP_LEVELS` value.

```js
static DEFAULT_OPTIONS = {
  window: {
    controls: [{
      icon: "fa-solid fa-file-export",
      label: "MY_MODULE.Export",        // localized for you
      action: "export",
      visible: function () { return game.user.isGM; }   // called with `this` = the app
    }]
  },
  actions: { export: MyApp.#onExport }
};
```

**Changed in v14:** entries use `label` / `visible` / `onClick`; the v13 names `name` / `condition` / `callback` are deprecated until v16. `DEFAULT_OPTIONS` arrays concatenate along the inheritance chain, so every app inherits the core "Detach" and "Attach" controls. Override `_getHeaderControls()` to filter them, or listen to the `getHeaderControls<Class>` hook (`(app, controls)`) to edit another app's menu.

### Frame buttons

`_getFrameButtons(options)` returns entries rendered as icon buttons directly in the header, next to the close button (template `templates/generic/frame-buttons.hbs`). Core prefers header controls; use frame buttons for one or two high-traffic actions. `DocumentSheetV2` adds "Copy UUID" and, when `canImport` applies, "Import" this way.

```js
_getFrameButtons(options) {
  const buttons = super._getFrameButtons(options);
  buttons.push({ icon: "fa-solid fa-dice-d20", label: "MY_MODULE.RollAll", action: "rollAll" });
  return buttons;
}
```

### Detached windows

Any framed application can move into its own browser window. Users pick "Detach" from the header menu; code can do the same:

```js
await app.detachWindow();                 // render({ window: { detached: true } })
await app.attachWindow();                 // back into the main workspace
await app.renderChild(childApp);          // render childApp in the same window as app
app.parent;                               // ApplicationV2|null, set by renderChild
app.children;                             // Map<string, ApplicationV2>
app.window.windowId;                      // id of the hosting detached window, undefined when attached
```

Behaviour:
- `renderChild` keeps the child in the parent's window; it follows the parent on detach/attach, and closing the parent closes the child.
- `detachWindow()` on a child breaks the parent link; `attachWindow()` first tries to rejoin the prior parent.
- `_canDetach()` / `_canAttach()` gate the default controls. Override them to opt out (return `false` from `_canDetach`).
- `_onDetach(from, to)` and `_onAttach(from, to)` run after the move.
- `_refit(positionUpdate)` re-measures a non-resizable app after its content changes; in a detached window it also resizes the browser window.
- `render({ window: { windowId } })` targets an existing detached window.

Write DOM code against `this.element.ownerDocument` rather than the global `document` — the app may not live in the main page. Custom elements that can be adopted across documents should extend `foundry.applications.elements.AdoptableHTMLElement` (all core form elements do) so Firefox keeps their prototype.

`foundry.applications.detached` is the `DetachedWindowManager` singleton: `windows` (Map of open windows), `focused`, `openWindow({id, position, timeout, source})`, `checkEmpty(win)`, `adoptNodes`, `importNodes`, `copyAttributes`, `querySelector(selector)` / `querySelectorAll(selector)` across every window. Hooks `openDetachedWindow(id, win)` and `closeDetachedWindow(id, win)` fire when windows open and close. The popup loads `templates/detached/index.html`, and `Game#configureUI` copies theme attributes onto each detached window's `<html>`/`<body>`.
