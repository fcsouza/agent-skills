# Sources

Each line names the page opened and the claim it supports. All pages were read on 2026-11-22. Lines marked "tested" were also run in a scratch project with Biome 2.6.8, ultracite 8.3.1, dependency-cruiser 18.8.0, TypeScript 6.0.3, Zod 4.6.7, bun 1.4.4 and Claude Code's `claude plugin` commands. Lines marked "observed" come from those runs and no page states them.

## Thesis

- Lauren Tan, talk at AI Engineer (YouTube, 2026-11-14) - https://www.youtube.com/watch?v=O_zcc6Xl12g - supports: the codebase as the agent's largest input, so bad patterns get copied; turn each correction into a deterministic check; ban APIs that need nuance; context in directory structure with imports across it forbidden; ban most comments because they cannot be enforced and give room to justify workarounds; lint messages that point at the root cause; start with a lint that stops new occurrences, then clean up old ones.

## Biome

- Biome, "noRestrictedImports" - https://biomejs.dev/linter/rules/no-restricted-imports/ - supports: group `style`; `paths` with a message or `importNames` plus `message`; `patterns` with `group` and `message`; gitignore-style globs; default severity warning. Tested: `importNames` ban; relative and alias specifiers caught by `**/main/**`. Observed: matches the specifier text, so `'../main'` passed.
- Biome, "noRestrictedGlobals" - https://biomejs.dev/linter/rules/no-restricted-globals/ - supports: group `style`; `deniedGlobals` as an object from name to message; default severity warning. Tested: bare `setTimeout` caught. Observed: custom message prints as a note; `window.setTimeout` not caught.
- Biome, "Linter" - https://biomejs.dev/linter/ - supports: levels `on`, `off`, `info`, `warn`, `error`; errors fail the CLI; warnings fail only with `--error-on-warnings`. Tested: `"level": "on"` gave a warning and exit 0.
- Biome, "Configuration" - https://biomejs.dev/reference/configuration/ - supports: `overrides` with `includes`; last matching override wins for single values; `extends`; `plugins` entries as a path or `{ path, includes }`. Observed: an override's rule `options` replace the base options.
- Biome, "Linter plugins" - https://biomejs.dev/linter/plugins/ - supports: `.grit` files registered under `plugins`; `register_diagnostic` with `span`, `message`, optional `severity` (`hint`, `info`, `warn`, `error`) and `fix_kind`; `includes` to scope a plugin; JavaScript plugins are a developer preview. Tested: `$obj.setTimeout($args)` caught `window.setTimeout`; category printed as `plugin`.
- Biome, "GritQL" - https://biomejs.dev/reference/gritql/ - supports: target languages JavaScript and TypeScript, CSS, JSON; grammar node names can change between versions; support still in progress.
- Biome, "Suppressions" - https://biomejs.dev/analyzer/suppressions/ - supports: `// biome-ignore <category>: <reason>` for the next line; `biome-ignore-all` at file top; `biome-ignore-start` and `biome-ignore-end` ranges; misplaced file-level suppression reported as `suppression/unused`. Tested: a suppression without a reason is a parse error; `lint/plugin` suppressed a plugin hit.
- Biome, "CLI" - https://biomejs.dev/reference/cli/ - supports: `--changed` checks whole files changed against `vcs.defaultBranch`, not added lines, so it is not a ratchet.

## Ultracite

- Ultracite, "Configuration" - https://www.ultracite.ai/docs/configuration - supports: `extends` with `ultracite/biome/core` and framework presets; rules overridden under `linter.rules`.
- Ultracite, "Usage" - https://www.ultracite.ai/docs/usage - supports: `ultracite check` runs the linter without changing files; `ultracite fix` applies safe fixes. The script names `bun run format` and `bun run lint:biome` are the owner's, from the owner's own instructions, not from this page.

## dependency-cruiser

