# Create mode

You are writing for the next agent, not for a person. That agent reads the verify skill cold, mid-task, and has never seen the app. Every command must run as written.

## 1. Interview the repo

Answer each question from the code. Write the answers in a scratch file; they become the skill's sections. Ask the user only what you cannot observe, such as a test account password.

| Question | What you need | Where to look |
| --- | --- | --- |
| **Surface** | What a user touches: web page, desktop window, CLI, TUI, HTTP API, mobile app, library. Pick the main one and note the rest. | README, `package.json` `bin` and scripts, route files, `main` of an Electron app, CLI entry points |
| **Run** | The command that starts it locally, ports, env vars, seed data, migrations, auth | package scripts, Makefile, `docker-compose.yml`, `.env.example`, README quickstart, CI workflow |
| **Drive** | How an agent can operate it from code | existing Playwright or Cypress specs, expect scripts, PTY helpers, a debug port, documented endpoints |
| **Observe** | What evidence exists | screenshots, accessibility snapshots, stdout and exit codes, response bodies, logs, database rows, written files |
| **Isolate** | Can two instances run side by side | is the port configurable, is the data directory configurable, does it share a browser profile, a socket, a lock file |

If the app cannot be isolated (a fixed port, a shared database), say so in the skill. Refusing to drive a shared instance beats corrupting the user's session.

## 2. Fix or report a broken base

Run the start command once before you write anything. If it fails:

- Fix it when the fix is small and inside the task (a missing install step, a wrong script name). Say what you fixed.
- Report it when it is not: the exact command, the exact error, and what you tried.

When an asset the feature under test never uses blocks startup (a static folder, a sample config), the skill may create it. Mark it as verification scaffolding and remove it in Cleanup.

## 3. Pick the driver

Follow the order in `drive-options.md`. Use what the repo already has before you add anything. Test the driver once by hand before you write it into the skill: launch a browser, open a PTY, send one request.

## 4. Write the skill

Copy `verify-skill-template.md` to `.claude/skills/verify-<app>/SKILL.md`. Fill every section from the interview. A section with nothing real in it is a sign the interview missed something; go back.

Write these with care:

- **Launch.** It must reach a usable state from an empty data directory, migrations and seed data included. Ready means usable: a page that renders the app, a CLI that answers `--version`, a health route that checks the database. Give each run its own data directory and port so two runs never collide.
- **Doctor.** One read-only command. It answers "is this instance worth driving?" with yes or no and the reason. It checks that the port belongs to the process this run started, not to some other server.
- **Drive.** Real selectors from the repo. Read the markup or the CLI help to find them. Do not guess a label.
- **Evidence.** One directory per run, outside the data directory. Name files by feature and step.
- **Cleanup.** Stop the process IDs this run recorded, then remove the data directory. Never the evidence directory. End with a check that the port is free and the process is gone.
- **Helpers.** `chmod +x` every script and show the command in the skill body. A helper the reader must reverse-engineer is not a helper.

Build a control CLI (see `control-cli.md`) when driving takes more than two or three commands per step, or when the same steps repeat across features.

## 5. Seed the feature map

Write `features/README.md` and one file per user-facing feature. Start with the three to five that users reach most. Find them in routes, CLI commands, menus and the README. Copy the structure of `feature-map-example/`.

Write each feature from the user's side. "The search box at the top of the page", not "the `SearchBar` component". Check each place you name against a screenshot; in the proof run a form described as "at the bottom of the page" sat in the middle.

In `features/README.md`, say where the helper lives as a path from the repo root, and that the short name in the feature files means that path. `${CLAUDE_SKILL_DIR}` is substituted only in the loaded SKILL.md, not in files read later.

Scope each assertion to the region that proves it. An `expect "Quarterly plan"` after a search also passes on a page that always lists every note. Name every entry point a user has: a button, a keyboard shortcut, a CLI command. A journey that needs data the seed does not have fails; write the reason under `Gotchas`. Do not drop the step.

## 6. Prove the skill once

Follow the generated skill as written, as if you had never seen the repo. Re-read each step from the file before you run it.

You read the new SKILL.md from disk, so Claude Code has not substituted `${CLAUDE_SKILL_DIR}` in it, and your shell does not set it. Read it as `.claude/skills/verify-<app>` from the repo root, or set it for the proof: `export CLAUDE_SKILL_DIR=$PWD/.claude/skills/verify-<app>`.

1. Launch.
2. Doctor.
3. Drive one mapped feature end to end, including its second-view read-back.
4. Capture evidence.
5. Clean up.
6. List the evidence directory and confirm every file is still there.
7. Check that no process this run started is still alive and its port is free.
8. Run `claude plugin validate .claude/skills`. It reports frontmatter that does not parse (Claude Code v2.1.233 or later, per the skills docs).
9. If the interview said two instances can run side by side, start a second run ID while the first is up and run its Doctor. Then clean it up.

Each time you needed knowledge the page did not hold, the page has a gap. Fix the page, run cleanup, and start again from step 1. Keep a log of these gaps; they go in the handover.

If you proved it in a stand-in for the real target (a container for a fresh VM, a local stack for a remote one), list each setup step the stand-in did that the target will not. Those steps stay unverified.

## 7. Hand over

Report:

- the path of the verify skill and each file in it;
- the proof commands and their trimmed output;
- the evidence directory and its listing after cleanup;
- what you fixed in the skill during the proof;
- every step not verified, and why;
- the next step: run Maintain mode when the app changes.

Commit the skill with the project, so every person and every agent drives the app the same way.
