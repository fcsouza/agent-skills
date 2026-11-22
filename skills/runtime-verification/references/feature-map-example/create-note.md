# Create a note

A user writes a title and a body in the `New note` form below the search box and chooses `Save note`. The page reloads with `Note saved` and the new title in the `All notes` list. The CLI creates the same kind of note from a terminal.

## Sub-features

- `create-page`: save a note from the page form.
- `create-empty-title`: saving with no title shows `title is required` and saves nothing.
- `create-cli`: `notes add` saves a note and prints it.

## How to get to it (user POV)

- Open the page. Under the search form, fill `Title` and `Body` in the `New note` form, then choose `Save note`.
- In a terminal, run `notes add --title <title> --body <body>`.

## Driving it with control-notes

Preconditions:

- Baseline from `features/README.md`. No note titled `Release checklist` or `CLI note`.

- **Save from the page.** Fill the form and save. Run `control-notes browser --run <id> goto / fill "Title" "Release checklist" fill "Body" "Tag and publish" click "Save note" snap create-note-page-saved expect "Note saved" within "All notes" "Release checklist"`. JSON `ok: true`; the screenshot shows `Note saved` and `Release checklist` under `All notes`.
- **Read it back from the CLI.** Run `control-notes cli --run <id> --save create-note-page-readback -- list --json`. Exit code 0; stdout holds three notes, one titled `Release checklist` with body `Tag and publish`.
- **Empty title.** Run `control-notes browser --run <id> goto / fill "Body" "no title" click "Save note" snap create-note-empty-title expect "title is required"`. The page shows `title is required`. Then `control-notes cli --run <id> -- list --json` still lists three notes.
- **Create from the CLI.** Run `control-notes cli --run <id> --save create-note-cli -- add --title "CLI note" --body "From the terminal" --json`. Exit code 0; stdout holds the new id and title `CLI note`.
- **See it on the page.** Run `control-notes browser --run <id> goto / snap create-note-cli-on-page within "All notes" "CLI note"`. The `All notes` list shows `CLI note`.

## Gotchas

- Titles are trimmed on save. Assert the rendered title, not the typed one.
- `Note saved` comes from the redirect after the save. The form comes back empty after a failed save too, so an empty form proves nothing; check `Note saved` and the `All notes` list.
- This recipe adds two notes. Relaunch before you run another feature's recipe.
