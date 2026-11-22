# Proof standards

A proof is evidence a reviewer can open and check without running the app again. "It compiles" and "the test passed" are not proofs that a feature works for a user.

## What counts

- **The real user path.** The page through a browser, the command through a shell, the endpoint through an HTTP client. Not an internal function, a test-only route, or a direct write to storage.
- **The action and the result.** Record the command or click, then the state after it. A final screenshot alone does not show what caused it.
- **A second view of every side effect.** After the UI creates a note, read it back through the CLI, the API or the data file. After the CLI deletes one, check the page no longer lists it.
- **Evidence before the assertion.** Take the screenshot or snapshot before the check that can fail, so a failure still leaves something to read.
- **An assertion that can fail.** Scope each check to the region that proves it. A check on text the page always shows passes on a broken feature.
- **The right instance.** Every artifact shows something that ties it to this run: the port, the data directory, a build id, a page title.

## What does not count

- A status message alone ("Saved", exit code 0) without the read-back.
- A mock of the code under test. Mocks belong only at a boundary production already isolates, such as a payment provider or a mail relay.
- A skipped entry point reported as verified because another path worked.
- A dry-run trusted by its name. Watch what it touches: files written, network calls, git refs, browser windows opened.

## Evidence by surface

| Surface | Capture |
| --- | --- |
| Web or Electron | Screenshot with the app visible, accessibility snapshot or page text, console errors, the URL |
| CLI | The exact command, stdout, stderr, exit code |
| TUI | Terminal capture before and after the keystrokes, the keystrokes sent |
| HTTP service | Method, URL, request body, status, response body |
| Any side effect | The second-view read-back named above |
| A flow with motion or timing | A short recording, plus the screenshots above |

Keep secrets out of evidence. Passwords, tokens, cookies and API keys do not belong in a screenshot, a log, a transcript or a saved response. Use a test account, mask the value before you save the file, and say what you masked.

Write evidence to one directory per run, outside anything Cleanup removes. Name files `<feature>-<step>.<ext>`. Write a short `summary.json` or `summary.md` that lists each artifact with the feature and entry point it proves.

## Doctor discipline

Run Doctor before the first drive, after every failed drive, and after anything surprising. A healthy process can still hold a stuck UI state. When Doctor cannot see the problem, reset to a known state or relaunch. Do not keep driving and hope.

## Reporting

For each feature, say one of:

- `verified`: driven through the named entry point, evidence at the named path.
- `failed`: driven, and the result was wrong. Give the step, the expected result and the observed one.
- `not driven`: with the reason (no browser, missing precondition, skipped entry point).
- `unreachable`: with the concrete prerequisite (an account, an OS, a licence) and the route you tried.
