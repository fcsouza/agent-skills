# Progression Patterns

## Unlock Sequencing

### Linear Chain

Unlock A → B → C. Simple, predictable, easy to balance. Best for early game or tutorial phase.

```typescript
const UNLOCK_CHAIN = [
  { id: 'generator_basic', requires: null, at: 0 },
  { id: 'generator_advanced', requires: 'generator_basic', at: 100 },
  { id: 'upgrade_multiplier', requires: 'generator_advanced', at: 1_000 },
  { id: 'automation_basic', requires: 'upgrade_multiplier', at: 10_000 },
  { id: 'prestige', requires: 'automation_basic', at: 1_000_000 },
] as const;

function getAvailableUnlocks(totalEarned: number, unlocked: Set<string>) {
  return UNLOCK_CHAIN.filter(
    (u) => u.at <= totalEarned && !unlocked.has(u.id) &&
      (u.requires === null || unlocked.has(u.requires)),
  );
}
```

### Branching Tree

Choose path — each branch introduces different mechanics. Creates meaningful choices and replayability.

```
                [Core Generator]
               /                \
     [Auto-Clicker]        [Multiplier Path]
      /         \               /          \
[Speed Boost] [Multi-Click] [Combo System] [Crit Chance]
```

### Discovery-Based

Hidden unlocks triggered by reaching thresholds, combining resources, or performing specific actions. Creates "aha!" moments.

```typescript
const SECRET_UNLOCKS = [
  { id: 'golden_click', condition: (s: GameState) => s.totalClicks >= 10_000 },
  { id: 'hoarder', condition: (s: GameState) => s.resources.gold >= 1e9 && s.upgrades.length === 0 },
  { id: 'speedrun', condition: (s: GameState) => s.prestigeCount >= 1 && s.playTime < 3600 },
];
```

### Hybrid (Recommended)

Linear main path with discovery side-content. Players always have clear next goal while rewarding exploration.

---

## Prestige Layer Design

### Single Reset (Cookie Clicker Model)

One prestige currency. Full reset of base resources, generators, and upgrades. Prestige currency buys permanent multipliers.

```
Run 1: Build up → Hit wall → Prestige → Get heavenly chips
Run 2: Same loop but 2x faster → Prestige again → More chips
Run N: Each run progressively faster, new prestige upgrades unlock
```

**Currency formula**: `floor(150 * sqrt(lifetimeEarned / 1e10))`

**Design rules**:
- First prestige should feel achievable in 2-4 hours
- Each prestige should roughly double initial progress speed
- Prestige upgrade tree should have 20-50 nodes for depth

### Multi-Layer (Antimatter Dimensions Model)

3-4 prestige layers. Each resets everything below it.

```
Layer 0: Dimensions (base generators)
Layer 1: Infinity (resets dimensions, grants infinity points)
Layer 2: Eternity (resets infinity, grants eternity points)
Layer 3: Reality (resets eternity, grants reality machines)
```

**Design rules**:
- Each layer should take 10x longer to first trigger than the previous
- Higher layers give exponentially more power
- Unlock new mechanics at each layer (not just bigger numbers)
- Layer 1: 2-4 hours, Layer 2: 1-2 days, Layer 3: 1-2 weeks

### Partial Reset

Prestige keeps some upgrades while resetting others. Less punishing, more strategic.

```typescript
type ResetScope = {
  resets: ('resources' | 'generators' | 'basicUpgrades')[];
  keeps: ('prestigeUpgrades' | 'achievements' | 'milestones' | 'cosmetics')[];
};
```

---

## Content Pacing

### Early Game (0-30 min)

- Rapid unlocks every 2-5 minutes
- Teach one mechanic at a time
- Immediate feedback for every action
- Dopamine-rich: numbers go up fast, constant unlocks
- Goal: hook the player, teach the core loop

### Mid Game (30 min - 1 day)

