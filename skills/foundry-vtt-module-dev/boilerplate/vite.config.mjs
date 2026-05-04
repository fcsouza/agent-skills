import { defineConfig } from "vite";
import { resolve } from "node:path";
import { cpSync, mkdirSync } from "node:fs";

const MODULE_ID = "my-module";

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
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: mode === "development" ? "inline" : true,
    minify: mode === "production",
    lib: {
      entry: resolve(import.meta.dirname, "src/main.mjs"),
      name: MODULE_ID,
      fileName: () => "main.mjs",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (asset) => {
          if (asset.name?.endsWith(".css")) return "styles/[name][extname]";
          return "assets/[name][extname]";
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {},
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
