# Styling & Themes

System CSS is where most of your user's eyes spend time — character sheets, item sheets, chat cards. The patterns below are extracted from the two largest production Foundry systems (`foundryvtt/dnd5e` and `foundryvtt/pf2e`) and codify what works at scale on v14.

This is **system-specific** advice. The module skill's [accessibility.md](../../foundry-vtt-module-dev/references/accessibility.md) and the cascade-layers concepts apply equally to module CSS, but systems have unique scope, sheet density, and theming concerns that modules don't share.

The theming mechanism did not change in v14. Cascade layers, body classes and `.themed` all work exactly as they did in v13; the changes are new custom properties, detached windows, and Font Awesome 7.

---

## The Big Picture

Every shipping system follows the same nine rules:

1. **Single compiled CSS file** declared in `system.json` `styles[]` — never list individual partials.
2. **Marker class** on every Application root (`.my-system`) added via `DEFAULT_OPTIONS.classes`.
3. **Component CSS is unlayered.** It naturally wins against Foundry's base/applications layers without specificity hacks.
4. **CSS custom properties are the abstraction** — not preprocessor mixins.
5. **Two variable strategies coexist:** namespace your own (`--my-system-*`) **and** override Foundry's core variables (`--color-text-*`) for skinning.
6. **Body-class theming** — `body.theme-light` / `body.theme-dark` (Foundry's convention; there is no `data-theme` attribute, and your CSS should not query `prefers-color-scheme` itself).
7. **`.themed.theme-{light,dark}`** scope for popouts and per-application theme overrides.
8. **Per-version sheet folders** — keep AppV1 styles in `v1/`, AppV2 styles in `v2/` if you support both.
9. **Sheet scoping by document chain** — `.my-system.sheet.actor.character`.

---

## Manifest Declaration

```json
{
  "styles": ["styles/my-system.css"]
}
```

One compiled artifact. The LESS/SCSS source is never listed here; only the build output. Pair with hot reload:

```json
{
  "flags": {
    "hotReload": {
      "extensions": ["css", "hbs", "json"],
      "paths": ["styles/my-system.css", "templates", "lang"]
    }
  }
}
```

Foundry watches the file and live-reloads the page's stylesheet when it changes.

---

## Marker Class via `DEFAULT_OPTIONS.classes`

Every Application your system renders should carry a system marker class. ApplicationV2 makes this declarative:

```javascript
class CharacterSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["my-system", "sheet", "actor", "character"],
    // ...
  };
}
```

Foundry concatenates these onto the root `<form>` / `<section>` element. Your CSS then chains:

```less
.my-system.sheet { /* all sheets */ }
.my-system.sheet.actor { /* all actor sheets */ }
.my-system.sheet.actor.character { /* character only */ }
.my-system.sheet.item.weapon { /* weapon items only */ }
```

The pattern keeps every selector self-scoping. No global rules, no specificity wars.

---

## Cascade Layers

Foundry declares the following layer order in its core CSS (`public/css/foundry2.css`), unchanged from v13:

```css
@layer reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions;
```

That's left-to-right priority — later layers win against earlier ones. **Two slots exist specifically for downstream consumers: `system` and `modules`.** A system can put its CSS in `@layer system` and it will automatically beat `applications` (Foundry's app styles) without needing higher specificity. Modules go in `@layer modules` to layer above systems by default.

You have **two valid strategies** for system CSS:

### Strategy A — Use the official `@layer system` slot

```less
// styles/main.less
@import "variables/base";       // @layer variables
@import "variables/themes";     // @layer variables

@layer system {
  @import (reference) "v2/sheets.less";   // hoists rules into @layer system
  @import (reference) "v2/character.less";
  @import (reference) "v2/chat.less";
}
```

This is the **most idiomatic** approach: every rule lives in a known layer slot, and modules that want to override your system explicitly use `@layer modules` (or unlayered) to win cleanly.

### Strategy B — Leave component CSS unlayered (the dnd5e pattern)

```less
// styles/main.less
@import "variables/base";       // @layer variables
@import "variables/themes";     // @layer variables

// UNLAYERED — wins against ALL Foundry layers (including @layer modules and @layer system)
@import "v2/sheets";
@import "v2/character";
@import "v2/chat";
```

Unlayered rules beat layered rules at the same specificity tier — so unlayered system CSS wins against everything Foundry put in `@layer applications`, `@layer system`, even `@layer exceptions`.

### Which to Pick

