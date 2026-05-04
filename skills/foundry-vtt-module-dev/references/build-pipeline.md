# Build Pipeline (Vite & Rollup)

A Foundry module is just static files served from `Data/modules/<id>/`. You can ship raw `.mjs` files and skip a build entirely — and that's fine for small modules with one or two files.

But once you want TypeScript, Sass/LESS, Svelte/Lit components, npm dependencies, source maps, or a fast dev loop, a bundler earns its keep. This reference covers **Vite** (recommended for most modules) and **Rollup** (when you need finer control).

---

## The Foundry Constraint

Foundry serves your module files directly via its own static router. Three implications shape how you configure any bundler:

1. **No asset hashing.** Foundry references files via the fixed paths in `module.json` (`esmodules`, `styles`, `templates`). A bundle that emits `main.[hash].mjs` breaks Foundry's reference. Disable hashing on JS, CSS, and assets you reference from the manifest.
2. **No HTML entry point.** Foundry IS the HTML — your bundle is a library that mounts into the existing DOM. The bundler's `index.html` workflow doesn't apply.
3. **Module structure must mirror the manifest.** Whatever paths you put in `module.json` must exist relative to the module root. A bundler that flattens or relocates files needs a copy step to preserve structure.

---

## Recommended Project Layout

```
my-module/
├── src/                       ← source code
│   ├── main.mjs               ← entry referenced from module.json (post-build)
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
├── vite.config.mjs            ← OR rollup.config.mjs
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

## Choosing Vite or Rollup

| | Vite | Rollup |
|---|---|---|
| Dev speed | Fast (esbuild + native ESM) | Slower (full bundle each rebuild) |
| Config complexity | Lower (sane defaults) | Higher (assemble plugins manually) |
| HMR for JS | Yes (with proxy setup) | No (manual watch + Foundry F5) |
| TypeScript | Built-in | Add `@rollup/plugin-typescript` |
| Sass/LESS | Built-in (with preprocessor installed) | Plugin per preprocessor |
| Output control | Less granular | Total |
| Output size | Comparable | Comparable |

**Default: Vite.** Pick Rollup only when you need very specific output shaping (e.g., multiple entry points with different optimization tiers) or when integrating with a tool that demands Rollup (some Svelte stacks).

---

## Vite Config

A working `vite.config.mjs` for a Foundry module:

```javascript
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync, cpSync, mkdirSync } from "node:fs";

const MODULE_ID = "my-module";

