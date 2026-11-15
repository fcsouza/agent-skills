# Module Styling (CSS cascade layers)

Foundry core stylesheets use CSS cascade layers (`@layer`). A module names a layer for each stylesheet in the manifest:

```json
"styles": [{ "src": "styles/my-module.css", "layer": "modules" }]
```

Core declares its top-level layers in this order, lowest priority first: `reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions` (community wiki, checked against 13.334). Naming `modules` puts your rules after core's own and before `exceptions`. A stylesheet listed as a plain string also lands in the package's default layer. `"layer": null` opts out: unlayered CSS beats every layered rule, `exceptions` included, so other packages can no longer override you. Do not invent a layer name.

An inner `@layer` in a stylesheet loaded under `modules` nests inside it: `@layer my-module { ... }` becomes `modules.my-module` and keeps the same position. Use it to group your own rules, not to replace the manifest field.

Rules for module CSS (this skill's rules):

- Scope every selector to your marker class (`DEFAULT_OPTIONS.classes: ["my-module", ...]`), so you never restyle another package's windows.
- Use Foundry's custom properties where they exist, with a fallback: `border: 1px solid var(--color-border, #7a7971)`. Check a property name in the browser devtools on your Foundry build before you depend on it.
- Theme through `body.theme-light` / `body.theme-dark` and `.themed.theme-<x>` on popouts, the same mechanism `styling-and-themes.md` describes for systems.
- Respect `prefers-reduced-motion` for any transition or animation. See `accessibility.md`.

`boilerplate/module/static/styles/my-module.css` is a starter that follows these rules. Systems carry far more CSS; read `styling-and-themes.md` for the system patterns.
