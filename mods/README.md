# Claude Code mods

Mods are Claude Code plugins built on function hooks. They run inside Claude Code and can guard tool calls or draw above the prompt. Each folder here is one mod. They need Claude Code 2.1.287 or later.

| Mod | What it does |
| --- | --- |
| [commit-guard](commit-guard/) | Blocks a commit whose staged diff holds a home-folder path or a `link:`/`file:` reference. Blocks `git add -A` and `git add .`. Blocks pushes straight to `main` or `master`. |
| [prod-guard](prod-guard/) | Holds every write call to the Dokploy MCP server until you press Proceed. Reads pass through. Secret fields show by name only. |
| [bun-only](bun-only/) | Rewrites `npm`, `npx`, `yarn` and `pnpm` to `bun` and `bunx`. Sends `bunx biome` to `bun run format` or `bun run lint:biome`. |
| [done-gate](done-gate/) | Shows the files a turn edited and which checks (format, lint, typecheck, test) have not run since. Reads the checks from `package.json` scripts. |
| [worktrees](worktrees/) | Shows the repo's git worktrees, their branches, uncommitted changes, and the count against a limit of 10. Hidden when there is only one. |
| [usage-rings](usage-rings/) | Shows context, 5h and 7d usage. Each ring turns green, yellow, orange or red by level, and shows the time left until the limit resets. Compact runs `/compact`; Code review runs `/code-review high --fix`. Each running subagent gets a row with its model, time and tool count. |

## Install

In a terminal session:

```
/plugin marketplace add fcsouza/agent-skills
/plugin install commit-guard@fcsouza-agent-skills
```

Swap in any mod name from the table. In the desktop app, click + next to the prompt box, then Plugins, Add marketplace with `fcsouza/agent-skills`, then Add plugin.

usage-rings replaces the usage band of the [skins](https://github.com/hellosverre/claude-skins) mod. If you use skins, run `/skin band off`.

## Develop

```
claude --plugin-dir mods/commit-guard
claude plugin validate mods/commit-guard
claude plugin test mods/commit-guard
```

Pure logic sits in its own file (`rules.ts`, `checks.ts`, `parse.ts`, `meters.ts`) so the tests call it directly.