- Unlocks slow to every 15-30 minutes
- Introduce first prestige mechanic
- Player starts making meaningful choices (which upgrades to buy)
- Idle vs active play becomes relevant
- Goal: establish the meta loop, introduce prestige

### Late Game (1-7 days)

- Prestige becomes routine (multiple per session)
- Unlock meta-upgrades that change how prestige works
- Introduce second prestige layer or new mechanics
- Automation becomes important
- Goal: reward mastery, add depth layers

### Endgame (7+ days)

- Social features (leaderboards, competitions)
- Prestige layers 3+
- Challenges (restricted runs with bonuses)
- Seasonal/event content
- Community goals
- Goal: indefinite engagement through social + incremental content

### Pacing Curve

```
Unlocks/hour
    │
 12 │ ██
 10 │ ████
  8 │ ██████
  6 │ ████████
  4 │ ████████████
  2 │ ████████████████████
  0 │ ████████████████████████████████
    └─────────────────────────────────
      0    1h   4h   1d   3d   7d  14d
```

---

## Anti-Patterns

### Exponential Wall

**Problem**: Costs grow faster than any production can match. Player hits an impossible wall.

**Symptoms**: Players quit at a specific point. No amount of waiting helps.

**Fix**: Ensure every wall has a solution (prestige, new mechanic, different resource path). Test that forward progress is always possible, even if slow.

### Meaningless Choices

**Problem**: All upgrades are mathematically equivalent — doesn't matter which you buy.

**Symptoms**: Players don't engage with choice, just buy whatever is cheapest.

**Fix**: Give upgrades distinct effects (multiplicative vs additive, different resource types, unlocks vs raw power). Make the optimal choice non-obvious.

### Idle-Only Trap

**Problem**: No meaningful active play decisions. Checking back is just "collect and spend."

**Symptoms**: Player engagement drops, sessions get shorter and less frequent.

**Fix**: Add active play bonuses (clicking multipliers, mini-games, timed events). Make active play 2-5x more efficient than idle.

### Prestige Too Early

**Problem**: Forced reset before player feels accomplished or understands the system.

**Symptoms**: Player anger, confusion, abandonment at first prestige.

**Fix**: Make first prestige feel earned (not forced). Show clear benefit before reset. Let player delay prestige if they want.

### Feature Creep

**Problem**: Too many systems introduced too fast. Player overwhelmed.

**Symptoms**: UI cluttered, player doesn't know what to focus on.

**Fix**: Progressive disclosure — hide systems until relevant. Unlock tabs one at a time. Gate complexity behind progression.

---

## Case Studies

### Cookie Clicker

- **Core loop**: Click → cookies → buy buildings → more cookies/sec
- **Prestige**: Heavenly chips from ascending, buy permanent upgrades
- **Strengths**: Simple core, deep prestige tree, seasonal events, humor
- **Lesson**: A simple core loop with deep meta-progression can last years

### Kittens Game

- **Core loop**: Gather resources → build structures → research tech → unlock new resources
- **Prestige**: Reset with chronosphere, keep some resources and tech
- **Strengths**: Multi-resource economy, tech tree depth, seasonal mechanics, challenge modes
- **Lesson**: Complex interconnected systems create emergent strategy

### Antimatter Dimensions

- **Core loop**: Buy dimensions → produce antimatter → buy more dimensions
- **Prestige**: 3 layers (Infinity, Eternity, Reality), each with own currency and upgrades
- **Strengths**: Clean mathematical design, multi-layer prestige, elegant UI
- **Lesson**: Multi-layer prestige keeps the game fresh across months of play

### Universal Paperclips

- **Core loop**: Make paperclips → buy upgrades → make more paperclips
- **Prestige**: Distinct game phases that completely change mechanics
- **Strengths**: Narrative-driven, finite ending, phase transitions, philosophical themes
- **Lesson**: Idle games can tell stories through mechanics alone
