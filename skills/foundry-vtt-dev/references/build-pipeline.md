# Build Pipeline (Vite)

A Foundry module is just static files served from `Data/modules/<id>/`. You can ship raw `.mjs` files and skip a build entirely — and that's fine for small modules with one or two files.

But once you want TypeScript, Sass/LESS, Svelte/Lit components, npm dependencies, source maps, or a fast dev loop, a bundler earns its keep. This reference covers Vite, which `boilerplate/module/` uses. The boilerplate was built with Vite 8.3.8 and its `dist/` checked file by file.

---

## The Foundry Constraint

Foundry serves your module files directly via its own static router. Four implications shape how you configure any bundler:

1. **Static `.html` files are not pages.** Since 14.361 the server sends any file whose mime type is `text/html` or `application/xhtml+xml` as `text/plain`. A `.html` file in your module can no longer be opened in a browser or iframe. Handlebars templates still work — they are fetched and compiled, never navigated to. Use `.hbs` for templates and drop any standalone HTML page from your build output.
2. **No asset hashing.** Foundry references files via the fixed paths in `module.json` (`esmodules`, `styles`, `templates`). A bundle that emits `main.[hash].mjs` breaks Foundry's reference. Disable hashing on JS, CSS, and assets you reference from the manifest.
3. **No HTML entry point.** Foundry IS the HTML — your bundle is a library that mounts into the existing DOM. The bundler's `index.html` workflow doesn't apply.
4. **Node 24.** Foundry v14 requires Node 24. Your build scripts run on whatever Node you install, but pin CI to Node 24 so `engines` checks and native deps behave the same as on the server.
5. **Module structure must mirror the manifest.** Whatever paths you put in `module.json` must exist relative to the module root. A bundler that flattens or relocates files needs a copy step to preserve structure.

---

## Recommended Project Layout

```
my-module/
├── src/                       ← source code
│   ├── main.mjs               ← entry; builds to dist/scripts/main.mjs
│   ├── apps/
│   │   ├── _module.mjs
│   │   └── my-sheet.mjs
│   ├── data/
│   │   ├── _module.mjs
│   │   └── hero-data.mjs
│   └── styles/
│       └── main.scss
├── static/                    ← copied verbatim to dist/
│   ├── module.json
│   ├── lang/en.json
│   └── templates/
│       └── my-sheet.hbs
├── packs/                     ← compendium sources (LevelDB or JSON)
├── dist/                      ← build output (gitignored)
├── vite.config.mjs
├── package.json
└── tsconfig.json              ← if using TypeScript
```

`dist/` is what Foundry sees. During development, **symlink** it into Foundry's data folder:

```bash
# macOS / Linux
ln -s "$(pwd)/dist" "$HOME/Library/Application Support/FoundryVTT/Data/modules/my-module"

# Windows (PowerShell, admin)
New-Item -ItemType SymbolicLink -Path "$env:LOCALAPPDATA\FoundryVTT\Data\modules\my-module" -Target "$PWD\dist"
```

Edit source → bundler writes to `dist/` → Foundry's hot-reload (declared via `flags.hotReload` in `module.json`) picks up CSS/HBS/JSON changes; JS still needs F5.

---

## Vite Config

Copy `boilerplate/module/vite.config.mjs`. It is the config this section explains.

Key choices explained:

- **`base: "/modules/<id>/"`** — Vite needs to know the URL prefix Foundry serves under, so generated chunk imports resolve correctly.
- **`build.lib`** — library mode. Disables HTML entry generation; emits a single ESM bundle.
- **`fileName: () => "scripts/main.mjs"`** — fixed output name, no hash. It must match `esmodules` in `static/module.json` (`"scripts/main.mjs"`).
- **`assetFileNames`** — keeps CSS at `styles/main.css` (matches `module.json` `styles`) without hashes.
- **`server.proxy`** — Vite dev server reverse-proxies to Foundry. You can hit `localhost:5173` and get HMR for JS/CSS while the rest of Foundry's UI loads from the actual server.
- **`foundryStatic` plugin** — copies `static/` (manifest, lang, templates) and `packs/` into `dist/` in `writeBundle` and on file changes. Copy after the bundle is written: with `emptyOutDir: true`, Vite empties `dist/` after `buildStart`, so a copy made there disappears and `dist/` ends up with only `scripts/main.mjs`.

