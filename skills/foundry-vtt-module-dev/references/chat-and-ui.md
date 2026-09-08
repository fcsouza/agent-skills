# Chat & UI Extensions

Deep reference for Foundry VTT v14's chat system, context menus, rich text processing, and FilePicker API.

**Changed in v14:** roll modes became message modes (`CONFIG.ChatMessage.modes`, the `messageMode` create option, the `core.messageMode` setting); slash commands are registered in `ChatLog.CHAT_COMMANDS`; the chat input is a `<prose-mirror>` element, not a `<textarea>`; context menu entries use `label` / `visible` / `onClick`; TinyMCE is gone. See `foundry-vtt-module-dev/references/v14-migration.md` for the full list.

---

## 1. Chat Message Creation

```js
// Basic chat message
await ChatMessage.create({
  content: "<p>Hello from my module!</p>",
  speaker: ChatMessage.getSpeaker({ actor }),
  style: CONST.CHAT_MESSAGE_STYLES.OTHER   // IC, OOC, EMOTE, or OTHER
});

// Whisper to the GM
await ChatMessage.create({
  content: "<p>Secret information only the GM sees.</p>",
  speaker: ChatMessage.getSpeaker(),
  whisper: ChatMessage.getWhisperRecipients("GM")   // array of User IDs
});

// Apply a message mode instead of setting whisper/blind by hand (v14)
await ChatMessage.create({
  content: "<p>Perception: 18</p>",
  speaker: ChatMessage.getSpeaker({ actor })
}, { messageMode: "blind" });

// Roll chat card via Roll.toMessage()
const roll = new Roll("2d6 + @mod", { mod: 3 });
await roll.evaluate();
await roll.toMessage({
  speaker: ChatMessage.getSpeaker({ actor }),
  flavor: "Damage Roll"
}, { messageMode: "gm" });

// Retrieve messages
const recent = game.messages.contents.slice(-10);   // last 10 messages
const specific = game.messages.get("messageId");
```

`ChatMessage.getSpeaker()` accepts `{ actor, token, alias }`. When called without arguments, it uses the current user's character.

### Message modes (v14)

`CONFIG.ChatMessage.modes` replaces `CONFIG.Dice.rollModes`. Core ships five modes:

| Mode | Effect on the message data |
|---|---|
| `public` | `whisper` cleared, `blind: false` |
| `gm` | `whisper` set to the GM user ids unless already set, `blind: false` |
| `blind` | `whisper` set to the GM user ids unless already set, `blind: true` |
| `self` | `whisper` set to `[game.user.id]`, `blind: false` |
| `ic` | as `public`, plus `style: CONST.CHAT_MESSAGE_STYLES.IC` |

Pass `messageMode` in the create options and `ChatMessage#_preCreate` applies it. The old `rollMode` option still works but logs a deprecation warning and is mapped through `foundry.dice.Roll._mapLegacyRollMode` — removal in v16.

```js
// Apply a mode to a data object before creating the message
ChatMessage.applyMode(chatData, "gm");            // static — mutates and returns chatData
message.applyMode("self");                        // instance — updates the message source

// The user's current default
game.settings.get("core", "messageMode");         // "public" | "gm" | "blind" | "self" | "ic"
```

Add a mode of your own with a `handler` that shapes the data however you like:

```js
Hooks.once("init", () => {
  CONFIG.ChatMessage.modes.table = {
    label: "MY_MODULE.Modes.table",
    icon: "fa-solid fa-users",
    handler: chatData => {
      chatData.whisper = game.users.filter(u => u.active && !u.isGM).map(u => u.id);
      chatData.blind = false;
    }
  };
});
```

A mode that is not in `CONFIG.ChatMessage.modes` falls back to the user's `core.messageMode` setting. `ic` downgrades to `public` when the message has no speaker actor or token, or carries rolls.

---

## 2. Custom Slash Commands

Two ways in: register a pattern in `ChatLog.CHAT_COMMANDS` (v14), or intercept the `chatMessage` hook.

### ChatLog.CHAT_COMMANDS (preferred)

`ChatLog.CHAT_COMMANDS` is a static record of `{rgx, fn, mode, isRoll, isMultiline}` entries. Core registers `roll`, `gmroll`, `blindroll`, `selfroll`, `publicroll`, `ooc`, `ic`, `emote`, `gm`, `whisper`, `reply`, `players` and `macro` there. Add your own in `init`:

