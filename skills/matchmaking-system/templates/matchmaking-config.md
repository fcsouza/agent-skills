# Matchmaking Configuration Template

Customize these settings per game. Values below are sensible defaults.

---

## Queue Settings by Game Mode

| Setting | 1v1 | 2v2 | 4v4 | Battle Royale | Co-op |
|---|---|---|---|---|---|
| Players per match | 2 | 4 | 8 | 60-100 | 2-4 |
| Min players to start | 2 | 4 | 8 | 40 | 2 |
| Allow backfill | No | No | Yes | Yes | Yes |
| Cross-region fallback | After 60s | After 60s | After 45s | After 30s | After 90s |
| Skill matching weight | 1.0 | 0.8 | 0.6 | 0.3 | 0.1 |
| Queue priority boost after | 30s | 30s | 20s | 15s | 45s |

### Mode-Specific Notes

- **1v1**: Strictest skill matching. Never compromise on match quality for speed.
- **2v2**: Match teams, not individuals. Sum of team rating should be within threshold.
- **4v4**: Wider skill tolerance. Balance teams by distributing high/low rated players.
- **Battle Royale**: Skill matters less due to variance. Fill lobbies quickly, use SBMM buckets (low/mid/high).
- **Co-op**: Minimal skill requirements. Prioritize low wait time and region match.

---

## Rating System (ELO / Glicko-2)

```
initial_rating: 1500
initial_deviation: 350       # Glicko-2 RD (high = uncertain)
initial_volatility: 0.06     # Glicko-2 sigma

# K-factor schedule (ELO mode)
k_factor_new: 40             # < 10 games
k_factor_learning: 24        # 10-30 games
k_factor_established: 16     # > 30 games

# Performance metrics weight (0.0 = win/loss only, 1.0 = performance only)
performance_weight: 0.3

# Rating floors (prevent death spiral)
min_rating: 100
max_rating: 3500

# Seasonal decay
inactive_decay_start: 14     # Days before decay begins
inactive_decay_per_day: 5    # Rating points lost per day of inactivity
inactive_decay_floor: 1200   # Never decay below this
```

---

## Search Radius Widening Schedule

| Wait Time | Radius Delta | Cumulative Radius | Notes |
|---|---|---|---|
| 0s | 0 | +-50 | Initial tight search |
| 10s | +50 | +-100 | First expansion |
| 20s | +50 | +-150 | Second expansion |
| 30s | +100 | +-250 | Aggressive expansion (player promoted to priority) |
| 45s | +100 | +-350 | Very wide search |
| 60s | +150 | +-500 | Maximum radius — accept any viable match |
| 90s | -- | +-500 | Force-match with best available (ignore min quality) |
| 120s | -- | -- | Notify player of low population; offer cross-region |

### Implementation

```typescript
const RADIUS_SCHEDULE = [
  { waitMs: 0,      radius: 50  },
  { waitMs: 10_000, radius: 100 },
  { waitMs: 20_000, radius: 150 },
  { waitMs: 30_000, radius: 250 },
  { waitMs: 45_000, radius: 350 },
  { waitMs: 60_000, radius: 500 },
];
```

Use BullMQ delayed jobs to trigger each expansion step.

---

## Regional Latency Thresholds

```
# Maximum acceptable ping per region tier
same_region: < 50ms          # Ideal
adjacent_region: < 100ms     # Acceptable
cross_continent: < 200ms     # Degraded experience warning
global_fallback: < 300ms     # Only after extended wait time

# Region mapping (for cross-region fallback)
regions:
  us-east:    [us-west, eu-west]
  us-west:    [us-east, asia-east]
  eu-west:    [us-east, eu-central]
  eu-central: [eu-west, asia-west]
  asia-east:  [us-west, asia-southeast]
  asia-southeast: [asia-east, oceania]
  oceania:    [asia-southeast, us-west]
```

---

## Anti-Abuse Rules

### Leave Penalty

```
tracking_window: 20          # Last N games
abandon_threshold: 0.20      # 20% abandon rate triggers penalty

# Escalating cooldowns
penalties:
  - level: 1                 # First offense
    cooldown: 30s
    rating_penalty: 0
  - level: 2                 # Second offense
    cooldown: 2m
    rating_penalty: -10
  - level: 3                 # Third offense
    cooldown: 10m
    rating_penalty: -25
  - level: 4                 # Habitual offender
    cooldown: 30m
    rating_penalty: -50

# Penalty decay: 1 level removed per 5 completed matches
decay_rate: 5
```

### Queue Manipulation Prevention

```
# Re-queue cooldown (prevent queue-sniping)
requeue_cooldown: 5s

# Dodge penalty (leaving during COUNTDOWN)
dodge_cooldown: 60s
dodge_rating_penalty: -15

# Smurf detection thresholds
smurf_winrate_threshold: 0.80    # 80%+ win rate over 15+ games
smurf_kda_threshold: 3.0         # Unusually high performance
smurf_action: accelerated_placement  # Fast-track to true skill bracket
```

---

## Team Matchmaking Adjustments

```
# Premade vs solo handicap
premade_2_handicap: 100      # 2-stack rated 100 higher than displayed
premade_3_handicap: 175      # 3-stack
premade_full_handicap: 250   # Full premade team

# Team balance algorithm
team_balance: minimize_variance  # Options: minimize_variance, snake_draft, captain_pick
max_team_rating_diff: 150    # Max difference between team average ratings
```
