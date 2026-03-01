# RPG Systems

Design patterns, formulas, and architecture for RPG mechanics in browser games — character stats, combat, progression, equipment, skill trees, loot, and economy.

## What It Covers

- Primary and derived stat architecture with scaling formulas
- Turn-based combat: damage formulas, hit/crit, elemental system, status effects
- XP curves, leveling, class/job systems, prestige
- Equipment slots, rarity tiers, set bonuses
- Skill tree node structure and traversal
- Enemy stat scaling and AI patterns
- Loot tables with weighted random and pity system
- Crafting, shops, and currency sinks
- Drizzle ORM schemas for items, inventory, loot, crafting, and shops

## File Structure

```
rpg-systems/
├── SKILL.md                          # Main skill — stats, combat, leveling, equipment, enemies
├── README.md                         # This file
└── references/
    ├── combat-formulas.md            # Full combat system, elements, status effects, turn order
    ├── progression.md                # XP curves, classes, prestige, power creep prevention
    └── economy.md                    # Loot tables, crafting, shops, Drizzle schemas
```

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Works with 37+ agents — Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more:

```bash
npx skills add fcsouza/agent-skills --skill rpg-systems
```

Install globally (available across all projects):

```bash
npx skills add fcsouza/agent-skills --skill rpg-systems -g
```

### Manual

Copy the `rpg-systems/` folder to your agent's skills directory:

```bash
# OpenClaw (workspace skills, highest precedence)
cp -r rpg-systems/ ~/.openclaw/workspace/skills/rpg-systems/

# Claude Code
cp -r rpg-systems/ .claude/skills/rpg-systems/
```

## Usage

Once installed, the skill triggers on RPG system design topics. It provides formulas, patterns, and schemas for building RPG mechanics in browser games.

Use `/rpg-systems` as a slash command, or let the agent invoke it automatically based on context.
