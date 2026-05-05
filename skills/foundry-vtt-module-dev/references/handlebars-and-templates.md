# Handlebars & Templates (Foundry-Specific)

Generic Handlebars syntax (`{{#if}}`, `{{#each}}`, partials, blocks) is documented at [handlebarsjs.com](https://handlebarsjs.com/guide/). This reference covers what Foundry adds: ~15 custom helpers, the v13 custom HTML elements that often replace them, the form-helper system, registration patterns, and the integration with ApplicationV2's PARTS.

---

## Foundry Helper Inventory

Helpers come pre-registered. Use them in any `.hbs` template.

| Helper | Example | Notes |
|---|---|---|
| `{{localize}}` | `{{localize "MY_MODULE.title"}}` | Looks up the i18n key. Returns the original key if missing. |
| `{{numberFormat}}` | `{{numberFormat actor.system.gold decimals=0}}` | Locale-aware number formatting. Options: `decimals`, `sign`. |
| `{{checked}}` | `<input type="checkbox" {{checked enabled}}>` | Emits `checked` attr if value is truthy. |
| `{{disabled}}` | `<button {{disabled isLocked}}>Save</button>` | Emits `disabled` attr if value is truthy. |
| `{{selected}}` | `<option {{selected (eq value "fire")}}>Fire</option>` | Emits `selected` attr — pair with `eq` helper. |
| `{{selectOptions}}` | `<select>{{selectOptions choices selected=current}}</select>` | Generates `<option>` list from a `{key: label}` object. Options: `selected`, `blank`, `localize`, `nameAttr`, `labelAttr`. |
| `{{filePicker}}` | `{{filePicker target="system.img" type="image"}}` | Renders a file-picker button. Often replaced by `<file-picker>` in v13. |
| `{{colorPicker}}` | `{{colorPicker name="system.color" value=color}}` | Color input. Replaced by `<color-picker>` in v13. |
| `{{rangePicker}}` | `{{rangePicker name="x" value=10 min=0 max=100}}` | Numeric slider with synced text input. |
| `{{editor}}` | `{{editor system.biography target="system.biography" editable=editable}}` | Mounts a ProseMirror editor. Replaced by `<prose-mirror>` in v13. |
| `{{enrichHTML}}` | `{{{enrichHTML system.description}}}` | Resolves `@UUID[…]`, `@Check[…]`, inline rolls. **Triple-stash required** — output is HTML. |
| `{{lookup}}` | `{{lookup CONFIG.MY_SYSTEM.abilities key}}` | Standard Handlebars helper, but useful with `CONFIG`. |
| `{{eq}}`, `{{ne}}`, `{{lt}}`, `{{gt}}`, `{{and}}`, `{{or}}`, `{{not}}` | `{{#if (gt value 10)}}` | Comparison and logic helpers Foundry registers globally. |
| `{{ifThen}}` | `{{ifThen isReady "Yes" "No"}}` | Inline ternary. |
| `{{concat}}` | `{{concat "MY_MODULE." key}}` | String concatenation, useful for dynamic i18n keys. |
| `{{formInput}}` | See "Form Helpers" below | High-level form input. |
| `{{formGroup}}` | See "Form Helpers" below | High-level field+label+hint wrapper. |
| `{{formField}}` | See "Form Helpers" below | Lower-level wrapper for custom widgets. |
| `{{numberInput}}` | `{{numberInput value name="qty" min=0 max=99 step=1}}` | Specialized number input with min/max/step. |
| `{{radioBoxes}}` | `{{radioBoxes "system.size" choices=sizes selected=current}}` | Radio button group from a `{key: label}` object. |
| `{{timeSince}}` | `{{timeSince timestamp}}` | Relative time string ("2 hours ago"). |
| `{{object}}` | `{{#with (object foo="bar")}} ... {{/with}}` | Inline object literal — useful inside `{{#with}}` or as a partial argument. |

**Default to triple-stash (`{{{ }}}`) for any helper that returns HTML** — `enrichHTML`, `editor`, anything that emits attributes. Double-stash escapes the output.

---

## Helpers vs v13 Custom HTML Elements

v13 ships 14 custom HTML elements that often replace the legacy helpers. The element approach is preferred for new code — elements integrate with the form-data lifecycle automatically, support `data-document-uuid` for live collaboration, and avoid the helper's HTML-string ceremony.

| Element | Replaces helper | Purpose |
|---|---|---|
| `<color-picker name="…" value="#ff0000">` | `{{colorPicker}}` | Color input (hex/rgb) |
| `<code-mirror name="…" value="…" language="javascript">` | (none) | Syntax-highlighted code editor — supports JavaScript, JSON, HTML, Markdown |
| `<document-embed uuid="JournalEntry.abc">` | (none) | Inline preview of a document by UUID |
| `<document-tags name="…" value="…">` | (none) | Multi-document picker (drag documents in to add) |
| `<enriched-content>{{description}}</enriched-content>` | partial overlap with `{{enrichHTML}}` | Auto-enriches `@UUID[…]`, `@Check[…]`, inline rolls in its inner HTML |
| `<file-picker name="…" type="image" value="…">` | `{{filePicker}}` | File selection with type filter (`image`/`audio`/`video`/`text`/`font`) |
| `<hue-slider name="…" value="0.5">` | (none) | Hue picker (0–1) for color customization |
| `<multi-checkbox name="…" value="…">` | (none) | Array-of-strings via checkbox grid |
| `<multi-select name="…" value="…">` | (none) | Multi-value select dropdown |
| `<prose-mirror name="…" value="…" toggled collaborate>` | `{{editor}}` | Rich text editor with optional view/edit toggle and live collab |
| `<range-picker name="…" value="50" min="0" max="100" step="1">` | `{{rangePicker}}` | Slider + synced numeric input |
| `<secret-block>...</secret-block>` | (none) | GM-only content; players see a redacted placeholder |
| `<string-tags name="…" value="…">` | (none) | Free-form multi-tag input (chips) |
| (`<form-element>` is the abstract base — never used directly in templates) | | |

When in doubt, check what `{{formInput}}` produces in DevTools — the helpers internally render these same elements.

**Notable attributes:**
- `data-document-uuid="{{actor.uuid}}"` on `<prose-mirror>` enables collaborative editing across clients
- `collaborate` (boolean) on `<prose-mirror>` opts the editor into the live-collab pipeline
- `language="json"` on `<code-mirror>` switches the syntax highlighter
- `secret` attribute or `<secret-block>` wrapper hides content from non-GM users

---

## Form Helpers

`{{formInput}}`, `{{formGroup}}`, and `{{formField}}` automate name/value binding for ApplicationV2 forms. They read the field schema (when given a DataModel field), generate the right input element (string/number/select/checkbox/file/color), and apply Foundry's standard CSS classes.

```hbs
{{!-- Full form group: label + hint + input --}}
{{formGroup
  (lookup systemFields "abilities.str")
  name="system.abilities.str"
  value=system.abilities.str
  hint="MY_MODULE.AbilityStrHint"
}}

{{!-- Just the input, no label/hint wrapper --}}
{{formInput
  (lookup systemFields "abilities.str")
  name="system.abilities.str"
  value=system.abilities.str
}}

{{!-- Custom widget inside the standard wrapper --}}
{{#formField label="MY_MODULE.CustomWidget" hint="MY_MODULE.CustomWidgetHint"}}
  <my-custom-widget value="{{system.custom}}"></my-custom-widget>
{{/formField}}
```

Pass `(lookup systemFields "<path>")` to give the helper the field definition — it reads `min`, `max`, `step`, `choices`, etc. directly from the DataModel schema. Inject `systemFields` from `_prepareContext`:

```javascript
async _prepareContext(options) {
  const ctx = await super._prepareContext(options);
  ctx.systemFields = this.document.system.schema.fields;
  return ctx;
}
```

This eliminates duplicating min/max/choices in the template.

---

## Custom Helpers and Partials

Register custom helpers and partials in `init`. They become available in every template afterward.

```javascript
Hooks.once("init", () => {
  // Custom helper
  Handlebars.registerHelper("formatModifier", (mod) => {
    if (typeof mod !== "number") return "";
    return mod >= 0 ? `+${mod}` : `${mod}`;
  });

  // Block helper (with body)
  Handlebars.registerHelper("times", function(n, options) {
    let result = "";
    for (let i = 0; i < n; i++) result += options.fn({ index: i });
    return result;
  });
});
```

Usage:

```hbs
{{formatModifier actor.system.abilities.str.mod}}

{{#times 3}}
  <div class="slot-{{index}}"></div>
{{/times}}
```

For partials, prefer Foundry's preloading — it fetches and registers them in one call:

```javascript
Hooks.once("init", async () => {
  await foundry.applications.handlebars.loadTemplates({
    "abilityRow": "modules/my-module/templates/parts/ability-row.hbs",
    "inventoryItem": "modules/my-module/templates/parts/inventory-item.hbs",
  });
});
```

```hbs
{{!-- Use the registered partial by name --}}
{{> abilityRow ability=str}}

{{!-- Or by full path (also works without preregistration; slower first time) --}}
{{> "modules/my-module/templates/parts/ability-row.hbs" ability=str}}
```

When you pass an object, naming the keys (as above) registers them as named partials. Passing a flat array of paths only preloads them into the cache — you have to use the full path in templates.

---

## Template Preloading & Cache

Foundry caches every template after first fetch. Subsequent `renderTemplate` calls are synchronous.

```javascript
// Force-load templates during init so the first render isn't blocked on network
await foundry.applications.handlebars.loadTemplates([
  "modules/my-module/templates/sheet.hbs",
  "modules/my-module/templates/dialog.hbs",
]);

// Later — synchronous after preload
const html = await foundry.applications.handlebars.renderTemplate(
  "modules/my-module/templates/sheet.hbs",
  { name: "Hero" }
);
```

ApplicationV2's PARTS system preloads templates declared in `static PARTS` automatically — you don't need to call `loadTemplates` for those.

For dev iteration, declare `flags.hotReload` in `module.json` with `"extensions": ["hbs"]` and the `"templates"` path. Foundry watches files, busts the cache, and re-renders open applications when an `.hbs` file changes.

```json
{
  "flags": {
    "hotReload": {
      "extensions": ["hbs", "css", "json"],
      "paths": ["templates", "styles", "lang"]
    }
  }
}
```

---

## Common Sheet Patterns

### Iterating embedded items

```hbs
<ul class="inventory">
  {{#each items as |item|}}
    <li class="item" data-item-id="{{item._id}}" draggable="true">
      <img src="{{item.img}}" alt="">
      <span>{{item.name}}</span>
      {{#if @root.editable}}
        <button data-action="deleteItem" aria-label="{{localize 'MY_MODULE.delete'}}">
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
        </button>
      {{/if}}
    </li>
  {{else}}
    <li class="empty">{{localize "MY_MODULE.NoItems"}}</li>
  {{/each}}
</ul>
```

`{{else}}` inside `{{#each}}` renders when the collection is empty — the cleanest way to handle empty states.

### Ownership-gated UI

```hbs
{{#if (gte ownership 3)}}
  <button data-action="adminAction">Admin only</button>
{{/if}}

{{!-- Or compute booleans in _prepareContext for cleaner templates --}}
{{#if isOwner}}
  <button data-action="edit">Edit</button>
{{/if}}
```

Computing booleans in `_prepareContext` (`ctx.isOwner = this.document.testUserPermission(game.user, "OWNER")`) keeps templates readable and centralizes the permission logic.

### Conditional flag rendering

```hbs
{{#if (lookup actor.flags "my-module.featured")}}
  <span class="featured-badge">{{localize "MY_MODULE.Featured"}}</span>
{{/if}}
```

### HTML descriptions with enrichment

```hbs
<div class="description">
  {{{enrichHTML system.description rollData=rollData secrets=isOwner}}}
</div>
```

`enrichHTML` resolves `@UUID[Item.abc]`, `@Check[strength]`, inline rolls, and secret blocks. `secrets=true` reveals secret blocks (for owner view only). Pass `rollData=actor.getRollData()` so inline rolls work.

---

## ApplicationV2 PARTS Integration

Each PART is rendered with its own template, but they all share the result of `_prepareContext`. To give a part its own data scoped to it, override `_preparePartContext`:

```javascript
static PARTS = {
  header: { template: "modules/my-module/templates/header.hbs" },
  inventory: { template: "modules/my-module/templates/inventory.hbs" },
};

async _prepareContext(options) {
  const ctx = await super._prepareContext(options);
  ctx.actor = this.document;
  ctx.systemFields = this.document.system.schema.fields;
  return ctx;
}

async _preparePartContext(partId, context, options) {
  const ctx = await super._preparePartContext(partId, context, options);
  if (partId === "inventory") {
    ctx.items = this.document.items.contents.sort((a, b) => a.sort - b.sort);
    ctx.totalWeight = ctx.items.reduce((sum, i) => sum + (i.system.weight ?? 0), 0);
  }
  return ctx;
}
```

Inside the part's template, `{{actor}}` and `{{items}}` are both available — global context plus part-specific additions.

---

## Pitfalls

1. **Double-stash on HTML output** — `{{enrichHTML system.bio}}` shows escaped HTML as text. Use `{{{enrichHTML system.bio}}}`.
2. **Partial referenced before preload** — first-render template fetch is async. If you reference a partial that hasn't been preloaded, the first render shows it broken. Always preload at `init`.
3. **`{{editor}}` outside `_renderHTML`** — ProseMirror needs the editor to be in the DOM before initialization. Helper-mounted editors work in ApplicationV2 because the framework handles the lifecycle; raw template strings rendered to `innerHTML` lose the editor.
4. **Helpers that error silently** — `{{localize}}` returns the key on miss, masking typos. Use `{{localize "MY_MODULE.title"}}` consistently and audit lang files.
5. **Form helpers without a `name` attribute** — `<file-picker>` and friends bind to form data via `name`. Without it, the value isn't submitted on close.
6. **Stale cache on hot reload** — if a template change isn't reflected, check that the path is under `flags.hotReload.paths` and the file is being written to the served directory (e.g., `dist/templates/...` if you have a build step).
7. **`@root` in deeply nested loops** — Handlebars' `@root` accesses the original context. Useful for ownership flags inside `{{#each items}} {{#each effects}}`. Don't overuse — recompute and inject in `_prepareContext` when possible.
8. **Mixing `<form-input>` element with `{{formInput}}` helper** — they produce nearly identical output but `{{formInput}}` returns a string while `<form-input>` is parsed at render time. Pick one approach per file for readability.
9. **Triple-stashing user input** — `{{{user.bio}}}` is an XSS vector if the bio contains script tags. Only triple-stash trusted Foundry-enriched HTML (`enrichHTML` already sanitizes) or output you've explicitly sanitized.
