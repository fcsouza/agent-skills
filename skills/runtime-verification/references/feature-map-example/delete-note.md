# Delete a note

A user removes a note from a terminal with `notes delete <id>`. A dry run first says whether the note exists without removing it. The page has no delete control.

## Sub-features

- `delete-dry-run`: `--dry-run` reports what it would delete and changes nothing.
- `delete-cli`: `notes delete <id>` removes the note.
- `delete-missing`: deleting an unknown id exits 1.

## How to get to it (user POV)

- In a terminal, run `notes list` to find the id, then `notes delete <id>`.

## Driving it with control-notes

Preconditions:

- Baseline from `features/README.md`. Get the id of `Grocery list` from `control-notes cli --run <id> -- list --json`.

- **Dry run.** Run `control-notes cli --run <id> --save delete-note-dry-run -- delete <note-id> --dry-run --json`. Exit code 0; stdout is `{"wouldDelete":true,"id":"<note-id>"}`.
- **Dry run changed nothing.** Run `control-notes cli --run <id> -- list --json`. Still two notes.
- **Delete.** Run `control-notes cli --run <id> --save delete-note-cli -- delete <note-id> --json`. Exit code 0; stdout is `{"deleted":true,"id":"<note-id>"}`.
- **Gone from the page.** Run `control-notes browser --run <id> goto / snap delete-note-page absent "Grocery list"`. The `All notes` list no longer shows `Grocery list`.
- **Unknown id.** Run `control-notes cli --run <id> -- delete nope --json`. Exit code 1; stdout is `{"deleted":false,"id":"nope"}`.

## Gotchas

- `control-notes cli` returns the CLI's stdout as a string; parse it as JSON to read the id.
- A dry run on an unknown id exits 0 with `"wouldDelete":false`. Only the real delete exits 1.
- Ids are random per seed. Read the id in each run; never reuse one from an older run.
- This recipe removes a seeded note. Relaunch before you run another feature's recipe.
