# Template for `.claude/skills/verify-<app>/SKILL.md`

Copy the block below. Replace every `<...>` with what the interview found. Delete a hint line once its section is real. A finished skill holds no `<...>` and no `TODO`.

The layout it produces:

```text
.claude/skills/verify-<app>/
  SKILL.md
  scripts/control-<app>.ts      (or .sh, .py: whatever the repo already runs)
  features/
    README.md
    <feature>.md                one per user-facing feature
```

````markdown
---
name: verify-<app>
description: Use when you need to run <App> (<surface: web page on port N, CLI `x`, API>) and prove a change works by driving it as a user. Launch, doctor, drive, evidence and cleanup for this repo, plus a feature map under features/. Use for "verify it in the app", "reproduce this bug", "show me screenshots".
---

# Verify <App>

<One paragraph: what the app is, which surfaces a user touches, which one this skill drives first.>

Run every command from the repo root. Each run has an ID (`--run <id>`, default `<default>`). Two runs with different IDs share no port and no data.

## Launch

```bash
<exact command>
```

<What it does: fresh data dir, free port, seed data, migrations. How it decides the app is ready: the rendered page, a prompt, a health route that checks dependencies. Where it records the process ID it started.>

<For a short-lived CLI or TUI: the build or install step, run once. Each drive then runs in its own process or PTY session.>

<If the app cannot run twice side by side, say so here and tell the reader to refuse to drive an instance this run did not start.>

## Doctor

```bash
<exact command>
```

Run it before the first drive, after any failed drive, and after anything surprising. It is read-only. It checks <process alive, the port answers and belongs to the recorded process, the right build, the data dir, auth>. If it fails, run Cleanup, then Launch again.

## Drive

<The harness and why. The exact commands for the common steps, with stable handles from this repo: roles and accessible names, labels, test ids, prompt strings, routes.>

The feature map in `features/README.md` lists each user-facing feature and how to drive it. Read the index first, then the feature file.

## Evidence

Evidence for a run goes to `<path>`. Cleanup never deletes it.

- <Per surface: screenshot plus accessibility snapshot, CLI command with stdout, stderr and exit code, request and response.>
- Read every side effect back through a second view: <the second view for this app>.
- Drive the real user path. No test-only routes, no direct writes to storage.
- Mocks only where production already isolates the system: <the boundaries in this app, or "none">.
- <Any dry-run or test mode, and what you observed it actually skip.>

## Cleanup

```bash
<exact command>
```

<What it stops (only process IDs this run recorded), what it removes, what it keeps. How to confirm nothing is left: the port is free, the process is gone.> Never kill by process name.

## Helpers

- `${CLAUDE_SKILL_DIR}/scripts/<file> --help`: <one line>. <Each script is executable; show the exact invocation for each command the sections above use.>

## Pitfalls

- <Traps the proof run hit: wrapper processes, debounce, focus, seed gaps.>
````

## Notes on filling it in

- Keep `name` equal to the directory name. Put the app name, the surface and the trigger phrases in `description`; that text is how Claude decides to load the skill.
- `${CLAUDE_SKILL_DIR}` resolves to the skill's own directory in Claude Code, so helper paths work from any working directory.
- If the repo already has a test harness (Playwright specs, Cypress, an expect script), the Drive section calls it. Write a helper only for what the harness lacks.
- Keep the body short. Feature detail belongs in `features/`, not here.
