# Tooling and Publishing

Versions below were read from the npm registry and GitHub on 2026-11-15. Re-check them before you pin.

## Node

Foundry v14 requires Node 24; v13 and below require Node 22 (requirements article, release 14.355). The two are mutually exclusive. Run your build and the CLI on Node 24 so local dev, CI and the Foundry host match.

## Official CLI (`@foundryvtt/foundryvtt-cli`, 3.0.5)

The `fvtt` command packs and unpacks LevelDB compendia, so compendium content can live in git as JSON or YAML.

```bash
bun add -g @foundryvtt/foundryvtt-cli
fvtt package workon "my-module" --type "Module"   # set the active package
fvtt package unpack "monsters"                    # LevelDB pack -> one file per document
fvtt package pack "monsters"                      # files -> LevelDB pack
fvtt package clear                                # forget the active package
```

`unpack` takes `--outputDirectory` and `--yaml`; `pack` takes `--inputDirectory`, `--outputDirectory` and `--yaml`. There is no `extract` verb. Run `fvtt package unpack --help` for the rest. Keep the unpacked sources in git, ignore `packs/`, and pack on release.

## TypeScript types (`fvtt-types`)

The League of Foundry Developers publishes `fvtt-types`. On npm, the `latest` tag is a v13 build (13.346.0-beta); v14 builds exist only on the `beta` and `prerelease` tags (`beta` is 14.370.0-beta.20261107215328). The README documents v13 installs only. For a v14 project, pin an exact beta and expect gaps:

```bash
bun add -d fvtt-types@14.370.0-beta.20261107215328
```

```json
{ "compilerOptions": { "types": ["fvtt-types"], "moduleResolution": "bundler", "strict": true } }
```

Where a v14 type is missing or wrong, check the v14 API docs (https://foundryvtt.com/api/v14/) rather than trusting the type.

## Build

Copy `boilerplate/module/` and read `build-pipeline.md`. Run `bunx ultracite init` once, then `bun run format` and `bun run lint`.

## Publishing

Submit a package at https://foundryvtt.com/packages/submit. The manifest's `manifest` field must be a stable URL for the latest manifest; `download` points to the zip for the version that manifest describes (module-development article). With GitHub Releases:

```
manifest:  https://github.com/you/my-module/releases/latest/download/module.json
download:  https://github.com/you/my-module/releases/download/v1.0.0/module.zip
```

Release workflow. It builds, zips `dist/`, and uploads both files. Actions are pinned by commit SHA, with the tag in a comment so Dependabot can update them:

```yaml
name: Release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: cd dist && zip -r ../module.zip .
      - uses: softprops/action-gh-release@8a0cd651e5b2365bd640854a3fa5dfc70e4875f3 # v3.0.4
        with:
          files: |
            dist/module.json
            module.zip
          generate_release_notes: true
```

Set `version` and `download` in `static/module.json` before you tag, then `git tag v1.0.0 && git push --tags`.

## Tours

A tour is a JSON file of steps, each with a `selector` to highlight. Register it in `setup` and start it once:

```js
Hooks.once("setup", async () => {
  game.tours.register("my-module", "welcome",
    await foundry.nue.Tour.fromJSON("/modules/my-module/tours/welcome.json"));
});
Hooks.once("ready", async () => {
  if (game.settings.get("my-module", "tourCompleted")) return;
  await game.tours.get("my-module.welcome").start();
  await game.settings.set("my-module", "tourCompleted", true);
});
```

## Module API

Expose a stable API so other packages and macros can call you:

```javascript
Hooks.once("init", () => {
  game.modules.get("my-module").api = {
    getHeroData: (actorId) => game.actors.get(actorId)?.system,
  };
});
// elsewhere: game.modules.get("my-module")?.api?.getHeroData(id)
```

## Community libraries

| Library | Use it for |
|---|---|
| libWrapper | Patching a core method without breaking other modules that patch it |
| socketlib | Awaitable calls to the GM over sockets; core `User#query` now covers the common case |
| Quench | In-game Mocha/Chai tests; see `testing-with-quench.md` |

## Debugging

- Browser devtools (F12) are the main tool.
- `CONFIG.debug.hooks = true` logs every hook call.
- `ui.notifications.info/warn/error()` shows in-game feedback.

## Reference implementations

Foundry's own systems are the best working examples: dnd5e (https://github.com/foundryvtt/dnd5e), pf2e (https://github.com/foundryvtt/pf2e) and Crucible (https://github.com/foundryvtt/crucible).