```js
Hooks.once("init", () => {
  foundry.applications.sidebar.tabs.ChatLog.CHAT_COMMANDS.summon = {
    rgx: /^(\/summon )([^]*)/i,
    isRoll: false,
    isMultiline: false,
    fn: function (command, match, chatData, createOptions) {
      // `this` is the ChatLog. `match` is the RegExp match.
      const name = match[2].trim();
      chatData.content = `<p>Summoning <strong>${foundry.utils.escapeHTML(name)}</strong>…</p>`;
      createOptions.messageMode = "gm";
    }
  };
});
```

`ChatLog#processMessage` calls your `fn`, then runs `ChatMessage.create(chatData, createOptions)`. So the handler mutates both objects in place; return `false` to stop message creation entirely. Set the message mode by writing `createOptions.messageMode` — the registry's `mode` key is only read automatically for roll commands (`isRoll: true`), where it also decides whether the dice can roll interactively. Set `isMultiline: true` to let the command run over several lines; writing to `ChatLog.MULTILINE_COMMANDS` or `ChatLog.MESSAGE_PATTERNS` is deprecated.

### The chatMessage hook

Still supported, and the right tool when you want to inspect every message rather than own a command:

```js
Hooks.on("chatMessage", (chatLog, message, { user, speaker }) => {
  const match = message.match(/^\/mycommand\s+(.+)$/i);
  if ( !match ) return;              // not our command — pass through

  ChatMessage.create({
    content: `<p>Target: <strong>${foundry.utils.escapeHTML(match[1])}</strong></p>`,
    speaker
  });

  return false;                      // prevent the raw "/mycommand ..." text from posting
});
```

The hook fires with the trimmed message string and `{user, speaker}`, not the old `data` object. Returning `false` suppresses the default message.

### The chat input is ProseMirror

`ui.chat`'s input is an `HTMLProseMirrorElement` (`#chat-message`), not a `<textarea>`. Handle keystrokes through the `chatInput(event, options)` hook — return `false` to take over, and set `options.recordPending = false` at the same time so chat history stays in sync.

The element dispatches a cancelable `plugins` event before it builds its editor, and `ChatLog` listens for it in `_onConfigurePlugins`. The editor is built when the element connects, which is earlier than `renderChatInput` — so subclass the ChatLog and set `CONFIG.ui.chat` rather than adding a listener from a render hook:

```js
class MyChatLog extends foundry.applications.sidebar.tabs.ChatLog {
  _onConfigurePlugins(event) {
    super._onConfigurePlugins(event);
    if ( !event.target.closest("#chat-message") ) return;
    event.plugins.myPlugin = new foundry.prosemirror.Plugin({ /* ... */ });
  }
}
Hooks.once("init", () => { CONFIG.ui.chat = MyChatLog; });
```

`event.plugins` is the plugin record (also `event.detail`); calling `event.preventDefault()` drops every plugin. The same event fires on every `<prose-mirror>` element, so filter on the target.

## 3. Chat Card Templates

### Interactive chat cards with action buttons

Create rich HTML chat cards that users can interact with:

```js
// Build and post an interactive card
async function postAbilityCheck(actor, ability) {
  const mod = actor.system.abilities[ability]?.mod ?? 0;
  const html = await foundry.applications.handlebars.renderTemplate("modules/my-module/templates/chat/ability-card.hbs", {
    actorName: actor.name,
    ability,
    mod,
    img: actor.img
  });

  await ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { "my-module": { ability, actorId: actor.id } }
  });
}
```

```hbs
{{! modules/my-module/templates/chat/ability-card.hbs }}
<div class="my-module-card">
  <header>
    <img src="{{img}}" width="36" height="36" />
    <h3>{{actorName}} — {{ability}} Check</h3>
  </header>
  <div class="card-body">
    <p>Modifier: {{#if (gte mod 0)}}+{{/if}}{{mod}}</p>
    <button type="button" data-action="rollCheck" data-ability="{{ability}}">
      <i class="fa-solid fa-dice-d20"></i> Roll
    </button>
  </div>
</div>
```

