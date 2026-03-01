# Player Psychology Reference

Understanding player motivation, retention, and engagement patterns for
browser game design.

---

## Bartle Taxonomy for Browser Games

Richard Bartle's player types, adapted for browser-based idle games, RPGs,
and MMOs:

### Achievers (Acting on the World)

Motivated by progression, accumulation, and measurable goals.

- **What they want**: Numbers go up, completion percentages, achievements,
  prestige milestones, leaderboard positions.
- **Design for them**: Clear progression bars, achievement systems, prestige
  layers with visible rewards, statistics pages, "100% completion" tracking.
- **Browser game examples**: Prestige resets in idle games, achievement badges,
  total resource counters, level milestones.
- **Retention hook**: "You're 73% to the next prestige layer."

### Explorers (Interacting with the World)

Motivated by discovery, secrets, and understanding hidden systems.

- **What they want**: Hidden mechanics, secret areas, easter eggs, lore,
  discovering optimal strategies, understanding formulas.
- **Design for them**: Hidden upgrades that unlock under specific conditions,
  lore fragments, discoverable game mechanics, wiki-worthy depth.
- **Browser game examples**: Secret prestige paths, hidden synergies between
  upgrades, lore entries that reveal game world history.
- **Retention hook**: "There's a hidden mechanic nobody's found yet."

### Socializers (Interacting with Players)

Motivated by relationships, community, and cooperation.

- **What they want**: Guilds, chat, trading, cooperative goals, shared
  achievements, helping others.
- **Design for them**: Faction systems, guild missions, trading markets,
  chat channels, cooperative boss raids, mentoring systems.
- **Browser game examples**: Faction territory wars (cooperative), guild
  resource pools, player-run markets, alliance chat.
- **Retention hook**: "Your guild needs you for the raid tonight."

### Killers (Acting on Players)

Motivated by competition, dominance, and proving superiority.

- **What they want**: PvP, rankings, competitive events, rewards for defeating
  others, bragging rights.
- **Design for them**: PvP arenas, competitive leaderboards, seasonal rankings,
  territory control, bounty systems.
- **Browser game examples**: Arena ladders, territory conquest, bounty boards,
  competitive seasonal events with exclusive rewards.
- **Retention hook**: "Player X just took your #3 ranking."

### Balancing Player Types

Most players are blends. Design your core loop for one primary type, then
layer systems for others:

| Game Type | Primary | Secondary | Tertiary |
|-----------|---------|-----------|----------|
| Idle/Clicker | Achiever | Explorer | Socializer |
| Text MMO | Socializer | Killer | Achiever |
| Tactical RPG | Achiever | Explorer | Killer |

---

## Retention Loops

Browser games live or die by their loop structure. Three nested loops drive
long-term retention:

### Core Loop (30-Second Engagement)

The tightest loop — what the player does every few seconds.

```
Action → Reward → Feedback → Action
```

- **Idle game**: Click/tap → resources gained → number goes up → buy upgrade
- **RPG**: Enter combat → deal damage → loot drops → equip gear
- **MMO**: Send action → see result → compare with peers → plan next move

The core loop must feel satisfying within 5 seconds. Instant feedback is
non-negotiable.

### Meta Loop (Session-Level Goals)

What keeps the player engaged for 5-30 minutes per session.

```
Goal → Core loops → Progress → New goal
```

- **Idle game**: Save up for next upgrade tier → run core loop → unlock → new
  tier available
- **RPG**: Complete quest chain → multiple combats → level up → new area
- **MMO**: Complete daily missions → multiple actions → earn faction rep → new
  rank

Meta loops give direction. Without them, the core loop feels pointless.

### Social/Metagame Loop (Cross-Session)

What brings the player back tomorrow, next week, next month.

```
Community → Competition/Cooperation → Status → Community
```

- **Idle game**: Compare prestige count on leaderboard → push for higher rank
- **RPG**: Guild raids with scheduled times → show up to help team
- **MMO**: Faction war season ending → contribute to faction victory

### Loop Nesting Diagram

```
┌─────────────────────────────────────────────────┐
│  Social Loop (days/weeks)                       │
│  ┌───────────────────────────────────────────┐  │
│  │  Meta Loop (minutes/hours)                │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Core Loop (seconds)                │  │  │
│  │  │  Action → Reward → Feedback → ...   │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │  Goal → [core loops] → Progress → Goal    │  │
│  └───────────────────────────────────────────┘  │
│  Community → Status → Competition → Community   │
└─────────────────────────────────────────────────┘
```

---

## Session Cadence

Browser game players have three distinct session types. Design for all three.

### Active Sessions (5-15 minutes)

Player is actively making decisions and performing actions.

- Making purchases/upgrades
- Engaging in combat
- Managing inventory
- Participating in events
- Chatting with guild

**Design**: Dense information, responsive UI, immediate feedback. This is
where the core loop lives.

### Idle Sessions (30 seconds - 2 minutes)

Player checks back to collect progress and queue next actions.

- Collecting accumulated resources
- Starting new production timers
- Checking notification badges
- Quick daily reward claim

**Design**: One-tap collection, clear "what happened while you were away"
summary, minimal friction to queue next action.

### Social Sessions (5-30 minutes)

Player is primarily interacting with other players.

- Guild chat and planning
- Trading on player market
- Reviewing leaderboards
- Coordinating faction activities

**Design**: Chat UI, social feeds, comparison tools, guild management
interfaces. This can happen even when game progress is paused.

---

## Monetization Ethics

Fair monetization for browser games — respect the player's time and skill.

### Acceptable Models

