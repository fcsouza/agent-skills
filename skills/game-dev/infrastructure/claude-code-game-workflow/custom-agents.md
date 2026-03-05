---
name: custom-agents
description: How to set up and use Claude Code custom agents for game development — specialized sub-agents for engineering, narrative, and design work.
---

# Custom Agents for Game Dev

Claude Code supports custom agents: specialized sub-agents defined as markdown files in `.claude/agents/` within your project. Each agent has a focused role, a curated tool allowlist, and a system prompt that injects domain context automatically.

## What Custom Agents Are

- **Location**: `.claude/agents/*.md` in your game project root
- **YAML frontmatter**: defines `name`, `description` (how Claude routes to the agent), and `tools` (allowlist)
- **Body**: becomes the sub-agent's system prompt — it receives this context before every task
- **Routing**: Claude reads the `description` field and invokes the right agent based on task context

## Setup

1. Create the directory in your game project:
   ```bash
   mkdir -p .claude/agents
   ```

2. Copy the three agent templates from this skill:
   ```bash
   cp path/to/skills/game-dev/infrastructure/claude-code-game-workflow/templates/game-agents/*.md .claude/agents/
   ```

3. Customize the skill paths in each agent's body to match your actual project layout.

## The Three Game Dev Agents

### `game-engineer` — Backend Implementation

```yaml
---
name: game-engineer
description: Use for server-side game systems — schemas, API routes, WebSocket, queues, Redis, auth, payments.
tools: Bash, Read, Write, Edit, Glob, Grep, TodoWrite
---
```

**Has Bash access**: needs to run migrations, tests, and Biome formatting.

Trigger phrases:
- "implement [feature]"
- "add endpoint for..."
- "create schema for..."
- "set up BullMQ job..."
- "write migration for..."
- "fix backend bug in..."

### `narrative-writer` — Narrative Content

```yaml
---
name: narrative-writer
description: Use for quests, characters, NPCs, world lore, story arcs, dialogue.
tools: Read, Write, Edit, Glob, Grep, TodoWrite
---
```

**No Bash access**: narrative work is text-only; never needs to run code.

Mandatory behavior: always runs the coherence check (reads `quest-narrative-coherence/SKILL.md`, loads `world-lore.md` and `quest-registry.md`) before producing any content.

Trigger phrases:
- "create quest..."
- "add character / NPC..."
- "write dialogue for..."
- "world lore for..."
- "faction backstory..."

### `game-designer` — Design Documents

```yaml
---
name: game-designer
description: Use for core loops, economy balance, level design, progression systems, UX flows, feature specs.
tools: Read, Write, Edit, Glob, Grep, TodoWrite
---
```

**No Bash access**: design documents go to `docs/design/`; no code execution needed.

Trigger phrases:
- "design [feature]..."
- "balance the economy..."
- "level design for..."
- "progression system for..."
- "UI flow for..."

## Tool Allowlist Rationale

| Agent | Bash | Write/Edit | Reason |
|---|---|---|---|
| game-engineer | Yes (full) | Yes | Runs migrations, tests, Biome; writes code |
| narrative-writer | No | Yes (text files only) | Text creation; no scripts needed |
| game-designer | No | Yes (docs only) | Design docs; no code execution |

## Explicit Invocation

Claude will auto-route based on task context, but you can always invoke explicitly:

```
Using the game-engineer agent: implement the quest progress tracking endpoint

Using the narrative-writer agent: create a merchant guild quest that ties into the Thornwood faction

Using the game-designer agent: balance the gem earn rate for the first 7 days of play
```

## Cross-Agent Workflow Example

For a full quest feature (schema + narrative + game design):

```
Step 1 — game-designer: design the quest reward structure and unlock conditions
Step 2 — narrative-writer: create the quest content (coherence check first)
Step 3 — game-engineer: implement schema + API + WebSocket events for quest completion
```

This separation keeps narrative work out of the engineer's context and vice versa — each agent loads only the skills it needs.

## Cross-References

- `worktrees.md` — run each agent in its own worktree for parallel development on large features
- `SKILL.md` — subagent parallel execution patterns for dispatching multiple agents simultaneously