### Handling card button clicks

Bind the listener to the message element the render hook hands you. Do not query `document` for the chat log — messages also render in the notifications area, in a popped-out chat, and in detached windows, so a single global listener misses them.

```js
Hooks.on("renderChatMessageHTML", (message, html) => {
  const flags = message.flags["my-module"];
  if ( !flags ) return;

  html.addEventListener("click", async event => {
    const button = event.target.closest("[data-action='rollCheck']");
    if ( !button ) return;

    const actor = game.actors.get(flags.actorId);
    if ( !actor ) return;
    const mod = actor.system.abilities[flags.ability]?.mod ?? 0;
    const roll = new Roll(`1d20 + ${mod}`);
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${flags.ability.capitalize()} Check`
    });
  });
});
```

To reach chat DOM from outside a render hook, use `foundry.applications.detached.querySelectorAll(selector)`, which searches every open window rather than only the main page.

### Injecting buttons into existing messages

Use `renderChatMessageHTML` to add buttons to other modules' or system chat cards:

```js
Hooks.on("renderChatMessageHTML", (message, html, context) => {
  // Add a "Save to Journal" button to every chat message
  if (!game.user.isGM) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "saveToJournal";
  button.innerHTML = '<i class="fa-solid fa-book"></i>';
  button.title = game.i18n.localize("MY_MODULE.Chat.saveToJournal");
  button.addEventListener("click", () => saveMessageToJournal(message));
  html.querySelector(".message-content")?.appendChild(button);
});
```

`html` is a native `HTMLElement`. The third argument is the rendering context, and it is only passed when the core message template rendered the message. `renderChatMessage` (jQuery) still fires but is deprecated — removal in v16.

---

## 4. Context Menus

### Entry shape (changed in v14)

A `ContextMenuEntry` is `{label, icon, classes, group, visible, onClick}`. The v13 names `name`, `condition` and `callback` still work but log a deprecation warning — removal in v16.

| v13 | v14 |
|---|---|
| `name` | `label` |
| `condition` | `visible` (function or plain boolean) |
| `callback` | `onClick` |

`visible(target)` and `onClick(event, target)` both receive the row element the menu was opened on, not a document. Resolve the document from the element's dataset the way core does.

### Sidebar context menus

The hook is `get<DocumentName>ContextOptions` and it fires with `(application, menuItems)`.

```js
Hooks.on("getActorContextOptions", (app, entries) => {
  const getActor = li => game.actors.get(li.closest("[data-entry-id]").dataset.entryId);
  entries.push({
    label: "MY_MODULE.ContextMenu.quickHeal",
    icon: "fa-solid fa-heart",
    visible: li => game.user.isGM && getActor(li).isOwner,
    onClick: async (event, li) => {
      const actor = getActor(li);
      await actor.update({ "system.health.value": actor.system.health.max });
      ui.notifications.info("MY_MODULE.Notifications.healed", { format: { name: actor.name } });
    }
  });
});
```

`icon` takes a class string (a full HTML element also works). `label` is localized for you — pass the i18n key.

### Chat message context menu

```js
Hooks.on("getChatMessageContextOptions", (app, entries) => {
  entries.push({
    label: "MY_MODULE.ContextMenu.pinMessage",
    icon: "fa-solid fa-thumbtack",
    onClick: (event, li) => {
      const message = game.messages.get(li.closest("[data-message-id]").dataset.messageId);
      return message.setFlag("my-module", "pinned", true);
    }
  });
});
```

### Placeable context menus (v14)

Placeables on the canvas get their own menus. The Document name goes in the hook name — `getTokenPlaceableContextOptions`, `getWallPlaceableContextOptions`, and so on. A literal `getPlaceableContextOptions` never fires; that name is only the template used in the API docs.

```js
Hooks.on("getTokenPlaceableContextOptions", (app, entries) => {
  entries.push({
    label: "MY_MODULE.ContextMenu.markTarget",
    icon: "fa-solid fa-crosshairs",
    visible: () => game.user.isGM,
    onClick: () => canvas.tokens.controlled.forEach(t => t.setTarget(true, { releaseOthers: false }))
  });
});
```

### Building a menu yourself

```js
const menu = new foundry.applications.ux.ContextMenu.implementation(containerElement, ".entry", entries, {
  fixed: true,
  jQuery: false
});
```

Inside an `ApplicationV2`, call `this._createContextMenu(handler, selector, {hookName})` instead — it collects entries from your handler, fires the hook for every class in the inheritance chain, and returns the menu.

`ContextMenu.activateListeners(document)` wires the global close-on-click handler; the old `ContextMenu.eventListeners()` is deprecated until v16. `ContextMenu.create()` throws for ApplicationV2 instances — it only ever supported appv1. `foundry.applications.ux.FilterMenu` is a ContextMenu subclass for filter dropdowns: it opens on `click`, stays open when an entry is picked, and rebuilds its entries on every open from the `menuItems` callback you pass.

### Hook name migration

| v12 hook | v14 hook |
|---|---|
| `getChatLogEntryContext` | `getChatMessageContextOptions` |
| `getSidebarTabEntryContext` (Actors) | `getActorContextOptions` |
| `getSidebarTabEntryContext` (Items) | `getItemContextOptions` |
| `getSidebarTabEntryContext` (Journals) | `getJournalEntryContextOptions` |
| `getSidebarTabEntryContext` (Scenes) | `getSceneContextOptions` |

### Autocomplete menus

`foundry.applications.ux.Autocomplete` renders a drop-down of completions next to any element — the chat input uses it for `@` references.

```js
const ac = new foundry.applications.ux.Autocomplete({
  onSelect: (identifier, label, { prefix }) => console.log(identifier, label, prefix)
});
ac.activate(inputElement, [{ identifier: "Actor.abc", label: "Bandit" }], { prefix: "@" });
ac.select(1);      // move the highlight down
ac.commit();       // fire onSelect for the highlighted entry
ac.dismiss();      // close without selecting
```

Entries are `{identifier, label, disabled}`. The menu renders into the target element's own document, so it works inside detached windows.

## 5. TextEditor.enrichHTML

Foundry's rich text processing converts document references and inline rolls into interactive HTML.

### Basic usage

```js
const TextEditor = foundry.applications.ux.TextEditor.implementation;

