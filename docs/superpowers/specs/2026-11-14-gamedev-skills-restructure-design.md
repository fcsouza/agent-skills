# Game-dev skills restructure: design

Date: 2026-11-14. Status: decisions taken by the owner in the planning session; awaiting plan approval.

Evidence for every claim below lives in `docs/research/2026-11-14-gamedev-skills/`. By the owner's decision that directory stays out of the repository (local git exclude).

## Problem

- The 25 game-dev skills exist twice, byte for byte: `skills/<name>/` and `plugins/game-dev/<category>/<name>/`.
- The 7 workflow commands exist in two hand-kept variants that differ by 24 to 160 lines each.
- All 25 `name:` fields carry a category prefix (`design-level-design` in `level-design/`). The Agent Skills spec requires the name to equal the directory.
- The owner installs with `npx skills`, which copies skill directories only. The plugin's hooks, `commands/`, `agents/`, `.mcp.json` and `AGENTS.md` never reach his projects.
- Four of six hook scripts read `$CLAUDE_HOOK_INPUT`; Claude Code passes hook input on stdin. The destructive-SQL guard lets `DROP TABLE` through.
- A web check by Claude subagents found no trace of about 25 cited GDC talks and about 70 attributed quotes. Codex and Agy (Gemini 4 Hydrogen) were given those tables and searched again; neither found them. Others are misattributed or mistitled.
- Boilerplate pins APIs that have moved: Stripe `2024-12-18.acacia`, the old Better Auth Drizzle adapter path, `bun.lockb`, BullMQ `utc: true`, a synchronous Stripe webhook check.

## Decisions (owner's, 2026-11-14)

The owner's rule, in his words: "nao quero que inventa nada da cabeca, por isso precismos ter fontes". Every source, quote and version claim needs a URL someone opened.

1. Install path is `npx skills` (cherry-pick).
2. Remove MCP and agents from the bundle.
3. Shape: one flat tree in `skills/`, plus one index skill `game-dev`. Delete the copy under `plugins/game-dev/`.
4. The 7 commands become skills only. They fire by slash and by the model (no `disable-model-invocation`).
5. Delete all five hooks.
6. License: MIT.
7. A source the web check cannot confirm is replaced by a real, verified source with its URL. If none exists, the claim goes too.
8. Code: "enxugar e atualizar mesmo, a prefiria usar o sdk dos caras que tem mesmo". Delete boilerplate that only restates a vendor API and point to the official docs. Keep and update what is game-specific. Where code talks to a vendor, use the vendor's official SDK, not a hand-written HTTP client.
9. Delete `claude-code-game-workflow` and `cursor-codex-integration`. Keep the game-project CLAUDE.md template and the worktree + Neon note.
10. Research tables stay out of the public repository.
11. Verified citations live in `skills/<name>/references/sources.md`, not in `SKILL.md`.
12. The design choices listed below are accepted.
13. Execution: parallel subagents where tasks are independent; the orchestrator reviews and adjusts.

## Target shape

```
skills/
  game-dev/                     index skill: "need X -> use skill Y", project conventions
    SKILL.md
    templates/game-project-claude.md
  <23 topic skills>/            name == directory
    SKILL.md                    decisions, procedures, pitfalls; no quotes, no Sources section
    references/sources.md       verified citations only, each with a URL (optional)
    boilerplate/ templates/     game-specific code, compiled against pinned versions
  game-dev-commands/<7>/SKILL.md
tools/
  check-skills.sh               lint: names, links, manifests, banned strings, sources
package.json, tsconfig.json     typecheck: compiles boilerplate against pinned current versions
evals/game-dev/                 cases for `claude plugin eval`
.claude-plugin/marketplace.json one `game-dev` entry, source "./", listing all 31 skills
```

`plugins/` is removed. `mods/` and the non-game skills are untouched.

## Design choices made while planning (accepted by the owner)

- **Every boilerplate file that imports a third-party package starts with a `// Verified against: <pkg> <version> (<date>)` comment.** The installed skill does not ship the repo's `package.json`, so the file itself must say what it was checked against.
- **Drizzle target is the stable line (0.45.x)**, with a note on the two 1.0 breaking changes. 1.0 is still a release candidate.
- **Redis client stays ioredis**, because BullMQ 6 defaults to it and a game that uses both should share one client library. The skill says so and links both READMEs.
- **Lyria code targets `lyria-002` (GA) through the official Google SDK.** Lyria 3 is preview; the skill mentions it with a link.
- **WebSocket auth uses the Better Auth session**, not `@elysiajs/jwt`. This removes the contradiction between two skills.
- **One marketplace entry.** The five category entries (`game-dev-design`, `game-dev-engineering`, `game-dev-narrative`, `game-dev-infrastructure`, `game-dev-commands`) are removed; `game-dev` lists all 31 skills. Anyone who installed a category entry as a Claude Code plugin must reinstall `game-dev`.
- **Manifests carry no skill counts.** The lint derives the list from the marketplace entry.
- **Copyright line:** `Copyright (c) 2026 Fabricio Cavalcante`.

## Out of scope (reported, not fixed here)

- `react-animations` imports `framer-motion`; the current package is `motion`.
- `foundry-vtt-module-dev` boilerplate pins `vite ^5.4` and `ultracite ^4`.
- The Codex second opinion on versions and code did not finish (account usage limit).

## Acceptance

- `tools/check-skills.sh` exits 0.
- `bun run typecheck` at the repo root exits 0.
- `claude plugin validate .` reports no errors.
- `bunx skills add . --list` shows 31 game-dev skills with unprefixed names and no duplicates.
- `claude plugin eval` trigger cases: the expected skill fires in every case, and no game skill fires in the negative cases.
- The owner's machine-path grep on the staged diff is empty before each commit.
