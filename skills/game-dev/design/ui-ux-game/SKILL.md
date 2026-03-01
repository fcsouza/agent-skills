# UI/UX Game Design

## Purpose

HUD patterns, menu systems, feedback loops, onboarding, and accessibility for any game type. Genre-agnostic — the same principles apply whether you're building an idle clicker, an MMO, or a puzzle game.

## When to Use

Trigger: game UI, game UX, HUD, menu system, game feedback, onboarding, tutorial, accessibility, game interface, notification system, settings menu, inventory UI, tooltip, progress bar, game menu

## Prerequisites

- `game-design-fundamentals` — feedback loop and player motivation context

## Core Principles

> Fumito Ueda: "Minimalism amplifies emotional impact. Remove everything that doesn't serve the experience."
> Jenova Chen: "The interface should be invisible — players should feel, not read."
> Shigeru Miyamoto: "Good UI teaches through interaction, not instruction."

1. **Less is more** — show only what the player needs right now; progressive disclosure for complex systems (Ueda)
2. **Feedback is instant** — every player action produces immediate visual + audio response (Chen)
3. **Teach by doing** — tutorials should be interactive, not text walls; the best tutorial is no tutorial at all (Miyamoto)
4. **Consistency breeds intuition** — same patterns everywhere: same button = same action, same color = same meaning
5. **Accessibility is not optional** — colorblind modes, scalable text, remappable controls, screen reader support
6. **Mobile-first responsive** — design for smallest screen first, scale up; touch targets minimum 44px
7. **State is always visible** — player should never wonder "what's happening?" — show health, progress, currency, status

## Key UI Patterns

| Pattern | Use Case | Implementation |
|---------|----------|---------------|
| HUD overlay | Always-visible game state | Fixed position, minimal footprint |
| Radial menu | Quick action selection | Triggered by hold/right-click |
| Tab navigation | Multi-system management | Tabs with badge indicators |
| Modal dialog | Confirmations, important info | Blocks game, requires action |
| Toast notification | Non-critical updates | Auto-dismiss, stackable |
| Tooltip | Contextual details | Hover/long-press, positioned smart |
| Progress bar | Show advancement | Linear or radial, with milestones |
| Inventory grid | Item management | Drag-drop, sort, filter, search |

## Onboarding Flow

```
1. First interaction → teach core mechanic (no text, just do it)
2. First reward → show feedback system (number go up, sound, visual)
3. First choice → teach decision-making (two options, clear difference)
4. First failure → teach recovery (low stakes, quick retry)
5. First system unlock → teach progressive disclosure (new tab appears)
```

## Cross-References

- `game-design-fundamentals` — feedback loops and reward schedules
- `level-design` — tutorial level integration
- `elevenlabs-sound-music` — audio feedback integration

## Pitfalls & Anti-Patterns

- **"UI soup"** — too many elements on screen at once; players can't focus
- **"Text tutorial"** — pages of instructions before the player does anything
- **"Hidden information"** — critical game state not visible; player feels lost
- **"Inconsistent controls"** — same button does different things in different screens
- **"No feedback"** — player clicks and nothing visually happens for 200ms+
- **"Accessibility afterthought"** — adding colorblind mode after launch; it should be designed in

## Designer Philosophy

**Fumito Ueda** (ICO, Shadow of the Colossus): The best UI is invisible. In ICO, there's no HUD — the player grips Yorda's hand, and that IS the interface. Every UI element you add should justify its existence against the alternative of removing it entirely.

**Jenova Chen** (Journey, Flower): UI should create emotional connection, not information overload. In Journey, the entire "multiplayer UI" is another player's presence. No health bars, no names, no chat — just shared experience through minimal interface.

**Shigeru Miyamoto** (Mario, Zelda): The best tutorials are the ones players don't notice. World 1-1 of Super Mario Bros teaches running, jumping, enemies, power-ups, and secrets — all without a single line of text.

## Sources

- "The Invisible Interface" — Fumito Ueda, GDC 2006
- "Designing Journey" — Jenova Chen, GDC 2013
- "Game Feel" — Steve Swink
- "Don't Make Me Think" — Steve Krug (applies to game UI too)
- WCAG 2.1 accessibility guidelines adapted for games
