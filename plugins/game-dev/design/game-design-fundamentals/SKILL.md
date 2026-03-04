---
name: design-game-design-fundamentals
version: 1.0.0
description: >-
  Use when designing core game loops, feedback systems, player motivation models,
  MDA framework analysis, progression curves, difficulty tuning, reward schedules,
  or any genre-agnostic game design theory.
---

# Game Design Fundamentals

Core game design theory — loops, feedback systems, player motivation, MDA framework. Genre-agnostic foundation for all game types.

---

## Purpose

Provide a universal design foundation applicable to any game genre. This skill covers the theory, frameworks, and practical patterns that underpin all successful game designs — from core loops to player psychology to progression pacing.

---

## When to Use

Trigger: game design, core loop, feedback system, player motivation, MDA framework, game feel, progression design, difficulty curve, player psychology, Bartle types, flow state, reward system

---

## Prerequisites

None — this is a foundational design skill.

---

## Core Principles

1. **"A game is a series of interesting decisions"** — Sid Meier. Every moment should present the player with a meaningful choice.
2. **Core loop must be fun in 30 seconds** — Miyamoto principle. If the fundamental action-feedback cycle is not satisfying immediately, no amount of content will save it.
3. **MDA: Mechanics -> Dynamics -> Aesthetics** — Hunicke, LeBlanc, Zubek. Designers create mechanics; players experience aesthetics. Dynamics emerge from the interplay.
4. **Flow channel: challenge must scale with skill** — Csikszentmihalyi / Jenova Chen. Too easy breeds boredom; too hard breeds anxiety. The target is the narrow channel between.
5. **Mastery creates fun** — Raph Koster, *A Theory of Fun for Game Design*. Players enjoy learning patterns. Once a pattern is fully mastered with nothing new to learn, fun ceases.
6. **Elegant systems: minimal rules, emergent complexity** — Richard Garfield. The best designs use few, clear rules that combine to produce deep possibility spaces.
7. **Feel-first design: prototype the feel before building the system** — Miyamoto. The tactile, moment-to-moment sensation of play is more important than any feature list.
8. **Reward schedules: variable ratio > fixed ratio** — Behavioral psychology (B.F. Skinner). Variable rewards sustain engagement far longer than predictable ones.
9. **Player types: Achievers, Explorers, Socializers, Killers** — Richard Bartle. Different players seek fundamentally different experiences from the same game.
10. **Restraint is a design tool** — Fumito Ueda. What you remove is as important as what you add. Elegance comes from subtraction.

---

## Step-by-Step Instructions

### Phase 1: Concept & Vision

1. **Define the core fantasy.** What does the player *feel* like they are doing? Not the mechanic — the experience.
2. **Identify your target player types** (Bartle taxonomy). Which 1-2 types are primary? Design the core loop for them.
3. **Write a one-sentence pitch.** If you cannot describe the game in one sentence, the concept is not focused enough.
4. **Define the MDA target.** Choose 2-3 target aesthetics (Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission). All mechanics should serve these aesthetics.

### Phase 2: Core Loop Design

5. **Design the 30-second loop.** Action -> Feedback -> Reward -> Decision -> Action. Prototype this first.
6. **Layer the session loop.** Goal -> [core loops] -> Progress -> New goal. This gives direction to repeated core loops.
7. **Layer the long-term loop.** Community -> Competition/Cooperation -> Status -> Community. This drives cross-session retention.
8. **Validate nesting.** Each loop should feed into the next. The core loop generates resources for the session loop; the session loop generates progress for the long-term loop.

### Phase 3: Systems Design

9. **Define mechanics.** For each mechanic: name, rules, inputs, outputs, and how it *feels*.
10. **Map mechanic interactions.** Which mechanics amplify each other? Which create trade-offs? Emergent complexity comes from interactions.
11. **Design the progression curve.** Early game (rapid unlocks, teaching), mid game (meaningful choices, branching), late game (mastery, optimization), endgame (social, competitive, infinite scaling).
12. **Design the difficulty curve.** Map challenge vs. skill over time. Ensure the player stays in the flow channel.
13. **Design the reward schedule.** Mix fixed rewards (predictable milestones) with variable rewards (random drops, surprise bonuses).

### Phase 4: Economy & Balance

14. **Define resources.** What are the faucets (sources) and sinks (drains)? Every resource needs both.
15. **Define growth curves.** Linear, polynomial, or exponential? Match the curve to the intended pacing.
16. **Playtest the first 30 minutes.** Is the core loop satisfying? Are unlocks paced well? Is the player making interesting decisions?

### Phase 5: Documentation

17. **Write the Game Design Document (GDD).** Use `templates/gdd-template.md`.
18. **Complete the Player Motivation Worksheet.** Use `templates/player-motivation-worksheet.md`.
19. **Review against core principles.** Does every mechanic serve the target aesthetics? Is the core loop fun in 30 seconds? Is there a flow channel?

---

## Code Examples

### Core Loop Architecture

Use `boilerplate/core-loop.ts` for a genre-agnostic system manager with configurable tick rate and ordered system execution.

```typescript
import { SystemManager } from './boilerplate/core-loop';

const manager = new SystemManager({ tickRate: 60 });
manager.register('input', new InputSystem());
manager.register('simulation', new SimulationSystem());
manager.register('feedback', new FeedbackSystem());
manager.start();
```

### Feedback & Reward System

Use `boilerplate/feedback-system.ts` for event-driven feedback, reward triggers, streak tracking, and achievement progress.

```typescript
import { GameEventBus, RewardSystem, StreakTracker } from './boilerplate/feedback-system';

const bus = new GameEventBus();
const rewards = new RewardSystem(bus);
const streaks = new StreakTracker(bus);

rewards.register({
  id: 'first-milestone',
  condition: (event) => event.type === 'milestone_reached' && event.data.level >= 10,
  reward: { type: 'resource', id: 'premium_currency', amount: 50 },
});
```

