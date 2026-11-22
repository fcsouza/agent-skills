# Property patterns

Every spec on this page ran under `@antithesishq/bombadil` 0.8.0 and typechecked with `tsc --strict`. The browser target was a local page served on `127.0.0.1` with one planted bug per pattern. The terminal target was a small Bun REPL with a planted bug. Each section says how the property fired.

## Writing a property from a user's rule

1. Write the rule as one sentence about what the user sees: "There are never more than five notifications."
2. Pick the shape. "Never" or "always" is an invariant. "Goes away", "shows up" or "finishes" is a guarantee with a time bound. "Only moves by", "can only go from X to Y" is a state machine.
3. Write an extractor for each value the rule mentions. Read the DOM or the terminal grid the way a user would see it: visible text, element counts, not internal variables.
4. Write the property, named after the rule.
5. Check it on a version of the app you know is correct. A property that fails on correct code measures something else, often sampling or a reload.
6. Then run it on the real app.

## Browser spec used for the four patterns

```typescript
import { always, eventually, next, now } from '@antithesishq/bombadil';
import { isAction } from '@antithesishq/bombadil/actions';
import { extract, weighted } from '@antithesishq/bombadil/browser';
import { back, clicks, forward, inputs, scroll } from '@antithesishq/bombadil/browser/defaults/actions';
export {
  noConsoleErrors,
  noHttpErrorCodes,
  noUncaughtExceptions,
  noUnhandledPromiseRejections,
} from '@antithesishq/bombadil/browser/defaults/properties';

const notificationCount = extract((state) => state.document.querySelectorAll('.notification').length);
const errorText = extract((state) => state.document.querySelector('.error')?.textContent ?? null);
const counter = extract((state) => Number(state.document.querySelector('#counter')?.textContent ?? '0'));
const deleted = extract((state) => state.document.body?.dataset.deleted === 'yes');

// Invariant: "never more than five notifications".
export const maxFiveNotifications = always(() => notificationCount.current <= 5);

// Guarantee: an error message goes away within five seconds (the page clears it after one).
export const errorDisappears = always(
  now(() => errorText.current !== null).implies(eventually(() => errorText.current === null).within(5, 'seconds')),
);

// State machine: each step leaves the counter alone, adds one, subtracts one, or resets to zero.
const step = (ok: (before: number, after: number) => boolean) =>
  now(() => {
    const before = counter.current;
    return next(() => ok(before, counter.current));
  });
export const counterSteps = always(
  step((a, b) => b === a)
    .or(step((a, b) => b === a + 1))
    .or(step((a, b) => b === a - 1))
    .or(step((_a, b) => b === 0)),
);

// Canary for the filter below: fails if the destructive button was ever clicked.
export const neverDeleted = always(() => !deleted.current);

// Default clicks minus the destructive control. Export only this, never the original `clicks`.
const safeClicks = clicks.filter(
  (action) => !(isAction(action, 'Click') && action.Click.fingerprint.testId === 'delete-all'),
);

export const actions = weighted([
  [100, safeClicks],
  [100, inputs],
  [50, scroll],
  // No reload: a reload wipes client state and would hide a stuck error message.
  [10, back],
  [1, forward],
]);
```

## Invariant: never more than five notifications

Planted bug: the "Notify" button stopped dropping the oldest notification at five. Both runs against it exited `2`. The first printed:

```text
maxFiveNotifications was violated:

as of 00:00.000, it should always be the case that () => notificationCount.current <= 5, however at 00:59.198, notificationCount = 6
```

`shrink` cut the 96-action trace to six clicks on "Notify". That is the report to give the user.

## Guarantee: the error message goes away

Planted bug: the "Save" error never cleared. With the spec above, the run exited `2` in under six seconds:

```text
errorDisappears was violated:

as of 00:00.000, it should always be the case that if () => errorText.current !== null then within 5 seconds () => errorText.current === null, however from the prior state at 00:00.177, errorText = Could not save, failing the implication because () => errorText.current === null was never true before 00:05.194
```