const enriched = await TextEditor.enrichHTML(actor.system.biography, {
  relativeTo: actor,                          // resolves @UUID relative to this document
  rollData: actor.getRollData()               // makes @abilities.str etc. available
});
```

`EnrichmentOptions` are `secrets`, `documents`, `links`, `rolls`, `embeds`, `custom`, `rollData` and `relativeTo`. The `async` option is gone — `enrichHTML` is always async. The bare `TextEditor` global is a shim for `foundry.applications.ux.TextEditor.implementation`, removal in v15.

### Content link syntax

```
@UUID[Actor.abc123]{Display Name}          → clickable link to a document
@UUID[Item.xyz789]                         → link with auto-resolved name
[[/roll 2d6 + @mod]]                       → deferred inline roll (click to roll)
[[/r 1d20 + @abilities.str]]               → shorthand for /roll
@Check[strength]{Strength Save}            → system-dependent (requires system support)
```

### Custom enrichers

Register custom inline patterns via `CONFIG.TextEditor.enrichers`:

```js
Hooks.once("init", () => {
  CONFIG.TextEditor.enrichers.push({
    // Pattern: @Check[ability]{label} — e.g. @Check[strength]{Strength Save}
    pattern: /@Check\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: (match, options) => {
      const [full, ability, label] = match;
      const anchor = document.createElement("a");
      anchor.classList.add("check-link");
      anchor.dataset.ability = ability;
      anchor.innerHTML = `<i class="fa-solid fa-dice-d20"></i> ${label ?? `${ability} Check`}`;
      anchor.addEventListener("click", async () => {
        const actor = options.relativeTo?.actor ?? options.relativeTo;
        const rollData = options.rollData ?? actor?.getRollData() ?? {};
        const mod = rollData.abilities?.[ability]?.mod ?? 0;
        const roll = new Roll(`1d20 + ${mod}`);
        await roll.evaluate();
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `${ability.capitalize()} Check`
        });
      });
      return anchor;
    }
  });
});
```

Now `@Check[strength]{Strength Save}` in any enriched HTML becomes a clickable roll link.

### Document embed handlers (v14)

`CONFIG.<DocumentName>.embedHandlers` is an array of callbacks that post-process every `@Embed[...]` result for that document type. Each handler gets `(doc, content, config, options)` and returns the element to use, or `null` to block the embed:

```js
Hooks.once("init", () => {
  CONFIG.JournalEntryPage.embedHandlers.push((page, content, config) => {
    if ( !content || !page.getFlag("my-module", "spoiler") ) return content;
    content.classList.add("my-module-spoiler");
    return content;
  });
});
```

Handlers run in registration order, each receiving the previous handler's output. `Document#toEmbed` wraps the final result as an inline span or a `<figure>` unless the handler already returned an `HTMLDocumentEmbedElement`.

