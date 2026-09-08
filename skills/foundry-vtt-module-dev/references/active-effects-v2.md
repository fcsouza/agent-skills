# Active Effects V2

Deep reference for the v14 ActiveEffect model: typed changes, phases, field-guided application, durations with expiry, token targeting, subtypes and compendium storage. Source: `common/documents/active-effect.mjs`, `common/data/active-effect.mjs`, `client/documents/active-effect.mjs`, `client/helpers/active-effect-registry.mjs`, `client/documents/actor.mjs`, `client/documents/token.mjs`.

---

## 1. What changed

| Topic | v13 | v14 |
|---|---|---|
| Where changes live | `effect.changes[]` on the document | `effect.system.changes[]` via `ActiveEffectTypeDataModel` |
| Change mode | `mode: number` (`CONST.ACTIVE_EFFECT_MODES`) | `type: string` (`CONST.ACTIVE_EFFECT_CHANGE_TYPES`), plus `subtract` and free-form custom types |
| Change value | string | `AnyField` — numbers, booleans, arrays, objects stored as-is |
| Timing | one pass, priority only | `phase: "initial" \| "final"` (+ custom phases) and priority |
| Duration | `{startTime, seconds, combat, rounds, turns, startRound, startTurn}` | `duration: {value, units, expiry, expired}` + `start: {combat, combatant, initiative, round, turn, time}` |
| Expiry | none in core | expiry events, `ActiveEffect.registry`, `CONFIG.ActiveEffect.expiryAction` |
| Application code | instance `apply`, `_applyAdd`, ... | static `applyChange`, `applyChangeField`, `_applyChangeAdd`, ... and `DataField#applyChange` |
| Targets | Actor only | Actor, and Token data through `token.*` keys |
| Subtypes | none | `type`/`system`, `CONFIG.ActiveEffect.dataModels`, `documentTypes.ActiveEffect` |
| Storage | embedded only | embedded or in an ActiveEffect compendium with folders |
| `origin` | `StringField` | `DocumentUUIDField({relative: true})` |
| Status effects | array | `CONFIG.statusEffects` proxy indexed by id |
| `CONFIG.ActiveEffect.legacyTransferral` | present | removed |

---

## 2. Schema

`BaseActiveEffect.defineSchema()` (schemaVersion `14.353`):

| Field | Type | Notes |
|---|---|---|
| `name` | StringField | required, text-searchable |
| `img` | FilePathField | initial `ActiveEffect.DEFAULT_ICON` (`icons/svg/aura.svg`) |
| `type` | DocumentTypeField | initial `"base"`; `baseTypeAllowed: true` |
| `system` | TypeDataField | `ActiveEffectTypeDataModel` or a registered subtype model |
| `disabled` | BooleanField | |
| `start` | SchemaField, nullable | `{combat (Combat), combatant (id), initiative, round, turn, time}` |
| `duration` | SchemaField | `{value (int ≥0, nullable), units, expiry (nullable), expired (bool)}` |
| `description` | HTMLField | |
| `origin` | DocumentUUIDField `{relative: true}` | relative UUIDs like `.Item.abc123` are valid |
| `tint` | ColorField | initial `#ffffff` |
| `transfer` | BooleanField | initial `true`; forced `false` on Actor-embedded and world effects in `_preCreate` |
| `statuses` | SetField<StringField> | status ids this effect applies |
| `showIcon` | NumberField | `CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER 0 / CONDITIONAL 1 / ALWAYS 2`, initial `CONDITIONAL` |
| `folder` | ForeignDocumentField(Folder) | compendium and world folders |
| `sort`, `flags`, `_stats` | | |

`duration.units` choices are `CONST.ACTIVE_EFFECT_DURATION_UNITS` = `years, months, days, hours, minutes, seconds, rounds, turns`; initial `"seconds"`. `duration.expiry` defaults to `"turnStart"` when `duration.value` is a number, else `null`.

