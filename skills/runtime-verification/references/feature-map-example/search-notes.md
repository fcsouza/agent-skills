# Search notes

A user types words in the `Search notes` box at the top of the page and chooses `Find`. Notes whose title or body contain the words appear in a `Search results` list above the form. A query with no match shows `No matching notes`. The CLI runs the same search from a terminal.

## Sub-features

- `search-title`: a title match appears in the results.
- `search-body`: a body match appears in the results.
- `search-empty`: a query with no match shows `No matching notes`.
- `search-cli`: `notes search` prints the same matches.

## How to get to it (user POV)

- Open the page, type in `Search notes` at the top, choose `Find`.
- Open a URL with `?q=<words>` directly, for example a shared link.
- In a terminal, run `notes search <words>`.

## Driving it with control-notes

Preconditions:

- Baseline from `features/README.md`.

- **Title match.** Run `control-notes browser --run <id> goto / fill "Search notes" "quarterly" click "Find" snap search-notes-title within "Search results" "Quarterly plan"`. JSON `ok: true`; the snapshot's `Search results` list holds `Quarterly plan` and not `Grocery list`.
- **Body match.** Run `control-notes browser --run <id> goto / fill "Search notes" "budget" click "Find" snap search-notes-body within "Search results" "Quarterly plan"`. JSON `ok: true`; the `Search results` list holds `Quarterly plan`.
- **No match.** Run `control-notes browser --run <id> goto / fill "Search notes" "volcano" click "Find" snap search-notes-empty expect "No matching notes"`. The page shows `No matching notes`.
- **Shared link.** Run `control-notes browser --run <id> goto "/?q=grocery" snap search-notes-link within "Search results" "Grocery list"`. JSON `ok: true`.
- **CLI match.** Run `control-notes cli --run <id> --save search-notes-cli -- search quarterly --json`. Exit code 0; stdout is a list with one note titled `Quarterly plan`.
- **CLI body match.** Run `control-notes cli --run <id> --save search-notes-cli-body -- search budget --json`. Exit code 0; stdout is a list with one note titled `Quarterly plan`.
- **CLI miss.** Run `control-notes cli --run <id> -- search volcano --json`. Exit code 0; stdout is `[]`.

## Gotchas

- `expect "Quarterly plan"` also passes on the `All notes` list, which always shows every note. Use `within "Search results"` for every match.
- `snap` comes before `within`, so a failed match still leaves a snapshot.
- Failing since 2026-11-22 (commit `dcca931`): `budget` finds nothing on the page (`No matching notes`) and `notes search budget --json` prints `[]`, while `notes --help` still says "find notes by title or body". Body search is a product regression, reported, not a map change. Evidence: `search-notes-body.aria.txt` and `search-notes-cli-body.cli.json` in run `maint`.
- Search does not change data, so the recipes can run in any order on one instance.
