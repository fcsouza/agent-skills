# Browser MMO Design

Systems, patterns, and architecture for multiplayer text-based browser games — factions, PvP, leaderboards, chat, energy systems, real-time sync, anti-cheat, and social features for games like Torn or The Crims.

## What It Covers

- Timer and energy systems with server-authoritative regeneration
- Faction/guild creation, ranks, permissions, and wars
- PvP combat design: cooldowns, hospital/jail, retaliation, bounties
- Leaderboards with real-time top 100 and cached rankings
- Chat system with WebSocket channels and rate limiting
- Anti-cheat: server-authoritative validation, bot detection, audit logging
- WebSocket real-time sync: state updates, presence, scaling with Redis
- Social systems: territory/turf, player profiles, mail, reputation
- Drizzle ORM schemas for all database tables
- Elysia API and WebSocket examples

## File Structure

```
browser-mmo-design/
├── SKILL.md                          # Main skill — energy, factions, PvP, leaderboards, chat, anti-cheat
├── README.md                         # This file
└── references/
    ├── real-time.md                  # WebSocket with Elysia, state sync, presence, scaling, polling
    ├── social-systems.md             # Faction schemas, permissions, territory, wars, profiles, mail
    └── anti-cheat.md                 # Rate limiting, validation, bot detection, economy exploits, audit
```

## Installation

### Via [skills.sh](https://skills.sh) (recommended)

Works with 37+ agents — Claude Code, OpenClaw, Cursor, Copilot, Windsurf, and more:

```bash
npx skills add fcsouza/agent-skills --skill browser-mmo-design
```

Install globally (available across all projects):

```bash
npx skills add fcsouza/agent-skills --skill browser-mmo-design -g
```

### Manual

Copy the `browser-mmo-design/` folder to your agent's skills directory:

```bash
# OpenClaw (workspace skills, highest precedence)
cp -r browser-mmo-design/ ~/.openclaw/workspace/skills/browser-mmo-design/

# Claude Code
cp -r browser-mmo-design/ .claude/skills/browser-mmo-design/
```

## Usage

Once installed, the skill triggers on browser MMO design topics. It provides patterns, schemas, and architecture for building multiplayer text-based browser games.

Use `/browser-mmo-design` as a slash command, or let the agent invoke it automatically based on context.