| If… | Use |
|---|---|
| You want predictable interop with modules — modules can override you cleanly via unlayered or `@layer modules` | **Strategy A (`@layer system`)** |
| You want maximum control and want your system's chrome to be hard to override | **Strategy B (unlayered)** — what dnd5e does |
| You're building a system meant to be highly customizable by modules | **Strategy A** |
| You want what works without thinking too hard | **Strategy A** is the design intent — Foundry added the slot for systems to use |

The boilerplate ships **Strategy B** (unlayered) because it matches the most-studied production system (dnd5e). If you're starting fresh with no migration burden, **Strategy A is the cleaner long-term choice** — just wrap each `@import` in `@layer system { ... }` instead of leaving them bare.

### Internal Layer Organization (Either Strategy)

Within your system's CSS, organize by sub-layers for predictable override priority:

```less
// At the top of main.less
@layer my-system.tokens, my-system.base, my-system.components, my-system.overrides;

@layer my-system.tokens {
  @import "variables/base";
}
@layer my-system.components {
  @import "v2/sheets";
}
```

This nests cleanly inside `@layer system { ... }` if you're using Strategy A.

---

## CSS Custom Properties (Two Strategies)

### Strategy 1 — Override Foundry's core variables

For skinning the chrome (window borders, form fields, buttons) without writing new CSS rules:

```less
// styles/variables/base.less
@layer variables {
  :root {
    --color-text-dark-primary: #1c1410;       // Foundry uses this for default text
    --color-border-light-1: #c8a672;          // window borders
    --form-field-height: 28px;                // input heights
    --font-primary: "Cinzel", serif;          // global UI font
  }
}
```

This propagates everywhere Foundry uses these variables — sidebar, chat, dialogs — without adding any new selectors.

### Strategy 2 — Namespace your own variables

For values that ONLY your system uses:

```less
@layer variables {
  :root {
    --my-system-color-gold: #c9a86b;
    --my-system-color-parchment: #f1e2c0;
    --my-system-color-hp-1: #db5759;          // low HP red
    --my-system-color-hp-2: #e0c061;          // mid HP yellow
    --my-system-color-hp-3: #84c474;          // high HP green
    --my-system-statblock-padding: 0.75rem;
    --my-system-sheet-header-height: 170px;

    // Spacing scale — adopt the PF2e pattern
    --my-system-space-1: 0.25rem;
    --my-system-space-2: 0.5rem;
    --my-system-space-3: 0.75rem;
    --my-system-space-4: 1rem;
    --my-system-space-6: 1.5rem;
    --my-system-space-8: 2rem;
  }
}
```

**Sheet-local variables** can be declared on the sheet root and inherit down — useful for layout dimensions specific to that sheet:

```less
.my-system.sheet.actor.character {
  --my-system-sheet-header-height: 170px;
  --my-system-sheet-tab-bar-height: 36px;
}
```

---

## Theming (Body Class + Themed Popouts)

Foundry switches themes via a body class. There is no `[data-theme]` attribute. `Game#configureUI` reads the user's colour-scheme setting and falls back to the browser's `prefers-color-scheme` when the setting is empty, but the result is always written as `body.theme-light` or `body.theme-dark` — so your CSS keys off the class, never the media query. Your CSS responds to **two selector roots**:

```less
// styles/variables/themes.less
@layer variables {
  // Light theme — applies to body and to .themed.theme-light popouts
  body.theme-light .my-system,
  .themed.theme-light.my-system {
    --my-system-bg-card: #fdf6e3;
    --my-system-text-primary: #1c1410;
    --my-system-border: #c8a672;
  }

  // Dark theme
  body.theme-dark .my-system,
  .themed.theme-dark.my-system {
    --my-system-bg-card: #2a2018;
    --my-system-text-primary: #e9d8a6;
    --my-system-border: #6b5234;
  }
}
```

Why both selectors? When the user pops a sheet out into its own window or applies a per-application theme override, Foundry sets the `themed.theme-{light,dark}` classes on that subtree instead of changing the global body. Pairing them lets your sheet look right in both contexts.

Use a LESS mixin if the variable list is long (this is the dnd5e pattern):

```less
// variables/themes.less
.mixin-theme-dark() {
  --my-system-bg-card: #2a2018;
  --my-system-text-primary: #e9d8a6;
  --my-system-border: #6b5234;
  // ... 30+ more vars
}

@layer variables {
  body.theme-dark .my-system,
  .themed.theme-dark.my-system {
    .mixin-theme-dark();
  }
}
```

This avoids duplicating the variable list across the body and themed selectors.

### Detached Windows