`ActiveEffectTypeDataModel` (`common/data/active-effect.mjs`) defines the one field every AE type must keep:

```js
changes: new fields.ArrayField(new fields.SchemaField({
  key: new fields.StringField({required: true}),
  type: new fields.StringField({required: true, blank: false, initial: "add"}),   // validated: dot-separated alphanumerics or "custom.<n>"
  value: new fields.AnyField({required: true, nullable: true, serializable: true, initial: ""}),
  phase: new fields.StringField({required: true, blank: false, initial: "initial"}),
  priority: new fields.NumberField()
}))
```

A system may override the `changes` SchemaField but must keep `type`, `phase` and `priority`. At setup `Game` checks every model in `CONFIG.ActiveEffect.dataModels` has an `ArrayField` named `changes`; a missing field is patched in with `console.error`.

Metadata: `hasTypeData`, `indexed`, `compendiumIndexFields: ["_id", "name", "img", "type", "sort", "folder"]`, create permission = parent `OWNER` (or GM for world effects), delete = `OWNER`.

---

## 3. Change types

`CONST.ACTIVE_EFFECT_CHANGE_TYPES` with default priorities:

| Type | Priority | Numbers | Strings | Arrays / Sets | Booleans |
|---|---|---|---|---|---|
| `custom` | 0 | your handler / `applyActiveEffect` hook | | | |
| `multiply` | 10 | `base * value` | — | — | `base && value` |
| `add` | 20 | `base + value` | concat | push / union | `base \|\| value` |
| `subtract` | 20 | `base - value` | remove substring | splice / difference | `base !== value` |
| `downgrade` | 30 | keep lower | — | keep if subset | keep lower |
| `upgrade` | 40 | keep higher | — | keep if superset | keep higher |
| `override` | 50 | replace | replace | replace | replace |

`priority` defaults to the type's `defaultPriority` in `ActiveEffect#prepareBaseData`. Lower runs first.

Custom string types are ignored by core unless registered:

```js
Hooks.once("init", () => {
  CONFIG.ActiveEffect.changeTypes.halve = {
    label: "MYMOD.EFFECT.Halve",
    defaultPriority: 15,
    // ActiveEffectChangeHandler: (targetDoc, change, {field, replacementData, modifyTarget}) => Promise<Record<string, unknown>|void>
    handler: (targetDoc, change, {field, replacementData, modifyTarget=true}={}) => {
      const current = foundry.utils.getProperty(targetDoc, change.key);
      const update = Math.floor(current / 2);
      if ( modifyTarget ) foundry.utils.setProperty(targetDoc, change.key, update);
      return {[change.key]: update};
    },
    // optional ActiveEffectChangeRenderer: ({change, index, fields, defaultPriority}) => Promise<string>
    render: null
  };
});
```

`ActiveEffect.CHANGE_TYPES` merges core and configured types (cached on first access, so register in `init`). When a type has a `handler`, `ActiveEffect.applyChange` calls it and skips field-guided application. Numeric `custom.<n>` types come from migrating v13 modes core did not know.

---

## 4. Phases

Core phases are `CONST.ACTIVE_EFFECT_CHANGE_PHASES = ["initial", "final"]`.

- `Actor#prepareEmbeddedDocuments` calls `this.applyActiveEffects("initial")` (before `prepareDerivedData`).
- `Actor#prepareData` calls `this.applyActiveEffects("final")` after `super.prepareData()` (after derived data).

`Actor#applyActiveEffects(phase)`:

1. Errors (via `Hooks.onError`) if the phase is not in `ActiveEffect.CHANGE_PHASES` or already ran this cycle. Without an argument it logs a deprecation and guesses the phase.
2. Iterates `allApplicableEffects()` (own effects + `transfer: true` item effects), skipping `!effect.active`.
3. Asks `effect.shouldApplyChange(change, {phase, replacementData})` for each change (default: `change.phase === phase`).
4. Splits `token.*` keys into `this.tokenActiveEffectChanges[phase]`; sorts the rest by priority; calls `ActiveEffect.applyChange(this, change, {replacementData})`.
5. Merges results into `this.overrides`. During `"initial"` it also fills `actor.statuses`.

