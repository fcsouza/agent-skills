# Foundry VTT System Pre-Publish Checklist

## Manifest
- [ ] `system.json` has all required fields: id, title, description, version, compatibility
- [ ] `system.json` `compatibility.minimum` and `verified` are `"14"`
- [ ] `system.json` `type` is `"system"`
- [ ] `system.json` `documentTypes` declares every subtype the system uses (Actor, Item, and any other typed document)
- [ ] `template.json` is deleted — every type has a `TypeDataModel` (the file is deprecated since v14, removed in v16)
- [ ] Grid defaults use the `grid` object, not the removed flat `gridDistance` / `gridUnits`
- [ ] Pack `name` values match `[A-Za-z0-9_-]` and are unique (duplicates throw)
- [ ] `esmodules` entry points are listed correctly
- [ ] `styles` CSS files are listed correctly
- [ ] `languages` includes at least one language file
- [ ] `packs` paths reference existing pack directories with correct `type` and `system` values

## Data Models
- [ ] `TypeDataModel` is registered in `CONFIG.Actor.dataModels` for every Actor type
- [ ] `TypeDataModel` is registered in `CONFIG.Item.dataModels` for every Item type
- [ ] `defineSchema()` uses `foundry.data.fields` (not plain objects)
- [ ] Any `ActiveEffect` subtype model extends `foundry.data.ActiveEffectTypeDataModel` and keeps a `changes` ArrayField defining `type`, `phase`, `priority`
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
- [ ] `toMessage()` / `ChatMessage.create()` pass `messageMode`, not the deprecated `rollMode`
- [ ] Any custom roll-mode picker reads `CONFIG.ChatMessage.modes`, not `CONFIG.Dice.rollModes`

## Combat
- [ ] `CONFIG.Combat.initiative.formula` is set in the `init` hook
- [ ] Initiative formula references valid roll data keys
- [ ] Combatant overrides (if any) use `libWrapper` for compatibility
- [ ] Turn order and initiative ties are handled per system rules
- [ ] Combatant lookups use `getCombatantsByActor` / `getCombatantsByToken` (they return arrays)
- [ ] Any custom Active Effect expiry timing is registered in `CONFIG.ActiveEffect.expiryEvents` and refreshed via `ActiveEffect.registry.refresh()`

## Migration
- [ ] `migrateData(source, options)` static method exists on every `TypeDataModel` that changed field paths
- [ ] Every `migrateData()` returns the data — `return super.migrateData(source, options)` as the final statement
- [ ] Field-level migrations override `DataField#_migrate`, not the deprecated `migrateSource`
- [ ] Updates use `_del` / `_replace` (`foundry.data.operators`), not the deprecated `-=` / `==` keys
- [ ] Active Effects store changes in `system.changes` with string `type` values, not numeric `mode`
- [ ] `systemSchemaVersion` setting is registered in `init` hook
- [ ] `ready` hook checks schema version and runs migrations
- [ ] Migration runner shows user-facing notification on start
- [ ] Migration is idempotent (safe to run multiple times)

## Sheets
- [ ] Every Actor type has exactly one registered sheet
- [ ] Every Item type has exactly one registered sheet
- [ ] No orphaned types (types defined in `documentTypes` without a sheet)
- [ ] Sheets are registered through `foundry.documents.collections.Actors` / `Items` (core registers no default Actor or Item sheet in v14, so there is nothing to unregister)
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
- [ ] System-specific conditions are added to `CONFIG.statusEffects` by id in `init` (whole-array assignment is deprecated since v14 and wipes other packages' entries)
- [ ] Each status has a unique namespaced `id` (e.g. `"my-system.prone"`)
- [ ] Status entries use `img` / `name`, not the deprecated `icon` / `label`
- [ ] `CONFIG.specialStatusEffects.DEFEATED` points to the system's "dead" status
- [ ] Condition icons exist at the paths referenced in status entries
- [ ] Conditions that modify stats put their changes under `system.changes` with a string `type`

## Hotbar & Macros
- [ ] `hotbarDrop` hook is registered in `ready` (not `init`)
- [ ] Item drag-to-hotbar creates a working script macro
- [ ] Macro script uses UUID to find the item and calls `item.roll()`

## Enrichers
- [ ] Custom enrichers registered via `CONFIG.TextEditor.enrichers` in `init`
- [ ] No TinyMCE code paths remain — ProseMirror is the only editor in v14
- [ ] Enriched syntax (e.g. `@Check[str]`) renders as interactive HTML
- [ ] Enricher click handlers are wired via `data-action` or event listeners

## Code Quality
- [ ] All `.mjs` files use ES module syntax (`import` / `export`)
- [ ] No jQuery usage anywhere in the system
- [ ] No `MeasuredTemplate` usage — area effects use Regions (`canvas.regions.placeRegion`)
- [ ] Console is free of v14 deprecation warnings on world load, sheet open, and a roll
- [ ] CSS uses `@layer` for specificity management
- [ ] No `var` declarations (use `const` or `let`)
- [ ] Private methods use `static #methodName` syntax
- [ ] Section separators use `// --- Section Name ---` convention

## Packaging
- [ ] `system.json` `manifest` URL points to the raw manifest file
- [ ] `system.json` `download` URL points to a versioned release archive
- [ ] All paths in the manifest are relative to the system root
- [ ] No absolute file paths in any configuration file
- [ ] Pack directories (LevelDB) are included in the distribution archive
- [ ] System loads cleanly in a fresh Foundry world with no console errors
- [ ] Build and release tooling runs on Node 24 (`>=24.13.1 <25`), the runtime Foundry v14 ships with
- [ ] No `.html` file is linked for direct browsing — since 14.361 static HTML is served as `text/plain` (Handlebars templates are unaffected)
