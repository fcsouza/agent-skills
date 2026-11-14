# Game-dev Skills Restructure Implementation Plan

Status: PR 1 is pull request 13. PRs 2 to 4 are pending.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One flat, lint-checked tree of game-dev skills with an index skill, verified sources and boilerplate that compiles against current library versions.

**Architecture:** `skills/` becomes the only source. The plugin copy, hooks, MCP config, agents and two Claude Code/Cursor skills are deleted. One marketplace entry points at the same tree, so `npx skills` and Claude Code read identical files. A lint script and a typecheck workspace keep it that way.

**Tech Stack:** Markdown skills (Agent Skills spec), bash + jq lint, Bun + TypeScript typecheck workspace, `claude plugin eval`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-14-gamedev-skills-restructure-design.md`

**Evidence:** `docs/research/2026-11-14-gamedev-skills/` (eight files). The owner decided these stay out of the repository: the directory is listed in the local git exclude file and is never staged. It exists only in the worktree where this plan was written, so all four PRs are built in that worktree. Tasks cite the files by name.

**Execution method (owner's choice):** parallel subagents wherever tasks are independent; the orchestrator reviews and adjusts each result.

## Global Constraints

- Nothing from memory. A source, quote, version or API claim enters a skill only after the implementer opens a page that supports it. Record the URL.
- Package manager is `bun` / `bunx`. Never npm, npx, yarn or pnpm in commands the plan runs. (README install lines for the public `npx skills` CLI stay as they are.)
- Lint and format for generated game projects: ultracite (`bun run format`, `bun run lint:biome`). Never `bunx biome`.
- Skill `name` equals its directory name: lowercase letters, digits, hyphens, at most 64 characters. `description` at most 1,024 characters.
- `SKILL.md` stays under 500 lines. References sit one level below `SKILL.md`.
- Vendor APIs go through the vendor's official SDK. No hand-written HTTP clients where an SDK exists.
- Before every commit: `git status --short`, read `git diff --cached`, and run the owner's machine-path grep on the staged diff (home-directory paths, `link:` and `file:` dependency URLs). It must print nothing. Never `git add -A`.
- Commit messages and PR text: plain statements of what changed and why. No attribution lines.
- Each PR passes the `verify-before-done` and `judge` skills before merge.
- Scope is the game-dev skills. Do not edit `mods/` or the seven non-game skills.
- Model tiering when dispatching workers: sonnet for mechanical edits, opus for tasks that verify APIs against docs.

## Review Focus

1. **A project that already has the old prefixed skills installed** (`design-level-design/` in `~/.agents/skills` or `.claude/skills`). After reinstall, old and new directories coexist and both load. Expected: the README tells the user how to remove the old ones. Pinned in Task 6, Step 4.
2. **A skill installed alone.** A command says "apply the `quest-narrative-coherence` skill" and that skill is not installed. Expected: the command names the missing skill and the install command, then stops. Pinned by lint check `X1` (Task 1) and the `Requires` block (Task 2).
3. **A skill directory that exists but is missing from the marketplace list.** Claude Code loads only listed paths, silently. Expected: lint fails. Pinned by lint check `M2` (Task 1).
4. **A game project with no `docs/world-lore.md` or `docs/mvp-first-draft.md`.** Expected: the command stops with a message naming the file and the command that creates it. Pinned by eval case `bootstrap-no-docs` (Task 24).
5. **A library that moves past the version the boilerplate was checked against.** Expected: the file header says which version it was verified with. Pinned by lint check `C4` (Task 1) and the typecheck workspace (Task 7).

## Parallelism

- PR 1 (Tasks 1-6) runs in order. The tasks share `marketplace.json`, the command files and the lint.
- PR 2: Task 7 first. Then Tasks 8-20 run in parallel, one worker per skill directory, at most 10 at a time. Tasks 8 and 14 share the session-auth decision: run Task 8 first and give its result to Task 14. The orchestrator alone edits the root `package.json` (Task 19 needs the Google SDK added).
- PR 3: Task 21 first. Then the eight skills of Task 22 in parallel; `game-economy-design` and `procedural-gen` go to one worker because they share `loot-table.ts`.
- PR 4: the seven commands of Task 23 in parallel, then Task 24, then Task 25.
- A worker edits only its own skill directory and does not commit. The orchestrator reads the diff, reruns the lint and the typecheck, opens two of the cited URLs to confirm they say what the worker claims, adjusts, and commits one skill at a time.
- Workers have no context from this session. Each brief names the skills to invoke (`skill-creator`, `superpowers:writing-skills`), the task text, Procedure P, and the evidence files to read.

## Delivery

Four pull requests, in order. Each is cut from `main` after the previous one merges. The owner's review of each PR is what bounds the timeline; the edits themselves are minutes to a few hours of agent time per PR.

| PR | Tasks | Content |
|---|---|---|
| 1 | 1-6 | Structure: lint, one command source, index skill, deletions, names, manifests, MIT |
| 2 | 7-20 | Engineering skills: typecheck workspace, code and sources |
| 3 | 21-22 | Design and narrative skills: sources, trimming, quest ownership |
| 4 | 23-25 | Command content, evals, CI |

## File Structure

| Path | Responsibility |
|---|---|
| `tools/check-skills.sh` | Lint for the game-dev skill set |
| `tools/check-skills.test.sh` | Tests for the lint, one fixture per check |
| `package.json`, `tsconfig.json`, `bun.lock` (repo root) | Compiles every `boilerplate/` and `templates/` `.ts` file against pinned versions. They sit at the root because TypeScript resolves a bare import by walking up from the importing file, and `skills/*/boilerplate/` only reaches a root `node_modules` |
| `skills/game-dev/SKILL.md` | Index: routes a game task to a skill; project conventions |
| `skills/game-dev/templates/game-project-claude.md` | CLAUDE.md template for a game repo |
| `skills/<name>/references/sources.md` | Verified citations for that skill |
| `evals/game-dev/` | Cases for `claude plugin eval` |
| `.github/workflows/skills.yml` | Runs lint and typecheck |
| `.claude-plugin/marketplace.json` | One `game-dev` entry, `source: "./"`, listing 31 skill paths |

## Procedure P: rewriting one skill

Tasks 8-22 apply this procedure to one skill each and add only their specifics.

- [ ] **P1.** Run `tools/check-skills.sh skills/<name>`. Note the failures.
- [ ] **P2. Description.** Rewrite as one clause on what the skill covers, then "Use when ..." with the game need first. Remove the "Triggers:" keyword list. Remove the words the audit flags for that skill (see `audit-design-narrative.md` and `audit-engineering-infra.md`).
- [ ] **P3. Body.** Delete: the opening quote block, "Purpose", the body "When to Use", "Designer Philosophy", "Sources", and theory that states no decision (MDA, Bartle types, flow). Keep decisions, procedures, pitfalls and checklists. Move any block over about 40 lines that is reference material into `references/<topic>.md`.
- [ ] **P4. Links.** Mention every file under `templates/`, `boilerplate/` and `references/` in `SKILL.md`, each with "read when ...". Delete files that have no use.
- [ ] **P5. Sources.** Find this skill's rows in the two source tables and the two second-opinion tables. For each row:
  - Confirmed by the first pass and not contradicted by Codex or Agy: open the URL, then add it to `references/sources.md`.
  - Corrected or misattributed: use the corrected citation after opening its URL.
  - Not found: search once more with the exact title in quotation marks. If still not found, delete the citation and every sentence that depends on it. If Codex or Agy proposed a replacement, open it; add it only if the page supports the claim.
  - Dead link: replace with the current URL after opening it.
  - Attributed quotes with no primary source: delete.
  - Format of each line in `references/sources.md`: `- <Author>, "<Title>" (<venue, year>) - <URL> - supports: <claim> - checked <YYYY-MM-DD>`.
- [ ] **P6. Code.** Apply the task's code specifics. Every `.ts` file that imports a third-party package starts with `// Verified against: <pkg> <version> (<YYYY-MM-DD>)`. Then run `bun run typecheck` at the repo root. Expected: no errors in this skill's files.
- [ ] **P7.** Delete `skills/<name>/.content-pending`. Run `tools/check-skills.sh skills/<name>`. Expected: exit 0.
- [ ] **P8.** The orchestrator reviews the diff, then commits: `git add skills/<name>` and `git commit -m "<name>: verified sources, trimmed body, current APIs"` (drop the parts that do not apply).

---

# PR 1: Structure

### Task 1: Lint

**Files:**
- Create: `tools/check-skills.sh`
- Create: `tools/check-skills.test.sh`

**Interfaces:**
- Produces: `tools/check-skills.sh [--only ID,ID] [skill-dir ...]`. With no directory it checks every skill listed in the marketplace `game-dev` entry plus the repo-level checks. Each failure prints `FAIL <ID> <path>: <message>`. Exit 1 on any failure, 0 otherwise.

Checks:

| ID | Rule |
|---|---|
| `N1` | Frontmatter `name` equals the directory name and matches `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters |
| `N2` | `description` exists, at most 1,024 characters |
| `S1` | `SKILL.md` has fewer than 500 lines |
| `R1` | None of these appear in the skill set, `README.md` or the `game-dev` entry of `.claude-plugin/marketplace.json` (the other entries are not read): `skills/game-dev/(design\|engineering\|narrative\|infrastructure)`, `plugins/game-dev`, `CLAUDE_HOOK_INPUT`, `CLAUDE_PLUGIN_ROOT`, `bunx biome`, `bun.lockb`, `game-asset-gen`, `idle-game-design`, `claude-code-game-workflow`, `cursor-codex-integration`, and `(design\|engineering\|narrative\|infrastructure)-<dir>` for every skill directory name. `npx skills` is banned in the skill set only; `README.md` keeps it for the public install lines. The README section "Upgrading from 1.x" is exempt, because it must name the old directories |
| `R2` | The `game-dev` marketplace entry and `README.md` contain no `<number> skills` count |
| `L1` | Every relative link or backticked `templates/...`, `boilerplate/...`, `references/...` path in a `SKILL.md` resolves to a file |
| `L2` | Every file under a skill's `templates/`, `boilerplate/`, `references/` is mentioned in its `SKILL.md` |
| `M1` | Every path in the marketplace `game-dev` entry's `skills` array exists and holds a `SKILL.md` |
| `M2` | Every directory under `skills/` that the `game-dev` set should contain is listed. The expected set: all directories under `skills/` and `skills/game-dev-commands/` except `claude-agent-sdk`, `database-performance-tuning`, `foundry-vtt-module-dev`, `foundry-vtt-system-dev`, `nuvemshop-sdk`, `openclaw-genie`, `react-animations`. Every listed skill also has a README link to `skills/<name>/` (commands: `skills/game-dev-commands/<name>/`) |
| `X1` | Every skill named in a "`Requires`" block or after "Apply the" resolves to a `skills/**/SKILL.md`. A command has a `## Requires` heading, and every skill it applies is listed there. Every name in the Skill column of the `game-dev` Route table resolves, and, in a full-repo run, every skill the marketplace lists (except `game-dev`) appears in that column |
| `P1` | No tracked file under the listed game-dev skill directories, `tools/`, `evals/`, `docs/superpowers/`, nor the root `bun.lock`, contains a home-directory path or a `link:` / `file:` dependency URL (the owner's machine-path patterns). The script builds these patterns from fragments so it does not match itself |
| `C1` | No `## Sources` heading in `SKILL.md` |
| `C2` | No block-quote line (a line starting with `>`) in `SKILL.md` |
| `C3` | Every line starting with `- ` in `references/sources.md` contains `https://` |
| `C4` | Every `.ts` under `boilerplate/` or `templates/` that imports a non-relative, non-`node:` module starts with `// Verified against: <pkg> <version> (<YYYY-MM-DD>)`. Several packages are separated by `, `, each with a version, and one date ends the line |
| `C5` | `description` contains no `Triggers:` |

`C1`-`C5`, `L2` and `S1` are skipped for a skill that contains a `.content-pending` file. The marker exists only between PR 1 and PR 4. A repo-level check `Z1` fails when any `.content-pending` file exists and `--final` is passed.

- [ ] **Step 1: Write the failing tests** in `tools/check-skills.test.sh`. For each check ID, build a temp repo (`mktemp -d`) holding a minimal `.claude-plugin/marketplace.json` and one skill with exactly one violation; assert the script exits 1 and prints `FAIL <ID>`. Add one clean fixture that exits 0, one fixture with `.content-pending` that passes despite a `## Sources` heading, and one `--final` run that fails `Z1`.
- [ ] **Step 2:** Run `bash tools/check-skills.test.sh`. Expected: fails, script not found.
- [ ] **Step 3:** Implement `tools/check-skills.sh` in bash with `jq` for the manifest. It takes the repo root from `git rev-parse --show-toplevel`, or from `CHECK_SKILLS_ROOT` when set (the tests set it).
- [ ] **Step 4:** Run `bash tools/check-skills.test.sh`. Expected: `all checks passed` with one line per fixture.
- [ ] **Step 5:** Commit `tools/check-skills.sh tools/check-skills.test.sh`: "Add a lint for the game-dev skills".

### Task 2: One source for the seven commands

**Files:**
- Modify: `skills/game-dev-commands/{game-architect,game-balance,game-build,game-expand,game-lore,game-quest,game-review}/SKILL.md`
- Modify: `skills/quest-narrative-coherence/templates/quest-registry.md` (header line only)
- Read only: `plugins/game-dev/commands/*.md` (deleted in Task 4)

The `skills/game-dev-commands/` variant is the base, because it names skills where the plugin variant uses `${CLAUDE_PLUGIN_ROOT}` paths. Merge in from the plugin variant:

- [ ] **Step 1:** For each command, diff the two bodies with the frontmatter stripped: `diff <(awk 'BEGIN{c=0} /^---$/ && c<2 {c++; next} c>=2' plugins/game-dev/commands/<n>.md) <(awk 'BEGIN{c=0} /^---$/ && c<2 {c++; next} c>=2' skills/game-dev-commands/<n>/SKILL.md)`. List every difference that is not `$ARGUMENTS` wording, a path, or a `/game-dev:` name.
- [ ] **Step 2:** Add `argument-hint` to each skill's frontmatter, copied from the plugin variant.
- [ ] **Step 3:** Replace each "extract ... from the user's message" instruction with: "Input: `$ARGUMENTS`. If it is empty, take it from the user's message."
- [ ] **Step 4:** Resolve the real drift:
  - `game-lore`: entry type detection uses "Contains", so it works for slash arguments and free text.
  - `game-quest`: remove the inline registry template. Read the registry template from the `quest-narrative-coherence` skill (`templates/quest-registry.md`). In the same commit, set that template's header to `Quest ID | Name | Type | Quest Giver NPC | Primary Location | Factions Affected | Rewards Summary | Prerequisites | Story Arc`, so `game-quest` keeps writing the same registry it writes today.
  - `game-architect`: where the plugin variant read the plugin README and AGENTS.md, write "Apply the `game-dev` skill". Where it copied `game-project-claude.md`, point to that template in the `game-dev` skill.
  - `game-review`: keep the skill variant's domain-to-skill mapping.
  - References between commands read "the `game-architect` skill (`/game-architect`)".
  - `game-quest` and `game-lore` end with a step that updates `docs/quest-registry.md` or `docs/world-lore.md`. Confirm it exists; add it if not.
- [ ] **Step 5:** Add a `## Requires` block after the title of each command listing the skills it applies, one per line in backticks, followed by: "If one is not installed, say which and stop: `npx skills add fcsouza/agent-skills --skill <name>`."
- [ ] **Step 6:** Run `tools/check-skills.sh --only X1,N2 skills/game-dev-commands/*`. Expected: the only failure is `X1` for `game-dev`, which Task 3 creates.
- [ ] **Step 7:** Commit the seven files: "Merge the two command variants into the skill form".

### Task 3: Index skill

**Files:**
- Create: `skills/game-dev/SKILL.md`
- Move: `skills/claude-code-game-workflow/templates/game-project-claude.md` to `skills/game-dev/templates/game-project-claude.md`
- Modify: `skills/postgres-game-schema/SKILL.md` (add the worktree note)
- Read only: `plugins/game-dev/AGENTS.md`, `plugins/game-dev/README.md`, `skills/claude-code-game-workflow/worktrees.md`

**Interfaces:**
- Produces: a skill named `game-dev`. Commands and the README refer to it by that name.

- [ ] **Step 1:** `git mv` the template. In it, replace `bunx biome` commands with `bun run format` and `bun run lint:biome`, and remove references to agents and MCP servers.
- [ ] **Step 2:** Write `skills/game-dev/SKILL.md`, at most 100 lines:
  - Frontmatter `name: game-dev`. Description: "Entry point for game development work: routes a task to the right game-dev skill and states the project conventions. Use when starting or continuing work on a game project, or when it is unclear which game-dev skill applies."
  - `## Route`: a table "Need | Skill" with one row per topic skill (23) and per command (7), grouped Design, Engineering, Narrative, Infrastructure, Workflows. `skill-progression-trees` goes under Engineering.
  - `## Project files`: `docs/mvp-first-draft.md` (written by `game-architect`), `docs/build-registry.md` (`game-build`), `docs/world-lore.md` (`game-lore`), `docs/quest-registry.md` (`game-quest`).
  - `## Rules`: carry over from `AGENTS.md` only the rules that are game conventions. One of them: before writing a quest, character or lore entry, apply `quest-narrative-coherence`.
  - `## Missing skill`: the `npx skills add fcsouza/agent-skills --skill <name>` line.
  - `## New project`: points to `templates/game-project-claude.md`.
- [ ] **Step 3:** Add to `skills/postgres-game-schema/SKILL.md`, under pitfalls, a three-line note taken from `skills/claude-code-game-workflow/worktrees.md` (the Neon paragraph near line 76): git worktrees share one Neon database, so two worktrees that run migrations collide; use one Neon branch per worktree.
- [ ] **Step 4:** Run `tools/check-skills.sh --only N1,N2,S1,L1,L2,X1 skills/game-dev`. Expected: exit 0.
- [ ] **Step 5:** Commit `skills/game-dev skills/postgres-game-schema/SKILL.md` and the moved file: "Add the game-dev index skill".

### Task 4: Delete the plugin copy, MCP, agents, hooks and two skills

**Files:**
- Move: `plugins/game-dev/evals/evals.json` to `evals/game-dev/legacy-evals.json`
- Delete: `plugins/` (whole directory), `skills/claude-code-game-workflow/`, `skills/cursor-codex-integration/`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1:** Prove nothing outside the deleted paths depends on them: `grep -rn "plugins/game-dev\|claude-code-game-workflow\|cursor-codex-integration" --include='*' . --exclude-dir=.git --exclude-dir=docs --exclude-dir=plugins`. Every hit must be in `README.md`, `.claude-plugin/marketplace.json`, or a skill this plan edits. List them for Task 5 and Task 6.
- [ ] **Step 2:** `git mv plugins/game-dev/evals/evals.json evals/game-dev/legacy-evals.json`.
- [ ] **Step 3:** `git rm -r plugins skills/claude-code-game-workflow skills/cursor-codex-integration`.
- [ ] **Step 4:** In `.claude-plugin/marketplace.json`, remove the entries `game-dev`, `game-dev-design`, `game-dev-engineering`, `game-dev-narrative`, `game-dev-infrastructure`, `game-dev-commands`. Add one entry:

```json
{
  "name": "game-dev",
  "source": "./",
  "description": "Game development skills: design, engineering, narrative, infrastructure and seven workflow commands, with an index skill that routes to them.",
  "keywords": ["game-dev", "game-design", "elysia", "drizzle", "typescript", "multiplayer", "mvp"],
  "category": "development",
  "skills": ["./skills/game-dev", "./skills/<each of the 23 topic skills>", "./skills/game-dev-commands/<each of the 7>"]
}
```

The entry carries no `version`, so users follow the branch head. The manifest has a top-level `renames` map from the five old entry names to `game-dev`.

- [ ] **Step 5:** Run `tools/check-skills.sh --only M1,M2`. Expected: exit 0.
- [ ] **Step 6:** Read `claude plugin validate --help` for the target form, then validate the marketplace at the repo root. Expected: no errors.
- [ ] **Step 7:** Commit: "Remove the plugin copy, hooks, MCP config, agents and two tooling skills".

### Task 5: Names and references

**Files:**
- Modify: frontmatter of the 23 topic `SKILL.md` files
- Modify: every file `tools/check-skills.sh --only R1` reports
- Create: `.content-pending` (empty) in each of the 23 topic skills and 7 commands

- [ ] **Step 1:** Run `tools/check-skills.sh --only N1,R1`. Expected: 23 `N1` failures and the `R1` list.
- [ ] **Step 2:** Set each `name:` to its directory name.
- [ ] **Step 3:** Fix each `R1` hit: prefixed skill names become bare names; `skills/game-dev/<category>/<name>/...` paths become "the `<name>` skill" or a path relative to the file; remove the `game-asset-gen` and `idle-game-design` rows in `skills/game-design-fundamentals/SKILL.md` (lines 164 and 166).
- [ ] **Step 4:** `touch skills/<each of 23>/.content-pending skills/game-dev-commands/<each of 7>/.content-pending`.
- [ ] **Step 5:** Run `tools/check-skills.sh`. Expected: the only failures are `R1`/`R2` hits inside `README.md`, which Task 6 fixes. `L1` failures in a skill are dead references: fix them here.
- [ ] **Step 6:** Commit: "Make skill names match their directories and fix dead references".

### Task 6: README, license, upgrade notes

**Files:**
- Modify: `README.md`, `LICENSE`, `.claude-plugin/marketplace.json` (`metadata.version`, `metadata.description`)

- [ ] **Step 1:** Replace `LICENSE` with the MIT text. Fetch it from https://choosealicense.com/licenses/mit/ and fill `Copyright (c) 2026 Fabricio Cavalcante`. Set the README license line to MIT.
- [ ] **Step 2:** Rewrite the README game-dev sections: remove the "Available Plugins" count line and the two deleted skills; list `game-dev` first as the entry point; move `skill-progression-trees` to Engineering; add the seven commands; update "Structure" to mention `references/`; the Claude Code install line stays `/plugin install game-dev@fcsouza-agent-skills`; remove the `cp -r plugins/game-dev/` line.
- [ ] **Step 3:** Set `metadata.version` to `2.0.0`.
- [ ] **Step 4:** Add a README section "Upgrading from 1.x". Read `bunx skills --help` for the remove command and write the exact steps: remove the old prefixed directories (`design-*`, `engineering-*`, `narrative-*`, `infrastructure-*`) from `~/.agents/skills` and from the project's skills directory, then reinstall. Say that names changed and two skills were removed.
- [ ] **Step 5:** Run `tools/check-skills.sh`. Expected: exit 0.
- [ ] **Step 6:** Run `bunx skills add . --list`. Expected: 31 game-dev skills, unprefixed names, each once. Then `git status --short` to confirm the command wrote nothing.
- [ ] **Step 7:** Run `claude plugin validate .`. Expected: no errors.
- [ ] **Step 8:** Commit, then open PR 1.

---

# PR 2: Engineering skills

### Task 7: Typecheck workspace

**Files:**
- Create: `package.json`, `tsconfig.json`, `bun.lock` at the repo root (`.gitignore` already ignores `node_modules/`)

**Interfaces:**
- Produces: `bun install && bun run typecheck` at the repo root. Exit 0 means every included file compiles.

- [ ] **Step 1:** For each package, read `https://registry.npmjs.org/<pkg>/latest` and pin that exact version. Snapshot on 2026-11-14: `typescript` 7.0.2, `elysia` 1.4.32, `drizzle-orm` 0.45.4, `better-auth` 1.7.23, `bullmq` 6.7.6, `ioredis` 6.0.0, `stripe` 23.1.0, `@elevenlabs/elevenlabs-js` 2.78.0, `@neondatabase/serverless` 1.2.1. Add `@types/bun` and the Google SDK chosen in Task 19 at their current versions.
- [ ] **Step 2:** `package.json`: `"private": true`, the pinned `devDependencies`, and `"scripts": {"typecheck": "tsc --noEmit -p ."}`.
- [ ] **Step 3:** `tsconfig.json`: `strict: true`, `noEmit: true`, `skipLibCheck: true`, module settings valid for TypeScript 7 (it rejects `moduleResolution: node` and `baseUrl`; take the values from the TypeScript 7 release notes), `include: ["skills/*/boilerplate/**/*.ts", "skills/*/templates/**/*.ts"]`, `exclude` the seven non-game skills.
- [ ] **Step 4:** `bun install`, then `bun run typecheck`. Expected: it fails with type errors. If the errors are "cannot find module" for a pinned package, resolution is broken: fix that before going on. Save the error list grouped by skill into the PR description; Tasks 8-20 clear it.
- [ ] **Step 5:** Check the lockfile: `tools/check-skills.sh --only P1` prints nothing for `bun.lock`.
- [ ] **Step 6:** Commit: "Add a typecheck workspace for skill boilerplate".

Rule for Tasks 8-20: a kept file must compile on its own. Replace imports of files that do not exist (`../db`) with a parameter the caller passes in.

### Task 8: `betterauth-integration`

**Files:** Delete `boilerplate/auth-setup.ts`, `boilerplate/auth-middleware.ts`, `templates/auth-routes.ts`. Keep `templates/role-definitions.ts`.

Apply Procedure P with:
- Point to the vendor: "Use the `better-auth-best-practices` skill if it is installed, otherwise https://www.better-auth.com/docs."
- Correct the hashing claim at `SKILL.md:31`: the default is scrypt (https://www.better-auth.com/blog/1-6).
- Drizzle adapter import is `@better-auth/drizzle-adapter`; confirm on the Better Auth Drizzle adapter page.
- Add the schema generation step before `drizzle-kit`; confirm the exact CLI command in the Better Auth CLI docs and write it with `bunx`.
- The admin plugin adds `user.role`. Remove the `additionalFields` role; custom roles use `createAccessControl`. Confirm on the admin plugin page.
- Sessions, not JWT. State that the WebSocket handshake validates the Better Auth session (confirm the server-side session API in the docs).
- Sources: remove the Koster and OWASP quotes (no source found).

### Task 9: `stripe-game-payments`

**Files:** Delete `boilerplate/stripe-setup.ts`, `boilerplate/checkout.ts`. Rewrite `boilerplate/webhooks.ts`. Keep `templates/product-catalog.ts`, `templates/webhook-events.ts`.

Apply Procedure P with:
- Point to the vendor for client setup and Checkout: the `stripe-docs` skill if installed, otherwise https://docs.stripe.com.
- `webhooks.ts`:
  - Verify with `await stripe.webhooks.constructEventAsync(...)`. Confirm in the stripe-node README that the Bun build needs the async form.
  - Idempotency in the database: a table keyed by the Stripe event id with a unique constraint. Remove the in-memory `Set` (line 8).
  - Read the subscription from `invoice.parent.subscription_details.subscription` after checking `invoice.parent?.type === 'subscription_details'` (lines 90-94). Confirm in the Stripe API changelog for Basil.
  - Handle `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`; on `checkout.session.completed`, fulfil only when `payment_status === 'paid'`.
  - Handle `charge.dispute.created` by revoking the purchased currency, as `SKILL.md:65` promises.
  - Do not pass `apiVersion`; the SDK pins its own.
- Replace `stripe.com/use-cases/gaming` with https://stripe.com/industries/gaming after opening it.

### Task 10: `postgres-game-schema`

**Files:** Delete `boilerplate/migrations.ts`. Keep `boilerplate/schema.ts`, `templates/entity-template.ts`, `templates/query-patterns.ts`.

Apply Procedure P with:
- Point to https://orm.drizzle.team for install, config and migrations (and the `neon-drizzle` skill if installed).
- `templates/query-patterns.ts:25,188`: make it compile on drizzle-orm 0.45.x with the database passed in as a parameter.
- Add a short "Drizzle 1.0" note: `relations()` is replaced by `defineRelations()` and `drizzle({ client, relations })`; `casing` moves to the table level. Link https://orm.drizzle.team/docs/v0-v1-changes after opening it.
- Replace `neon.tech/docs` with `neon.com/docs`.

### Task 11: `skill-progression-trees`

**Files:** Modify `boilerplate/skill-tree.ts`.

Apply Procedure P with:
- Lines 104-105 chain two `.where()` calls. Read the Drizzle docs on `where` and combine the conditions with `and(...)`. Fix the commented examples at 136-137 and 169-170 the same way.
- Sources: none of the four GDC talks was found. `The Art of Game Design` (Schell) stays if its page is opened.

### Task 12: `bullmq-game-queues`

**Files:** Modify `boilerplate/scheduler.ts`. Keep the other four files.

Apply Procedure P with:
- `scheduler.ts:46,130,155`: replace `utc: true` with `tz: 'UTC'`. Confirm in the BullMQ v5-to-v6 migration guide.
- State that BullMQ 6 lists ioredis as an optional peer, so the project installs it explicitly.
- Sources: remove the Meier and Wright quotes. Fix the Redis links to the `redis.io/docs/latest/` paths.

### Task 13: `redis-game-patterns`

**Files:** Delete `boilerplate/redis-client.ts`, `boilerplate/session-cache.ts`, `boilerplate/pub-sub.ts`. Keep `boilerplate/leaderboard.ts`, `templates/rate-limiter.ts`, `templates/ephemeral-state.ts`.

Apply Procedure P with:
- Kept files take the Redis client as a parameter.
- Say why the skill uses ioredis: BullMQ 6 defaults to it. Link the ioredis README (which recommends node-redis for new projects) and the BullMQ connections guide, after opening both.
- Remove generic Redis advice (`KEYS *`, "set TTLs", `SCAN`).
- Pub/Sub link becomes https://redis.io/docs/latest/develop/pubsub/.

### Task 14: `game-backend-architecture`

**Files:** Keep `boilerplate/game-loop.ts`, `boilerplate/room-manager.ts`, `templates/message-types.ts`, `ARCHITECTURE.md`. Cut `boilerplate/server.ts` to a wiring example.

Apply Procedure P with:
- `server.ts`: remove `@elysiajs/jwt`; authenticate the WebSocket with the Better Auth session, matching Task 8. Per-request values go through `.derive()`, not `store` (https://elysiajs.com/patterns/extends-context).
- Point to the `elysiajs` skill if installed, otherwise https://elysiajs.com.
- Sources: keep Fiedler "Fix Your Timestep!" and Gambetta "Fast-Paced Multiplayer (Part I)" after opening them. Sid Meier "Interesting Decisions" is confirmed (https://gdcvault.com/play/1015756/Interesting). Remove the Will Wright line.

### Task 15: `game-state-sync`

**Files:** Create `references/` files from `SKILL.md:149-337`. Keep all boilerplate (no third-party imports).

Apply Procedure P with:
- Sources: Tim Ford's talk is "'Overwatch' Gameplay Architecture and Netcode" (GDC 2017). Jared Cone's is "It IS Rocket Science! The Physics of 'Rocket League' Detailed" (GDC 2018, https://www.gdcvault.com/play/1024972/). The Valve wiki page returned 403 to the checkers; open it in a browser before keeping it.

### Task 16: `gameplay-analytics`

**Files:** Modify `boilerplate/analytics-client.ts`. Keep the rest.

Apply Procedure P with:
- `analytics-client.ts`: take the Drizzle database and the Redis client as parameters, so it does not pin a driver.
- Remove the Amy Jo Kim, Koster and Wright quotes and the D1/D30 example attributed to Kim.
- Remove the `deltadna.com` link (dead). The Mixpanel and Amplitude links are general blogs; keep them only if a specific article is opened and supports a claim.
- The D1/D7 targets also appear in `monitoring-game-ops`. This skill owns them.

### Task 17: `matchmaking-system`

Apply Procedure P with:
- Sources: remove "Ranked Matchmaking in Overwatch" (not found). Replace Menke's line with his real talk, "Matchmaking for Engagement: Lessons from 'Halo 5'", after opening its GDC Vault page. The Glicko-2 PDF title is "Example of the Glicko-2 system". Remove the Riot link (redirects to a news search).
- `boilerplate/*.ts` take the Redis client as a parameter.

### Task 18: `monitoring-game-ops`

**Files:** Modify `boilerplate/logger.ts`.

Apply Procedure P with:
- `logger.ts:154-170`: move the request id and start time from `store` to `.derive()`.
- Remove the two GDC talks (not found). Remove the D1/D7 targets and point to `gameplay-analytics`.

### Task 19: `elevenlabs-sound-music`

**Files:** Replace `boilerplate/elevenlabs-client.ts` and `boilerplate/elevenlabs-music-client.ts` with one `boilerplate/elevenlabs-audio.ts`. Rewrite `boilerplate/lyria-client.ts`. Keep `boilerplate/audio-manager.ts`, `templates/sound-config.ts`, `templates/prompt-catalog.md`.

Apply Procedure P with:
- `elevenlabs-audio.ts` uses `@elevenlabs/elevenlabs-js` for speech, sound effects and music. Read the SDK reference for each method name.
- Set the sound effects and music model ids explicitly. Open https://elevenlabs.io/docs/overview/models and use the ids it lists as current. The second opinion reported `eleven_text_to_sound_v3` and `music_v2_5`, with `eleven_text_to_sound_v2` removed on 2027-03-01; confirm before writing.
- `lyria-client.ts` uses the official Google SDK for the GA model `lyria-002`. Open the Vertex AI Lyria page (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria-music-generation) and take the SDK package and call from there. Mention Lyria 3 as preview with its link.
- Remove the Ueda and Chen quotes.

### Task 20: `ci-cd-game`

**Files:** Delete `templates/ci-workflow.yaml`. Modify `boilerplate/ci.yml`, `boilerplate/deploy.yml`.

Apply Procedure P with:
- Cache key hashes `bun.lock`.
- Pin the Bun version; read the input names in https://github.com/oven-sh/setup-bun.
- Use the current major of `actions/checkout`, `actions/cache`, `oven-sh/setup-bun` and the Neon branch action; read each releases page.
- Lint step runs `bun run lint:biome`.
- Remove "Continuous Delivery for Games". If a source is wanted, Jafar Soltani, "Adopting Continuous Delivery" (GDC 2018, https://gdcvault.com/play/1025028/Adopting-Continuous), after opening it.
- Point to the `github-actions-templates` skill if installed.

After Task 20: `bun run typecheck` exits 0; `tools/check-skills.sh` exits 0; open PR 2.

---

# PR 3: Design and narrative skills

### Task 21: One owner for quest coherence

**Files:**
- Modify: `skills/quest-narrative-coherence/SKILL.md`, `templates/quest-registry.md`, `templates/world-lore.md`, `templates/coherence-checklist.md`
- Modify: `skills/quest-mission-design/SKILL.md`, `templates/quest-template.md`, `boilerplate/quest-system.ts`
- Modify: `skills/game-dev-commands/game-quest/SKILL.md`

**Interfaces:**
- Consumes: the quest registry header set in Task 2.
- Produces: the same header in every place that names it: `Quest ID | Name | Type | Quest Giver NPC | Primary Location | Factions Affected | Rewards Summary | Prerequisites | Story Arc`.
- Produces: one list of quest types, defined in `quest-mission-design/SKILL.md` and mirrored as the union type in `boilerplate/quest-system.ts`.

Apply Procedure P to both skills with:
- `quest-narrative-coherence` owns the five-step check. `quest-mission-design` and `game-quest` say "apply `quest-narrative-coherence`" and do not restate the steps.
- All three places use the header above and the single type list.
- All files are read as `docs/world-lore.md` and `docs/quest-registry.md`.
- "At least 2 completion paths" applies to main and faction quests only. Say so.
- Sources: none of the cited GDC talks was found in three checks. The Jeff Kaplan GDC 2009 talk on quest design may replace "Designing Quests That Don't Suck" after opening https://www.gamedeveloper.com/game-platforms/gdc-learning-from-i-world-of-warcraft-i-s-quest-design-mistakes.

### Task 22: The other eight skills

Apply Procedure P, one commit per skill, with these specifics. Source rows for each are in `sources-design-narrative.md`, corrected by `sources-second-opinion-codex.md` and `sources-second-opinion-agy.md`.

| Skill | Specifics |
|---|---|
| `game-design-fundamentals` | 242 lines: move theory out or delete it. The "30 seconds" loop idea is Jaime Griesemer's (Halo), not Miyamoto's. Fullerton's book and Lost Garden (`lostgarden.com`) exist. Garfield "Luck in Games": cite only what is opened. Remove the catch-all at the end of the description. |
| `game-economy-design` | "Players will optimize the fun out of a game" is Soren Johnson (https://www.designer-notes.com/?p=369). Two GDC talks not found; Vili Lehdonvirta, "Designing Virtual Markets for Fun and Profit" (GDC 2013) is a candidate after opening. `templates/loot-table.ts` duplicates `procedural-gen/boilerplate/loot-table.ts` with different content: keep the economy one here, and make `procedural-gen` point to it. Add a step that runs `boilerplate/economy-simulator.ts`. |
| `level-design` | Link all four template and boilerplate files (none is linked today). "Ten Principles for Good Level Design" is Dan Taylor, GDC 2013. Journey: "Designing Journey", GDC 2013. Remove the Dark Souls "postmortems" and the Miyamoto "garden" lines unless a primary source is opened. |
| `procedural-gen` | "Continuous World Generation in 'No Man's Sky'", Innes McKendrick, GDC 2017. Remove "Building Worlds with Noise". Delete its `loot-table.ts` and point to `game-economy-design`. |
| `ui-ux-game` | Narrow the description: "UI" alone collides with non-game skills. Remove Ueda "The Invisible Interface". The ICO and Mario 1-1 claims have secondary support only; keep them as plain statements with those links, without quotes. |
| `character-design-narrative` | Three GDC talks not found; Jill Murray, "Diverse Game Characters: Write Them Now!" (GDC 2013) is a candidate. Remove the Miyazaki paragraph at line 80. |
| `story-structure-game` | Remove the Ken Levine line at 87 (not in the cited article). "Narrative Legos" (Levine, GDC 2014) is real. |
| `worldbuilding` | Six cited talks not found. Richard Rouse III, "Environmental Narrative: Your World is Your Story" (GDC 2010) is a candidate. Lore files are read as `docs/world-lore.md`. |

After Task 22: `tools/check-skills.sh` exits 0; open PR 3.

---

# PR 4: Commands, evals, CI

### Task 23: Command content

**Files:** the seven `skills/game-dev-commands/*/SKILL.md`.

- [ ] **Step 1: `game-build`.** After writing code, run the project's typecheck and tests and read the output before reporting. Decide the test command from the docs: Vitest 5 needs Node 22 unless run as `bun --bun vitest` (Bun 1.4 release notes). Write the one the docs support.
- [ ] **Step 2: `game-balance`.** Add a step that runs `boilerplate/economy-simulator.ts` from `game-economy-design` and reads its output. Replace steps that need a person ("create a spreadsheet", "run silent playtests") with what the agent can do, or mark them as the user's.
- [ ] **Step 3: `game-architect`.** Load a skill only when the selection matrix picks it, not all of them before the first question. Generated projects use ultracite scripts; read the ultracite docs for the init command. The generated `tsconfig.json` is valid for TypeScript 7. Fix the malformed `<repo-root>/${CLAUDE_PLUGIN_ROOT}/` path. Move long templates into `templates/` files so `SKILL.md` drops below 500 lines.
- [ ] **Step 4: all seven.** Replace emoji status lines with plain text. Give each all-caps rule its reason or lower its case.
- [ ] **Step 5:** Delete the seven `.content-pending` files. Run `tools/check-skills.sh`. Expected: exit 0.
- [ ] **Step 6:** Commit.

### Task 24: Evals

**Files:**
- Create: `evals/game-dev/<case>/...`
- Delete: `evals/game-dev/legacy-evals.json` after conversion

- [ ] **Step 1:** Read https://code.claude.com/docs/en/plugin-evals.md and `claude plugin eval --help`. Write down the case layout and the grader types it supports.
- [ ] **Step 2:** Convert the 29 legacy entries: `prompt` becomes the case prompt, `expected_output` becomes a rubric grader with separately checkable statements.
- [ ] **Step 3:** Add trigger cases, each graded on which skill was invoked:
  - One per topic skill and per command (30).
  - `index-ambiguous`: "I'm starting a game, where do I begin?" expects `game-dev`.
  - Eight negative cases where no game skill may fire: a web dashboard UI, a SaaS Stripe subscription, a generic job queue, auth for a blog, a Redis cache for an API, a CI pipeline for a library, a database schema for an invoicing app, a marketing story.
  - `bootstrap-no-docs`: `/game-quest` in a project with no `docs/world-lore.md` expects a stop message naming the file and `game-architect`.
- [ ] **Step 4:** Run the trigger cases once. Save the report under `docs/research/` (local, not committed). For each miss, change that skill's description and rerun that case. The full rubric suite runs only when the owner asks; it costs several runs per case with a baseline arm.
- [ ] **Step 5:** Commit.

### Task 25: CI and final check

**Files:** Create `.github/workflows/skills.yml`.

- [ ] **Step 1:** Workflow on pull request and push to `main`: checkout, setup Bun, `bash tools/check-skills.test.sh`, `tools/check-skills.sh --final`, `bun install --frozen-lockfile && bun run typecheck`.
- [ ] **Step 2:** Run the three commands locally. Expected: each exits 0.
- [ ] **Step 3:** Run `claude plugin validate .` and `bunx skills add . --list`. Expected: no errors; 31 game-dev skills.
- [ ] **Step 4:** Add a README section "Maintaining": how to run the lint and typecheck, how to re-verify a source, and `/skill-doctor` for skills that never fire.
- [ ] **Step 5:** Commit and open PR 4.

## Not in this plan

- `react-animations` (`framer-motion` to `motion`) and the Foundry boilerplate pins. Reported in the spec.
- Codex's second opinion on versions and code. Its account hit the usage limit; rerun it if wanted before PR 2.

## Amendments after the PR 1 review

The whole-branch review of PR 1 found work that belongs to later tasks. Each line names the task that owns it.

**Task 7 (typecheck workspace)**
- Lint check `C4` reads only `.ts` files. If any kept boilerplate is `.tsx` or `.js`, extend `C4` to it in this task.

**Task 21 (quest ownership)**
- The registry template's Active table lost its `Status` column in PR 1. Decide whether it returns, and give the Completed and Planned tables the same column names as the Active table.
- `skills/quest-narrative-coherence/SKILL.md:79-82` still describes the registry fields in the old terms.
- The world-lore section names differ between the `quest-narrative-coherence` template and what `game-architect` writes. Make them one list.

**Task 23 (command content)**
- Six command descriptions still say "Extract ... from the user's message" (`game-quest`, `game-lore`, `game-build`, `game-expand`, `game-balance`, `game-review`), which contradicts the `$ARGUMENTS` input sentence. `game-quest`'s description says it requires `docs/quest-registry.md`, but the command creates that file.
- Nested parentheses like "(run the `game-architect` skill (`/game-architect`) first)" become "(run `/game-architect` first)".
- The `## Prerequisites` bullets that start with "Requires" need another word, because `## Requires` now means skills.
- `game-review` tells the user to rebuild a component with `/game-build`, but `game-build` refuses to regenerate a component marked `built`.
- `game-architect` applies all 23 topic skills, so a user who installed only some of them is stopped by the Requires rule. Loading on demand (Step 3) must also make the Requires check apply only to the skills the selection matrix picks.
- `game-architect` asks for a hand-written `biome.json` and also runs `ultracite init`, which writes the linter config. Keep the `ultracite init` step and remove the hand-written file.
- Procedure P5 applies to the commands too: `game-quest` (around lines 100-102) and the "Designer Philosophies" table in `game-architect` carry attributed quotes with no source.
- Decide whether `game-build` applies the `game-dev` index before it starts.

**Task 25 (CI and final check)**
- `P1` does not scan `README.md`, `LICENSE` or `.claude-plugin/marketplace.json`. Add them.
- Clean up the lint minors the reviews deferred: the duplicate `M1` line for a listed path with no `SKILL.md`; the unused `rel()` helper; `L1` accepting a directory; `git ls-files` without `-z`; the four `R1` patterns with no fixture; the two tests that depend on the previous fixture's state.

**Versions**
- The `game-dev` marketplace entry has no `version` key, so plugin users follow the branch head. No per-PR bump is needed. `metadata.version` stays `2.0.0` until the owner tags a release.

**Open with the owner**
- The nine `mods/*/.claude-plugin/plugin.json` files declare `GPL-3.0`; the root `LICENSE` is MIT. This plan does not edit `mods/`.