Register extra phases and run them yourself:

```js
CONFIG.ActiveEffect.phases.postCombat = {label: "MYMOD.PHASES.postCombat", hint: "MYMOD.PHASES.postCombatHint"};

class MyActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    this._computeCombatStats();
    this.applyActiveEffects("postCombat");   // once per data-preparation cycle
  }
}
```

`Actor#_clearData()` resets `overrides`, `tokenActiveEffectChanges`, `statuses` and the completed-phase set on every `prepareBaseData`.

---

## 5. Values and `@` references

`change.value` is an `AnyField`. Migration parses v13 string values with `JSON.parse` when possible, so `"2"` becomes `2` and `"[1,2]"` becomes an array. Plain text stays a string.

String values may reference roll data. Replacement data comes from `Actor#getRollData()` passed through `effect.getReplacementData(baseData)` (override to add keys). Resolution:

- `DataField#_replaceDataRefs(raw, data, {strict=true})` runs `Roll.replaceFormulaData(raw, data, {recursive: true})` and throws when an `@` remains (strict).
- `NumberField#_castChangeDelta` then evaluates the string as a roll with `Roll.create(...).evaluateSync().total`, so `"@abilities.str.mod * 2"` works on numeric fields.
- Without a field (unguided path) `ActiveEffect._replaceDataRefs` runs `replaceFormulaData(..., {recursive: true, warn: true})` and casts to the current value's type.

Failures log `Active Effect (<uuid>) | "<type>" change to "<key>" failed to resolve` and leave the value untouched.

```js
await actor.createEmbeddedDocuments("ActiveEffect", [{
  name: "Bless",
  system: {changes: [
    {key: "system.attributes.ac.bonus", type: "add", value: "1d4", phase: "final"},
    {key: "system.traits.languages", type: "add", value: ["celestial"]},
    {key: "system.attributes.speed", type: "multiply", value: 0.5, priority: 5}
  ]},
  duration: {value: 10, units: "rounds", expiry: "turnEnd"}
}]);
```

---

## 6. Field-guided application

`static ActiveEffect.applyChange(targetDoc, change, {replacementData={}, modifyTarget=true})`:

1. Looks up the field: `targetDoc.system.getFieldForProperty(key.slice(7))` for `system.*` keys, else `targetDoc.getFieldForProperty(key)`.
2. If `CHANGE_TYPES[change.type].handler` exists → call it.
3. Else if a field exists → `applyChangeField(targetDoc, change, {field, replacementData, modifyTarget})`, which calls `field.applyChange(current, targetDoc, change, {replacementData})`, cleans and re-validates the result (invalid → original value, warning logged), and sets it when `modifyTarget`.
4. Else → `_applyChangeUnguided(targetDoc, change, changes, {replacementData, modifyTarget})`, the v13-style type switch that infers the type from the current value or `game.model`.

Returns `{[key]: newValue}`.

`DataField#applyChange(value, model, change, {replacementData})` dispatches on `change.type` to `_applyChangeAdd/_applyChangeSubtract/_applyChangeMultiply/_applyChangeOverride/_applyChangeUpgrade/_applyChangeDowngrade/_applyChangeCustom(value, delta, model, change)`. Subclasses specialize: `NumberField` evaluates formulas, `BooleanField` maps arithmetic to logic, `StringField` concatenates, `ArrayField`/`SetField` cast each element with the inner field. `DataField#_applyChangeCustom` fires `Hooks.call("applyActiveEffect", model, change, value, delta, {})`.

Override points, in order of preference:

