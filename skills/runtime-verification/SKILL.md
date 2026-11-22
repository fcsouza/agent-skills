---
name: runtime-verification
license: MIT
description: >-
  Use when a project needs a scripted way for an agent to run the real app, drive it the way a user does, and keep evidence of what happened, or when such a setup has gone stale. Create mode writes a project-local verify-[app] skill (launch, doctor, drive, evidence, cleanup, helpers) plus a feature map written from the user's side, then proves it once end to end. Maintain mode audits an existing verify skill and feature map against the app and ends clean, changed or blocked. Use for "make a verification skill for this repo", "give the agent a way to run and click through the app", "prove it works in the running app, not just the tests", "audit the verify skill", "the feature map is out of date", web apps, Electron, CLIs, TUIs and HTTP services. Also use when the user says "cria uma skill de verificação", "prova que funciona no app", "roda o app e me mostra a evidência" or "atualiza o mapa de features".
---

# Runtime verification

Give an agent the same tools a person uses to check a change: start the real app, use it, look at what happened, and keep the proof. Review then means reading evidence (screenshots, terminal transcripts, read-back state, recordings) instead of trusting a summary.

This skill has two modes. **Create** writes a project-local skill, `.claude/skills/verify-<app>/`, and proves it once. **Maintain** audits that skill against the app as the app changes.

Adapted from the create-verification-skill and maintain-verification-skill skills in pstack v0.15.46 by Lauren Tan, under MIT. Modified: one skill with two modes, Claude Code skill paths and frontmatter, `Agent` readers, a driver order for Claude Code, and a feature-map example rebuilt from a proof run. Licence details: [NOTICE.md](NOTICE.md).

## Pick the mode

- No project skill drives the app, or the user asks for one: **Create**.
- A `verify-*` skill with a `features/` map exists and the app changed, or the user asks to audit it: **Maintain**.
- Several `verify-*` skills exist: ask which one. One with a `features/` map drives the app; one that runs a model checker or a prover belongs to `formal-verification`. None exists and the user asked for Maintain: say so and offer Create. Do not invent a target.
- A `verify-*` skill exists and the task is to check one change: do not run either mode. Follow that skill.

## Rules for both modes

1. **The real user path.** Drive what a user touches: the page, the command, the endpoint a client calls. Internal setters, test-only routes and writes straight to storage do not prove a feature.
2. **Action and result.** Capture what you did and the state it produced, not only the final screen.
3. **Read side effects back through a second view.** A row the UI created is read through the CLI, the API or the data file. A toast that says "saved" is not proof.
4. **Mocks only at a real production boundary.** Stub a payment provider or a mail relay the app already isolates. Never stub the code under test.
5. **Check what a dry-run skips.** Watch the files, network and refs it touches. Some dry-runs still write or call out.
6. **Doctor first** whenever something looks off: before the first drive, after any failed drive, after any surprise.
7. **Kill what you started.** Track the process IDs you launched. Never kill by process name or by port alone.
8. **Cleanup never removes evidence.** Evidence lives in a directory cleanup does not touch, and you list it after cleanup to prove it survived.
9. **Never weaken a journey to make it pass.** A missing precondition is a failure with a reason, written under that feature's `Gotchas`.
10. **A skipped entry point is not verified.** Driving the CLI does not prove the button. Report the button as not driven.
11. **A generated skill that never ran is a draft.** Only a skill you ran end to end is done.

The full evidence standard is in `references/proof-standards.md`.

## Create mode

Read `references/create.md` before you start. In short:

1. **Interview the repo, not the user.** Answer five questions from the code: **surface** (what a user touches), **run** (how it starts locally), **drive** (how an agent can operate it), **observe** (what evidence it can capture), **isolate** (can two instances run side by side). Ask the user only what the repo cannot answer.
2. **Fix or report a broken base.** If the checkout does not build or start, fix that first or report the exact failure. A skill written against a broken base teaches wrong steps.
3. **Pick the driver.** Use an existing harness first. `references/drive-options.md` lists the order and the commands.
4. **Write the skill** at `.claude/skills/verify-<app>/SKILL.md` from `references/verify-skill-template.md`, with every section filled from what the interview found. Build a small control CLI as its helper when agents would otherwise write throwaway scripts; `references/control-cli.md` lists the traits.
5. **Seed the feature map** under `features/`: a `README.md` index and one file per user-facing feature, the top three to five first. Follow the contract below and the worked example in `references/feature-map-example/`.
6. **Prove it once.** Follow the generated skill as written: launch, doctor, drive one mapped feature, capture evidence, clean up, then list the evidence. Fix every step that failed or needed knowledge the page did not give, and run cleanup after each failed try. Run `claude plugin validate .claude/skills` to check that the frontmatter parses.
7. **Hand over** with the proof output, the evidence location, and every step left unverified.

### Frontmatter of the generated skill

```yaml
---
name: verify-notes
description: Use when you need to run Notes (web page on port 4173 and the `notes` CLI) and prove a change works by driving it as a user. Launch, doctor, drive, evidence and cleanup for this repo, plus a feature map under features/.
---
```

Claude Code loads project skills from `.claude/skills/<name>/SKILL.md`. Claude decides when to use a skill from its `description`, so name the app, the surface and the moment to reach for it. `name` sets the slash command and defaults to the directory name; keep them equal. If the YAML does not parse, the body still loads but Claude cannot match the description. New skill folders are picked up within the session; if one does not appear, run `/reload-skills`.

### Sections the generated skill must have

