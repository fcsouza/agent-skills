# Maintain mode

A feature map goes stale the moment the app changes. This pass checks every feature from source and drives every feature live, then fixes the verify skill or reports the app. The unit of care is the feature, not each sentence.

## Scope

Edit only the verify skill's own directory: its `SKILL.md`, `features/`, and its scripts. Never edit product code. When the map and the app disagree, decide which is wrong:

- The map describes the app wrongly: **doc drift**. Fix the map.
- The app does something the harness cannot drive: **harness gap**. Fix the helper.
- The app is broken: **product regression**. Report it. Leave the map describing what the product should do, and add the failure under that feature's `Gotchas` with the date, the commit and the evidence path. The recipe keeps failing until the product is fixed; that is the point.

## 0. Locate the target

Find `.claude/skills/verify-*/` with a `features/` directory. One: use it. Several: ask which. None: stop and offer Create mode.

Keep run notes in a scratch file outside the repo: features covered, drift found, prerequisites, outcome. Do not commit them.

## 1. Index hygiene

Read `features/README.md` and list the files beside it. Fix index entries that are missing, extra, duplicated or point at no file. Check each feature file has the H1, one paragraph, and the four H2s in order.

## 2. Readers in parallel

Send one `Agent` call per feature file, all in the same message, so they run at the same time. Use a cheaper model than yours when the harness lets you pick. Give each reader this brief, with the paths filled in:

```text
You are a read-only reader. Do not run the app, do not start servers, do not edit, create or delete any file.

Repo root: <absolute path>
Feature file: <absolute path to features/<feature>.md>
Feature map index: <absolute path to features/README.md>

Task: explain how this user-facing feature works today, from the source code, and compare it with the feature file.

Return exactly these four parts:
1. Summary: what a user can do with this feature, in two to four sentences.
2. Source entry points: the files and lines that implement each entry point the feature file lists (path:line).
3. Likely drift: each place where the feature file and the source disagree, with the feature-file line and the source path:line. Write "none" if none. Also list user-facing entry points for this feature that the source has and the feature file lacks.
4. Recipe: one live recipe that would verify the feature, as the exact commands from the feature file, corrected where the source shows they would fail.
```

Readers report. They do not decide.

## 3. Reconcile

- Every feature file has a returned summary. A missing one means that feature is not covered; rerun its reader or read it yourself.
- Open each cited drift and confirm it. Do not re-prove claims the readers found clean.
- Merge the recipes so the live pass needs as few app states as it can.
- Look for user-facing surfaces the map lacks: new routes, commands, menu items. Each reader owns one feature, so no reader owns a new one. Diff the app since the map last changed: `git log -1 --format=%h -- .claude/skills/verify-<app>` gives the commit, and `git diff <commit> --stat -- . ':!.claude'` lists what moved since. In the proof run the readers missed a new CLI command; this diff found it. Call a surface missing only with a concrete source path.
- A reader labels every mismatch "drift". You decide whether it is drift or a regression. Read the user's intent from what the app still promises: its help text, its docs, the commit message. In the proof run, `notes --help` still said "find notes by title or body" after body search broke, so that mismatch was a regression, not drift.
- Check each recipe's assertions before you trust a green run. An assertion on text the page always shows passes on a broken feature. In the proof run, the mapped body-search step would have passed on the regression because the page lists every note below the results.

## 4. Live pass

Required even when every reader came back clean. You alone drive. Follow the verify skill's own Launch model: one long-lived instance driven step by step for servers and pages, or a fresh session per drive for short-lived CLIs.

Drive every feature at least once, through every entry point the map lists. Hold three rules the whole pass:

1. **Doctor before you drive.** Before the first drive, on every fresh session, and after any failed drive. When Doctor cannot see the problem (a stuck page on a healthy process), reset to a known state or relaunch.
2. **Evidence survives.** After every cleanup, list the evidence directory. Do not assume.
3. **Nothing outlives its use.** Clean up what a failed attempt left behind, whether the session is stuck, gone or shared. On a shared instance, clean the residue, not the instance.

If Doctor fails because the skill drifted (a renamed script, a changed port variable), that is drift: fix it, restart only what the fix touched, and retry once before you call the pass blocked.

A feature you cannot reach is `unreachable` only with the concrete prerequisite (an account, an entitlement, an OS, external state) and the route you tried. If the map never named that prerequisite, that is drift too.

Drive every fix live again before you keep it. Run the final cleanup after the last drive, re-proofs included.

## 5. Triage

Sort each finding into doc drift, harness gap or product regression, as defined under Scope. Fix the first two inside the verify skill's directory. A helper fix follows the same rules as in Create mode: executable, invocation shown in the skill body. Record product regressions for the report.

## 6. Outcome

End in exactly one:

- `clean`: every feature covered from source and live, nothing changed.
- `changed`: corrections made and driven live, all inside the verify skill's directory. Re-read every changed file before you report. If the user wants a PR, the PR holds only these files.
- `blocked`: coverage could not finish, or a fix could not be proven. Name what blocked it.

A product regression does not change the outcome by itself. A pass can be `clean` or `changed` and still report a regression.

## Report

- Outcome.
- Features covered, with the entry points driven and the evidence path for each.
- Drift found and fixed, by file.
- Harness gaps found and fixed.
- Product regressions: feature, step, expected, observed, evidence path.
- Unreachable features with their prerequisites.
- What was not covered, and why.
