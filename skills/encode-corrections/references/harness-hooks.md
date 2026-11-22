# Harness hooks (level 5)

Use a hook when the mistake is something the agent does, not code it writes: a forbidden command, a skipped safety step, a write to the wrong place. A hook runs before the tool call and can refuse it, so the mistake never happens.

If the mistake can also live in code, prefer a level 3 lint: a hook stops only agents in this harness, a lint stops every author and runs in CI. A hook can still back up a lint when the agent keeps trying the same thing, because it answers at once instead of at the next lint run.

Facts below come from the Claude Code hooks and mods docs, read on 2026-11-22 (`sources.md`). The docs.claude.com hooks URL redirects to code.claude.com.

## Choose the form

| Form | Lives in | Good for |
| --- | --- | --- |
| Settings hook | `.claude/settings.json` (shared with the team), `.claude/settings.local.json` (you, this project), `~/.claude/settings.json` (you, every project) | One shell script per rule. No plugin needed. |
| Plugin with `hooks/hooks.json` command hooks | A plugin | The same, shipped to several repos. |
| Mod (function hooks) | A plugin whose `hooks/hooks.json` has a `modules` key | Logic in TypeScript, tests with `claude plugin test`, rewriting a call instead of only refusing it. Needs Claude Code 2.1.287 or later. |

## Settings hook: refuse a Bash command

`.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/no-verify.sh", "args": [] }]
      }
    ]
  }
}
```

`.claude/hooks/no-verify.sh`:

```bash
#!/usr/bin/env bash
# PreToolUse hook for Bash: refuse git commands that skip the repo's own hooks.
set -euo pipefail
command=$(jq -r '.tool_input.command // ""')
# --no-verify on commit or push; -n on commit only (for push, -n means --dry-run).
if [[ $command =~ git[[:space:]]+(commit|push)[[:space:]].*--no-verify ]] ||
  [[ $command =~ git[[:space:]]+commit[[:space:]](.*[[:space:]])?-n([[:space:]]|$) ]]; then
  echo "Do not skip git hooks. Run the failing check, fix what it reports, then commit again." >&2
  exit 2
fi
exit 0
```

- The hook reads JSON on stdin. For `PreToolUse` it holds `tool_name` and `tool_input`; for Bash, `tool_input.command` is the command.
- Exit code 2 blocks the call, and stderr becomes the message Claude reads. Write it as an instruction that names the fix.
- Instead of exit 2, a hook can exit 0 and print `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "<the fix>"}}`.
- A matcher made of letters, digits, `_`, `-`, spaces, `,` and `|` matches tool names exactly (`Edit|Write`). Any other character makes it an unanchored JavaScript regex.
- `${CLAUDE_PROJECT_DIR}` is the project root where the session started. This is the exec form: `command` plus `args`, no shell, so a path with spaces needs no quoting. The docs prefer it for any hook that names a path placeholder; in shell form, wrap each placeholder in double quotes. A plugin has its own variable for its folder; see the hooks reference.
- Tested: fed JSON on stdin, the script exited 2 for `git commit --no-verify -m x`, `git commit -n -m x`, `git commit -m x -n` and `git push --no-verify`, and 0 for `git push -n origin feat`, `git commit -m x`, `git log -n 5` and `ls`. It was not run inside a live session.
- Text matching catches the common spellings only. Tested: `git -C . commit --no-verify -m x`, `git commit -nm x` and `git commit --no-v -m x` all get through. A commit message that contains ` -n` is refused. Say so in the table row.

## Mod: refuse or rewrite a tool call

A mod is a plugin whose `hooks/hooks.json` lists a module:

```json
{ "modules": ["./register.ts"] }
```

The module exports `register`, which receives `on`. A `tool.call` hook gets the mods API, the event and `next`. Return `next(e)` to let the call run, or return `{ deny: '<message>' }` without calling `next` to refuse it; Claude reads the deny text as the tool's result.

```ts
import type { Register } from 'claude-code';

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = String((e as { command?: unknown }).command ?? '');
    if (/\bgit\s+(commit|push)\b.*--no-verify/.test(command) || /\bgit\s+commit\b.*\s-n(\s|$)/.test(command)) {
      return { deny: 'Do not skip git hooks. Run the failing check, fix what it reports, then commit again.' };
    }
    return next(e);
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'The git hook guard failed, so this command did not run.' }));
};
```

- A hook that throws or times out is skipped and the call goes ahead. The `.catch` handler makes the guard fail closed. `next.called` says whether the hook had already called `next`.
- Pass `next` a changed copy of the event to rewrite a call instead of refusing it. The event itself is frozen.
- `claude plugin validate <dir>` lists the hooks it found and flags a gating hook without `.catch`. `claude plugin test` runs the mod's tests with no session.
- Tested: in a scratch plugin, `claude plugin validate` passed, and a `claude plugin test` test that fired `git commit --no-verify -m x` got the deny while `git commit -m x` went through. It was not loaded in a live session.

A test for the mod, in `tests/guard.test.ts`:

```ts
import { expect, test } from 'claude-code/testing';

test('refuses --no-verify and lets a plain commit through', async ($, on) => {
  on('tool.call', () => ({ result: 'ran' }));
  const refused = await $.tool.call({ tool: 'Bash', command: 'git commit --no-verify -m x' });
  expect(refused.deny).toContain('Do not skip git hooks');
  const passed = await $.tool.call({ tool: 'Bash', command: 'git commit -m x' });
  expect(passed.deny).toBeUndefined();
});
```

## Worked examples

The repository that ships this skill also ships mods that encode corrections as hooks, at https://github.com/fcsouza/agent-skills/tree/main/mods. Read them as worked examples:

- `bun-only` rewrites `npm`, `npx`, `yarn` and `pnpm` calls to `bun` and `bunx`, and sends direct Biome calls to the project scripts. It rewrites rather than refuses, so the agent's step still runs.
- `commit-guard` blocks a commit whose staged diff holds a home-folder path or stages a `.env` file, blocks `git add -A`, and blocks pushes to `main`.
- `pino-guard` blocks an edit that adds a pino transport without a development-only guard. This one guards a code pattern, so by the rule above a lint would also fit; the hook answers during the edit.

## Proving a hook

1. Feed the hook the JSON of the real past mistake on stdin (settings hook) or fire the event in a `claude plugin test` test (mod).
2. Confirm it refuses with a message that names the fix.
3. Feed it two or three nearby commands that must pass, and confirm they do.
4. Record in the table row what the text match does not catch.
