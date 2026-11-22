# Agent Skills

Production-grade skills for AI coding agents (OpenClaw, Claude Code, and others).

Built by [Fabricio Cavalcante](https://github.com/fcsouza) — Software Engineer & AI Specialist.

## Available Plugins

A plugin bundles skills you install in one step.

| Plugin | Description | Platform |
|--------|-------------|----------|
| [game-dev](skills/game-dev/) | Game development skills for design, art and assets, engineering, narrative and infrastructure, seven workflow commands, and an index skill that routes a task to the right one | Game Dev |
| fstack | Four skills for trusting an agent's work: corrections encoded as checks, runtime verification, formal verification and UI fuzzing. See [fstack](#fstack) below | Claude Code |
| standalone-skills | The eight skills under [Standalone](#standalone) below | Various |

## Claude Code Mods

Mods are plugins built on function hooks: they run inside Claude Code, guard tool calls and draw above the prompt. See [mods/](mods/) for install steps.

| Mod | Description |
|-----|-------------|
| [commit-guard](mods/commit-guard/) | Blocks commits with machine paths or `.env` files, `git add -A`, and pushes to `main` |
| [prod-guard](mods/prod-guard/) | Holds Dokploy MCP writes until you press Proceed |
| [bun-only](mods/bun-only/) | Rewrites npm, npx, yarn and pnpm to bun |
| [done-gate](mods/done-gate/) | Shows edited files and the checks still owed |
| [worktrees](mods/worktrees/) | Shows git worktrees, their changes, and the count |
| [usage-rings](mods/usage-rings/) | Context and plan usage, coloured by level |
| [pr-status](mods/pr-status/) | The current branch's PR: CI checks and review |
| [sql-guard](mods/sql-guard/) | Holds writes to non-local databases until you press Proceed |
| [pino-guard](mods/pino-guard/) | Blocks pino transports that break bundled logging |

## Available Skills

Skills are individual, cherry-pickable modules. Install only what you need.

### fstack

Four skills that make an agent's work checkable. They come from Lauren Tan's talk [All Code Is Slop (Except Mine)](https://www.youtube.com/watch?v=O_zcc6Xl12g): every correction becomes a check, and verification is how you trust the result. Installed as the Claude Code plugin, the commands are `/fstack:<name>`.

| Skill | Description | Platform |
|-------|-------------|----------|
| [encode-corrections](skills/encode-corrections/) | Turn each correction you give an agent into a check that fails next time: architecture first, then types, a lint whose error names the fix, a test, a hook, and prose last | Claude Code |
| [runtime-verification](skills/runtime-verification/) | Give a project a scripted way to run the real app, drive it as a user would and keep evidence: generates a `verify-<app>` skill with a feature map, and audits it when the app changes | Claude Code |
| [formal-verification](skills/formal-verification/) | Verify one property where tests do not reach: a TLA+ model checked with TLC or generated inputs on the real code, a broken variant that fails, a Mermaid statechart, and a project skill that rechecks it | TLA+ / fast-check |
| [bombadil](skills/bombadil/) | Find UI bugs with property-based testing: write a Bombadil spec for a web or terminal app, run a bounded test, read the trace, reproduce and shrink a violation | [Bombadil](https://github.com/antithesishq/bombadil) |

#### How they fit together

Each skill works on its own, so you can adopt one at a time. Together they follow the order the talk gives [at 2:03](https://www.youtube.com/watch?v=O_zcc6Xl12g&t=123s): the codebase and deterministic checks first, then verification, with prose rules last.

| Step | Skill | When |
|------|-------|------|
| 1 | `encode-corrections` | All the time. Each correction you give the agent becomes architecture, a type, a lint, a test or a hook. Start here. |
| 2 | `runtime-verification` | Once per project. It writes a `verify-<app>` skill so the agent can run the app and keep evidence. Run its Maintain mode when the app changes. |
| 3 | `bombadil` | After the app starts on its own, locally or on staging, with disposable data. Each UI rule you state becomes a property. |
| 4 | `formal-verification` | Only where tests and fuzzing do not reach: a race, a retry, a lease, a state machine. One target at a time. |

Only step 3 needs another step first: Bombadil needs a running app, and step 2 is what gives the agent one.

The skills hand work to each other:

- A bug that `bombadil` or the `verify-<app>` skill finds is a correction. Give it to `encode-corrections` so a check stops it from coming back.
- Replay a `formal-verification` counterexample against the real code before you report it as a bug: as a test, or live with the `verify-<app>` skill.
- Review the change with [judge](skills/judge/), from the `standalone-skills` plugin. Its "Promote to lint rule" section lists findings for `encode-corrections`.

A first session in a project can look like this:

```
/fstack:encode-corrections sweep this repo for mistakes that happened twice
/fstack:runtime-verification make a verification skill for this repo
/fstack:bombadil fuzz the checkout page; the cart total never goes negative
/fstack:formal-verification can two workers commit the same job?
```

### Standalone

Each skill stands on its own. Install one, or all eight with the `standalone-skills` plugin.

| Skill | Description | Platform |
|-------|-------------|----------|
| [asaas](skills/asaas/) | Charge in Brazil with the Asaas API: Pix charges and QR codes, Pix Automático, subscriptions, customers, webhooks and sandbox, plus the `$aact_` key quoting traps | [Asaas](https://www.asaas.com) |
| [claude-agent-sdk](skills/claude-agent-sdk/) | Build agents with the Claude Agent SDK in TypeScript or Python: permissions, settings isolation, subagents, hooks, custom tools, sessions and hosting, with pointers to the official docs | Claude Agent SDK |
| [database-performance-tuning](skills/database-performance-tuning/) | Find and fix slow Postgres and MySQL queries: measure first, read the plan, change one thing, verify. Ships a read-only Postgres diagnostic script | PostgreSQL / MySQL |
| [foundry-vtt-dev](skills/foundry-vtt-dev/) | Build and migrate Foundry VTT v14 modules and game systems: manifests, TypeDataModel, ApplicationV2 sheets, GM-checked queries, Active Effects V2, Regions, world migrations, Vite build and release | [Foundry VTT](https://foundryvtt.com) |
| [judge](skills/judge/) | Review a pull request, branch or diff before merge: deterministic checks, fresh-context reviewers, verified findings with evidence, a coverage table, a gate script, then a fix loop | Claude Code |
| [nuvemshop-sdk](skills/nuvemshop-sdk/) | Build, audit and publish Nuvemshop/Tiendanube apps: OAuth and scopes, webhook signature checks, Nexo, NubeSDK and App Store homologation | [Nuvemshop](https://nuvemshop.dev) |
| [openclaw-genie](skills/openclaw-genie/) | Install, configure and deploy the OpenClaw gateway safely: points to the official docs and sets rules for secrets, channels and network exposure | [OpenClaw](https://openclaw.ai) |
| [react-animations](skills/react-animations/) | Motion for React: CSS or Motion, exit animations, reduced motion, bundle size, and game HUD effects such as health bars, card flips and screen shake | React |

Upgrading: `foundry-vtt-module-dev` and `foundry-vtt-system-dev` are now one skill, `foundry-vtt-dev`. Remove the two old skills and install `foundry-vtt-dev`.

### Game Dev

Start with `game-dev`. It routes a game task to the right skill below and states the project conventions.

| Skill | Description |
|-------|-------------|
| [game-dev](skills/game-dev/) | Entry point: routes a game task to the right skill and states the project conventions |

#### Design

| Skill | Description |
|-------|-------------|
| [game-design-fundamentals](skills/game-design-fundamentals/) | Design loop, core loops, difficulty, rewards |
| [game-economy-design](skills/game-economy-design/) | Currencies, faucets and sinks, loot tables, exploit review |
| [game-localization](skills/game-localization/) | Localize a game: string tables with stable IDs, plurals and formatting through Intl, text expansion, pseudo-localization |
| [level-design](skills/level-design/) | Levels, environments, difficulty curves |
| [mmo-design](skills/mmo-design/) | Persistent worlds: shards, economy at scale, alts, roles, guilds, endgame, live ops |
| [procedural-gen](skills/procedural-gen/) | Seeded dungeons, terrain and worlds, generator validation |
| [quest-mission-design](skills/quest-mission-design/) | Quests, objectives, quest trees |
| [ui-ux-game](skills/ui-ux-game/) | HUD, menus, onboarding, accessibility |

#### Art and assets

| Skill | Description |
|-------|-------------|
| [elevenlabs-sound-music](skills/elevenlabs-sound-music/) | SFX generation, adaptive music, voice acting |
| [game-blender](skills/game-blender/) | Blender in a game asset pipeline: headless export, glTF and FBX, LODs, collision, baking |

#### Engineering

| Skill | Description |
|-------|-------------|
| [betterauth-integration](skills/betterauth-integration/) | Player login, staff roles, session checks on WebSocket |
| [bullmq-game-queues](skills/bullmq-game-queues/) | Job queues, async events, scheduled tasks |
| [game-anti-cheat](skills/game-anti-cheat/) | Defend an online game against cheating: server-side validation, hidden-state filtering, detection, enforcement |
| [game-backend-architecture](skills/game-backend-architecture/) | Game servers, WebSocket, rooms, tick loops |
| [game-client](skills/game-client/) | Browser game client: choose plain web, Phaser, PixiJS or Three.js/R3F; loop, input, assets, canvas sizing, cleanup |
| [game-godot](skills/game-godot/) | Godot 4 for this stack: GDScript and C#, headless runs and export, Godot 3 traps, WebSocket client to the Bun server |
| [game-save-load](skills/game-save-load/) | Save and load: browser and server saves, versioned format with migrations, atomic writes, cross-device conflicts |
| [game-state-sync](skills/game-state-sync/) | Client-server sync: prediction, reconciliation, interpolation, delta compression |
| [game-unity](skills/game-unity/) | Unity 6 for this stack: Unity CLI and batch mode, API changes, WebSocket client to the Bun server, licensing facts |
| [gameplay-analytics](skills/gameplay-analytics/) | Retention analytics, funnels, D1/D7/D30 |
| [matchmaking-system](skills/matchmaking-system/) | Matchmaking, lobbies, rating systems, skill-based queues |
| [postgres-game-schema](skills/postgres-game-schema/) | Game DB schemas, Drizzle ORM, inventory |
| [redis-game-patterns](skills/redis-game-patterns/) | Leaderboards, presence, rate limits, cache-aside |
| [skill-progression-trees](skills/skill-progression-trees/) | Skill trees, talent trees, unlock graphs |
| [stripe-game-payments](skills/stripe-game-payments/) | In-app purchases, subscriptions, webhooks |

#### Infrastructure

| Skill | Description |
|-------|-------------|
| [ci-cd-game](skills/ci-cd-game/) | CI/CD pipelines, GitHub Actions, deployment |
| [monitoring-game-ops](skills/monitoring-game-ops/) | Logging, alerts, server health |

#### Narrative

| Skill | Description |
|-------|-------------|
| [character-design-narrative](skills/character-design-narrative/) | Characters, NPCs, character bibles, dialogue |
| [quest-narrative-coherence](skills/quest-narrative-coherence/) | Narrative coherence check, lore validation |
| [story-structure-game](skills/story-structure-game/) | Branching narratives, player agency, story arcs |
| [worldbuilding](skills/worldbuilding/) | Lore, factions, geography, world bibles |

#### Workflows

Each workflow is a skill. In Claude Code you can also run it as a slash command. Installed as the Claude Code plugin, the commands are `/game-dev:<name>`, for example `/game-dev:game-build`.

| Command | Description |
|---------|-------------|
| [game-architect](skills/game-dev-commands/game-architect/) | Interview you, then write an MVP plan with starter project files |
| [game-build](skills/game-dev-commands/game-build/) | Build one component from the MVP plan, with tests and mocks |
| [game-expand](skills/game-dev-commands/game-expand/) | Add a feature to an existing MVP plan |
| [game-balance](skills/game-dev-commands/game-balance/) | Check economy, difficulty, progression and rewards for imbalances |
| [game-review](skills/game-dev-commands/game-review/) | Audit game code for server authority, auth, payments and scope drift |
| [game-lore](skills/game-dev-commands/game-lore/) | Add or update one lore entry and keep it consistent |
| [game-quest](skills/game-dev-commands/game-quest/) | Design one quest from objective tree to registry entry |

## Structure

All skills follow a flat layout:

```
skills/<skill-name>/
├── SKILL.md            # Main skill file (YAML frontmatter + body)
├── references/         # Deep-dive reference files (optional)
├── templates/          # Document and config templates (optional)
├── boilerplate/        # Starter code to copy and customize (optional)
└── ARCHITECTURE.md     # System design decisions (optional)
```

The seven workflow commands sit under `skills/game-dev-commands/<name>/`.

- `SKILL.md` is always the entry point — read this first
- `references/` holds deep-dive files that `SKILL.md` links to
- `templates/` are document/config templates to fill in
- `boilerplate/` files are starter code, copy and customize
- `ARCHITECTURE.md` explains system design decisions

## Installation

### Plugins (Claude Code)

```bash
/plugin marketplace add fcsouza/agent-skills
/plugin install game-dev@fcsouza-agent-skills
/plugin install fstack@fcsouza-agent-skills
/plugin install standalone-skills@fcsouza-agent-skills
```

### Individual skills (cherry-pick)

```bash
# Install a specific skill
bunx skills add fcsouza/agent-skills --skill game-design-fundamentals

# Install the index skill and a few topic skills
bunx skills add fcsouza/agent-skills --skill game-dev --skill betterauth-integration --skill postgres-game-schema

# List all available skills
bunx skills add fcsouza/agent-skills --list
```

### Updating

```bash
# Skills installed with the skills CLI: -p for this project, -g for your home directory
bunx skills update -p -y
bunx skills update -g -y

# Plugins (in your shell)
claude plugin marketplace update fcsouza-agent-skills
claude plugin update game-dev@fcsouza-agent-skills
claude plugin update fstack@fcsouza-agent-skills
claude plugin update standalone-skills@fcsouza-agent-skills
```

Restart Claude Code after `claude plugin update` to load the new version.

### Manual

```bash
# Individual skill
cp -r skills/<skill-name>/ .claude/skills/<skill-name>/

# For OpenClaw
cp -r skills/<skill-name>/ ~/.openclaw/workspace/skills/<skill-name>/
```

## Upgrading from 1.x

Version 2.0.0 changes names and removes parts of the plugin.

- Skill names no longer carry a category prefix. `design-level-design` is now `level-design`. The prefixes `design-`, `engineering-`, `narrative-` and `infrastructure-` are gone.
- Two skills were removed: `claude-code-game-workflow` and `cursor-codex-integration`.
- The five plugin entries `game-dev-design`, `game-dev-engineering`, `game-dev-narrative`, `game-dev-infrastructure` and `game-dev-commands` are now one entry, `game-dev`.
- The hooks, agents and MCP config that shipped with the plugin are gone.

To upgrade, remove the old prefixed skills, then install again. Use `-g` for skills installed in your home directory, and leave it off for the current project.

```bash
bunx skills remove -g -y \
  design-game-design-fundamentals design-game-economy-design design-level-design \
  design-procedural-gen design-quest-mission-design design-skill-progression-trees \
  design-ui-ux-game \
  engineering-betterauth-integration engineering-bullmq-game-queues \
  engineering-elevenlabs-sound-music engineering-game-backend-architecture \
  engineering-game-state-sync engineering-gameplay-analytics \
  engineering-matchmaking-system engineering-postgres-game-schema \
  engineering-redis-game-patterns engineering-stripe-game-payments \
  infrastructure-ci-cd-game infrastructure-claude-code-game-workflow \
  infrastructure-cursor-codex-integration infrastructure-monitoring-game-ops \
  narrative-character-design-narrative narrative-quest-narrative-coherence \
  narrative-story-structure-game narrative-worldbuilding
```

Run the same command without `-g` in each project that has them. The command skips names that are not installed. If you use the Claude Code plugin, run `/plugin marketplace update fcsouza-agent-skills` and then `/plugin install game-dev@fcsouza-agent-skills`. Otherwise install the skills you want with `bunx skills add`, as shown above.

The marketplace maps the five old entry names to `game-dev`, so Claude Code should move an enabled old entry to `game-dev`. If `claude plugin list` still shows an old entry, uninstall it in your shell:

```bash
claude plugin uninstall game-dev-design@fcsouza-agent-skills
claude plugin uninstall game-dev-engineering@fcsouza-agent-skills
claude plugin uninstall game-dev-narrative@fcsouza-agent-skills
claude plugin uninstall game-dev-infrastructure@fcsouza-agent-skills
claude plugin uninstall game-dev-commands@fcsouza-agent-skills
```

These act on user scope. Add `--scope project` or `--scope local` for an entry installed there.

## Maintaining

The game-dev skills have a lint, a typecheck and CI.

```bash
bash tools/check-skills.test.sh
```

```bash
tools/check-skills.sh --final
```

```bash
bun install --frozen-lockfile && bun run typecheck
```

- `tools/check-skills.sh` checks names, that each frontmatter is valid YAML, links, the marketplace list, the index and this README against each other, banned strings, and that each skill keeps its citations in `references/sources.md`. `.github/workflows/skills.yml` runs all three commands on every pull request and on `main`.
- The typecheck compiles every `boilerplate/` and `templates/` file against the versions pinned in `package.json`. Each file that imports a package starts with a `// Verified against: <pkg> <version> (<date>)` line. When you bump a version, rerun the typecheck and update that line.
- To re-verify a source, open the URL in its `references/sources.md` line and check that the page still supports the claim after `supports:`. If it does not, fix or remove the claim and the line, and update the `checked` date.
- `tools/eval-game-dev.sh` runs the eval suite in `evals/game-dev/` against a temporary copy of the game-dev skills, because the repo root is a marketplace and `claude plugin eval .` finds no plugin there. Pass `claude plugin eval` options through, for example `--case 'trigger-*' --concurrency 4`. Only the last `--case` counts, so pass one glob per run. Each case is a real Claude run on your account, so the full suite costs money. Reports land in `evals/results/`, which git ignores.
- A new game-dev skill needs a trigger case in `evals/game-dev/trigger-<name>/` and its name in every `trigger-negative-*` grader. Lint check E1 fails until both exist.
- When a skill never fires, run `/skill-doctor` in Claude Code and tighten that skill's `description`.

## License

MIT
