---
name: vision-multimodal
description: Using screenshots and images with Claude Code for game dev — UI debugging, level design review, game state diagnosis.
---

# Vision and Multimodal Inputs for Game Dev

Claude Code accepts images directly in the prompt. Paste a screenshot, drag-and-drop a file, or use Playwright MCP to capture one programmatically. Claude receives the image as a vision input and can describe, diagnose, or suggest fixes.

## How to Input Images

- **Paste**: copy a screenshot to clipboard, paste directly into the Claude Code prompt (`Cmd+V`)
- **Drag-and-drop**: drag an image file onto the Claude Code terminal window
- **Playwright MCP**: capture a screenshot programmatically and have Claude review it automatically (see `mcp-setup.md`)

Accepted formats: PNG, JPEG, WebP, GIF. Use **PNG** for UI debugging — it preserves pixel accuracy and doesn't compress detail away.

## Use Case 1: UI / HUD Debugging

Paste a screenshot when something looks wrong in the game UI.

```
[paste screenshot]
The HUD health bar is overlapping the minimap at viewport widths below 768px.
Identify which component or CSS class is causing the overlap and suggest a minimal fix.
```

```
[paste screenshot]
The inventory grid should show 4 columns but appears as 2 on mobile.
What's the flex/grid configuration causing this and how do I fix it?
```

## Use Case 2: Level Design Review

Get structural feedback on a level layout without writing a design doc.

```
[paste screenshot of level]
Review this level layout for:
1. Player flow — is the path to the exit clear or confusing?
2. Chokepoints — are there unintended bottlenecks?
3. Reward placement — are pickups visible from natural traversal paths?
Rate each 1-5 and suggest one concrete improvement per dimension.
```

```
[paste level screenshot]
This is a platformer level in world 2. The difficulty should be moderate — requires
2-3 precise jumps. Does the layout achieve this? What would you change?
```

## Use Case 3: Game State Debugging

When a game state looks wrong, share the screenshot to help diagnose the cause.

```
[paste screenshot showing -47 gems]
The inventory shows a negative gem count (-47).
Trace what could cause this. Check: the gem earn/spend endpoints,
the currency update transaction in src/routes/wallet.ts, and any race
conditions when concurrent requests hit the wallet update.
```

```
[paste screenshot of matchmaking stuck]
The matchmaking screen has been showing "Finding match..." for 3 minutes
with 2 players in the queue. What could cause the BullMQ matching job to not fire?
Check src/jobs/matchmaking.ts and the BullMQ queue configuration.
```

## Use Case 4: Before / After Comparison

Compare two screenshots to verify a fix worked or catch regressions.

```
[paste screenshot A — before]
[paste screenshot B — after]
Compare these two states. I implemented a fix for the HUD overlap.
Did the fix work? Are there any new visual issues introduced?
```

## Use Case 5: Playwright Screenshot Loop

Use Playwright MCP to automate the capture → review cycle without manual screenshots.

```
Using Playwright: navigate to localhost:3000/game, take a screenshot after
the page fully loads. Review it: is the game canvas centered and does the
HUD appear in the top-right corner as designed?
```

```
Using Playwright: click the "Open Inventory" button, wait for the animation
to complete, take a screenshot. Does the inventory panel slide in from the right
with all item slots visible?
```

```
Using Playwright: navigate to localhost:3000/shop, take a screenshot,
then check if all 6 item cards are visible without horizontal scroll on a
1280x720 viewport.
```

## Prompt Templates (copy-paste)

```
# Template 1 — UI bug
[screenshot]
Identify what's visually broken in this game UI. Expected behavior: [describe].
Suggest the minimal CSS/component fix.
```

```
# Template 2 — Level design feedback
[screenshot]
Review this level layout. Rate flow clarity, visual hierarchy, and reward
placement 1-5. Suggest one concrete improvement per dimension.
```

```
# Template 3 — Broken game state diagnosis
[screenshot]
This game state looks wrong. The issue is in [area].
Diagnose the cause by checking [file A] and [file B].
What's the most likely root cause?
```

```
# Template 4 — Before/after comparison
[screenshot A] [screenshot B]
Compare these two states. Did the change achieve [expected outcome]?
Are there any regressions?
```

```
# Template 5 — Playwright automated capture
Using Playwright: navigate to [URL], [perform action], take a screenshot.
Review: did [expected outcome] happen? If not, what's wrong?
```

```
# Template 6 — Mobile viewport check
[screenshot]
This is the game UI at 375px width (iPhone SE viewport).
Identify any elements that are cut off, overlapping, or too small to tap.
```

## Integration with Other Tools

**Playwright MCP + vision loop**: use Playwright to capture → Claude reviews → Claude suggests fix → implement → Playwright captures again to verify. This is faster than manually taking screenshots between each change.

**Plan mode**: paste a screenshot of the current broken state when writing a plan prompt. This gives Claude concrete visual context before it writes the implementation plan.

## Cross-References

- `mcp-setup.md` — Playwright MCP setup for automated screenshot capture
- `plan-mode.md` — using screenshots to inform implementation plans