**New in v14:** `ApplicationV2#detachWindow()` moves an application into a separate browser window. `DetachedWindowManager` copies every attribute of `<html>` and `<body>` into the new document, adds `body.detached`, and imports every `link[rel="stylesheet"]` and `<style>` node from the main window. So your compiled stylesheet and the current theme classes follow the sheet automatically — no extra manifest entry needed.

Two things to check when you style a sheet:

- Anything you attach to a selector rooted outside the application element (`#interface .my-system`, `#chat-log .message.my-system`) will not match in a detached window. Scope to the application root.
- `body.detached` is available if a popped-out sheet needs different chrome.

```less
body.detached .my-system.sheet {
  --my-system-sheet-header-height: 140px;   // tighter header when standalone
}
```

---

## Project Layout

The dnd5e structure, adapted:

```
my-system/
├── styles/
│   ├── my-system.less            ← entry (only @imports)
│   ├── variables/
│   │   ├── base.less             ← :root tokens, no theme
│   │   ├── light.less            ← .mixin-theme-light + selectors
│   │   └── dark.less             ← .mixin-theme-dark + selectors
│   ├── v2/                       ← AppV2 sheets (current)
│   │   ├── sheets.less           ← shared sheet chrome
│   │   ├── character.less
│   │   ├── npc.less
│   │   ├── items.less
│   │   ├── chat.less
│   │   ├── typography.less
│   │   └── apps.less             ← dialogs, configs
│   ├── v1/                       ← AppV1 fallbacks (delete when no longer supported)
│   │   └── legacy.less
│   └── high-contrast/            ← optional a11y override layer
│       └── overrides.less
├── styles/my-system.css          ← compiled output (gitignored)
└── system.json                   ← declares "styles": ["styles/my-system.css"]
```

One file per concern. No deep nesting. **No `mixins/` folder** — mixins live next to where they're used (mostly inside theme files).

---

## Build Pipeline

Two valid approaches:

### Option A — Direct `lessc` (dnd5e style)

Simple, no bundler required. Pair with watch for dev:

```json
{
  "scripts": {
    "build:css": "lessc styles/my-system.less styles/my-system.css --source-map",
    "watch:css": "less-watch-compiler styles/ styles/ my-system.less --source-map",
    "build": "bun run build:css && bun run build:js"
  },
  "devDependencies": {
    "less": "^4.2.0",
    "less-watch-compiler": "^1.16.0"
  }
}
```

Foundry's `flags.hotReload` picks up the compiled CSS file change. Add `styles/my-system.css` to `.gitignore` and rebuild on `postinstall`.

### Option B — SCSS via Vite (PF2e style)

If you're already using Vite for JS, integrate CSS through it:

```javascript
// vite.config.mjs
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: "src/main.mjs", styles: "src/styles/main.scss" },
      output: {
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css") ? "styles/[name][extname]" : "assets/[name][extname]",
      },
    },
  },
  css: {
    preprocessorOptions: { scss: {} },
  },
});
```

Either works. Use whatever matches your team's existing toolchain. dnd5e ships LESS because it's been around since v0.7; PF2e adopted SCSS+Vite because they have a Svelte UI layer.

---

## Sheet Scoping Patterns

Build your sheet stylesheets around the document type chain:

```less
// styles/v2/sheets.less — shared by all sheets
.my-system.sheet {
  background: var(--my-system-bg-card);
  color: var(--my-system-text-primary);

  .window-content {
    padding: var(--my-system-space-3);
  }

  > header {
    height: var(--my-system-sheet-header-height);
    border-bottom: 2px solid var(--my-system-border);
  }
}

// styles/v2/character.less — character-only
.my-system.sheet.actor.character {
  --my-system-sheet-header-height: 170px;

  .ability-block {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--my-system-space-2);
  }
}
```

For shared layouts (rows of stats, sidebar columns), use Foundry's built-in utility classes (`.flexrow`, `.flexcol`) directly in templates rather than reinventing them.

---

## Chat Card Scoping

Chat lives in a shared DOM (`#chat-log`) where every system's messages mix. Always scope:

```less
// styles/v2/chat.less
:is(.chat-popout, #chat-log, .chat-log) .message.my-system {
  .card-header {
    display: flex;
    align-items: center;
    gap: var(--my-system-space-2);
    padding: var(--my-system-space-2);
    background: var(--my-system-bg-card);
  }

  .roll-result {
    font-family: var(--my-system-font-numeric);
    font-size: 1.5rem;
  }
}
```

Always set the system class on the message itself when you create it:

```javascript
await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: html,
  flags: { core: { canPopout: true } },
  // The system class needs to be in the rendered HTML — add it to your template root.
});
```

