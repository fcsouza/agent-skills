---
name: mcp-setup
description: MCP server setup for game dev projects — GitHub issue/PR management, Playwright UI testing, and Context7 library docs.
---

# MCP Server Setup

MCP (Model Context Protocol) servers extend Claude Code with external tool access. This skill configures three servers useful for game development.

## Quick Start

1. Copy the template to your project root:
   ```bash
   cp path/to/skills/game-dev/infrastructure/claude-code-game-workflow/templates/.mcp.json .mcp.json
   ```

2. Set your GitHub token (shell env var — never commit it):
   ```bash
   # fish shell
   set -x GITHUB_TOKEN ghp_yourtoken

   # bash/zsh
   export GITHUB_TOKEN=ghp_yourtoken
   ```

3. Open Claude Code in your project (`claude`). Run `/mcp` to verify connected servers.

## GitHub MCP

**Use for**: issue tracking, PR creation and review, checking CI status without leaving Claude Code.

No extra installation — the `.mcp.json` config handles it via `npx`.

### Game Dev Prompt Examples

```
List all open issues tagged "bug" in this repo

Create a GitHub issue: "Quest prerequisites not enforced when player joins mid-session"

Create a PR for the current branch with a description summarizing the quest system implementation

What files changed in PR #42? Focus on schema files.

Are there any failing checks on the current branch?
```

### Authentication

The token needs `repo` scope for private repos. Generate at `github.com/settings/tokens`.

## Playwright MCP

**Use for**: testing game UI flows, taking screenshots for review, verifying interactions on the web client.

**Requirement**: your game's dev server must be running (`bun run dev`) before using Playwright.

### Game Dev Prompt Examples

```
Navigate to localhost:3000/game, take a screenshot, check if the HUD overlaps the inventory panel

Click the "Start Match" button and verify the matchmaking queue counter increments to 1

Navigate to the shop, add 3 items to cart, and confirm the total price updates correctly

Take a screenshot of the quest log screen and check if all active quests are displayed
```

### Screenshot → Fix Loop

```
1. Take a screenshot of the broken UI
2. Describe what's wrong and what the expected layout is
3. Ask Claude to identify the CSS/component causing the issue
4. Implement the fix
5. Take another screenshot to verify
```

## Context7 MCP

**Use for**: getting up-to-date documentation for game stack libraries without leaving Claude Code or risking stale docs.

No authentication needed.

### Game Stack Library Examples

```
Using Context7, look up the Elysia WebSocket API — how to broadcast a message to a named group

Using Context7, show the Drizzle ORM syntax for an upsert with conflict on (playerId, category)

Using Context7, get the BullMQ documentation for repeatable jobs with a fixed cron schedule

Using Context7, show the Redis sorted set commands for a leaderboard (zadd, zrange, zrank)

Using Context7, look up BetterAuth session configuration options

Using Context7, show the Stripe Node SDK syntax for creating a payment intent with metadata
```

## Token Security

Never commit tokens. Three safe options:

**Option A: Shell env var** (add to `~/.config/fish/config.fish` or `~/.zshrc`):
```bash
export GITHUB_TOKEN=ghp_...
```

**Option B: `.env` file** (add `.env` to `.gitignore`):
```
GITHUB_TOKEN=ghp_...
```
Bun automatically loads `.env` files.

**Option C: macOS Keychain** — store the token securely and reference it in a shell alias.

The `.mcp.json` uses `${GITHUB_TOKEN}` — this reads the env var at runtime.

## Verifying Connections

After starting `claude` in your project, run:
```
/mcp
```

You should see all three servers listed as connected. If a server fails, check:
- Token is set (`echo $GITHUB_TOKEN`)
- Node 18+ is installed (`node --version`)
- `.mcp.json` is in the project root (not a subdirectory)

## Cross-References

- `templates/.mcp.json` — copy-paste ready config
- `vision-multimodal.md` — using Playwright screenshots for game UI debugging
- `settings-full.md` — env var configuration in `.claude/settings.json`
