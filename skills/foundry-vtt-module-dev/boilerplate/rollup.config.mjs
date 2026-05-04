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