Vite compiles `.ts` files without extra setup. For SCSS, add `sass` as a dev dependency. A `tsconfig.json` for type checking:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "types": ["fvtt-types"]   // v14 types are a pre-release; see tooling-and-publishing.md
  },
  "include": ["src"]
}
```

---

## `package.json` Scripts

Copy `boilerplate/module/package.json`: `dev` (watch build), `build`, `serve` (Vite dev server with the Foundry proxy), `format` and `lint` (ultracite). `biome.jsonc` ships with the boilerplate: it is what `bunx ultracite init --pm bun --linter biome` writes, plus the Foundry globals (`game`, `CONFIG`, `foundry`, ...) and `noThisInStatic` off for ApplicationV2 action handlers. Biome reads `.gitignore`, so keep that file too. `bun run format` and `bun run lint` pass on the boilerplate as shipped.

`dev` builds once and stays in watch mode — combined with Foundry's `flags.hotReload` and a symlinked `dist/`, edits propagate without an F5 for CSS/HBS/JSON.

---

## `flags.hotReload` (Foundry-Side Live Reload)

Declare in `module.json` to tell Foundry which files to live-reload. The shape is `{extensions: string[], paths: string[]}`:

```json
{
  "flags": {
    "hotReload": {
      "extensions": ["css", "hbs", "json"],
      "paths": ["styles/main.css", "templates", "lang"]
    }
  }
}
```

Foundry watches the listed paths for matching extensions; on change, it reloads the affected sub-system. Only three cases are handled: `css` hot-swaps the stylesheet, `hbs` and `html` recompile the template and re-render open applications, `json` reloads language files. Anything else in `extensions` is watched but ignored.

Intercept a reload with the `hotReload` hook — return `false` to suppress Foundry's own handling:

```javascript
Hooks.on("hotReload", (data) => {
  // data: { packageType, packageId, content, path, extension }
  if (data.extension !== "json") return;
  console.log("reloading", data.path);
});
```

Stylesheets declared in `module.json` may also name a cascade layer, which decides where your rules land against core's:

```json
"styles": [{ "src": "styles/main.css", "layer": "modules" }]
```

Core declares its cascade layers in this order: `reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions`. Naming `modules` puts your rules after core's own and before `exceptions`. See `module-styling.md` for the default layer and `"layer": null`.

This is **Foundry's** mechanism, independent of your bundler. The bundler writes to `dist/` → Foundry sees the file change → Foundry reloads. Pair it with bundler watch mode and you get a near-instant edit→see loop without restarting Foundry.

JS still requires F5 — there's no Foundry-supported way to swap module code at runtime.

---

## Production Build

Before shipping a release:

```bash
bun run build                  # produces dist/ ready to zip
cd dist && zip -r ../module.zip .
```

The release workflow in `tooling-and-publishing.md` uploads the zip to GitHub Releases. The `manifest` URL in `module.json` should point at `https://github.com/.../releases/latest/download/module.json`; `download` at the versioned zip.

Make sure `dist/module.json` declares the correct `version`, `manifest`, and `download` URLs **before** zipping. A pre-build script that injects them from `package.json` keeps them in sync:

```javascript
// scripts/prebuild.mjs
import { readFileSync, writeFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("static/module.json", "utf8"));
manifest.version = pkg.version;
manifest.download = `https://github.com/you/${manifest.id}/releases/download/v${pkg.version}/module.zip`;
writeFileSync("static/module.json", JSON.stringify(manifest, null, 2));
```

Save the file first, then add `"prebuild": "bun scripts/prebuild.mjs"` to `package.json`. A `prebuild` entry runs before every `build`, so an entry that points at a missing file breaks the build.

---

## Pitfalls

1. **Hashed filenames** — `[hash]` in any output filename breaks the manifest reference. Disable hashing on JS, CSS, and any asset you list in `module.json`.
2. **Forgetting to copy static files** — `module.json`, templates, and lang files don't exist in your bundle output unless a plugin copies them. Foundry won't find your module without `module.json` in `dist/`.
3. **`base` mismatch** — Vite's `base` option must match the Foundry path (`/modules/<id>/`). Wrong base = chunk imports 404 in Foundry.
4. **Symlinking the source folder instead of `dist/`** — symlink only the build output. Symlinking source means Foundry tries to load uncompiled `.scss` and crashes.
5. **Copying statics in `buildStart`** — `emptyOutDir` wipes them. Copy in `writeBundle`, as the boilerplate does, then list `dist/` after a build.
6. **Sourcemaps in shipped builds** — set `sourcemap: true` (separate file) for production, not `"inline"` — inline maps double the bundle size.
7. **Watching `dist/` itself** — never. Only watch sources. Some bundlers loop forever otherwise.
8. **Multiple entry points** — Foundry's `module.json` `esmodules` field accepts multiple entries, but EACH must be a fully bundled file. Either build N bundles or use one entry that imports the others.
9. **Shipping a `template.json`** — deprecated since v14. Declare document subtypes with `documentTypes` in `module.json` and back them with `TypeDataModel` classes.
10. **Packing compendia** — the Foundry CLI (`@foundryvtt/foundryvtt-cli`) packs and unpacks LevelDB compendia: `fvtt package pack` and `fvtt package unpack`. See `tooling-and-publishing.md`.
11. **NPM dependencies that assume Node** — module bundles run in the browser. A dep that imports `node:fs` won't work; prefer browser-friendly alternatives or avoid the dep.
