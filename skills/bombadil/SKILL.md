---
name: bombadil
license: MIT
description: >-
  Use when a web or terminal UI needs property-based testing or fuzzing with Bombadil (Antithesis): writing a TypeScript specification with properties, extractors and action generators, running a bounded `bombadil browser test` or `bombadil terminal test`, reading a trace with `bombadil trace --json`, reproducing or shrinking a violation, or adding the bombadil-action GitHub Action to CI. Also use when the user wants random clicks and inputs to hunt UI bugs that example tests miss, wants a UI rule such as "never more than five notifications" or "the error goes away" checked over every state, or says @antithesishq/bombadil, property-based UI testing, fuzz the UI, testa a UI com fuzz, teste baseado em propriedades, fuzzing de interface or acha bug de UI com Bombadil.
---

# Bombadil

Bombadil is property-based testing for UIs, from Antithesis. You write a TypeScript specification that exports properties and action generators. Bombadil drives Chrome (browser driver) or a pseudo-terminal (terminal driver), picks random actions, and checks every property on every state it captures. A violation comes back as a trace you can replay and shrink.

This skill was checked against `@antithesishq/bombadil` 0.8.0 on macOS arm64 with Bun 1.4.4 and Chrome. Lines marked "not verified here" were read in the docs but not run. The terminal driver, `fuzz` and `shrink` carry the EXPERIMENTAL label in 0.8.0.

## When to use it, and when not

Use it to find bugs nobody wrote a test for: odd action orders, double clicks, back and forward, timing, strange input. It complements example tests. It does not replace them.

It needs a runnable app. The browser driver needs Chrome or Chromium on the machine. The terminal driver runs any program that reads stdin and writes to a terminal.

Skip it for pure logic with no UI, for a page you cannot run locally or on staging, and when the user wants one specific flow checked. Write an example test for that.

In the team process this skill comes from, every correction the user makes becomes a deterministic check, and most agent tokens go to verification. Bombadil is the fuzz layer of that process for UIs. A rule the user states becomes a property, and the property runs on every state from then on.

## The loop Bombadil runs

1. Extract the current state from the page or the terminal.
2. Check every exported property against it and record violations.
3. Pick the next action from the exported generators, by weight, and perform it.
4. Wait for an event: navigation, DOM change or timeout in the browser; output bytes or timeout in the terminal.
5. Go to step 1.

## Install

```bash
bun add -d @antithesishq/bombadil@0.8.0
bunx bombadil --version        # bombadil 0.8.0
```

The npm package ships prebuilt binaries for linux-x64, linux-arm64 and darwin-arm64 only, and the TypeScript types. Intel macOS gets `unsupported platform`. Pin the version: the manual on the website can be ahead of the package.

## Workflow

1. **Get a safe target.** Start the app on localhost or a staging host with disposable data. Never point Bombadil at production or a third-party site. Generators click everything they can reach, including "Delete", "Pay" and "Send".
2. **Turn the user's rules into properties.** One exported property per rule, named after the rule. See "From a rule to a property" below.
3. **Choose actions.** Start from the defaults. Filter out destructive controls. Add custom generators for flows random clicks rarely reach.
4. **Typecheck the spec** before you run it: `bunx tsc --noEmit --strict --target esnext --module preserve --moduleResolution bundler --lib esnext,dom --skipLibCheck bombadil/spec.ts`. Add `--ignoreConfig` when the folder has a `tsconfig.json`; TypeScript 7 refuses file arguments next to one otherwise. A type error found by `tsc` costs seconds; one found by Bombadil costs a Chrome start.
5. **Run a bounded test.** Always pass `--time-limit` and `--exit-on-violation`, and `--headless` for the browser.
6. **Read the trace**, reproduce it with the same options, then shrink it.
7. **Fix the app, not the property.** Replay the shrunk trace against the fix, then run a fresh bounded test.
8. **Report** the violation to the user in the app's own words, with the trace as evidence.
9. **Wire it into CI** once the spec is stable.

## A bounded run for an agent

```bash
mkdir -p .bombadil
bunx bombadil browser test --headless --time-limit 2m --exit-on-violation \
  --output-path .bombadil/run-1 http://localhost:3000/ bombadil/spec.ts
echo "exit=$?"

bunx bombadil terminal test --specification bombadil/cli.spec.ts \
  --time-limit 1m --exit-on-violation --output-path .bombadil/cli-1 ./my-cli --flag
```

Without `--time-limit` a test runs until you stop it. Without `--output-path` the trace goes to a temp file you then have to find. The output path names a file, not a directory. Its parent must exist, and an existing file is refused unless you pass `--output-path-overwrite`. Add the trace folder to `.gitignore`.

Exit codes seen in 0.8.0: `0` for a clean run that hit the time limit. `2` for a browser violation. `1` for a terminal violation, although the manual says `2`. `1` for runtime errors such as a bad output path. `2` also for a command-line usage error. So never read the exit code alone: read the last lines of output too. The browser driver ends with "Test finished, finding N violation!" and prints the exact `inspect` and `--reproduce` commands; the terminal driver ends with "terminal test failed: N violation(s) reported".

## From a rule to a property

Properties are formulas over time. An extractor turns state into a cell, and a property reads `cell.current`.

| The user says | Property shape |
| --- | --- |
| "Never more than five notifications" | Invariant: `always(() => count.current <= 5)` |
| "The error message goes away" | Guarantee: `always(now(() => shown).implies(eventually(() => !shown).within(5, 'seconds')))` |
| "The counter only moves by one" | State machine: `always(step1.or(step2)...)`, each step built with `now` and `next` |
| "Nothing crashes" | Default properties: uncaught exceptions, unhandled rejections, console errors, HTTP 4xx and 5xx |