### {{editor}} Handlebars helper

Use in sheet templates for rich text editing fields:

```hbs
{{! In your sheet template }}
{{#if isEditable}}
  <prose-mirror name="system.biography" button="true" editable="{{isEditable}}" toggled="false" value="{{system.biography}}">
    {{{enrichedBiography}}}
  </prose-mirror>
{{else}}
  {{{enrichedBiography}}}
{{/if}}
```

The `enrichedBiography` context variable must be pre-enriched in `_prepareContext`:

```js
async _prepareContext(options) {
  return {
    enrichedBiography: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.document.system.biography,
      { relativeTo: this.document, rollData: this.document.getRollData() }
    ),
    isEditable: this.isEditable
  };
}
```

---

## 6. FilePicker API

### Programmatic FilePicker

```js
const FilePicker = foundry.applications.apps.FilePicker.implementation;

// Open a file picker for images
new FilePicker({
  type: "image",
  current: actor.img,
  callback: path => actor.update({ img: path })
}).render({ force: true });

// Audio picker
new FilePicker({
  type: "audio",
  callback: path => game.settings.set("my-module", "ambientSound", path)
}).render({ force: true });
```

`FilePicker` is an `ApplicationV2`, so it takes `render({force: true})`. `FilePicker.FILE_TYPES` lists the accepted `type` values: `"any"`, `"audio"`, `"folder"`, `"font"`, `"graphics"`, `"image"`, `"imagevideo"`, `"text"`, `"texture"`, `"video"`.

`"texture"` (v14) is images plus video plus `.basis` and `.ktx2` — use it for anything that ends up on the canvas as a PIXI texture. `"graphics"` covers 3D model formats (`fbx`, `glb`, `gltf`, `mtl`, `obj`, `stl`, `usdz`).

### Auto-wired pickers in templates

In `DocumentSheetV2` templates, add `data-edit` to any `<img>` element to make it clickable — clicking opens a FilePicker that automatically updates the document field:

```hbs
{{! Clicking this image opens a FilePicker that updates actor.img }}
<img src="{{actor.img}}" data-edit="img" />

{{! For nested fields, use the full dot-path }}
<img src="{{system.portrait}}" data-edit="system.portrait" />
```

`data-edit="img"` is a shorthand for `data-edit="img"` on the document root. For any other field, use the full path: `data-edit="system.details.portrait"`.

### Programmatic browsing

```js
const FilePicker = foundry.applications.apps.FilePicker.implementation;

// List files in a directory (no user interaction)
const result = await FilePicker.browse("data", "modules/my-module/assets");
console.log(result.files);   // array of file paths
console.log(result.dirs);    // array of subdirectory paths

// Browse S3 or other storage backends
const s3result = await FilePicker.browse("s3", "my-bucket/images");
```

### Fetching a file as a Blob

`foundry.utils.fetchResource(src, {bustCache})` fetches a URL and returns a `Blob`, retrying once with a cache-busting query parameter when CORS fails. It replaces `TextureLoader.fetchResource`, which is deprecated until v16.

```js
const blob = await foundry.utils.fetchResource("modules/my-module/data/table.json");
const data = JSON.parse(await blob.text());
```

---

## 7. Security & Authorization

### Permission levels

Foundry uses four permission tiers for document access:

```js
CONST.DOCUMENT_OWNERSHIP_LEVELS.INHERIT;   // -1 — inherit from the parent Folder
CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;      //  0 — no access
CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED;   //  1 — see name/icon only
CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;  //  2 — read-only full access
CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;     //  3 — full read/write
```

