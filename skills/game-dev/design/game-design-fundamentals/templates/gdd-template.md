# Game Design Document: [Title]

> Version: 0.1 | Date: YYYY-MM-DD | Author: [Name]

---

## 1. Game Overview

| Field | Value |
|-------|-------|
| **Title** | [Working title] |
| **Genre** | [Primary genre / hybrid] |
| **Platform** | [Web, mobile, desktop, console] |
| **Target Audience** | [Age range, player profile, experience level] |
| **Unique Selling Proposition** | [One sentence: why does this game exist? What makes it different?] |
| **One-Sentence Pitch** | [Describe the entire game in one sentence] |
| **Target Session Length** | [How long is one typical play session?] |
| **MDA Target Aesthetics** | [2-3 from: Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission] |

---

## 2. Core Loop

The fundamental action-feedback cycle that the player repeats every few seconds.

```
[Input/Action] --> [Process/Simulation] --> [Feedback/Result] --> [Reward/Decision] --> [Loop]
```

### 30-Second Loop

| Step | Description | Feel |
|------|-------------|------|
| **Action** | [What does the player do?] | [How should it feel?] |
| **Process** | [What does the system calculate?] | [Visible or hidden?] |
| **Feedback** | [What does the player see/hear/feel?] | [Immediate? Delayed?] |
| **Reward** | [What does the player gain?] | [Expected? Surprising?] |
| **Decision** | [What choice does the player make next?] | [Meaningful? Obvious?] |

### Session Loop (5-30 minutes)

```
[Goal] --> [Repeated core loops] --> [Progress milestone] --> [New goal]
```

- Goal example: [What drives a single session?]
- Progress marker: [What tells the player they advanced?]
- Session end hook: [Why will the player come back?]

### Long-Term Loop (days/weeks)

```
[Community/Status] --> [Competition/Cooperation] --> [Achievement] --> [New ambition]
```

- Long-term driver: [What sustains engagement over weeks?]
- Social element: [How do players interact or compare?]

---

## 3. Mechanics

For each core mechanic:

### Mechanic: [Name]

| Attribute | Description |
|-----------|-------------|
| **Description** | [What does it do?] |
| **Rules** | [Specific rules governing this mechanic] |
| **Inputs** | [What triggers it? Player action, timer, event?] |
| **Outputs** | [What does it produce? Resources, state changes, feedback?] |
| **Feel** | [How should this mechanic feel to use? Snappy? Weighty? Satisfying?] |
| **Interactions** | [Which other mechanics does it connect to?] |

### Mechanic: [Name]

| Attribute | Description |
|-----------|-------------|
| **Description** | |
| **Rules** | |
| **Inputs** | |
| **Outputs** | |
| **Feel** | |
| **Interactions** | |

*(Repeat for each mechanic)*

---

## 4. Progression Design

### Unlock Sequence

| Phase | Timeframe | Unlocks | Player Focus |
|-------|-----------|---------|--------------|
| **Early** | 0-30 min | [Core mechanics, basic systems] | Learning, experimentation |
| **Mid** | 30 min - few hours | [Branching paths, deeper systems] | Strategy, meaningful choices |
| **Late** | Hours - days | [Mastery systems, optimization] | Efficiency, min-maxing |
| **Endgame** | Ongoing | [Social, competitive, infinite scaling] | Community, status, mastery |

### Difficulty Curve

```
Challenge
    ^
    |         Target flow channel
    |        ╱                 ╲
    |   ----╱-------------------╲----
    |  ╱   FLOW ZONE              ╲
    | ╱                            ╲
    |╱                              ╲
    └──────────────────────────────────> Skill / Time
      Early     Mid      Late    Endgame
```

- How does challenge increase over time?
- What prevents boredom in the early game?
- What prevents frustration in the late game?
- Are there adaptive difficulty mechanisms?

### Mastery Path

- What does a "skilled" player look like vs. a "new" player?
- What skills does the player develop over time?
- How does the game reward mastery (not just time investment)?

---

## 5. Economy Overview

> Cross-reference: `game-economy-design` skill for detailed balancing.

### Resources

| Resource | Type | Source (Faucet) | Drain (Sink) | Scarcity Level |
|----------|------|-----------------|--------------|----------------|
| [Primary resource] | Soft currency | [How is it earned?] | [How is it spent?] | [Abundant / Moderate / Scarce] |
| [Secondary resource] | Hard currency | | | |
| [Tertiary resource] | Consumable | | | |

### Growth Model

