---
name: worktrees
description: When and how to use git worktrees in game development — isolating new game systems, schema migrations, and experimental features.
---

# Git Worktrees for Game Dev

A worktree lets you work on a separate branch in an isolated directory without disturbing the main workspace. For game dev, this is valuable when a new system is large enough that partial changes would break the main branch.

## When to Use a Worktree

| Situation | Use Worktree? | Why |
|---|---|---|
| New game system (quest engine, matchmaking, netcode) | Yes | Large scope; partial state breaks main |
| DB schema migration with breaking changes | Yes | Can't half-migrate on a shared codebase |
| Experimental economy redesign | Yes | May be discarded; isolate from stable code |
| New multiplayer feature | Yes | Requires coordination between schema + API + WS |
| A/B testing balance parameters | Yes | Parallel branches to compare outcomes |
| Hotfix on a live bug | No | Must merge to main fast; overhead not justified |
| Adding a single API endpoint | No | Small scope; no isolation benefit |
| Updating documentation or CLAUDE.md | No | Text changes only |
| Biome/lint/typecheck fixes | No | No logic change |

## Creating a Worktree

### Method A: Claude Code Native (preferred)

Start a Claude Code session and use the `/worktree` command or the `EnterWorktree` feature. Claude Code creates the worktree in `.claude/worktrees/` and switches the session into it automatically.

### Method B: Manual

```bash
# From project root
git worktree add .worktrees/feature-quest-system -b feature/quest-system

# Open Claude Code in the worktree
cd .worktrees/feature-quest-system
claude
```

## Branch Naming Conventions

| Prefix | Purpose | Example |
|---|---|---|
| `feature/` | New game system | `feature/quest-system` |
| `experiment/` | Speculative redesign | `experiment/new-economy` |
| `schema/` | DB migrations | `schema/add-factions-table` |
| `fix/` | Bug fixes | `fix/ws-disconnect-crash` |
| `refactor/` | Code reorganization | `refactor/session-model` |

Use `schema/` prefix specifically to signal "this branch runs migrations" — important for the shared DB warning below.

## Worktree Lifecycle

```
1. Create worktree (feature/quest-system)
2. Develop → commit frequently
3. Open PR when ready
4. Merge to main
5. Remove worktree
```

```bash
# Remove after merging
git worktree remove .worktrees/feature-quest-system
git branch -d feature/quest-system
```

List all active worktrees:
```bash
git worktree list
```

## Warning: Shared Database

Neon (and any remote PostgreSQL) is **shared across all worktrees**. If two worktrees both run `bunx drizzle-kit migrate`, they will conflict.

**Rule**: only one worktree runs migrations at a time.

Conventions to avoid conflicts:
- Only run migrations from `schema/` prefix branches
- Coordinate migration order explicitly in PR descriptions
- Use separate Neon branches for experimental schema work (`neon branch create experiment-economy`)

## Integration with Custom Agents

Large features benefit from running each agent in its own worktree:

```
Worktree 1 (feature/quest-schema):   game-engineer agent → schema + API
Worktree 2 (feature/quest-narrative): narrative-writer agent → quest content
```

When both branches are ready, merge narrative into engineering branch (narrative content has no schema deps), then merge to main.

## Cross-References

- `custom-agents.md` — parallel agent execution patterns
- `mcp-setup.md` — GitHub MCP to create PRs from worktrees without leaving Claude Code
- `settings-full.md` — `Bash(git worktree*)` in the allow list