`CONST.ENTITY_PERMISSIONS` no longer exists. `CONST.DOCUMENT_META_OWNERSHIP_LEVELS` adds two UI-only values that are never stored: `DEFAULT` (-20) and `NOCHANGE` (-10).

### Setting permissions programmatically

```js
// Set default ownership for all users, with a specific override for one user
await actor.update({
  ownership: {
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
    [someUserId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
  }
});
```

The field is `ownership` (a `DocumentOwnershipField`). It maps user IDs to levels; the `default` key sets the fallback for users without an explicit entry.

### Editability in ApplicationV2

`this.isEditable` on any `DocumentSheetV2` / `ActorSheetV2` encapsulates whether the current user has Owner permission:

```js
class HeroSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  _canDragDrop(selector) {
    return this.isEditable;
  }

  _canDragStart(selector) {
    return this.isEditable;
  }
}
```

In templates, use `isEditable` to disable inputs:

```hbs
<input type="number" name="system.health.value" value="{{system.health.value}}"
  {{unless isEditable "disabled"}} />
```

### GM-only execution

```js
// Guard any GM-only logic
if (!game.user.isGM) return;

// Check for active GM
const activeGM = game.users.activeGM;
if (!activeGM) return ui.notifications.warn("No GM connected.");
```

### Socket security (CRITICAL)

Non-GM clients cannot modify world documents. The GM proxy pattern validates all mutations:

```js
Hooks.once("ready", () => {
  game.socket.on("module.my-module", async (data) => {
    if (!game.user.isGM) return;

    // Validate the request before executing
    if (data.type === "updateActor") {
      const actor = game.actors.get(data.actorId);
      if (!actor) return;

      // Check that the requesting user owns the document
      const user = game.users.get(data.userId);
      if (!user || !actor.testUserPermission(user, "OWNER")) {
        console.warn(`User ${data.userId} lacks permission to modify ${actor.name}`);
        return;
      }

      await actor.update(data.changes);
    }
  });
});
```

**Never trust client-side data.** Always validate:
- The document exists
- The requesting user has appropriate permission
- The changes are within expected bounds

### testUserPermission

```js
// Check if a user has at least OBSERVER access
const canView = actor.testUserPermission(game.user, "OBSERVER");

// Check if the current user is an owner
const canEdit = actor.isOwner;
```

---

## 8. ProseMirror Editor

ProseMirror is the only bundled rich-text editor. TinyMCE is gone from v14: nothing loads it, `CONFIG.TextEditor.engines` is empty by default, and code that assumed a TinyMCE instance breaks. Use the `<prose-mirror>` custom element instead of the `{{editor}}` helper.

### Template pattern

```hbs
{{#if editable}}
  <prose-mirror
    name="system.biography"
    button="true"
    editable="{{editable}}"
    toggled="false"
    value="{{system.biography}}">
    {{{enrichedBiography}}}
  </prose-mirror>
{{else}}
  {{{enrichedBiography}}}
{{/if}}
```

The `{{#if editable}}` wrapper with a plain HTML fallback is **mandatory** — the element only works in edit mode.

### Attributes

| Attribute | Type | Purpose |
|---|---|---|
| `name` | string | Data path for saving (replaces `target` from v12 `{{editor}}`) |
| `button` | "true"/"false" | Show the edit toggle button |
| `editable` | string | Whether the editor is active |
| `toggled` | "true"/"false" | Initial toggle state |
| `value` | string | Current data value |

### Preparing enriched HTML in _prepareContext

```js
async _prepareContext(options) {
  return {
    enrichedBiography: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.document.system.biography,
      { relativeTo: this.document, rollData: this.document.getRollData() }
    ),
    editable: this.isEditable
  };
}
```

### Custom enrichers

Register inline text patterns via `CONFIG.TextEditor.enrichers`:

```js
Hooks.once("init", () => {
  CONFIG.TextEditor.enrichers.push({
    pattern: /@MyRef\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: async (match, options) => {
      const [full, key, label] = match;
      const anchor = document.createElement("a");
      anchor.classList.add("my-ref-link");
      anchor.dataset.key = key;
      anchor.textContent = label ?? key;
      return anchor;
    },
    replaceParent: false
  });
});
```

