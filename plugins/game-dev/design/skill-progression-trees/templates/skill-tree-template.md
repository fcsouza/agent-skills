# Skill Tree Design Document

## Overview

| Field | Value |
|-------|-------|
| Tree Name | |
| Genre | |
| Target Player Level Range | |
| Total Nodes | |
| Max Unlockable Per Player | |

## Node Categories

| Category | Description | Examples |
|----------|-------------|----------|
| Active | Abilities the player triggers manually | Fireball, Dash, Shield Bash |
| Passive | Always-on stat bonuses | +10% HP, +5 Attack, -2s Cooldown |
| Unlock | Gates to content or mechanics | Access to PvP arena, Mount riding |
| Prestige | Post-endgame reset bonuses | +1% Global XP, Cosmetic aura |

## Cost Formula

```
cost = baseCost * tier^exponent
```

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| baseCost | | Starting cost for tier 1 nodes |
| exponent | | Typically 1.5-2.0; higher = steeper endgame |

### Cost Table Preview

| Tier | Cost (exponent 1.5) | Cost (exponent 1.8) | Cost (exponent 2.0) |
|------|---------------------|---------------------|---------------------|
| 1 | baseCost * 1.0 | baseCost * 1.0 | baseCost * 1.0 |
| 2 | baseCost * 2.8 | baseCost * 3.5 | baseCost * 4.0 |
| 3 | baseCost * 5.2 | baseCost * 7.2 | baseCost * 9.0 |
| 4 | baseCost * 8.0 | baseCost * 12.1 | baseCost * 16.0 |
| 5 | baseCost * 11.2 | baseCost * 18.1 | baseCost * 25.0 |

## Respec Policy

| Field | Value |
|-------|-------|
| Respec Available | Yes / No |
| Cost Type | Free / Soft Currency / Hard Currency |
| Cost Amount | |
| Cooldown | None / 24h / 7d |
| Partial Respec | Yes / No (if no, full reset only) |

## Prestige System

| Field | Value |
|-------|-------|
| Prestige Enabled | Yes / No |
| What Resets | All nodes / Tier 1-3 only / Nothing |
| What Persists | Prestige nodes / Cosmetics / Titles |
| Prestige Currency | |
| Max Prestige Levels | |

## Node Definitions

| ID | Name | Category | Tier | Prerequisites | Cost | Effects |
|----|------|----------|------|---------------|------|---------|
| node_001 | | | 1 | none | | |
| node_002 | | | 1 | none | | |
| node_003 | | | 2 | node_001 | | |
| node_004 | | | 2 | node_001, node_002 | | |
| node_005 | | | 3 | node_003 | | |

## Tree Visualization

```
[Root Nodes - Tier 1]
    |
    v
[Branch A - Tier 2]    [Branch B - Tier 2]
    |                       |
    v                       v
[Specialization A1]    [Specialization B1]
    \                     /
     v                   v
    [Capstone - Tier 5]
```

## Balance Checklist

- [ ] Can a player reach endgame without unlocking all nodes?
- [ ] Is every branch viable (no dead branches)?
- [ ] Does the optimal path still involve meaningful choices?
- [ ] Are there at least 2-3 distinct viable builds?
- [ ] Is the cost curve tested against player income at each tier?
- [ ] Does respec cost feel fair (not punitive, not free enough to ignore choices)?
- [ ] Are prestige bonuses meaningful but not mandatory?
- [ ] Has cycle detection been run on the prerequisite graph?
- [ ] Are all effects stored as data (JSONB), not hardcoded?
- [ ] Does progressive reveal work (new players not overwhelmed)?