Two traps showed up while writing this property.

- **A tight bound gives false alarms.** The correct page cleared the error after 1 second. With `.within(2, 'seconds')`, a clean run still failed: one click took nearly 2 seconds, no state was captured in between, and the next state came 2.1 seconds after the error appeared. Bombadil checks only the states it captures. Give the bound several times the app's own delay.
- **Reload hides the bug.** With the default `navigation` generator in the actions, the buggy page passed a 90-second run. The log showed 153 reloads, and each reload cleared the stuck message before the bound ran out. Removing `reload` from the actions exposed the bug at once. For any property about client state that a reload resets, leave `reload` out, or write the property so a reload does not satisfy it. Both traps were seen during the test runs; their logs were not kept.

## State machine: the counter moves by one

Planted bug: "Increment" jumped from 3 to 5. The run exited `2` with `counterSteps was violated`.

List every legal step, including the ones you do not think of as steps. The "reset to zero" branch covers the "Reset" button and a reload. Without the "unchanged" branch, every action that does not touch the counter would fail the property.

## Default properties: nothing crashes

Planted bug: "Reset" threw an `Error` in its click handler. The run exited `2` with `noUncaughtExceptions was violated`. No custom code was needed: the default properties catch uncaught exceptions, unhandled promise rejections, `console.error` calls and HTTP 4xx and 5xx page responses.

## Safety filter and canary

The `neverDeleted` canary held through every run of the spec above. None of those run logs shows a click on "Delete all data"; only the two runs that used `export *` from the defaults clicked it. A second spec used `export * from '@antithesishq/bombadil/browser/defaults'` plus an exported filtered `safeClicks`. Its first action clicked "Delete all data", and the canary fired:

```text
00:00.011 Clicking <button> (x: 544.6, y: 124.4, content: "Delete all data")
neverDeleted was violated:
```

`export *` brings in `defaultActions`, which still holds the unfiltered `clicks`.

## Terminal: invariant on a REPL

The CLI printed `count: N` and a prompt, and read `add`, `sub` and `quit`. Planted bug: `sub` had no floor at zero.

```typescript
import { always } from '@antithesishq/bombadil';
import { extract, weighted } from '@antithesishq/bombadil/terminal';
export { exitSuccess, noReplacementChars } from '@antithesishq/bombadil/terminal/defaults';

// The last "count: N" line on screen, or null before the first render.
const count = extract((state) => {
  for (let row = state.grid.size.rows - 1; row >= 0; row--) {
    const match = state.grid.rowText(row).match(/count: (-?\d+)/);
    if (match) return Number(match[1]);
  }
  return null;
});

export const countNeverNegative = always(() => count.current === null || count.current >= 0);

export const commands = weighted([
  [3, { TypeText: { Regexp: 'add\r' } }],
  [4, { TypeText: { Regexp: 'sub\r' } }],
  [3, { TypeText: { Regexp: '[a-z]{1,8}\r' } }],
]);
```

```text
countNeverNegative was violated:

as of 00:01.245, it should always be the case that:

() => count.current === null
  || count.current >= 0

however at 00:01.315, count = -1.0
```

The default terminal input (`typeBasicInput`) types random Unicode and control keys. It would rarely type a whole command, so a REPL needs a custom generator of real commands. Weights steer the search: with `add` weighted above `sub`, a 60-second run never went below zero; with `sub` above `add`, the bug showed within a second.

## Other shapes from the manual

These are from the manual and not verified here.

- **Sliding window:** read a value once in an outer `now`, then `always` compare against it.
- **Contextful guarantee:** read the typed name in an outer `always(() => ...)`, then require `eventually(() => notification includes name).within(...)` after a submit.
- **Resource leaks:** `noResourceLeak({ metric: 'dom_nodes', growthLimit: 500, windowMillis: 1_000 })` from `browser/extras/resources`. A spec with it ran for 15 seconds and exited `0` against a page with no leak; it was not tested against a leak. Prefer `dom_nodes` or `js_event_listeners` to heap metrics, which garbage collection makes noisy.