// Plugin: copy static assets to dist/ and re-copy on change in dev
function foundryStatic() {
  const copy = () => {
    mkdirSync("dist", { recursive: true });
    cpSync("static", "dist", { recursive: true });
    cpSync("packs", "dist/packs", { recursive: true });
  };
  return {
    name: "foundry-static",
    buildStart: copy,
    handleHotUpdate({ file, server }) {
      if (file.includes("/static/") || file.includes("/packs/")) {
        copy();
        server.ws.send({ type: "full-reload" });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: "src",
  base: `/modules/${MODULE_ID}/`,
  publicDir: false,                   // we manage statics ourselves
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: mode === "development" ? "inline" : true,
    minify: mode === "production",
    lib: {
      entry: resolve(__dirname, "src/main.mjs"),
      name: MODULE_ID,
      fileName: () => "main.mjs",     // NO HASHING
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (asset) => {
          // Keep CSS named after its source, no hash
          if (asset.name?.endsWith(".css")) return "styles/[name][extname]";
          return "assets/[name][extname]";
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: { /* additionalData: '@use "variables" as *;' */ },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Foundry serves everything on 30000; proxy non-module paths to it
      // so the Vite dev page can sit on top of Foundry for HMR.
      "^(?!/modules/" + MODULE_ID + "/).*": {
        target: "http://localhost:30000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [foundryStatic()],
}));
```

Key choices explained:

- **`base: "/modules/<id>/"`** — Vite needs to know the URL prefix Foundry serves under, so generated chunk imports resolve correctly.
- **`build.lib`** — library mode. Disables HTML entry generation; emits a single ESM bundle.
- **`fileName: () => "main.mjs"`** — fixed output name, no hash. Must match what `module.json` declares in `esmodules`.
- **`assetFileNames`** — keeps CSS at `styles/main.css` (matches `module.json` `styles`) without hashes.
- **`server.proxy`** — Vite dev server reverse-proxies to Foundry. You can hit `localhost:5173` and get HMR for JS/CSS while the rest of Foundry's UI loads from the actual server.
- **`foundryStatic` plugin** — copies `static/` (manifest, lang, templates) and `packs/` into `dist/` on build start and on file changes.

For TypeScript, add `import ts from "typescript"` setup is automatic — Vite handles `.ts` files natively. Set `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "types": ["fvtt-types"]
  },
  "include": ["src"]
}
```

---

## Rollup Config

When you need Rollup specifically:

```javascript
import { defineConfig } from "rollup";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import copy from "rollup-plugin-copy";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  input: "src/main.mjs",
  output: {
    file: "dist/main.mjs",
    format: "es",
    sourcemap: isProduction ? true : "inline",
    // No hashing — Foundry references via fixed manifest paths
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    postcss({
      extract: "styles/main.css",
      sourceMap: true,
      plugins: [autoprefixer()],
      use: ["sass"],
    }),
    copy({
      targets: [
        { src: "static/module.json", dest: "dist" },
        { src: "static/lang", dest: "dist" },
        { src: "static/templates", dest: "dist" },
        { src: "packs", dest: "dist" },
      ],
      hook: "writeBundle",
    }),
    isProduction && terser(),
  ].filter(Boolean),
  watch: {
    include: ["src/**", "static/**"],
    clearScreen: false,
  },
});
```

For TypeScript add `@rollup/plugin-typescript` and feed it `tsconfig.json`. For Svelte add `rollup-plugin-svelte`. Each capability is one plugin — that's the Rollup tradeoff: you assemble the toolchain yourself.

Run with `bunx rollup -c -w` for watch mode.

---

## `package.json` Scripts

```json
{
  "name": "my-module",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite build --watch --mode development",
    "build": "vite build",
    "preview": "vite",
    "link": "node ./scripts/link.mjs",
    "unlink": "node ./scripts/unlink.mjs",
    "format": "ultracite fix",
    "lint": "ultracite check"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "sass": "^1.77.0"
  }
}
```

`dev` builds once and stays in watch mode — combined with Foundry's `flags.hotReload` and a symlinked `dist/`, edits propagate without an F5 for CSS/HBS/JSON.

---

## `flags.hotReload` (Foundry-Side Live Reload)

Declare in `module.json` to tell Foundry which files to live-reload:

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

Foundry watches the listed paths for matching extensions; on change, it reloads the affected sub-system (CSS hot-swaps, templates re-render, language files reapply on next localize).

This is **Foundry's** mechanism, independent of your bundler. Vite/Rollup writes to `dist/` → Foundry sees the file change → Foundry reloads. Pair it with bundler watch mode and you get a near-instant edit→see loop without restarting Foundry.

JS still requires F5 — there's no Foundry-supported way to swap module code at runtime.

---

## Production Build

Before shipping a release:

```bash
bun run build                  # produces dist/ ready to zip
cd dist && zip -r ../my-module.zip .
```

The CI workflow in [SKILL.md](../SKILL.md)'s "Publishing to Foundry" section uploads the zip to GitHub Releases. The `manifest` URL in `module.json` should point at `https://github.com/.../releases/latest/download/module.json`; `download` at the versioned zip.

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

Run via `"prebuild": "node scripts/prebuild.mjs"` in `package.json` scripts.

---

## Pitfalls

1. **Hashed filenames** — `[hash]` in any output filename breaks the manifest reference. Disable hashing on JS, CSS, and any asset you list in `module.json`.
2. **Forgetting to copy static files** — `module.json`, templates, and lang files don't exist in your bundle output unless a plugin copies them. Foundry won't find your module without `module.json` in `dist/`.
3. **`base` mismatch** — Vite's `base` option must match the Foundry path (`/modules/<id>/`). Wrong base = chunk imports 404 in Foundry.
4. **Symlinking the source folder instead of `dist/`** — symlink only the build output. Symlinking source means Foundry tries to load uncompiled `.scss` and crashes.
5. **CommonJS dependencies in ESM bundle** — Rollup needs `@rollup/plugin-commonjs`; Vite handles it automatically. If a dep imports as `default` of nothing, that's the symptom.
6. **Sourcemaps in shipped builds** — set `sourcemap: true` (separate file) for production, not `"inline"` — inline maps double the bundle size.
7. **Watching `dist/` itself** — never. Only watch sources. Some bundlers loop forever otherwise.
8. **Multiple entry points** — Foundry's `module.json` `esmodules` field accepts multiple entries, but EACH must be a fully bundled file. Either build N bundles or use one entry that imports the others.
9. **NPM dependencies that assume Node** — module bundles run in the browser. A dep that imports `node:fs` won't work; prefer browser-friendly alternatives or avoid the dep.