```js
// 1. Per-field: custom DataField subclass
class DiceStepField extends foundry.data.fields.StringField {
  _applyChangeAdd(value, delta, model, change) { return stepUp(value, delta); }
}

// 2. Per-document: static overrides on your ActiveEffect subclass
class MyEffect extends ActiveEffect {
  static _applyChangeAdd(targetDoc, change, current, delta, changes) {
    if ( change.key === "system.legacyBonus" ) { changes[change.key] = current + delta * 2; return; }
    return super._applyChangeAdd(targetDoc, change, current, delta, changes);
  }
  static _applyChangeCustom(targetDoc, change, current, delta, changes) { /* replaces the hook path */ }
  static applyChangeField(targetDoc, change, options) { /* wrap field-guided path */ return super.applyChangeField(targetDoc, change, options); }
}

// 3. Per-effect gate
class MyEffect extends ActiveEffect {
  shouldApplyChange(change, options) {
    return super.shouldApplyChange(change, options) && !this.system.suspended;
  }
}
```

The instance methods `_applyAdd`, `_applyMultiply`, `_applyOverride`, `_applyUpgrade`, `_applyCustom`, `_applyLegacy` and `applyField` still run when a subclass defines them, with a deprecation warning.

---

## 7. Duration and expiry

Source `duration {value, units, expiry, expired}`; `value` null means indefinite (`prepareBaseData` sets `Infinity`). Prepared `duration` (from `updateDuration()` → `_prepareDuration`) adds `seconds`, `remaining`, `secondsRemaining`, `label`, `_worldTime`. Time units use `game.time.calendar`; `rounds`/`turns` use `CONFIG.time.roundTime/turnTime` and the effect's `start.combat`/`start.combatant` (or the actor's current combatant). Legacy getters `duration.seconds/rounds/turns/type/duration` warn.

`start` is filled by `ActiveEffect.getEffectStart(combat=game.combat)` in `_preCreate` for Actor-owned effects: `{time: game.time.worldTime, combat, combatant, initiative, round, turn}`. Data you pass in `start` wins.

Expiry events: `CONST.ACTIVE_EFFECT_EXPIRY_EVENTS = ["combatStart", "roundStart", "turnStart", "combatEnd", "roundEnd", "turnEnd"]`. `duration.expiry` names the event on which an effect whose duration has run out expires; `null` means "expire as soon as time runs out". `ActiveEffect#isExpiryEvent(event, context)` decides; outside combat any world-time advance satisfies in-combat events except `combatStart`.

`ActiveEffect.registry` (`ActiveEffectRegistry extends IterableWeakSet`) holds every effect with `isExpiryTrackable` (persisted, not in a compendium, embedded, active, has `start`, temporary). It is initialized after world documents are ready. `registry.refresh(event, context)`:

1. Recomputes durations (`effect.updateDuration(context)`), collecting effects whose remaining time changed.
2. Calls `actor.onUpdateEffectDurations(effects, event, context)` per actor (empty in core; override to react on every client).
3. On the active GM, for effects that reached their duration and pass `isExpiryEvent`: `CONFIG.ActiveEffect.expiryAction` `"update"` (default) sets `duration.expired = true` via `foundry.documents.modifyBatch`; `"delete"` deletes them; `null` does nothing.

Core calls `refresh` for `updateWorldTime` and the combat events. Custom events:

```js
CONFIG.ActiveEffect.expiryEvents.shortRest = "MYMOD.EXPIRY.shortRest";   // appears in the sheet's expiry dropdown
async function shortRest(actor) {
  await game.time.advance(3600);                       // advance time first, if it changes
  await ActiveEffect.registry.refresh("shortRest", {actors: new Set([actor])});
}
```

`isSuppressed` returns `system.isSuppressed ?? duration.expired`, so an expired effect stops applying but stays on the actor until deleted.

---

## 8. Token targeting