Rules:
- Enrichers run **after** default enrichers (`@UUID`, `[[/roll]]`, etc.)
- They only have access to text nodes within the HTML
- To override a default enricher, disable it first and provide a replacement

### Temporary enricher pattern

For one-shot enrichment without global side effects:

```js
async function enrichWithCustom(text) {
  const config = {
    pattern: /@MyRef\[([^\]]+)\]/g,
    enricher: async (match) => { /* ... */ },
    replaceParent: false
  };

  CONFIG.TextEditor.enrichers.push(config);
  const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(text);
  CONFIG.TextEditor.enrichers = CONFIG.TextEditor.enrichers.filter(c => c !== config);
  return enriched;
}
```

### Building an editor in code

```js
const editor = await foundry.applications.ux.ProseMirrorEditor.create(targetElement, content, {
  document: this.document,
  fieldName: "system.biography",
  collaborate: true,
  relativeLinks: true,
  plugins: { myPlugin }        // merged over ProseMirrorEditor.buildDefaultPlugins()
});
```

`ProseMirrorEditor.buildDefaultPlugins()` returns the standard plugin record — input rules, key maps, menu, dirty tracking, click handler, paste transformer, base key map, drop cursor, gap cursor, plus a reserved `chatInput` slot. Call it, edit the record, and hand it back through `plugins`.

**Changed in v14:** the constructor is `new ProseMirrorEditor(uuid, view, options)`. The old `(uuid, view, isDirtyPlugin, collaborate, options)` form still works with a warning — removal in v16. Pass `collaborate` inside `options`.

### Custom editor engines

`CONFIG.TextEditor.engines` maps an engine name to `{create, render}`. `create({options, initialContent})` builds the instance; `render({editable, ...})` returns the markup used by `createEditorInput` and the `{{editor}}` helper. Registering an engine is the only supported route back to a non-ProseMirror editor.

### ProseMirror inserts

`CONFIG.TextEditor.inserts` adds entries to the editor's insert menu. Each is `{action, title, inline, html, children}`; `<selection></selection>` inside `html` marks where the current selection goes.

```js
Hooks.once("init", () => {
  CONFIG.TextEditor.inserts.push({
    action: "readaloud",
    title: "MY_MODULE.Inserts.readaloud",
    html: `<div class="readaloud"><selection><blockquote>Read this aloud.</blockquote></selection></div>`
  });
});
```

Group several inserts under one menu entry by giving a parent entry a `children` array.

### Migrating off `{{editor}}`

`{{editor content target="field" editable=editable}}` becomes `<prose-mirror name="field" editable="{{editable}}">{{{content}}}</prose-mirror>`, wrapped in `{{#if editable}}` with a plain-HTML fallback. `target` is now `name`, and `engine="tinymce"` has nowhere to go.

---

## 9. UI Notifications

In-game toast notifications for user feedback. Never use browser `alert()` or `console.warn()` for user-facing messages.

```js
ui.notifications.info("Item created successfully.");
ui.notifications.success("Saved.");                                  // green
ui.notifications.warn("You don't have enough gold for this purchase.");
ui.notifications.error("Failed to save actor data.", { permanent: true });

// Localize the key rather than localizing it yourself
ui.notifications.info("MY_MODULE.Notifications.saved", { localize: true });

// Fill {placeholders} from the format object — values are HTML-escaped
ui.notifications.warn("MY_MODULE.Notifications.lowHealth", { format: { name: actor.name } });
```

Options: `localize`, `format`, `permanent`, `progress`, `console`, `escape`, `clean`. Passing `format` implies localization, so `localize` is unnecessary alongside it. A progress notification returns a handle you update as work proceeds:

```js
const progress = ui.notifications.info("MY_MODULE.Import.running", { localize: true, progress: true });
progress.update({ pct: 0.5, message: "MY_MODULE.Import.half", localize: true });
progress.update({ pct: 1 });
```

### Tooltips

Add tooltips to any HTML element via the `data-tooltip` attribute:

```hbs
<button type="button" data-action="rollAbility" data-ability="strength"
  data-tooltip="{{localize 'MY_MODULE.Tooltip.rollStrength'}}">
  <i class="fa-solid fa-dice-d20"></i>
</button>
```

Tooltips auto-position and auto-localize. They replace the need for `title` attributes in Foundry UI.