```hbs
{{!-- templates/chat/attack-card.hbs --}}
<div class="my-system attack-card">
  <header class="card-header">...</header>
  <div class="card-content">...</div>
</div>
```

---

## Token & HUD Customization

Style token resource bars, status icons, and HUD elements via canvas-adjacent selectors:

```less
.my-system {
  // Token HUD column on the right side of a token
  &.token-hud {
    .control-icon[data-action="my-system-action"] {
      background: var(--my-system-color-gold);
    }
  }

  // Status effect icons in the HUD palette
  .status-effects .effect-control[data-status-id^="my-system."] {
    border-color: var(--my-system-border);
  }
}
```

For dynamic token bar colors (HP bar tinting based on percentage), prefer doing the math in JS and applying a CSS variable on the token element rather than writing CSS percentage breakpoints — much cleaner.

---

## New Custom Properties in v14

No custom property was removed in v14. These were added; use them instead of hardcoding equivalents.

| Property | Purpose |
|----------|---------|
| `--spacer-2`, `--spacer-4`, `--spacer-8`, `--spacer-12`, `--spacer-16` | Core spacing scale (`--spacer-2` is `0.125rem`). Prefer these over a private scale for chrome that should match core. |
| `--menu-padding`, `--menu-button-height` | Context and control menu metrics |
| `--active-color`, `--active-background-color` | Active/selected state colors |
| `--sidebar-background`, `--slot-color` | Sidebar and hotbar slot surfaces |
| `--chat-input-border`, `--chat-menu-height` | Chat input chrome |
| `--color-data-background`, `--color-data-border` | Data-block surfaces |
| `--hr-border`, `--hr-gradient` | Horizontal rule styling in enriched content |
| `--effect-gap` | Gap between status effect icons |
| `--fa`, `--fa-inverse` | Font Awesome glyph content variables |
| `--cursor-default`, `--cursor-pointer`, `--cursor-grab`, `--cursor-text` and their `-down` variants | Cursor tokens used across the UI |

### Chat Background

`Game#configureUI({chatBackground})` toggles `with-background` on `#chat`. Scope chat chrome that assumes an opaque backdrop under `#chat.with-background` so it degrades cleanly when the user turns it off.

### Inline vs. Block Code

**Changed in v14:** bare `<code>` is styled inline; `code.block` is the block variant. The v13 `code.inline` class is gone. Enriched system content that emitted `<code class="inline">` should drop the class.

### Font Awesome

v14 ships **Font Awesome Pro 7.2.0** (v13 shipped Font Awesome 6). The class syntax (`fa-solid fa-user`) is unchanged, but any icon name that FA renamed or retired between 6 and 7 will no longer resolve. Audit the icon names your system hardcodes in sheets, CONFIG entries and templates.

`public/css/mce.css` is still shipped even though TinyMCE is gone. Do not build against it.

---

## Pitfalls

1. **Wrapping component CSS in `@layer my-system { }`** — counter-intuitive but wrong. Foundry's defaults are layered; your unlayered CSS wins automatically. Layered system CSS loses to layered Foundry exceptions.
2. **Hardcoded colors** — `color: #1c1410` breaks dark mode. Always use `var(--color-text-primary)` or `var(--my-system-text-primary)`.
3. **Hardcoded fonts** — same. Use `var(--font-primary)` or namespace your own (`var(--my-system-font-display)`).
4. **`!important` to win specificity** — symptom of broken scope. The right fix is a more specific selector chain (`.my-system.sheet.actor.character .stat-block`) or moving the rule outside any layer.
5. **`prefers-color-scheme: dark` in your own CSS** — Foundry already resolves the OS preference into `body.theme-dark`. Querying the media query yourself desyncs from the user's Foundry setting.
6. **`[data-theme]`** — also not Foundry's convention. Stick with body classes.
7. **Forgetting `.themed.theme-*`** — sheets popped into their own window get the themed wrapper, not the body class. Always pair both selectors.
8. **No marker class on Applications** — without `classes: ["my-system"]` in `DEFAULT_OPTIONS`, your scoped CSS never matches.
9. **Listing `.less` files in `system.json` styles** — Foundry doesn't compile LESS. List only the compiled `.css` output.
10. **Specificity wars with core sheets** — happens when you target core selectors directly (`.actor-sheet`). Always prefix with your marker (`.my-system .actor-sheet`).
11. **`@import` of node_modules CSS** — paths in `system.json` are resolved relative to the system folder. Imported npm CSS belongs in your build output, not in the manifest.
12. **Theme variables on `:root`** — they apply to the whole page including sidebar/chat. Define them inside the body.theme-* selector instead so they only apply to your sheets.