- dependency-cruiser, "Rules reference" - https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md - supports: `forbidden` rules with `name`, `severity`, `comment`, `from.path`, `to.path`; `error` severity makes the `err` reporters exit non-zero; config file names `.dependency-cruiser.js`, `.cjs`, `.json`.
- dependency-cruiser, "CLI" - https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md - supports: `--validate` is an alias for `--config`; `err` exits with the count of error violations; `err-long` also prints the rule's `comment`. Tested: `'../main'` and `'../main/disk'` both failed, exit 1. Observed: with no supported TypeScript compiler installed it warned, read 0 modules and exited 0. Tested: `err` printed rule names and file paths without the comment, exit 2 for two violations.
- dependency-cruiser, package.json - https://raw.githubusercontent.com/sverweij/dependency-cruiser/main/package.json - supports: bin names `dependency-cruiser`, `dependency-cruise`, `depcruise`; version 18.8.0.

## TypeScript and Zod

- TypeScript handbook, "Narrowing" - https://www.typescriptlang.org/docs/handbook/2/narrowing.html - supports: type predicates `parameterName is Type`; exhaustiveness checks by assigning to `never` in `default`. Tested: a missing variant gave TS2322 on that line.
- Zod, "Defining schemas" - https://zod.dev/api - supports: `.brand<"X">()` is static only; plain data is not assignable to the branded type until parsed; `z.infer`; `.parse` throws, `.safeParse` returns a result object. Tested: branded schema compiled and rejected a plain string.

## Git and GitHub

- Git, "git-grep" - https://git-scm.com/docs/git-grep - supports: searching a given tree; `-c`, `-E`, `-I`; pathspecs after `--`. Tested in `scripts/ratchet.sh`: output for a tree is prefixed with the tree name; `--untracked` includes untracked files.
- Git, "git-diff" - https://git-scm.com/docs/git-diff - supports: `A...B` compares the merge base of A and B with B; `-G<regex>` finds changes whose added or removed lines match.
- GitHub REST, "Pull request review comments" - https://docs.github.com/en/rest/pulls/comments - supports: `GET /repos/{owner}/{repo}/pulls/comments` with `sort`, `direction`, `since`, `per_page` up to 100. `gh api --help` (gh 2.103.3) documents the `{owner}` and `{repo}` placeholders.

## Claude Code

- Claude Code, "Hooks reference" - https://code.claude.com/docs/en/hooks - supports: settings hook shape `hooks` to event to `matcher` to `hooks[{ type: "command", command }]`; event list including `PreToolUse`; stdin fields `tool_name`, `tool_input`; exit 2 blocks and stderr becomes the message; JSON `permissionDecision: "deny"` with `permissionDecisionReason`; settings file locations; `$CLAUDE_PROJECT_DIR`; matcher exact-match characters versus regex; plugin `hooks/hooks.json`. https://docs.claude.com/en/docs/claude-code/hooks redirects here. Only the first third of this long page was read. Tested: the `no-verify.sh` script exits 2 or 0 as stated when fed JSON on stdin.
- Claude Code, "Create a mod" - https://code.claude.com/docs/en/plugins/mods/create.md - supports: `hooks/hooks.json` with `modules`; the module exports `register(on)`; Claude Code 2.1.287 or later; `claude plugin validate`; `claude plugin test` with `claude-code/testing`. Tested: the guard mod validated and its test passed.
- Claude Code, "React to events with a mod" - https://code.claude.com/docs/en/plugins/mods/events.md - supports: `tool.call` hooks with a matcher; returning `{ deny }` without `next` refuses the call and Claude reads the text; a failing hook is skipped unless a `.catch` handler answers; `next.called`; events are frozen, pass a changed copy to `next`.
- Claude Code, "Explore the .claude directory" - https://code.claude.com/docs/en/claude-directory - supports: transcripts at `~/.claude/projects/<project>/<session>.jsonl`; auto memory at `~/.claude/projects/<project>/memory/`; `<project>` is the working directory path with non-alphanumerics replaced by `-` (the page states this for the scratchpad folder; its `claude purge` example shows the same form for `projects/`, so applying it there is an inference); `cleanupPeriodDays` default 30; transcripts are plaintext; AGENTS.md can stand in for CLAUDE.md.
- Claude Code, "Settings files and precedence" - https://code.claude.com/docs/en/settings - supports: scopes of `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`.
