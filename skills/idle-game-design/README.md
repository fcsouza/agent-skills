# Idle Game Design

Design patterns for idle/incremental games — prestige systems, exponential scaling, big number math, offline progress, upgrade trees, automation, and economy balancing.

## What It Covers

- Core loop design (generator → resource → upgrade → prestige cycle)
- Cost and production formulas with TypeScript implementations
- Prestige/ascension layer design and currency conversion
- Offline progress calculation strategies
- Big number handling (`break_infinity.js`, `decimal.js`)
- Progression pacing and content sequencing
- UI patterns for idle games (React + Tailwind + shadcn/ui)

## File Structure

```
idle-game-design/
├── SKILL.md                          # Main skill (overview + formulas)
└── references/
    ├── formulas.md                   # Complete formula catalog (TypeScript)
    ├── progression-patterns.md       # Unlock sequencing, prestige layers, pacing
    └── ui-patterns.md                # React + Tailwind components for idle games
```

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Works with 37+ agents — Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more:

```bash
npx skills add fcsouza/agent-skills --skill idle-game-design
```

Install globally (available across all projects):

```bash
npx skills add fcsouza/agent-skills --skill idle-game-design -g
```

### Manual

Copy the `idle-game-design/` folder to your agent's skills directory:

```bash
# OpenClaw
cp -r idle-game-design/ ~/.openclaw/workspace/skills/idle-game-design/

# Claude Code
cp -r idle-game-design/ .claude/skills/idle-game-design/
```

## Usage

Once installed, triggers on idle/incremental game topics — prestige, scaling, big numbers, offline progress, upgrade trees, automation, and economy balancing.

## Companion Skills

| Skill | Focus |
|-------|-------|
| [game-architecture](../game-architecture/) | Game loops, state management, save/load |
| [rpg-systems](../rpg-systems/) | Stats, combat for idle-RPG hybrids |
| [game-asset-gen](../game-asset-gen/) | AI art generation for game sprites and icons |
| [game-dev-hub](../game-dev-hub/) | Orchestrator and project scaffolding |