| Curve | Formula | Used For |
|-------|---------|----------|
| Linear | `base + level * increment` | [Which systems?] |
| Polynomial | `base * level^exponent` | [Which systems?] |
| Exponential | `base * multiplier^level` | [Which systems?] |

### Economy Health Checks

- [ ] Every resource has both faucets and sinks
- [ ] No resource can be accumulated infinitely without a sink
- [ ] Growth curves are balanced so costs outpace production gradually
- [ ] Premium currency can be earned (slowly) through gameplay

---

## 6. Player Types Addressed

> Reference: Bartle taxonomy (Achievers, Explorers, Socializers, Killers)

| Player Type | Primary/Secondary | Systems That Serve Them |
|-------------|-------------------|------------------------|
| **Achievers** | [Primary / Secondary / Not targeted] | [Progression, milestones, statistics] |
| **Explorers** | | [Discovery, hidden mechanics, lore] |
| **Socializers** | | [Guilds, chat, cooperation, trading] |
| **Killers** | | [PvP, rankings, competitive events] |

---

## 7. Session Design

| Session Type | Duration | Frequency | Player Activity |
|-------------|----------|-----------|-----------------|
| **Active** | [5-30 min] | [Daily?] | [Core gameplay, decisions, engagement] |
| **Quick check** | [30s-2 min] | [Multiple daily?] | [Collect progress, queue actions, check status] |
| **Social** | [5-30 min] | [Weekly?] | [Community interaction, trading, guild activities] |

### Return Hooks

- [ ] Daily: [What brings the player back each day?]
- [ ] Weekly: [What creates weekly engagement cycles?]
- [ ] Social: [What social obligations drive return visits?]
- [ ] Progression: [What long-term goals pull the player forward?]

---

## 8. Technical Requirements

> Cross-reference: `game-backend-architecture` skill for implementation.

| Requirement | Details |
|-------------|---------|
| **Rendering** | [Canvas, WebGL, DOM, terminal, etc.] |
| **Networking** | [Single-player, client-server, peer-to-peer?] |
| **State management** | [Client-side, server-authoritative, hybrid?] |
| **Save system** | [Local storage, cloud saves, server-side?] |
| **Tick rate** | [Fixed timestep? How many updates/sec?] |
| **Target performance** | [FPS target, load time budget, memory budget] |

---

## 9. Art Direction

> Cross-reference: `game-asset-gen` skill for asset generation.

| Aspect | Direction |
|--------|-----------|
| **Visual style** | [Pixel art, vector, 3D low-poly, realistic, etc.] |
| **Color palette** | [Describe mood and palette constraints] |
| **UI style** | [Minimal, skeuomorphic, flat, etc.] |
| **Animation style** | [Snappy, fluid, juicy, restrained?] |
| **Reference games** | [Visual references for the art team] |

---

## 10. Audio Direction

> Cross-reference: `elevenlabs-sound-music` skill for audio generation.

| Aspect | Direction |
|--------|-----------|
| **Music style** | [Genre, mood, tempo, instrumentation] |
| **SFX philosophy** | [Realistic, stylized, minimal, juicy?] |
| **Feedback sounds** | [What actions have audio feedback?] |
| **Ambient audio** | [Environmental sounds, background loops?] |
| **Dynamic audio** | [Does music/SFX change with game state?] |

---

## 11. Monetization Model

*(If applicable. Remove this section for non-commercial projects.)*

| Model | Description |
|-------|-------------|
| **Primary model** | [Free-to-play, premium, subscription, etc.] |
| **Revenue sources** | [Cosmetics, battle pass, expansion packs, etc.] |
| **Premium currency** | [Name, earn rate, purchase rate, conversion] |
| **Ethical guardrails** | [What will you NOT monetize?] |

### Monetization Checklist

- [ ] Core mechanics are fully playable without spending
- [ ] No pay-to-win advantages
- [ ] Premium currency earnable through gameplay
- [ ] Clear, honest pricing (no obfuscated currency conversion)
- [ ] No predatory patterns (artificial scarcity, manipulative timers)

---

## Appendix: Design Validation Checklist

- [ ] Core loop is fun in 30 seconds (Miyamoto test)
- [ ] Every mechanic serves a target MDA aesthetic
- [ ] Player makes interesting decisions (Sid Meier test)
- [ ] Difficulty stays in the flow channel
- [ ] At least 2 Bartle types are served
- [ ] Every resource has faucets and sinks
- [ ] Session design matches target audience habits
- [ ] The game can be described in one sentence