- **Launch**: the exact start command, how to tell the app is usable (not only that a port answers), a fresh data directory, and the teardown. For a short-lived CLI, Launch builds once and each drive runs in its own session.
- **Doctor**: one read-only check. Process up, the right build, the port held by the process this run started, auth valid.
- **Drive**: real selectors and commands from this repo. Prefer roles, labels, test ids, prompt strings and routes over coordinates.
- **Evidence**: what to capture, where it goes, and the standards in rules 1 to 5.
- **Cleanup**: stop what this run started, remove scratch state, keep evidence. Show how to check that nothing was left running.
- **Helpers**: every script is executable, and the skill body shows the exact command that runs it. Refer to scripts as `${CLAUDE_SKILL_DIR}/scripts/<name>` so the path works from any directory.

## Feature map contract

Each feature file is written from the user's side, so the user and the agent share one name for each part of the app. The file has:

- An H1 with the feature name, then one paragraph on what the user sees.
- Exactly four H2s, in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, `Gotchas`.
- Under `Driving it with <harness>`: a `Preconditions:` list, then one bullet per step that pairs the user action, the exact command, and the result you can observe.

The `README.md` index holds baseline preconditions, driving conventions, proof and skip reporting, the contract above, and one link per feature. Keep code paths out of the map. It names what a user does and sees.

The index also says where the helper lives, as a path from the repo root. Claude Code substitutes `${CLAUDE_SKILL_DIR}` only in the SKILL.md it loads. Feature files are read later, as plain files, so a short name such as `control-notes` means nothing there unless the index defines it.

## Maintain mode

Read `references/maintain.md` before you start. In short:

1. **Locate** the verify skill and read its `features/README.md`. Fix missing, extra, duplicate and dead index entries.
2. **Readers in parallel.** One read-only `Agent` call per feature file, all in one message, with the brief from `references/maintain.md`. Readers read source and the feature file. They never run the app and never edit.
3. **Reconcile.** Every feature has a reader summary. Check cited drift. Look for user-facing surfaces missing from the map, with a concrete source path for each.
4. **One live pass** that drives every feature at least once, even when the readers found nothing. You alone drive. Doctor before the first drive and after every failure.
5. **Triage.** Wrong description: doc drift, fix the map. Working behaviour the harness cannot drive: harness gap, fix the helper and drive it again. Broken app behaviour: product regression, report it and leave the map saying what the product should do.
6. **End in exactly one outcome**:
   - `clean`: every feature covered from source and live, nothing to change.
   - `changed`: proven corrections made inside the verify skill's directory.
   - `blocked`: coverage could not finish. Name the blocker.

Edit only the verify skill's own directory. Never edit product code during Maintain.

## Control CLI

When agents keep writing one-off scripts to click through the app, give the verify skill a small control CLI instead. Agents reuse it, spend fewer tokens, and the CLI itself can be tested. Traits, with examples, are in `references/control-cli.md`: a few composable commands, `--dry-run` on anything destructive, errors that say what to do next, rich `--help`, and JSON output.

## Pitfalls

- Do not call a page proven because `curl` got 200. Drive the page in a browser when the surface is a page.
- Do not trust "ready" when a port answers. A server can listen before migrations or seed data finish.
- Do not kill by name (`pkill bun`, `killall node`). That kills the user's own dev server.
- Do not put evidence inside the data directory cleanup deletes.
- Do not write a feature file from source alone. Drive the steps before you call them correct, and check every "where it is on the page" against a screenshot.
- Do not assert on text the page always shows. A search result check that also matches the full list proves nothing; read the results region in the snapshot.
- Do not use a bare helper name in feature files. Give its path from the repo root in the index.
- Do not edit the map to match a broken app. That hides a regression.
- Do not prove the skill in a stand-in (a container for a VM, a local stack for a remote one) and call the target done. List each step the stand-in covered that the target will not.
- Do not hand over a skill with placeholder text such as `<port>` or `TODO`.

## Files

- `references/create.md`: read before Create mode. Interview questions and where to find the answers, broken bases, writing each section, seeding the map, the proof run, the handover.
- `references/maintain.md`: read before Maintain mode. The reader brief to copy, reconcile, the live pass invariants, triage, outcomes and the report.
- `references/proof-standards.md`: read when you capture evidence or judge whether a proof counts.
- `references/drive-options.md`: read when you pick how to drive the app. Driver order and working commands for browsers, Electron, CLIs, TUIs and HTTP services.
- `references/control-cli.md`: read when you build or fix the verify skill's helper CLI.
- `references/control-cli-example.ts`: the control CLI from the proof run (Bun, Playwright, subprocess). Copy its structure.
- `references/verify-skill-template.md`: copy when you write `.claude/skills/verify-<app>/SKILL.md`.
- `references/feature-map-example/README.md`: example index for a small notes app with a web page and a CLI.
- `references/feature-map-example/create-note.md`: example feature driven through the page and read back through the CLI.
- `references/feature-map-example/search-notes.md`: example feature with scoped assertions and a product regression recorded under `Gotchas`.
- `references/feature-map-example/delete-note.md`: example CLI-only feature with a dry run checked before the real delete.
- `NOTICE.md`: upstream files adapted and the MIT licence.

## Related skills

- `bombadil`: a property-based fuzz pass over the same running app, after the verify skill can launch it.
- `formal-verification`: for promises driving cannot reach, such as two retries that overlap.
- `encode-corrections`: turn a repeated verification miss into a rule, a lint or a test.
- `judge`: review the change before merge; the verify skill's evidence goes in that review.