### Difficulty Scaling

```typescript
const getDifficultyMultiplier = (
  playerSuccessRate: number,
  targetSuccessRate = 0.65,
): number => {
  const deviation = playerSuccessRate - targetSuccessRate;
  return 1 + deviation * 0.3;
};
```

### Growth Curves

```typescript
const linearGrowth = (base: number, level: number, increment: number): number =>
  base + level * increment;

const polynomialGrowth = (base: number, level: number, exponent: number): number =>
  base * level ** exponent;

const exponentialGrowth = (base: number, level: number, multiplier: number): number =>
  base * multiplier ** level;
```

### Cost Scaling

```typescript
const scaledCost = (baseCost: number, multiplier: number, owned: number): number =>
  baseCost * multiplier ** owned;
```

---

## Cross-References

| Need | Skill |
|------|-------|
| Economy balancing, resource flow, inflation control | `game-economy-design` |
| Level/world design, spatial layouts, pacing | `level-design` |
| Quest/mission structure, narrative arcs | `quest-mission-design` |
| Skill trees, talent trees, ability unlock graphs | `skill-progression-trees` |
| Game UI/UX patterns, HUD design, menus | `ui-ux-game` |
| Backend architecture, networking, state sync | `game-backend-architecture` |
| Visual assets, procedural generation | `game-asset-gen` |
| Sound design, music, audio feedback | `elevenlabs-sound-music` |
| Idle/incremental-specific patterns | `idle-game-design` |

---

## Pitfalls & Anti-Patterns

### Design Pitfalls

1. **Feature creep without loop validation.** Adding mechanics that do not feed into the core loop dilutes the experience. Every feature must serve the loop.
2. **Designing systems before feel.** Building complex interconnected systems before the moment-to-moment action feels good. Feel first, systems second.
3. **Flat difficulty curve.** No increase in challenge over time. Players master the game quickly and leave.
4. **Punishing failure instead of rewarding learning.** Harsh penalties for failure discourage experimentation. Players should feel safe to try new strategies.
5. **Reward inflation.** Giving too many rewards too fast devalues them all. Scarcity creates meaning.
6. **Ignoring session design.** Not considering how long players actually play per session leads to progression that feels too slow or too fast.
7. **Single player-type focus.** Designing exclusively for one Bartle type alienates the majority of potential players.
8. **Tutorial as separate experience.** Tutorials that feel disconnected from actual gameplay. The best tutorial *is* the gameplay with guardrails.

### Technical Anti-Patterns

1. **Hardcoded values.** Game balance constants embedded in logic instead of data-driven configuration.
2. **Tightly coupled systems.** Systems that directly reference each other instead of communicating through events.
3. **No serialization strategy.** Building game state without considering save/load from the start.
4. **Floating-point accumulation.** Using raw floating-point math for resource totals leads to precision drift over time.

---

## Designer Philosophy

### On Simplicity

> "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away." — Antoine de Saint-Exupery

This applies directly to game design. The most enduring games have simple rules and deep emergent behavior. Before adding a mechanic, ask: can an existing mechanic be extended instead?

### On Player Agency

The player must always feel that their decisions matter. If the optimal path is always obvious, there is no decision — only execution. If the outcome is always random, there is no agency — only luck. The sweet spot is informed decisions with uncertain but skill-influenced outcomes.

### On Iteration

No design survives first contact with players. Plan for iteration:
- Prototype the core loop first (paper or digital).
- Playtest early with the simplest possible version.
- Measure what players *do*, not what they *say*.
- Tune numbers last — fix the feel first.

### On Respect

Respect the player's time, intelligence, and autonomy. Do not waste their time with artificial gates. Do not insult their intelligence with excessive hand-holding. Do not remove their autonomy with forced paths. The player chose to spend time with your game — honor that choice.

---

## Sources

### Books

- Koster, Raph. *A Theory of Fun for Game Design* (2004). Core thesis: fun is the process of mastering patterns.
- Schell, Jesse. *The Art of Game Design: A Book of Lenses* (2008). 100+ lenses for analyzing design decisions.
- Hunicke, LeBlanc, Zubek. *MDA: A Formal Approach to Game Design and Game Research* (2004). The foundational framework for analyzing mechanics, dynamics, and aesthetics.
- Csikszentmihalyi, Mihaly. *Flow: The Psychology of Optimal Experience* (1990). The psychology of engagement and the flow channel.
- Bartle, Richard. *Designing Virtual Worlds* (2003). Player type taxonomy and multiplayer design.
- Salen & Zimmerman. *Rules of Play: Game Design Fundamentals* (2003). Comprehensive academic treatment of game design theory.
- Fullerton, Tracy. *Game Design Workshop* (2008). Practical design methodology and playtesting.

### Papers & Talks

- Chen, Jenova. *Flow in Games* (2006). Application of Csikszentmihalyi's flow to interactive entertainment.
- Garfield, Richard. *Luck in Games* (GDC 2012). On the role of randomness and skill in game design.
- Ueda, Fumito. *Design by Subtraction* (GDC 2012). Removing features to strengthen the core experience.
- Meier, Sid. *Interesting Decisions* (GDC 2012). What makes a decision interesting in games.
- Blow, Jonathan. *Designing to Reveal the Nature of the Universe* (2011). On meaning in game mechanics.

### Online Resources

- GDC Vault (gdcvault.com) — Thousands of game design talks from industry professionals.
- Gamasutra / Game Developer (gamedeveloper.com) — Industry articles and postmortems.
- Lost Garden (lostgarden.home.blog) — Daniel Cook's essays on game design theory.