Changes whose key starts with `token.` are stripped of the prefix and stored in `actor.tokenActiveEffectChanges[phase]`. `TokenDocument#applyActiveEffects(phase)` applies them to the TokenDocument through the same `ActiveEffect.applyChange`, using `TokenDocument#_getReplacementData()`, and merges results into `token.overrides`.

Targetable prefixes: `name, width, height, depth, shape, texture, alpha, disposition, light, sight, detectionModes, ring, turnMarker, movementAction, flags`. `width`, `height`, `depth` and `shape` are computed (`modifyTarget: false`) but not applied — a document update is needed, which the system must perform. Overriding `sight.visionMode` also inflates the vision-mode defaults.

```js
{key: "token.light.bright", type: "override", value: 20}
{key: "token.sight.visionMode", type: "override", value: "darkvision"}
{key: "token.detectionModes.feelTremor.range", type: "upgrade", value: 30}
```

Changed token overrides trigger `_onRelatedUpdate` → token reset and canvas refresh (`_renderActiveEffectChanges`).

---

## 9. Status effects

`CONFIG.statusEffects` is a Proxy over an array, indexed by `id` as well as position. Entries are `{id, name, img, _id?, statuses?, hud?, ...effectData}`.

```js
CONFIG.statusEffects.stunned = {id: "stunned", name: "MYMOD.Stunned", img: "modules/my-module/icons/stunned.svg",
  system: {changes: [{key: "system.attributes.ac.value", type: "add", value: -2}]}};
delete CONFIG.statusEffects.stunned;
CONFIG.statusEffects = [...];        // systems may still assign an array; entries are copied in
```

- `ActiveEffect.fromStatusEffect(statusId, options)` builds an unsaved effect from the config: localizes `name`, adds the id to `statuses`, sets `showIcon` to `ALWAYS` by default, then calls the overridable `_fromStatusEffect(statusId, effectData, options)`. Statuses with extra implicit `statuses` must set a static `_id`.
- `Actor#toggleStatusEffect(statusId, {active, overlay=false})` finds the effect by static `_id` or by single-status match, deletes or creates it, returns the new `ActiveEffect`, `true`, `false` or `undefined`.
- `actor.statuses` is rebuilt during the `"initial"` phase from `effect.statuses` of active effects.
- `CONFIG.specialStatusEffects` (`INVISIBLE`, `BLIND`, `BURROW`, `HOVER`, `FLY`, ...) still maps names to ids; `Actor#prepareData` notifies tokens with `_onApplyStatusEffect` when one flips.

---

## 10. Subtypes and compendium storage

ActiveEffect has type data. Declare subtypes in the manifest and register models:

```json
{"documentTypes": {"ActiveEffect": {"condition": {}, "aura": {}}}}
```

```js
class ConditionEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),              // keeps `changes`
      severity: new foundry.data.fields.NumberField({integer: true, min: 1, initial: 1}),
      isSuppressed: new foundry.data.fields.BooleanField()   // read by ActiveEffect#isSuppressed
    };
  }
}
Hooks.once("init", () => {
  CONFIG.ActiveEffect.dataModels.condition = ConditionEffectData;
  CONFIG.ActiveEffect.typeLabels.condition = "MYMOD.TYPES.condition";
});
```

`CONFIG.ActiveEffect.dataModels.base` is `ActiveEffectTypeDataModel`; `defaultType: "base"`. `ActiveEffect` is in `CONST.SYSTEM_SPECIFIC_COMPENDIUM_TYPES` (packs of type `ActiveEffect` belong to a system) and `CONST.FOLDER_DOCUMENT_TYPES`. `toCompendium` clears `origin` and `start` unless `clearState: false`. Compendium effects are never expiry-tracked.

`TokenLayer#_onDropActiveEffect` lets users drop a compendium effect onto a token.

---

## 11. Sheet and Region behavior

