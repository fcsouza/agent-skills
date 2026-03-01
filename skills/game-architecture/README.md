# Game Architecture

Browser game engine patterns — game loops, state management, ECS, save/load, offline progress, and performance optimization with TypeScript and React.

## What It Covers

- Game loop patterns (fixed timestep, delta time, React integration)
- State management with Zustand (per-system stores, selectors, persistence)
- Entity-Component-System for complex games
- Save/load with versioned migrations
- Offline progress calculation strategies
- Performance optimization (React, Canvas, Web Workers)

## File Structure

```
game-architecture/
├── SKILL.md                       # Main skill reference
├── README.md                      # This file
└── references/
    ├── game-loop.md               # GameLoop class, hooks, speed control, pause/resume
    ├── state-patterns.md          # Zustand stores, selectors, save/load, migrations
    ├── ecs.md                     # Entity-Component-System implementation
    └── performance.md             # React rendering, Canvas, Web Workers, asset loading
```

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Works with 37+ agents — Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more:

```bash
npx skills add fcsouza/agent-skills --skill game-architecture
```

Install globally (available across all projects):

```bash
npx skills add fcsouza/agent-skills --skill game-architecture -g
```

### Manual

Copy the `game-architecture/` folder to your agent's skills directory:

```bash
# Claude Code
cp -r game-architecture/ .claude/skills/game-architecture/

# OpenClaw (workspace skills)
cp -r game-architecture/ ~/.openclaw/workspace/skills/game-architecture/
```

## Usage

Once installed, the skill is automatically available. It triggers when you ask about game loops, state management, ECS, save/load, offline progress, or performance optimization for browser games.

Use `/game-architecture` as a slash command, or let the agent invoke it automatically based on context.
