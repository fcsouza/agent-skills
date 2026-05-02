# Chat & UI Extensions

Deep reference for Foundry VTT v13's chat system, context menus, rich text processing, and FilePicker API.

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

// Blind roll — GM sees result, player sees "Rolled privately"
await ChatMessage.create({
  content: "<p>Perception: 18</p>",
  speaker: ChatMessage.getSpeaker({ actor }),
  blind: true
});

// Roll chat card via Roll.toMessage()
const roll = new Roll("2d6 + @mod", { mod: 3 });
await roll.evaluate();
await roll.toMessage({
  speaker: ChatMessage.getSpeaker({ actor }),
  flavor: "Damage Roll"
});

// Retrieve messages
const recent = game.messages.contents.slice(-10);   // last 10 messages
const specific = game.messages.get("messageId");
```

`ChatMessage.getSpeaker()` accepts `{ actor, token, alias }`. When called without arguments, it uses the current user's character.

---

## 2. Custom Slash Commands

Intercept chat input before a message is created to register custom `/commands`.

```js
Hooks.on("chatMessage", (chatLog, content, data) => {
  // Parse custom command
  const match = content.match(/^\/mycommand\s+(.+)$/i);
  if (!match) return true;   // not our command — pass through

  const args = match[1].trim().split(/\s+/);
  const [target, ...rest] = args;

  // Build output
  const html = `<div class="my-module-command">
    <h3><i class="fa-solid fa-wand-magic-sparkles"></i> My Command</h3>
    <p>Target: <strong>${target}</strong></p>
    <p>Args: ${rest.join(", ")}</p>
  </div>`;

  ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker()
  });

  return false;   // prevent the raw "/mycommand ..." text from posting
});
```

Return `false` to suppress the raw command text. Return `true` (or nothing) to let Foundry handle the message normally.

---

## 3. Chat Card Templates

### Interactive chat cards with action buttons

Create rich HTML chat cards that users can interact with:

```js
// Build and post an interactive card
async function postAbilityCheck(actor, ability) {
  const mod = actor.system.abilities[ability]?.mod ?? 0;
  const html = await renderTemplate("modules/my-module/templates/chat/ability-card.hbs", {
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

Wire up button clicks on chat cards via event delegation in the `ready` hook:

```js
Hooks.on("ready", () => {
  // Attach to the chat log container
  document.getElementById("chat-log")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const card = button.closest(".my-module-card");
    const messageId = card?.closest(".message")?.dataset.messageId;
    const message = game.messages.get(messageId);
    const flags = message?.flags["my-module"];

    if (action === "rollCheck" && flags) {
      const actor = game.actors.get(flags.actorId);
      if (!actor) return;
      const mod = actor.system.abilities[flags.ability]?.mod ?? 0;
      const roll = new Roll(`1d20 + ${mod}`);
      await roll.evaluate();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `${flags.ability.capitalize()} Check`
      });
    }
  });
});
```

### Injecting buttons into existing messages

Use `renderChatMessage` to add buttons to other modules' or system chat cards:

```js
Hooks.on("renderChatMessage", (message, html, data) => {
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

`html` in `renderChatMessage` is a native `HTMLElement` (not jQuery) in v13.

---

## 4. Context Menus (v13)

v13 renamed context menu hooks from the legacy `getChatLogEntryContext` / `getSidebarTabEntryContext` to per-document hooks.

### Actor sidebar context menu

```js
Hooks.on("getActorContextOptions", (entry, options) => {
  options.push({
    name: "MY_MODULE.ContextMenu.quickHeal",
    icon: '<i class="fa-solid fa-heart"></i>',
    condition: () => game.user.isGM,
    callback: async () => {
      const actor = entry.document ?? entry;
      await actor.update({ "system.health.value": actor.system.health.max });
      ui.notifications.info(`${actor.name} fully healed.`);
    }
  });
});
```

### Chat message context menu

```js
Hooks.on("getChatMessageContextOptions", (entry, options) => {
  options.push({
    name: "MY_MODULE.ContextMenu.pinMessage",
    icon: '<i class="fa-solid fa-thumbtack"></i>',
    callback: async () => {
      const message = entry.document ?? entry;
      await message.setFlag("my-module", "pinned", true);
    }
  });
});
```

### Item sidebar context menu

```js
Hooks.on("getItemContextOptions", (entry, options) => {
  options.push({
    name: "MY_MODULE.ContextMenu.duplicateToActor",
    icon: '<i class="fa-solid fa-copy"></i>',
    condition: () => game.user.isGM,
    callback: async () => {
      const item = entry.document ?? entry;
      // Duplicate the item to the selected actor
      const actor = canvas.tokens.controlled[0]?.actor;
      if (actor) await actor.createEmbeddedDocuments("Item", [item.toObject()]);
    }
  });
});
```

### v12 → v13 migration

| v12 Hook | v13 Hook |
|---|---|
| `getChatLogEntryContext` | `getChatMessageContextOptions` |
| `getSidebarTabEntryContext` (Actors) | `getActorContextOptions` |
| `getSidebarTabEntryContext` (Items) | `getItemContextOptions` |
| `getSidebarTabEntryContext` (Journals) | `getJournalEntryContextOptions` |
| `getSidebarTabEntryContext` (Scenes) | `getSceneContextOptions` |

---

## 5. TextEditor.enrichHTML

Foundry's rich text processing converts document references and inline rolls into interactive HTML.

### Basic usage

```js
// Enrich HTML with document link resolution
const enriched = await TextEditor.enrichHTML(actor.system.biography, {
  relativeTo: actor,                          // resolves @UUID relative to this document
  rollData: actor.getRollData(),              // makes @abilities.str etc. available
  async: true                                 // required for inline roll evaluation
});
```

### Content link syntax

```
@UUID[Actor.abc123]{Display Name}          → clickable link to a document
@UUID[Item.xyz789]                         → link with auto-resolved name
[[/roll 2d6 + @mod]]                       → deferred inline roll (click to roll)
[[/r 1d20 + @abilities.str]]               → shorthand for /roll
@Check[strength]{Strength Save}            → system-dependent (requires system support)
```

### Custom enrichers (v13)

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

### {{editor}} Handlebars helper

Use in sheet templates for rich text editing fields:

```hbs
{{! In your sheet template — v13 uses prose-mirror element }}
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
    enrichedBiography: await TextEditor.enrichHTML(this.document.system.biography, {
      relativeTo: this.document,
      rollData: this.document.getRollData(),
      async: true
    }),
    isEditable: this.isEditable
  };
}
```

---

## 6. FilePicker API

### Programmatic FilePicker

```js
// Open a file picker for images
new FilePicker({
  type: "image",
  current: actor.img,
  callback: (path) => {
    actor.update({ img: path });
  }
}).render(true);

// Audio picker
new FilePicker({
  type: "audio",
  callback: (path) => {
    game.settings.set("my-module", "ambientSound", path);
  }
}).render(true);
```

Available types: `"image"`, `"audio"`, `"video"`, `"imagevideo"`, `"font"`, `"folder"`, `"any"`.

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
// List files in a directory (no user interaction)
const result = await FilePicker.browse("data", "modules/my-module/assets");
console.log(result.files);   // array of file paths
console.log(result.dirs);    // array of subdirectory paths

// Browse S3 or other storage backends
const s3result = await FilePicker.browse("s3", "my-bucket/images");
```

---

## 7. Security & Authorization

### Permission levels

Foundry uses four permission tiers for document access:

```js
CONST.ENTITY_PERMISSIONS.NONE;      // 0 — no access
CONST.ENTITY_PERMISSIONS.LIMITED;   // 1 — see name/icon only
CONST.ENTITY_PERMISSIONS.OBSERVER;  // 2 — read-only full access
CONST.ENTITY_PERMISSIONS.OWNER;     // 3 — full read/write
```

### Setting permissions programmatically

```js
// Set default permission for all users, with specific override for one user
await actor.update({
  permission: {
    default: CONST.ENTITY_PERMISSIONS.OBSERVER,
    [someUserId]: CONST.ENTITY_PERMISSIONS.OWNER
  }
});
```

The `permission` object maps user IDs to levels. The `default` key sets the fallback for users without an explicit entry.

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

## 8. ProseMirror Editor (v13)

v13 replaces the `{{editor}}` Handlebars helper with the `<prose-mirror>` custom element.

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
    enrichedBiography: await TextEditor.enrichHTML(this.document.system.biography, {
      relativeTo: this.document,
      rollData: this.document.getRollData()
    }),
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
  const enriched = await TextEditor.enrichHTML(text);
  CONFIG.TextEditor.enrichers = CONFIG.TextEditor.enrichers.filter(c => c !== config);
  return enriched;
}
```

### v12 → v13 migration

| v12 | v13 |
|---|---|
| `{{editor content target="field" editable=editable}}` | `<prose-mirror name="field" editable="{{editable}}">{{{content}}}</prose-mirror>` |
| `target` attribute | `name` attribute |
| `engine="prosemirror"` param | ProseMirror is the only engine |
| Single helper call | Must wrap in `{{#if editable}}` with fallback |

---

## 9. UI Notifications

In-game toast notifications for user feedback. Never use browser `alert()` or `console.warn()` for user-facing messages.

```js
// Informational (blue)
ui.notifications.info("Item created successfully.");

// Warning (yellow)
ui.notifications.warn("You don't have enough gold for this purchase.");

// Error (red)
ui.notifications.error("Failed to save actor data.");

// With localization
ui.notifications.info(game.i18n.localize("MY_MODULE.Notifications.saved"));
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