`ActiveEffectConfig` renders each change through `_renderChange({change, index, fields, defaultPriority, changeTypes})`: non-string values are JSON-stringified for the input, field paths become `system.changes.<i>.<field>`, and `CHANGE_TYPES[type].render` may return custom row HTML (`templates/sheets/active-effect/change.hbs` is the default). `_processChangeSubmission(change, index)` parses the form back.

The `applyActiveEffect` RegionBehavior (`CONFIG.RegionBehavior.dataModels.applyActiveEffect`) has `effects: SetField<DocumentUUIDField({type: "ActiveEffect"})>`. On `tokenEnter` it creates copies of those effects on the token's actor; on `tokenExit` it deletes them; editing the behavior recreates them for every token inside via `modifyBatch`.

---

## 12. Migration recipes

Stored data migrates on load (`BaseActiveEffect.migrateData`): `changes` → `system.changes`, `mode` → `type` (`0 custom, 1 multiply, 2 add, 3 downgrade, 4 upgrade, 5 override`, unknown → `custom.<n>`), string values parsed, `duration.startTime/startRound/startTurn/combat` → `start.*`, `duration.seconds|rounds|turns` → `value` + `units`, unparseable `origin` → `flags.core.originText`. Code must change by hand:

```js
// Modes → types
{key, mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "10"}   →   {key, type: "override", value: 10}

// Root changes → system.changes
effect.changes.map(...)            →   effect.system.changes.map(...)
effect.update({changes})           →   effect.update({"system.changes": changes})

// Duration
{duration: {seconds: 60}}          →   {duration: {value: 60, units: "seconds"}}
{duration: {rounds: 3}}            →   {duration: {value: 3, units: "rounds", expiry: "turnStart"}}
effect.duration.remaining          →   unchanged name; now in the stored unit (rounds/turns/seconds)

// legacyTransferral
CONFIG.ActiveEffect.legacyTransferral = false;   // delete the line; only the "modern" model exists
                                                 // item effects apply through `transfer: true`, read via actor.allApplicableEffects()

// Application overrides
_applyAdd(actor, change, current, delta, changes)   →   static _applyChangeAdd(targetDoc, change, current, delta, changes)
effect.apply(actor, change)                          →   ActiveEffect.applyChange(actor, change, {replacementData})
ActiveEffectConfig.DEFAULT_PRIORITIES                →   CONFIG.ActiveEffect.changeTypes[type].defaultPriority / ActiveEffect.CHANGE_TYPES
```

---

## Pitfalls

- Register `changeTypes`, `phases` and `expiryEvents` during `init`. `ActiveEffect.CHANGE_TYPES`, `CHANGE_PHASES` and `EXPIRY_EVENTS` are cached on first access.
- A change with an empty `key` is skipped. A change whose `phase` is not a registered phase never applies.
- `Actor#applyActiveEffects("initial")` twice in one cycle raises an error through `Hooks.onError`. Custom phases run once per cycle too.
- Field-guided results are cleaned and validated. Pushing `"celestial"` into a `SetField` with `choices` that lacks it silently keeps the old value and logs a warning.
- `effect.changes` is a getter on the instance and a non-enumerable shim on source data; `toObject()`, `toJSON()` and `deepClone` do not carry it. Use `system.changes`.
- `duration.expired` only flips when `expiryAction` is `"update"` and an active GM is connected. Player-only sessions never expire effects.
- `start` is `null` for world-level (unembedded) effects and for effects created on Items; only Actor-owned effects get `getEffectStart()` data, and only those are expiry-trackable.
- `isTemporary` is true when `expiry` is set or `value` is finite. An effect with `value: null, expiry: "turnEnd"` is temporary but never reaches its duration; use `expiry` together with a numeric `value`.
- Token-targeted `width`, `height`, `depth`, `shape` land in `token.overrides` but do not resize the token. Handle the update in your system.
- `Combat#getCombatantsByActor(actor)` is used for combat-based durations; effects on unlinked tokens resolve through the synthetic actor's combatant.
