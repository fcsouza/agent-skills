# Specification language cheatsheet

Checked against the type declarations in `@antithesishq/bombadil` 0.8.0. Every import path below typechecked with `tsc --strict --moduleResolution bundler`, except where marked.

A specification is an ES module in TypeScript or JavaScript. Every export of the top-level module must be a property (a `Formula`) or an action generator (an `ActionGenerator`). Bombadil uses all of them. The export name is the name in violation reports, so name it after the rule.

## Import paths

| Path | What it gives you |
| --- | --- |
| `@antithesishq/bombadil` | `always`, `eventually`, `next`, `now`, `not`, `extract`, `actions`, `weighted`, `registerCustomAction`, `ActionGenerator`, types `Formula`, `Cell`, `JSON` |
| `@antithesishq/bombadil/browser` | Typed `extract`, `actions`, `weighted`, `registerCustomAction`, `getFingerprint`, types `State`, `Action`, `ActionTemplate`, `Point`, `Fingerprint` |
| `@antithesishq/bombadil/browser/defaults` | The four default properties and `defaultActions` |
| `@antithesishq/bombadil/browser/defaults/properties` | `noHttpErrorCodes`, `noUncaughtExceptions`, `noUnhandledPromiseRejections`, `noConsoleErrors` |
| `@antithesishq/bombadil/browser/defaults/actions` | `clicks`, `inputs`, `scroll`, `back`, `forward`, `reload`, `navigation`, `waitOnce`, `lastAction` |
| `@antithesishq/bombadil/terminal` | Typed `extract`, `actions`, `weighted`, types `State`, `Grid`, `Action`, `ActionTemplate` |
| `@antithesishq/bombadil/terminal/defaults` | `exitSuccess`, `noReplacementChars`, `typeBasicInput` |
| `@antithesishq/bombadil/terminal/defaults/actions` | `CharSets`, `typeFromSet`, `pasteText` |
| `@antithesishq/bombadil/actions` | `isAction`, `CharSet`, `branch`, `leaf`, types `Range`, `Tree` |
| `@antithesishq/bombadil/browser/extras/resources` | `noResourceLeak`. Bombadil runs it, but the 0.8.0 package's `exports` map has no entry for this path, so `tsc` fails on it |

Import `extract` from the driver path (`/browser` or `/terminal`), not from the package root. The driver version types `state` for you.

Specs can import local modules, npm packages that do not need Node built-ins, and JSON, text or binary files with import attributes (`with { type: 'json' }`, `'text'`, `'binary'`). Imports of data files are from the manual and not verified here.

## Extractors and cells

```typescript
const notificationCount = extract((state) => state.document.querySelectorAll('.notification').length);
```

`extract` runs its function on every captured state and returns a `Cell`. Read the value with `.current`. The function must return JSON-serialisable data. `cell.map(f)` gives a derived cell.

Browser `state` has `document`, `window`, `navigationHistory` (`back`, `current`, `forward`), `errors.uncaughtExceptions`, `console` (warning and error entries), `lastAction` and `resources` (`js_heap_used`, `dom_nodes`, `js_event_listeners`, `layout_objects` and more). The browser extractor runs inside the page.

Terminal `state` has `grid` (`size.rows`, `size.columns`, `rowText(i)`, `row(i)` with cell styles), `scrollback`, `scrollOffset`, `cursor`, `exitStatus` (`{ code, signal }` or `null`) and `lastAction`.

Define extractors at the top level of the module, as every manual example does, and read them inside properties and generators.

## Formulas

- `always(x)`: `x` holds now and in every later state.
- `eventually(x)`: `x` holds now or in some later state. Add `.within(n, 'seconds')` or `.within(n, 'milliseconds')` to bound it.
- `next(x)`: `x` holds in the next state.
- `now(x)`: turns a thunk into a formula, so you can use connectives.
- Connectives are methods: `a.and(b)`, `a.or(b)`, `a.implies(b)`, `a.not()`, and the function `not(x)`.

