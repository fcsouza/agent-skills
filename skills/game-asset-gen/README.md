# Game Asset Gen

AI-powered game art generation using Gemini image models (Nano Banano) — sprites, pixel art, icons, backgrounds, tilesets, character portraits, and UI elements.

## What It Covers

- Gemini image model selection (flash, flash-preview, pro-preview)
- Prompt engineering for consistent game art styles
- Complete prompt templates for all asset types
- Multi-turn refinement workflow
- Asset pipeline integration with Next.js
- Batch generation and style consistency
- Cost estimation and optimization

## File Structure

```
game-asset-gen/
├── SKILL.md                          # Main skill — models, prompts, pipeline overview
└── references/
    ├── prompt-catalog.md             # Complete prompt templates for all asset types
    ├── pipeline.md                   # Asset workflow, sprite sheets, Next.js, versioning
    └── api-usage.md                  # TypeScript API code, batch scripts, error handling
```

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Works with 37+ agents — Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more:

```bash
npx skills add fcsouza/agent-skills --skill game-asset-gen
```

Install globally (available across all projects):

```bash
npx skills add fcsouza/agent-skills --skill game-asset-gen -g
```

### Manual

Copy the `game-asset-gen/` folder to your agent's skills directory:

```bash
# Claude Code
cp -r game-asset-gen/ .claude/skills/game-asset-gen/

# OpenClaw
cp -r game-asset-gen/ ~/.openclaw/workspace/skills/game-asset-gen/
```

## Prerequisites

- Gemini API key (get at https://ai.google.dev)
- Extends the `/gemini-api-dev` skill for detailed API documentation
- Use `/game-dev-hub` for game project structure and organization
