# Sources

- Microsoft, "Announcing TypeScript 7.0" (TypeScript devblog, 2026) - https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ - supports: strict is true by default, types defaults to [], baseUrl and moduleResolution node/node10/classic are no longer supported (bundler and nodenext recommended), so the generated tsconfig sets no baseUrl, uses moduleResolution bundler and lists types - checked 2026-11-14
- Ultracite, "Setup" - https://www.ultracite.ai/docs/setup - supports: `ultracite init` takes `--linter biome`, `--pm bun` and `--yes` ("Take the default for every question no flag answers"), installs the packages for the chosen linter and creates its configuration files - checked 2026-11-14
- Ultracite, "Usage" - https://www.ultracite.ai/docs/usage - supports: `ultracite check` runs the linter without modifying files and `ultracite fix` runs it and auto-fixes issues, the commands behind the `lint:biome` and `format` scripts - checked 2026-11-14
