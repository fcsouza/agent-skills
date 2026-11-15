# Namespaces (`foundry.*`)

Since v13 nearly every core class lives under `foundry.*`. Release 13.332 kept the old global names as redirects with a deprecation warning until Version 15. v14 removed the v12-era shims: bare `mergeObject`, `getProperty`, `Die`, `DiceTerm` and friends are gone. Write namespaced paths in every new file, and update old files when you touch them.

| Legacy global | Namespaced path |
|---|---|
| `Application`, `FormApplication` | `foundry.appv1.api.Application` (use ApplicationV2) |
| `Dialog` | `foundry.appv1.api.Dialog` (use `DialogV2`) |
| `ApplicationV2`, `HandlebarsApplicationMixin`, `DialogV2`, `DocumentSheetV2` | `foundry.applications.api.*` |
| `ActorSheetV2`, `ItemSheetV2` | `foundry.applications.sheets.*` |
| `Hooks` | `foundry.helpers.Hooks` (the global `Hooks` still works) |
| `Canvas`, `CanvasLayer` | `foundry.canvas.Canvas`, `foundry.canvas.layers.CanvasLayer` |
| `Token`, `Tile`, `Region` (canvas objects) | `foundry.canvas.placeables.*` |
| `Document`, `DataModel`, `TypeDataModel` | `foundry.abstract.*` |
| `fields.*` (`NumberField`, `SchemaField`, ...) | `foundry.data.fields.*` |
| `Roll`, `Die`, `DiceTerm` | `foundry.dice.Roll`, `foundry.dice.terms.*` |
| `Actors`, `Items` (sidebar collections) | `foundry.documents.collections.*` |
| `DocumentSheetConfig` | `foundry.applications.apps.DocumentSheetConfig` |
| `loadTemplates`, `renderTemplate` | `foundry.applications.handlebars.*` |
| (no legacy name) | `foundry.applications.fields.*`: `createFormGroup`, `createSelectInput`, `createNumberInput` and the other input builders |
| (no legacy name) | `foundry.applications.ux.*`: `Tabs`, `ContextMenu`, `DragDrop`, `FormDataExtended`, `SearchFilter`, `TextEditor` |
| `mergeObject`, `duplicate`, `isNewerVersion`, `debounce` | `foundry.utils.*` (bare globals removed in v14) |
| (new in v14) | `foundry.data.operators.*`: `ForcedDeletion`, `ForcedReplacement` (globals `_del`, `_replace`) |
| (new in v14) | `foundry.data.ActiveEffectTypeDataModel` |

Destructure once at the top of a file:

```javascript
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const fields = foundry.data.fields;
```

Check a path you are unsure of against the v14 API docs: https://foundryvtt.com/api/v14/