Each of these caught a planted bug in a local test page. `references/property-patterns.md` has the full specs, how each one fired, and the two traps hit while writing them: a tight `within` bound gives false alarms, and the default `reload` action can hide a stuck error.

`references/spec-language.md` has the import paths, extractor state, cells, formula operators, action shapes for both drivers, `weighted`, `filter`, `map`, `flatMap`, `when`, and custom actions.

## Actions and safety

The browser defaults weight clicks 100, inputs 100, scroll 50, navigation (back, forward, reload) 10 and wait 1. The terminal defaults type safe Unicode and common control keys.

To keep a destructive control out of reach, filter `clicks` on the element fingerprint and export your own weighted set. Do not also write `export * from '@antithesishq/bombadil/browser/defaults'`: it exports `defaultActions`, which still holds the unfiltered `clicks`. In a test here, a spec with `export *` plus a filtered copy clicked "Delete all data" in its first action. Export the default properties by name instead.

```typescript
const safeClicks = clicks.filter(
  (action) => !(isAction(action, 'Click') && action.Click.fingerprint.testId === 'delete-all'),
);
export const actions = weighted([[100, safeClicks], [100, inputs], [50, scroll], [10, back], [1, forward]]);
```

Add a canary property, such as "the delete flag is never set", so a filter that stops working fails loudly. Filtering is a second line of defence: the first is disposable data.

## Reading, reproducing and shrinking

```bash
bunx bombadil trace .bombadil/run-1                      # one line per state, violations marked
bunx bombadil trace .bombadil/run-1 --json \
  | jq -c 'select(.metadata.violations | length > 0) | {index, action: .metadata.action, violated: [.metadata.violations[].name]}'
bunx bombadil browser test --headless --reproduce .bombadil/run-1 http://localhost:3000/ bombadil/spec.ts
bunx bombadil browser shrink --headless --trace .bombadil/run-1 --time-limit 5m \
  --output-path .bombadil/run-1-shrunk http://localhost:3000/ bombadil/spec.ts
```

Use the same origin, spec and options for `--reproduce` and `shrink` as for the original test. Browser `--reproduce` refuses `--time-limit` and `--exit-on-violation`. Shrinking here cut a 96-action browser trace to 6 clicks in 75 seconds, and an 8-action terminal trace to 1. After the fix, replaying the shrunk trace exits `0`, so that replay is your regression check. `references/cli-and-traces.md` has every flag, the JSON fields, screenshots, `inspect` and the output path rules.

## Reporting a violation

Tell the user what happened in the app's own words, not in Bombadil's:

1. The rule that broke, by property name and in plain words.
2. The shortest steps to reach it, read from the shrunk trace: "Click Notify six times. A sixth notification appears."
3. What the user sees, from the trace or its screenshot.
4. The evidence: the trace path, the `bombadil trace` line that marks the violation, and the reproduce command.

Do not weaken a property to make a run pass. Loosen one only when the rule itself was wrong or the check measures sampling noise, say so to the user, and keep the original failing trace. A time bound you raised to stop false alarms is fine; a limit you raised from five to six notifications is not.

## CI

`antithesishq/bombadil-action` runs a bounded test in GitHub Actions. Pin `version: 0.8.0`, because the action's own default is older. Upload the output path as an artifact with `if: always()`, since the action does not. `references/ci.md` has a workflow. It is not verified here.

## Pitfalls

- Do not run Bombadil against production or a site you do not own. It clicks every reachable control.
- Do not `export *` the browser defaults next to a filtered `clicks`. The original stays exported inside `defaultActions`.
- Do not trust the exit code alone. A violation is `2` in the browser and `1` in the terminal, and a usage error is also `2`.
- Do not set a `within` bound close to the app's own timer. States are sampled, and a gap between two samples exceeded a 2-second bound on a message the page cleared after 1 second.
- Do not leave `reload` on when a property is about client state that a reload resets. 153 reloads in 90 seconds hid a stuck error message until reload was removed from the actions.
- Raise `--quiescence-timeout-ms` for a slow terminal program. At the default 5 ms, a Bun CLI was sampled before it had redrawn.
- `bombadil browser inspect` binds to `0.0.0.0`. Run it with `--no-open` and a `--port`, and stop it when done.
- In 0.8.0 the types for `@antithesishq/bombadil/browser/extras/resources` are missing from the package, so `tsc` fails on that import even though Bombadil runs it.

## Files

- `references/spec-language.md`: read when you write or change a spec. Imports, extractors, cells, formulas, action shapes, generator combinators, custom actions.
- `references/property-patterns.md`: read when you turn a user's rule into a property. Invariant, guarantee and state machine specs that caught planted bugs, with the traps.
- `references/cli-and-traces.md`: read when you run, reproduce, shrink or inspect. Commands, flags, exit codes, output paths, trace JSON, real output.
- `references/ci.md`: read when you add Bombadil to GitHub Actions.
- `references/sources.md`: read when you need the page behind a claim.
- [NOTICE.md](NOTICE.md): credit and licence for examples that follow the Bombadil manual.

## Related skills

- `runtime-verification`: run the app and check it with real tools; Bombadil is its fuzz layer for UIs.
- `formal-verification`: model-check a flow when random exploration cannot cover the state space.
- `encode-corrections`: turn each correction into a check; a UI rule often becomes a Bombadil property.
- `judge`: review the change that fixes a violation before merge.
