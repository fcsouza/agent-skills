// Verified against: vite 8.3.8 (2026-11-15)
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const MODULE_ID = "my-module";
const OUT_DIR = resolve(import.meta.dirname, "dist");

// Copy static/ (module.json, templates, lang) and packs/ into dist.
// The copy runs in writeBundle, after Vite has emptied and written outDir.
// Copying in buildStart loses the files: emptyOutDir wipes dist afterwards.
function foundryStatic() {
  const copy = () => {
    cpSync(resolve(import.meta.dirname, "static"), OUT_DIR, {
      recursive: true,
    });
    const packs = resolve(import.meta.dirname, "packs");
    if (existsSync(packs)) {
      cpSync(packs, resolve(OUT_DIR, "packs"), { recursive: true });
    }
  };
  return {
    name: "foundry-static",
    writeBundle: copy,
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
  publicDir: false,
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    sourcemap: mode === "development" ? "inline" : true,
    minify: mode === "production",
    lib: {
      entry: resolve(import.meta.dirname, "src/main.mjs"),
      name: MODULE_ID,
      // Must match "esmodules" in static/module.json. No hash: Foundry loads fixed paths.
      fileName: () => "scripts/main.mjs",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (asset) => {
          if (asset.names?.some((name) => name.endsWith(".css"))) {
            return "styles/[name][extname]";
          }
          return "assets/[name][extname]";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      [`^(?!/modules/${MODULE_ID}/).*`]: {
        target: "http://localhost:30000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [foundryStatic()],
}));