| Model | Description | Player Perception |
|-------|-------------|-------------------|
| Cosmetics | Skins, themes, visual effects | Positive — self-expression |
| QoL upgrades | Extra save slots, UI themes, auto-collect | Neutral — convenience |
| Time skip | Speed up timers (not skip content) | Neutral if reasonable |
| Battle pass | Seasonal content with free + premium tracks | Positive if free track is good |
| Expansion packs | New content, areas, mechanics | Positive — clear value |

### Avoid (Pay-to-Win)

- Selling power (stats, damage, exclusive gear)
- Selling progress that skips meaningful gameplay
- Locking core mechanics behind paywalls
- Aggressive energy gates that force spending
- Random loot boxes with power items

### Premium Currency Design

- **Earn some for free**: Daily quests, achievements, milestones should grant
  small amounts of premium currency.
- **Clear pricing**: Show real-money cost alongside premium currency cost.
- **No dark patterns**: No artificial scarcity ("only 2 hours left!"), no
  "confirm purchase" → "are you sure?" → "really sure?" funnels.
- **Conversion rate**: Keep it simple. 100 gems = $1.00. Don't obfuscate.

### Battle Pass Model

```
Free Track:  [■][■][■][□][□][□][□][□][□][□]  — Resources, basic cosmetics
Premium:     [★][★][★][□][□][□][□][□][□][□]  — Exclusive cosmetics, bonus XP

Tier 1-10:   Easy, rapid progression (hook)
Tier 11-30:  Steady cadence (2-3 days per tier)
Tier 31-50:  Challenge tiers (showcase dedication)
```

- Season length: 6-8 weeks for browser games (shorter than AAA)
- Free track must feel rewarding on its own
- Premium track is cosmetic and convenience only

---

## Progression Pacing

### Early Game (0-30 minutes)

**Goal**: Hook the player. Teach core mechanics through doing, not reading.

- Rapid unlocks every 1-2 minutes
- Minimal choices — guide the player
- Immediate, satisfying feedback
- Short tutorial that's actually playing the game
- First "wow" moment within 5 minutes (big number jump, first prestige preview,
  first combat win)

### Mid Game (30 minutes - 1 day)

**Goal**: Meaningful choices. Player understands systems and makes strategic
decisions.

- Unlock branching upgrade paths
- Introduce resource trade-offs
- First meaningful decision point (specialize vs. generalize)
- Social features unlock (guilds, chat, trading)
- Complexity increases gradually

### Late Game (1 day - 1 week)

**Goal**: Mastery and investment. Player is optimizing and committed.

- Prestige/rebirth mechanics unlock
- Deep optimization puzzles
- Rare drops and long-term goals
- Competitive features (leaderboards, PvP rankings)
- Content that rewards knowledge (hidden synergies, optimal builds)

### Endgame (1 week+)

**Goal**: Infinite engagement through social and competitive systems.

- Seasonal events and rotating content
- Faction/guild endgame (territory wars, cooperative raids)
- Infinite scaling (prestige layers, paragon levels)
- Community-driven goals (world bosses, server-wide events)
- Player-created content (custom challenges, marketplace)

### Pacing Curve

```
Excitement
    ▲
    │     ╱╲       ╱╲         ╱╲
    │    ╱  ╲     ╱  ╲       ╱  ╲
    │   ╱    ╲   ╱    ╲     ╱    ╲
    │  ╱      ╲ ╱      ╲   ╱      ╲
    │ ╱        ╳        ╲ ╱        ╲
    │╱                    ╳
    └──────────────────────────────────▶ Time
      Hook   Tutorial  Choices  Mastery  Endgame
```

Each "peak" is a new mechanic unlock or prestige reset. The valleys should
never feel boring — just lower intensity before the next spike.

---

## Flow State

Mihaly Csikszentmihalyi's flow channel applied to game difficulty design.

### The Flow Channel

```
Challenge
    ▲
    │          ╱ Anxiety
    │         ╱  (too hard)
    │        ╱
    │   ┌───────────┐
    │   │   FLOW    │  ← Target zone
    │   │  CHANNEL  │
    │   └───────────┘
    │        ╲
    │         ╲  Boredom
    │          ╲ (too easy)
    └──────────────────────▶ Skill
```

### Applying Flow to Browser Games

**Challenge must scale with player skill and progression:**

| Phase | Challenge Source | Skill Growth |
|-------|----------------|--------------|
| Early | Understanding mechanics | Learning the UI and systems |
| Mid | Choosing optimal strategies | Grasping interactions between systems |
| Late | Optimizing builds, timing | Deep knowledge of formulas and synergies |
| Endgame | Competing with skilled players | Mastery of all systems simultaneously |

### Avoiding Boredom (Too Easy)

- Auto-complete trivial tasks the player has mastered
- Introduce new mechanics before old ones become routine
- Scale enemy difficulty with player power (within reason)
- Add optional hard-mode challenges for skilled players

### Avoiding Anxiety (Too Hard)

- Provide multiple paths to progress (stuck on combat? try trading)
- Show clear indicators of recommended power level
- Allow grinding as a fallback (time investment = guaranteed progress)
- Difficulty settings or adaptive difficulty for single-player content

### Dynamic Difficulty in Practice

```typescript
// Adaptive difficulty example
const getDifficultyMultiplier = (
  playerWinRate: number,
  targetWinRate = 0.65,
): number => {
  const deviation = playerWinRate - targetWinRate;
  // Nudge difficulty toward target win rate
  // Positive deviation = winning too much = increase difficulty
  return 1 + deviation * 0.3;
};
```

Target win rates by content type:
- **Casual/story content**: 80-90% win rate
- **Standard content**: 60-70% win rate
- **Challenge content**: 30-50% win rate
- **Competitive PvP**: 45-55% (matchmaking-dependent)
