# Notes feature map

Example from a proof run of this skill, on a small notes app with a web page and a CLI. The verify skill lived at `.claude/skills/verify-notes/`.

The maintained list of what a Notes user can do, written from the user's side. Read this index before you drive the app, then open the feature file you need.

## Baseline preconditions

- `control-notes` in these files means `.claude/skills/verify-notes/scripts/control-notes.ts`, run from the repo root. It is not on `PATH`.
- `control-notes up --run <id>` has started a fresh instance and `control-notes doctor --run <id>` reports `ok: true`.
- The seed holds exactly two notes: `Quarterly plan` (body `Draft budget`) and `Grocery list` (body `Eggs and milk`).
- Never drive an instance this run did not start.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise. After a recipe that changes data, run `down` and `up` again before the next one.
- Page steps go through `control-notes browser`. Labels, button names and list names are the visible text, matched exactly. Assert matches with `within <list> <text>`, and put `snap` before the assertion so a failure still leaves evidence.
- CLI steps go through `control-notes cli -- <notes args>`. Add `--json` for anything you assert on.
- Take commands literally. Keep quotes and flags as written.

## Proof and skip reporting

- Capture the action and the result: a `snap` after the step that changes the page, a `--save` on the CLI call.
- Read every change back through the other surface.
- Record the feature and the entry point with each artifact name, for example `create-note-page-saved`.
- A skipped entry point is reported as not driven. It is never verified through another path.
- An unreachable step names the unmet precondition and the command tried.

## Feature file contract

Each file has an H1, one paragraph on what the user sees, then exactly four H2s in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with control-notes`, `Gotchas`. The driving section starts with `Preconditions:`, then one bullet per step: the user action, the exact command, the result you can observe. No code paths; only what a user does and sees.

## Features

- [Create a note](./create-note.md): save a note from the page form or the CLI, and the empty-title error.
- [Search notes](./search-notes.md): find notes by title or body from the page search form or the CLI, and the no-match state.
- [Delete a note](./delete-note.md): remove a note from the CLI, with a dry run first.