Operators accept a thunk (`() => boolean`) wherever they take a formula. To compare a value across states, read it in an outer thunk and close over it in the inner one:

```typescript
now(() => {
  const before = counter.current;
  return next(() => counter.current === before + 1);
});
```

## Action shapes

Browser (`ActionTemplate` from `/browser`):

- `'Back'`, `'Forward'`, `'Reload'`, `'Wait'`
- `{ Click: { fingerprint, point: { x, y } } }`, `{ DoubleClick: { fingerprint, point } }`
- `{ TypeText: { text: StringGenerator } }`, `{ PressKey: { code } }`
- `{ ScrollUp: { origin, distance } }`, `{ ScrollDown: { origin, distance } }`
- `{ SetFileInputFiles: { selector, files } }`, `{ MouseDrag: { from, to, steps, delayMillis } }`, `{ SetViewport: { width, height } }`

Terminal (`ActionTemplate` from `/terminal`):

- `{ TypeText: StringGenerator }`, `{ Resize: { columns, rows } }`, `{ Click: { row, column } }`, `{ ScrollUp: {} }`, `{ ScrollDown: {} }`

A `StringGenerator` is a literal string, `{ Text: [min, max] }` (random text of that length), `{ Regexp: '...' }` or `{ CharSet: entries }`. A number in a template can be a `Range`, either a number or `[min, max]`.

In the terminal, Enter is `\r`. `{ TypeText: { Regexp: 'add\r' } }` typed `add` and Enter into a Bun REPL in a test here.

A fingerprint identifies an element by `testId` (from `data-testid`, `data-test-id`, `data-cy` or `data-test`), `id`, `role`, `accessibleName`, `tag`, `href`, `nameAttr`, `placeholder`, `inputType` and `textContent`. Add a `data-testid` to a control you need to filter.

## Action generators

```typescript
export const commands = actions(() => [
  { TypeText: { Regexp: 'add\r' } },
  { TypeText: { Regexp: 'sub\r' } },
]);

export const weightedCommands = weighted([
  [3, { TypeText: { Regexp: 'add\r' } }],
  [4, { TypeText: { Regexp: 'sub\r' } }],
  [3, { TypeText: { Regexp: '[a-z]{1,8}\r' } }],
]);
```

`actions(fn)` runs `fn` on every state; return only actions possible in that state, or `[]`. `weighted([[w, generatorOrTemplate], ...])` picks by weight. Branches are equal by default.

Transform a generator instead of rewriting it. Weights carry over.

- `gen.filter(pred)`: drop actions. Use `isAction(action, 'Click')` to narrow the type first.
- `gen.map(f)`: replace each action with one other action.
- `gen.flatMap(f)`: replace each action with an array (picked evenly) or a generator. `[]` drops it.
- `gen.when(cond)`: run the generator only while `cond` (a boolean, a `Cell<boolean>` or a function) is true.

A terminal spec here chained all three on one weighted generator: `map` turned every `add` into `sub`, `flatMap` returned `[]` for junk input, and `when` waited on a `count.map((value) => value !== null)` cell. The trace held only `sub` actions. Export only the transformed generator. If the original stays exported, directly or through `export *`, Bombadil still uses it.

## Custom actions (browser only)

`registerCustomAction(name, async (document, window, ...args) => { ... })` returns a function. Call it inside an action generator to produce the action, for example to get past a login form or a cookie banner fast. Guard it with a cell so it only appears where it can run. From the manual; not verified here. The terminal driver has no custom actions.

## Default properties

Browser: `noHttpErrorCodes` (the page's navigation response is under 400), `noUncaughtExceptions`, `noUnhandledPromiseRejections`, `noConsoleErrors`. An uncaught `throw` in a click handler fired `noUncaughtExceptions` in a test here.

Terminal: `exitSuccess` (no non-zero exit code) and `noReplacementChars` (no U+FFFD, the sign of malformed UTF-8).

The manual says a run without a spec file uses exactly these defaults. Not verified here.
