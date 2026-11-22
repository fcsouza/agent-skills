# CLI, traces, reproduce and shrink

Every command and flag here was seen in `--help` or run under `@antithesishq/bombadil` 0.8.0 on macOS arm64. Output is trimmed. Paths are relative to the project.

## Running the binary

`bun add -d @antithesishq/bombadil@0.8.0` installs a `bombadil` launcher and the platform binary. `bunx bombadil ...` runs it. `bunx --bun bombadil --version` also works, so Node is not required. A `package.json` script can call `bombadil` directly.

Subcommands in 0.8.0:

| Command | Status in 0.8.0 |
| --- | --- |
| `bombadil browser test` | stable |
| `bombadil browser test-external` | stable; drives a browser or Electron app you started with a debugging port. Not run here |
| `bombadil browser fuzz` | EXPERIMENTAL; many short runs. Not run here |
| `bombadil browser shrink` | EXPERIMENTAL |
| `bombadil browser inspect` | stable |
| `bombadil terminal test` | EXPERIMENTAL |
| `bombadil terminal shrink` | EXPERIMENTAL |
| `bombadil terminal fuzz` | EXPERIMENTAL. Not run here |
| `bombadil trace` | stable |

## `browser test`

```text
bombadil browser test [OPTIONS] <ORIGIN> [SPECIFICATION_FILE]
```

The spec file is a positional argument after the origin. Flags used and seen to work here:

- `--headless`: no visible window. Use it from an agent.
- `--time-limit <N>`: a number with `s`, `m`, `h` or `d`.
- `--exit-on-violation`: stop at the first violation.
- `--output-path <FILE>` and `--output-path-overwrite`.
- `--reproduce <TRACE>`: replay a trace instead of exploring. Refuses `--time-limit` and `--exit-on-violation`.

Flags from `--help`, not run here: `--width`, `--height` (default 1024x768), `--allow-url <MATCH_PATTERN>` (widen or replace the origin boundary), `--header KEY=VALUE`, `--cookie <SET-COOKIE>` (log in with a test session), `--chrome-grant-permissions`, `--chrome-virtual-time-policy Advance` (speeds up timer-heavy apps), `--chrome-variant headless-shell`, `--no-sandbox`, `--instrument-javascript`, `--coverage-symbols`.

Exploration stays on the origin's scheme, host and port unless you pass `--allow-url`. A query string in the origin is kept, and reload keeps it.

## `terminal test`

```text
bombadil terminal test [OPTIONS] [COMMAND]...
```

The spec goes in `--specification <FILE>`, not as a positional argument. Everything after the options is the program and its arguments. Flags run here: `--specification`, `--time-limit`, `--exit-on-violation`, `--output-path`, `--output-path-overwrite`, `--reproduce`, `--quiescence-timeout-ms`. From `--help`: `--columns` (100), `--rows` (40), `--scrollback-lines-max` (100).

`--quiescence-timeout-ms` (default 5) is how long Bombadil waits for output to stop before it samples. At 5 ms a Bun REPL was sampled before it redrew: the state after `add` still showed `count: 0`. 50 ms fixed it.

Unlike the browser driver, terminal `--reproduce` accepted `--time-limit` and `--exit-on-violation` in 0.8.0. The terminal driver also redraws the screen on stdout while it runs, so send its output to a log file and read the last lines.

## Exit codes

Seen here, in 0.8.0:

| Situation | Exit |
| --- | --- |
| Time limit reached, no violation | `0` |
| Browser violation | `2` |
| Terminal violation | `1` (the manual says `2`) |
| Bad output path, other runtime error | `1` |
| Command-line usage error, such as `--reproduce` with `--time-limit` | `2` |
| Shrink finished | `0` |
| Replay of a trace that no longer violates | `0` |

Confirm with the last lines of output:

```text
Test finished, finding 1 violation!
Test finished after time limit!
Reproduction finished, finding 1 violation!
Reproduction finished!
terminal test failed: 1 violation(s) reported
Exited after time limit hit
Exited after reproduction finished
```

## Output paths

A trace is one file with screenshots inside. `--output-path` names that file.

```text
terminal test failed: trace already exists at out/term-fixed. Use --output-path-overwrite to overwrite, or choose a different --output-path.
terminal test failed: output path must name a trace file, not a directory: out
  - No such file or directory (os error 2)        (parent directory missing)
```

Without `--output-path`, Bombadil writes to a unique file in the system temp folder. For `fuzz`, the path is a file base: `run.bin` gives `run-0.bin`, `run-1.bin` (from `--help`, not run). For `shrink`, the output must not alias the input.

