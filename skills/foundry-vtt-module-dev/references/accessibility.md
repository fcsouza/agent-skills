# Accessibility (a11y)

Foundry sheets, dialogs, and HUD elements are plain HTML rendered into the page. The same accessibility rules apply as for any web app — but Foundry users span a wide range (color blindness, motor impairments, screen readers, keyboard-only play), and many GMs run sessions for hours at a time. A few small habits make modules dramatically more usable.

This applies to **both** modules and systems — sheet authors are the primary audience.

---

## ARIA Roles for Sheet Sections

ApplicationV2 wraps your content in a window. Inside `_renderHTML`/your Handlebars template, give meaningful regions semantic roles:

```hbs
<section class="sheet-header" role="region" aria-label="{{localize 'MY_MODULE.Sheet.identity'}}">
  <h1>{{actor.name}}</h1>
</section>

<nav class="sheet-tabs" role="tablist" aria-label="{{localize 'MY_MODULE.Sheet.tabs'}}">
  <a role="tab" data-tab="abilities" aria-selected="true" tabindex="0">
    {{localize 'MY_MODULE.Tab.abilities'}}
  </a>
  <a role="tab" data-tab="inventory" aria-selected="false" tabindex="-1">
    {{localize 'MY_MODULE.Tab.inventory'}}
  </a>
</nav>

<section role="tabpanel" data-tab="abilities" aria-labelledby="tab-abilities">
  <!-- ability content -->
</section>
```

Use `role="region"` + `aria-label` for any major area that's not already a `<nav>`, `<main>`, `<aside>`, or `<form>`. Screen readers announce each region as a navigable landmark.

---

## Icon-Only Buttons Need `aria-label`

Foundry sheets are heavy on Font Awesome icons. Every icon-only button MUST carry an accessible name:

```hbs
<button type="button" data-action="rollAttack" aria-label="{{localize 'MY_MODULE.Action.rollAttack'}}">
  <i class="fa-solid fa-dice-d20" aria-hidden="true"></i>
</button>

<button type="button" data-action="deleteItem" aria-label="{{localize 'MY_MODULE.Action.delete'}}">
  <i class="fa-solid fa-trash" aria-hidden="true"></i>
</button>
```

Always pair `aria-label` on the button with `aria-hidden="true"` on the icon — otherwise a screen reader reads "trash button" twice.

For buttons with visible text, no `aria-label` needed — the text content is the accessible name.

---

## Keyboard-Navigable Tabs

ApplicationV2's built-in tab handling responds to mouse clicks but not arrow keys by default. If you implement custom tabs, follow the [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):

```javascript
// Inside your sheet
_onRender(context, options) {
  super._onRender(context, options);
  const tablist = this.element.querySelector('[role="tablist"]');
  if (!tablist) return;
  tablist.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const current = tabs.findIndex(t => t.getAttribute("aria-selected") === "true");
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    tabs[next].click();
    tabs[next].focus();
  });
}
```

Set `tabindex="0"` on the active tab, `tabindex="-1"` on the others. Tab key moves between widgets; arrow keys move within the tablist.

---

## Focus Management on Dialog Open / Close

When a `DialogV2` opens, focus should move to the first interactive element inside it. ApplicationV2 mostly handles this, but for custom popovers or `Dialog.wait` flows, manage focus explicitly:

```javascript
// After render, focus the first input
async _onFirstRender(context, options) {
  await super._onFirstRender(context, options);
  const firstInput = this.element.querySelector("input, button, select, textarea");
  firstInput?.focus();
}

// Before close, restore focus to the trigger
async close(options) {
  this.#previousFocus?.focus();
  return super.close(options);
}
```

Save `document.activeElement` before opening so you can restore focus on close.

---

## `aria-live` for Chat & Notifications

Dynamic content (chat messages, ui.notifications, dice roll results) should announce itself to screen readers. Foundry's chat already uses live regions, but custom panels need their own:

```hbs
<div class="my-module-status" role="status" aria-live="polite" aria-atomic="true">
  {{statusMessage}}
</div>

<!-- For urgent updates (combat alerts, critical errors) -->
<div class="my-module-alert" role="alert" aria-live="assertive">
  {{alertMessage}}
</div>
```

`polite` waits for the user to pause; `assertive` interrupts immediately. Use `assertive` sparingly — it's intrusive.

---

## Color Contrast

Foundry's CSS variables already meet WCAG AA contrast in both Light and Dark themes. **Always** use the variables, never hardcoded colors:

```css
@layer my-module {
  .my-panel {
    color: var(--color-text-primary);     /* 4.5:1 against bg */
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
  }
}
```

Don't communicate state with color alone. A red border for "invalid" should also have an icon or text — color blindness affects ~8% of male users.

```hbs
<input class="invalid"
       aria-invalid="true"
       aria-describedby="error-{{id}}">
<span id="error-{{id}}" class="error-text">
  <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
  {{localize 'MY_MODULE.Error.required'}}
</span>
```

---

## `prefers-reduced-motion`

Animated effects (token glow, sheet transitions, dice tray slide-in) can trigger vestibular issues. Respect the user's OS-level preference:

```css
@layer my-module {
  .my-module-card {
    transition: transform 0.2s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .my-module-card {
      transition: none;
    }
    .animated-effect {
      animation: none;
    }
  }
}
```

For JS-driven animations (`gsap`, `CanvasAnimation.animate`), check the media query and skip or shorten:

```javascript
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const duration = reduced ? 0 : 800;
await CanvasAnimation.animate([{ ... }], { duration });
```

---

## Form Field Labels

Every input needs a programmatic label. Foundry's `formGroups` helper does this automatically; raw inputs do not:

```hbs
<!-- Good -->
<label for="strength">{{localize 'MY_MODULE.Ability.str'}}</label>
<input id="strength" name="system.abilities.str" type="number">

<!-- Also good -->
<label>
  {{localize 'MY_MODULE.Ability.str'}}
  <input name="system.abilities.str" type="number">
</label>

<!-- Bad — placeholder is not a label -->
<input name="system.abilities.str" type="number" placeholder="STR">
```

For checkbox grids and toggle groups, wrap in a `<fieldset>` with a `<legend>`.

---

## Headings Form an Outline

Use heading levels (`<h1>` … `<h4>`) hierarchically. The window title is `<h1>`; section headers are `<h2>`; sub-sections are `<h3>`. Don't skip levels for styling — use CSS to control size.

---

## Quick Audit Checklist

Before shipping a sheet or dialog:

- [ ] Every icon-only button has `aria-label`
- [ ] Every form input has a `<label>` (or `aria-label`)
- [ ] Tabs respond to arrow keys and `Home`/`End`
- [ ] Dialog opens with focus on the first input
- [ ] Dialog close restores focus to the trigger
- [ ] All interactive elements are reachable with `Tab`
- [ ] Status/error messages live in `role="status"` or `role="alert"`
- [ ] Colors come from CSS variables, not hex codes
- [ ] State is conveyed by more than color (icon + text)
- [ ] Animations respect `prefers-reduced-motion`
- [ ] `<h1>`–`<h4>` form a logical outline
- [ ] Test once with the OS screen reader (VoiceOver / NVDA / Orca)
