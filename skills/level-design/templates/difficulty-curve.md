# Difficulty Curve Design

## Overall Game Difficulty Curve

```
Difficulty
10 │                                    ████
 8 │                              ██████
 6 │                      ████████
 4 │            ██████████
 2 │    ████████
 0 │████
   └──────────────────────────────────────
    Tutorial  Early    Mid    Late   Endgame
```

### Phase Breakdown

| Phase | Duration | Difficulty Range | Purpose | Key Design |
|-------|----------|-----------------|---------|-----------|
| Tutorial | 5-15 min | 1-2 | Teach core mechanics | No failure possible, guided |
| Early | 30 min-2h | 2-4 | Build confidence | Low punishment, rapid progress |
| Mid | 2-8h | 4-6 | Meaningful challenge | Real decisions, some failure OK |
| Late | 8-20h | 6-8 | Mastery required | Complex combinations, punishing |
| Endgame | 20h+ | 8-10 | Expert content | Optional, for dedicated players |

---

## Per-Level Difficulty Profile

Every level should follow this internal arc:

```
Intensity
 █│         ██
  │       ██  █
  │     ██     █
  │   ██        █
  │  █           ██
  │██               █
  └─────────────────────
  Intro  Build  Peak  Resolve
```

| Phase | Description | Design Purpose |
|-------|-------------|---------------|
| Intro | Safe space, establish level theme | Orient player, set expectations |
| Buildup | Gradually increasing challenge | Build tension, test preparation |
| Peak | Hardest encounter in the level | Climactic moment, test mastery |
| Resolution | Cool-down, reward, transition | Emotional payoff, prepare for next |

---

## Difficulty Tuning Knobs

| Parameter | Easy | Normal | Hard |
|-----------|------|--------|------|
| Enemy/obstacle count | -30% | Base | +30% |
| Damage dealt to player | -40% | Base | +25% |
| Player resources (health, energy) | +50% | Base | -25% |
| Time limits | +50% or removed | Base | -25% |
| Puzzle complexity | Fewer steps, hints | Base | Extra steps, no hints |
| Checkpoint frequency | Every encounter | Every 2-3 encounters | Every area |
| AI behavior complexity | Predictable | Mixed | Aggressive + adaptive |
| Recovery options (healing, retry) | Abundant | Moderate | Scarce |

---

## Difficulty Modes

### Approach A: Preset Modes

| Mode | Target Audience | Multiplier on Tuning Knobs |
|------|----------------|---------------------------|
| Story | Narrative-focused, casual | All knobs at Easy |
| Normal | General audience | All knobs at Normal |
| Hard | Challenge-seekers | All knobs at Hard |
| Custom | Power users | Individual knob control |

### Approach B: Adaptive Difficulty

```
IF player.deathCount > 3 in same area:
    reduce difficulty by 1 step
    show optional hint
IF player.completionTime < expected * 0.5:
    increase difficulty by 1 step for next area
```

**Rules for adaptive difficulty**:
- Never reduce below minimum (player should still need to engage)
- Never increase mid-encounter (only between encounters)
- Always transparent: tell the player if difficulty adjusted
- Player can opt out of adaptive changes
- Track per-area, not globally (one hard area doesn't affect others)

---

## Common Difficulty Curve Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Flat difficulty | Players get bored | Add peaks and valleys |
| Sudden spike | Players quit at specific point | Add transition encounters |
| No rest areas | Player fatigue | Insert cool-down zones between challenges |
| Tutorial too long | Players skip/quit early | Teach through play, not text |
| Endgame cliff | Only 1% of players see final content | Offer difficulty options for story access |
| Reverse curve | Game gets easier over time | Scale challenges with player power growth |

---

## Difficulty Testing Checklist

- [ ] Can a new player complete the tutorial without external help?
- [ ] Does each difficulty mode feel distinct?
- [ ] Are there no impassable walls on Normal mode?
- [ ] Does Hard mode feel fair (hard but achievable)?
- [ ] Do rest areas feel like actual breaks?
- [ ] Is the peak encounter satisfying to overcome?
- [ ] Does adaptive difficulty (if used) feel invisible?
- [ ] Can the game be completed on all difficulty modes?