## Reading a trace

```bash
bunx bombadil trace .bombadil/run-1
```

```text
terminal trace
#0        +0.000s  (initial state)  (1.2 KB payload)
#1        +0.040s  TypeText {"text":"add\\r"}  (1.2 KB payload)
#2        +0.055s  TypeText {"text":"sub\\r"}  (1.2 KB payload)
#3        +0.071s  TypeText {"text":"sub\\r"}  (1.2 KB payload)
       violated: "countNeverNegative"
```

Browser traces also print each state's `url:` line and the clicked element's fingerprint.

`--json` prints one object per state. The fields worth reading:

- `index`
- `metadata.action`: the action that led to this state, `null` for the first.
- `metadata.snapshots[]`: `{ name, value }` for every extractor cell, under its variable name. This is how you see what the property saw.
- `metadata.violations[]`: `{ name, violation }`, where `name` is the exported property.
- `metadata.state`: driver state. Browser: `url`, `resources`, `screenshot` format. Terminal: `cursor`, `exit_status`.

```bash
# The violating state, its action and the property names
bunx bombadil trace .bombadil/run-1 --json \
  | jq -c 'select(.metadata.violations | length > 0) | {index, action: .metadata.action, violated: [.metadata.violations[].name]}'
# {"index":6,"action":{"Click":{"fingerprint":{"id":"notify","tag":"button","text_content":"Notify"},...}},"violated":["maxFiveNotifications"]}

# One extractor's value over time
bunx bombadil trace .bombadil/run-1 --json \
  | jq -c '{i: .index, v: ([.metadata.snapshots[] | select(.name == "errorText") | .value][0])}'
```

Other options: `--state 40..50` (or `40..`, `..50`, or one index), `--screen` (terminal screen as text, also inside `--json`), `--color`, and `--screenshots <DIR>`, which wrote `5.jpeg` and `6.jpeg` for `--state 5..7` on a browser trace. With `--json --screenshots`, the `screenshot` field came back `null` in 0.8.0, so look for the files by index instead.

## Inspect

```bash
bunx bombadil browser inspect --port 18073 --no-open .bombadil/run-1
```

It serves a web view of the trace and printed `Bombadil Inspect available at http://0.0.0.0:18073`. It listens on all interfaces, so stop it when done. The user can open it to scrub through states and screenshots. An agent gets more from `trace --json` and `--screenshots`.

## Reproduce

Use the same origin or command, the same spec and the same options as the original run.

```bash
bunx bombadil browser test --headless --reproduce .bombadil/run-1 http://localhost:3000/ bombadil/spec.ts
bunx bombadil terminal test --reproduce .bombadil/cli-1 --specification bombadil/cli.spec.ts ./my-cli --flag
```

The browser driver prints the reproduce command after each run. Reproduction is best effort: Bombadil fails with an error if the replay diverges (from the manual; no divergence was hit here). Keep the app deterministic for replay: same seed data, no clock or random values that change what can be clicked.

## Shrink

```bash
bunx bombadil browser shrink --headless --trace .bombadil/run-1 --time-limit 5m \
  --output-path .bombadil/run-1-shrunk http://localhost:3000/ bombadil/spec.ts
bunx bombadil terminal shrink --trace .bombadil/cli-1 --specification bombadil/cli.spec.ts \
  --time-limit 2m --output-path .bombadil/cli-1-shrunk ./my-cli --flag
```

```text
Shrinking for property `maxFiveNotifications`: 96 actions, 96 up to its earliest violation
Calibrating by replaying the trace 3 time(s)...
Reproduced in 3/3 calibration run(s), retrying candidates up to 1 time(s)
  96 actions
  48 actions (reproduced 2/2)
  ...
  6 actions (reproduced 2/2)
Shrinking finished!
  Property:   maxFiveNotifications
  Actions:    96 → 6 (96 up to earliest violation)
  Reproduced: 2/2 (original: 3/3)
  Runs:       72 in 75s
```

Pass `--time-limit` so shrinking stops; it keeps the smallest trace found so far. Pass `--property <name>` when the trace violates more than one property. `--parallelism N` runs replays at once; use it only when runs share no backend or files. `--calibration-runs` (default 3) and `--confirmation-runs-max` (default 5) tune how flaky a replay may be.

## Confirming a fix

1. Replay the shrunk trace against the fixed app. It exited `0` with "Reproduction finished!" here.
2. Run a fresh bounded test with the same spec. It exited `0` with "Test finished after time limit!" here.
3. Keep the shrunk trace with the bug report. It is the regression check for the next change.
