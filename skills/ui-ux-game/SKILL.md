---
name: ui-ux-game
description: >-
  Covers in-game interface design: HUD, menus, tutorials and onboarding, input feedback, and accessibility options. Use when building or reviewing a game's HUD, menu, tutorial, settings screen or accessibility options. Not for web or app UI outside games.
---

# Game UI and UX

## Principles

1. Show only what the player needs now. Ask, for each element: what must the player know, what do they want to know, and what feedback gets that across. Cut the element if nothing answers. (Schell, ch. 13)
2. Answer every input at once. Keep input-to-first-feedback under about 100 ms; 50 ms reads as instant. Give some visible, audible or tactile result in the same frame, even if the full effect comes later. (Swink, ch. 2)
3. Keep one meaning per control and per color. The same button does the same thing on every screen.
4. Keep key state visible: health, progress, currency, status. Players should not have to guess what is happening.
5. Show every mode change in more than one way, such as color plus icon plus sound. Keep overlapping modes on different input channels. (Schell, ch. 13)
6. Design accessibility in from the first screen. Do not add it after launch.
7. Size touch targets at 44 by 44 CSS pixels where you can. WCAG 2.2 sets 24 by 24 as the minimum (level AA) and 44 by 44 as the enhanced size (level AAA).

Minimal interfaces work. ICO has no health bars, no score and no map; the player holds Yorda's hand with a button. Super Mario Bros World 1-1 teaches with the placement of blocks, goombas and pipes. Both are secondary accounts, so treat them as examples, not rules. See `references/sources.md`.

## Pick a pattern

| Need | Pattern |
|---|---|
| Always-visible state | HUD overlay, fixed position, small footprint |
| Quick action choice | Radial menu on hold or right-click |
| Many systems | Tabs with badges for new content |
| Confirm or important info | Modal dialog; it blocks play, so use it sparingly |
| Non-critical update | Toast that dismisses itself and stacks |
| Detail on demand | Tooltip on hover or long-press |
| Advancement | Progress bar, linear or radial, with milestones |
| Item management | Grid with drag-drop, sort, filter and search |

Copy `boilerplate/hud-components.ts` when you need typed HUD element shapes (health bar, resource display, notification queue, minimap, tooltip, crosshair, action bar). It has no dependencies.

## Onboarding

Apply these rules from Hodent's GDC 2016 talk. Each is a rule of thumb from one author, not a measured law.

- Teach at most three things at the same time.
- Give the reason for a rule before the detail.
- Do not punish the player while they are still learning something.
- Show tutorial text when the player can act on it. Text on a loading screen is rarely remembered.
- Do not offer false affordances: an item that looks useful but is not misleads the player and makes the right lesson harder.

## Usability review

Check each screen against Hodent's seven pillars (adapted from Nielsen's heuristics): signs and feedback, clarity, form follows function, consistency, minimum workload, error prevention and recovery, flexibility and accessibility.

## Accessibility

Read `templates/accessibility-checklist.md` when you design or test a settings or accessibility screen. Every item in it traces to the Game Accessibility Guidelines or to WCAG 2.2.

## Pitfalls

- UI soup: so many elements that the player cannot focus.
- Tutorial wall: text before the player has done anything.
- Hidden state: critical information not on screen.
- Inconsistent controls: one button, different actions on different screens.
- Slow feedback: nothing visible within about 100 ms of input.
- A wait over about 10 seconds with no progress display. This limit comes from Nielsen's general interface research, not from games.
- Accessibility bolted on at the end.

## Files

- `references/sources.md`: read when you need the page behind a claim above.

## Related skills

- `game-design-fundamentals` (feedback loops and rewards)
- `level-design` (tutorial levels)
- `elevenlabs-sound-music` (audio feedback)
- `game-localization` (text expansion, right-to-left layout, string IDs for HUD text)
