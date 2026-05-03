# Foundry VTT System Pre-Publish Checklist

## Manifest
- [ ] `system.json` has all required fields: id, title, description, version, compatibility
- [ ] `system.json` `compatibility.verified` matches the current Foundry version
- [ ] `system.json` `documentTypes` defines all Actor and Item types used by the system
- [ ] `template.json` is consistent with `documentTypes` in `system.json`
- [ ] `esmodules` entry points are listed correctly
- [ ] `styles` CSS files are listed correctly
- [ ] `languages` includes at least one language file
- [ ] `packs` paths reference existing `.db` files with correct `type` and `system` values

## Data Models
- [ ] `TypeDataModel` is registered in `CONFIG.Actor.dataModels` for every Actor type
- [ ] `TypeDataModel` is registered in `CONFIG.Item.dataModels` for every Item type
- [ ] `defineSchema()` uses `foundry.data.fields` (not plain objects)
- [ ] Schema validation passes for all types (no runtime errors on creation)
- [ ] `prepareDerivedData()` computes modifiers, totals, and derived stats correctly
- [ ] `prepareDerivedData()` does not mutate source data (only modifies derived)

## Actor / Item Classes
- [ ] `CONFIG.Actor.documentClass` points to the custom Actor subclass
- [ ] `CONFIG.Item.documentClass` points to the custom Item subclass
- [ ] `getRollData()` returns a flat object suitable for Roll formulas
- [ ] `getRollData()` includes ability modifiers as shorthand keys
- [ ] `_preCreate()` uses `this.updateSource()` (not `this.update()`)
- [ ] `_preCreate()` sets prototype token defaults (name, display, bars, sight)
- [ ] Default items are created via `data.items` in `_preCreate()`, not post-create

## Dice
- [ ] Custom dice terms are registered in `init` hook via `CONFIG.Dice.terms["x"] = MyTerm`
- [ ] Custom roll parser is registered if using non-standard formula syntax
- [ ] Formula resolution has been tested in the Foundry console
- [ ] Roll results display correctly in chat cards

## Combat
- [ ] `CONFIG.Combat.initiative.formula` is set in the `init` hook
- [ ] Initiative formula references valid roll data keys
- [ ] Combatant overrides (if any) use `libWrapper` for compatibility
- [ ] Turn order and initiative ties are handled per system rules

## Migration
- [ ] `migrateData()` static method exists on every `TypeDataModel`
- [ ] Migration concludes with `return super.migrateData(data)` as the final statement
- [ ] `systemSchemaVersion` setting is registered in `init` hook
- [ ] `ready` hook checks schema version and runs migrations
- [ ] Migration runner shows user-facing notification on start
- [ ] Migration is idempotent (safe to run multiple times)

## Sheets
- [ ] Every Actor type has exactly one registered sheet
- [ ] Every Item type has exactly one registered sheet
- [ ] No orphaned types (types defined in `documentTypes` without a sheet)
- [ ] Core sheets are unregistered before registering system sheets
- [ ] Sheet `DEFAULT_OPTIONS.id` is unique and namespaced
- [ ] Sheet `PARTS` templates exist and load without errors

## Localization
- [ ] All user-visible strings use `{{localize "MY_SYSTEM.*"}}` in templates
- [ ] `TYPES.Actor.character` and `TYPES.Actor.npc` keys exist in lang file
- [ ] `TYPES.Item.weapon` and `TYPES.Item.spell` keys exist in lang file
- [ ] Ability labels (`MY_SYSTEM.Abilities.str`, etc.) are localized
- [ ] Section headings (`MY_SYSTEM.Sections.*`) are localized
- [ ] Action labels (roll, add, delete) are localized
- [ ] No hardcoded English strings in `.hbs` templates

## Status Effects & Conditions
- [ ] `CONFIG.statusEffects` is replaced with system-specific conditions in `init`
- [ ] Each status has a unique namespaced `id` (e.g. `"my-system.prone"`)
- [ ] `CONFIG.specialStatusEffects.DEFEATED` points to the system's "dead" status
- [ ] Condition icons exist at the paths referenced in status entries
- [ ] Conditions that modify stats include appropriate `changes` arrays

## Hotbar & Macros
- [ ] `hotbarDrop` hook is registered in `ready` (not `init`)
- [ ] Item drag-to-hotbar creates a working script macro
- [ ] Macro script uses UUID to find the item and calls `item.roll()`

## Enrichers
- [ ] Custom enrichers registered via `CONFIG.TextEditor.enrichers` in `init`
- [ ] Enriched syntax (e.g. `@Check[str]`) renders as interactive HTML
- [ ] Enricher click handlers are wired via `data-action` or event listeners

## Code Quality
- [ ] All `.mjs` files use ES module syntax (`import` / `export`)
- [ ] No jQuery usage anywhere in the system
- [ ] CSS uses `@layer` for specificity management
- [ ] No `var` declarations (use `const` or `let`)
- [ ] Private methods use `static #methodName` syntax
- [ ] Section separators use `// --- Section Name ---` convention

## Packaging
- [ ] `system.json` `manifest` URL points to the raw manifest file
- [ ] `system.json` `download` URL points to a versioned release archive
- [ ] All paths in the manifest are relative to the system root
- [ ] No absolute file paths in any configuration file
- [ ] Pack `.db` files are included in the distribution archive
- [ ] System loads cleanly in a fresh Foundry world with no console errors
