# Foundry VTT Module — Pre-Publish Checklist

## Manifest (`module.json`)

- [ ] `id` matches the module's folder name exactly (lowercase, hyphens only)
- [ ] `version` has been bumped (follow semver: MAJOR.MINOR.PATCH)
- [ ] `compatibility.minimum` and `.verified` reflect the tested Foundry version (omit `.maximum` unless a confirmed break exists)
- [ ] `manifest` URL points to the correct release branch/tag (not `main`)
- [ ] `download` URL points to the correct `.zip` artifact for this version
- [ ] `url` is a valid, publicly accessible project page
- [ ] All `esmodules` and `styles` paths exist in the package
- [ ] All `languages` file paths exist and are valid JSON
- [ ] `socket: true` only if the module actually uses `game.socket`
- [ ] No debug/test pack entries left in `packs`

## Code Quality

- [ ] No `console.log` calls in production paths (use a `CONFIG.debug.myModule` guard)
- [ ] No use of deprecated v1/v2 Document Sheet APIs (use `DocumentSheetV2`)
- [ ] All `Roll` instances use `await roll.evaluate()` (never `.roll()`)
- [ ] `DialogV2.confirm` / `DialogV2.prompt` used instead of legacy `Dialog`
- [ ] No direct `actor.data.data` access (use `actor.system`)
- [ ] `prepareDerivedData` does not call `this.parent.update()` (no DB writes in derived prep)
- [ ] All async functions properly `await` their promises
- [ ] No hardcoded user IDs or actor IDs

## Localization

- [ ] Every string shown to users goes through `game.i18n.localize()` or `game.i18n.format()`
- [ ] No raw English strings in `.hbs` templates — use `{{localize "KEY"}}`
- [ ] The `lang/en.json` file contains entries for every key referenced in code and templates
- [ ] Lang file keys follow the module's naming convention (e.g., `MY-MODULE.section.name`)
- [ ] No missing key warnings appear in the browser console on load

## Settings

- [ ] All settings are registered inside `Hooks.once('init')`
- [ ] `scope: 'world'` used for game-wide state, `scope: 'client'` for per-user preferences
- [ ] Settings that require a reload set `requiresReload: true`
- [ ] No settings with `config: false` appear in the settings UI accidentally
- [ ] Default values match the field type (`Boolean` defaults to `true`/`false`, not `1`/`0`)

## Compatibility

- [ ] Tested on the minimum Foundry version declared in `compatibility.minimum`
- [ ] No deprecated API warnings appear in the browser console
- [ ] No reliance on APIs marked `@deprecated` in the Foundry source
- [ ] Module loads cleanly with zero other modules active (no hidden dependencies)
- [ ] Module loads cleanly alongside common modules (libWrapper, socketlib, etc.) if applicable

## Packaging

- [ ] `node_modules/` is excluded from the release zip
- [ ] `.git/` directory is excluded from the release zip
- [ ] Test files (`*.test.mjs`, `__tests__/`) are excluded
- [ ] `.env`, `*.secret`, and any credential files are excluded
- [ ] Release zip extracts to a single folder named exactly `<module-id>/`
- [ ] Zip file size is reasonable — no binary assets accidentally included
- [ ] `module.json` inside the zip matches the one hosted at the `manifest` URL

## Documentation

- [ ] `README.md` includes installation instructions (manifest URL copy-paste)
- [ ] `README.md` lists required Foundry version and any system dependencies
- [ ] `CHANGELOG.md` has an entry for this version with a summary of changes
- [ ] Breaking changes are clearly marked in the changelog
- [ ] Screenshots or a demo GIF included if the module has a visible UI
