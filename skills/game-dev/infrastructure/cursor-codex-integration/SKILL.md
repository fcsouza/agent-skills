---
name: cursor-codex-integration
description: >-
  Use when configuring Cursor IDE or OpenAI Codex for game development — .cursorrules files, prompt conventions, context injection. Triggers: cursor, .cursorrules, codex, IDE setup.
---

# Cursor & Codex Integration

## Purpose

Configuration files and prompt conventions for using Cursor IDE and OpenAI Codex with this game development skill ecosystem.

## When to Use

Trigger: cursor, codex, .cursorrules, cursor rules, AI IDE, codex instructions, prompt conventions, context injection, AI coding setup

## Prerequisites

- `claude-code-game-workflow` — understand the skill ecosystem first

## Core Principles

1. **Context is everything** — AI coding tools perform better with clear project context
2. **Rules prevent mistakes** — .cursorrules catches common errors before they happen
3. **Skill references in prompts** — tell the AI which skill to follow for the current task
4. **Genre-agnostic enforcement** — rules should enforce the genre-agnostic constraint

## Stack Rules for .cursorrules

The `.cursorrules` file sits at the repo root and is loaded automatically by Cursor. Use it to enforce the game-dev stack. Key rules to include:

```
# TypeScript strict mode — never `any`
# Runtime: Bun only — no npm/npx/yarn
# Backend: Elysia — never Express, Hapi, or Fastify
# Database: Drizzle ORM — no raw SQL, no Prisma, no TypeORM
# Genre-agnostic: shared engine code must never assume RPG/MMO/FPS
# Server-authoritative: all game logic on server, client is display only
# Narrative: quests/characters/lore require quest-narrative-coherence check FIRST
```

See `templates/game-dev.cursorrules` for the complete file with all ~25 rules.

## Claude Code Integration

How to use Claude Code with this ecosystem:

1. **Reference SKILL.md files with @ mentions** — Claude Code can read skill files directly:
   ```
   @skills/game-dev/engineering/postgres-game-schema/SKILL.md implement the inventory schema
   ```
2. **Create a project CLAUDE.md** — use the template at `claude-code-game-workflow/templates/game-project-claude.md`. This file tells Claude Code which skills exist, when to use them, and project-specific constraints.
3. **Set up hooks for automated skill routing** — see `claude-code-game-workflow/templates/claude-hooks-config.json` for hooks that trigger the right skill based on file patterns (e.g., editing `db/schema.ts` triggers postgres-game-schema).
4. **Import skill context inline**:
   ```
   "@engineering/postgres-game-schema/SKILL.md implement the inventory schema"
   ```
   Claude Code will read the skill file and apply its patterns to the implementation.

## Prompt Templates

Five concrete prompt templates for common game dev tasks:

**1. New feature:**
```
Read @skills/game-dev/engineering/[relevant-skill]/SKILL.md. Then implement [feature] following the patterns there. Stack: Elysia + Drizzle + Neon. Use Bun runtime. No raw SQL.
```

**2. Narrative content (quests/characters/lore):**
```
Read @skills/game-dev/narrative/quest-narrative-coherence/SKILL.md first. Then create [quest/character]. Follow the 5-step coherence check and output a coherence report before writing any content.
```

**3. Schema change:**
```
Read @skills/game-dev/engineering/postgres-game-schema/SKILL.md. Add [table] following the JSONB + indexes + soft-delete patterns. Include the Drizzle migration command.
```

**4. Bug fix:**
```
Read the game-state-sync boilerplate. The bug is [describe]. Apply a server-authoritative fix only — do not move any game logic to the client.
```

**5. Code review:**
```
Review this [file] against the patterns in @skills/game-dev/engineering/[relevant]/SKILL.md. Flag violations of: server-authoritative architecture, genre-agnostic constraints, TypeScript strict type safety, and Drizzle ORM usage.
```

## Windsurf / GitHub Copilot

The same principles apply across AI IDEs:

- **GitHub Copilot**: `.cursorrules` content works in `.github/copilot-instructions.md`. Copy the rules file there and Copilot will apply them across the repo.
- **Windsurf**: supports `.windsurfrules` at the repo root with identical syntax to `.cursorrules`. Use the same `templates/game-dev.cursorrules` content.
- **Rule priority**: more specific rules override general ones. Put game-specific overrides at the top of the rules file.

## Cross-References

- `claude-code-game-workflow` — ecosystem navigation
- All other skills — referenced in prompt patterns

## Sources

- Cursor documentation
- OpenAI Codex best practices
