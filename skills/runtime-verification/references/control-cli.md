# The control CLI

A control CLI is a small program inside the verify skill that launches, checks, drives and cleans up the app. Agents call it instead of writing a new throwaway script each run. They spend fewer tokens, every run takes the same steps, and the CLI itself can be tested.

Build the smallest one that does the job. It is a tool, not a framework.

## Traits

- **A few composable commands, each doing real work.** `up`, `doctor`, `browser`, `cli`, `evidence`, `down` cover most apps. Avoid one command per button.
- **`--dry-run` on anything destructive.** `down --dry-run` prints which process it would stop, which directory it would remove, and which it would keep.
- **Errors that say what to do next.** "no state for run main; run `up` first, or pass the --run you used" beats a stack trace.
- **Rich `--help`.** List every command and every step it accepts, where state and evidence live, and how run IDs work. The reader learns the tool from `--help` alone.
- **JSON output.** Every command prints one JSON object with `ok`. Exit 1 when `ok` is false. Agents parse it; people can still read it.
- **Run IDs.** Every command takes `--run <id>`, so two agents can each run their own instance.
- **Fail in seconds.** Playwright waits 30 seconds for a missing element by default. A renamed button then costs half a minute per step. The proof CLI set `page.setDefaultTimeout(5000)`.
- **Scoped assertions.** A step such as `within <list> <text>` checks one region by its accessible name. A whole-page text check passes whenever the text appears anywhere.
- **Steps reveal features gradually.** A `browser` command that takes steps (`goto`, `fill`, `click`, `expect`, `snap`) lets the feature map describe any journey without new code.

## Shape that worked in the proof run

```text
control-notes up [--port N]          start on a free port, fresh data dir, seed, wait until the page renders
control-notes doctor                 read-only health: process alive, port owned by it, data dir, page renders
control-notes browser <step>...      goto <path> | fill <label> <text> | click <name> | expect <text> | absent <text> | within <list> <text> | snap <name>
control-notes cli [--save NAME] -- <args>
control-notes evidence               list evidence files
control-notes down [--dry-run]       stop the recorded PID, remove the run dir, keep evidence
```

State lived in the OS temp directory under `verify-notes/runs/<run>/` and evidence under `verify-notes/evidence/<run>/`. `down` removed only the first.

The full script is `control-cli-example.ts` beside this file: a Bun script of about 250 lines with Playwright for the page and a subprocess for the CLI. Copy its structure, not its app-specific parts (seed notes, routes, labels).

## Testing the CLI

Run `up`, `doctor`, one `browser` journey, `down`, then `evidence`. Then make it fail on purpose: run `doctor` after `down` and read the error; run `up` twice with the same run ID. A CLI whose errors you never saw is not tested.

Make every script executable (`chmod +x`) and show its exact invocation in the verify skill's Helpers section.
