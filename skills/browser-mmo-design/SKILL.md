---
name: browser-mmo-design
version: 1.0.0
description: >-
  Use when designing or building multiplayer browser game systems — factions/guilds,
  PvP combat, leaderboards, chat, energy/timer systems, cooldowns, action economy,
  WebSocket real-time sync, anti-cheat, or social features for text-based MMOs
  like Torn or The Crims.
---

# Browser MMO Design

Systems, patterns, and architecture for multiplayer text-based browser games.

---

## Timer & Energy Systems

Every action in a browser MMO is gated by a resource that regenerates over time. ALL timers are server-authoritative — the client only displays countdowns.

### Energy Formula

```typescript
const calculateEnergy = (
  stored: number,
  maxEnergy: number,
  regenRate: number,
  lastUpdateAt: Date,
): number => {
  const elapsed = (Date.now() - lastUpdateAt.getTime()) / 1000;
  return Math.min(maxEnergy, stored + regenRate * elapsed);
};
```

### Resource Types

| Resource | Regeneration | Used For |
|----------|-------------|----------|
| Energy | 1 per 5 min | General actions (train, work, travel) |
| Nerve | 1 per 3 min | Crimes, illegal activities |
| Happy | 1 per 15 min | Boosts training gains |
| Life | Heals over time or hospital | Health points |

### Cooldown Pattern

```typescript
import { pgTable, integer, timestamp, text } from 'drizzle-orm/pg-core';

const cooldowns = pgTable('cooldowns', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').notNull(),
  action: text('action').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

const canPerformAction = async (userId: number, action: string): Promise<boolean> => {
  const cooldown = await db.query.cooldowns.findFirst({
    where: and(
      eq(cooldowns.userId, userId),
      eq(cooldowns.action, action),
      gt(cooldowns.expiresAt, new Date()),
    ),
  });
  return !cooldown;
};
```

### Server-Authoritative Rule

- Client sends intent: `{ action: 'train', stat: 'strength' }`
- Server validates energy, cooldowns, state, then executes
- Server returns result + new energy value + next available time
- Client NEVER calculates outcomes — only displays server responses

---

## Faction / Guild Systems

### Core Structure

- **Creation**: Costs in-game currency, requires minimum level
- **Capacity**: Starts at 15, upgradeable with faction respect/money
- **Upgrades**: Armory, training facilities, territory bonuses

### Rank Hierarchy

| Rank | Permissions |
|------|------------|
| Leader | Full control, disband, promote co-leaders |
| Co-leader | Manage members, start wars, manage armory |
| Officer | Recruit, kick recruits, manage announcements |
| Member | Access armory, participate in wars |
| Recruit | Limited access, probation period |

### Permission System

Custom permissions beyond default roles — see `references/social-systems.md` for Drizzle schemas and middleware.

### Faction Wars

- **Declaration**: Leader/co-leader initiates, costs faction respect
- **Duration**: 24h–7d, configurable
- **Scoring**: Attacks on enemy faction members earn war points
- **End conditions**: Timer expires, surrender, score threshold
- **Rewards**: Respect, territory, bonuses to winners

---

## PvP Combat Design

### Attack Requirements

- Costs energy (default: 25)
- Attacker must be out of hospital/jail
- Target must be out of jail (hospital attacks allowed at reduced power)
- Level restriction: cannot attack players 10+ levels below you

### Cooldowns & Limits

- **Per-target cooldown**: 24h after attacking same player
- **Hospital timer**: Defeated players enter hospital (30 min–4 hours based on damage)
- **Jail timer**: Crime failures land players in jail (5 min–6 hours)
- **Retaliation bonus**: Attacked players get +20% damage for 24h against attacker
- **Travel lockout**: Cannot be attacked while traveling (but timer still runs)

### Attack Flow

```typescript
const executeAttack = async (attackerId: number, defenderId: number) => {
  const attacker = await getPlayerWithStats(attackerId);
  const defender = await getPlayerWithStats(defenderId);

  // Validations
  if (attacker.energy < 25) throw new Error('Not enough energy');
  if (attacker.level - defender.level >= 10) throw new Error('Target too weak');
  if (await isOnCooldown(attackerId, defenderId)) throw new Error('Cooldown active');

  // Combat resolution (delegate to rpg-systems combat formulas)
  const result = resolveCombat(attacker, defender);

  // Apply results atomically
  await db.transaction(async (tx) => {
    await deductEnergy(tx, attackerId, 25);
    await applyDamage(tx, defenderId, result.damage);
    if (result.defeated) await sendToHospital(tx, defenderId, result.hospitalTime);
    await setCooldown(tx, attackerId, defenderId, '24h');
    await grantRetaliation(tx, defenderId, attackerId);
    await logCombat(tx, result);
  });

  return result;
};
```

### Bounty System

- Players place bounties on others using in-game currency
- Bounties are anonymous (optional: reveal after claim)
- First player to defeat the target claims the bounty
- Minimum bounty amount prevents spam
- Bounty board shows active bounties sorted by reward

---

## Leaderboards

### Categories

| Board | Metric | Update Frequency |
|-------|--------|-----------------|
| Level | XP / Level | Real-time |
| Wealth | Net worth (cash + bank + assets) | Every 15 min |
| Combat | Attacks won / respect earned | Real-time |
| Faction | Total faction respect | Every 15 min |

### Implementation

```typescript
// Top 100 — real-time query
const getTopPlayers = async (category: string, limit = 100) => {
  return db
    .select({
      rank: sql`ROW_NUMBER() OVER (ORDER BY ${getOrderColumn(category)} DESC)`,
      userId: players.id,
      username: players.username,
      value: getOrderColumn(category),
    })
    .from(players)
    .orderBy(desc(getOrderColumn(category)))
    .limit(limit);
};

// Player's own rank — cached with invalidation
const getPlayerRank = async (userId: number, category: string) => {
  const cacheKey = `rank:${category}:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await db.execute(sql`
    SELECT rank FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY ${getOrderColumn(category)} DESC) as rank
      FROM players
    ) ranked WHERE id = ${userId}
  `);

  await redis.set(cacheKey, JSON.stringify(result[0]), 'EX', 300);
  return result[0];
};
```

---

## Chat System

### Channel Types

| Channel | Access | Rate Limit |
|---------|--------|------------|
| Global | All players | 1 msg/3s |
| Faction | Faction members only | 1 msg/1s |
| Trade | All players | 1 msg/10s |
| Private | Two players | 1 msg/1s |

### WebSocket with Elysia

```typescript
import { Elysia, t } from 'elysia';

const chatApp = new Elysia()
  .ws('/chat', {
    body: t.Object({
      type: t.Union([t.Literal('message'), t.Literal('join'), t.Literal('leave')]),
      channel: t.String(),
      content: t.Optional(t.String()),
    }),
    open(ws) {
      const userId = ws.data.userId;
      ws.subscribe('global');
      updatePresence(userId, 'online');
    },
    message(ws, { type, channel, content }) {
      if (type === 'message' && content) {
        if (!checkRateLimit(ws.data.userId, channel)) return;
        const sanitized = sanitizeMessage(content);
        ws.publish(channel, { userId: ws.data.userId, content: sanitized, ts: Date.now() });
      }
    },
    close(ws) {
      updatePresence(ws.data.userId, 'offline');
    },
  });
```

See `references/real-time.md` for full WebSocket patterns, presence, and scaling.

---

## Anti-Cheat Principles

1. **Server-authoritative**: Client sends intents, server resolves outcomes
2. **Validate everything**: Energy, cooldowns, permissions, state — on every request
3. **Rate limit per action**: Sliding window, not just global
4. **Timestamp verification**: Server generates all timestamps, never trust client time
5. **Bot detection**: Analyze timing patterns, enforce CAPTCHAs on suspicious activity
6. **Atomic transactions**: All state changes in a single DB transaction
7. **Audit logging**: Log every significant action for review

See `references/anti-cheat.md` for implementation details, Redis rate limiting, and Drizzle audit schemas.

---

## Cross-References

- **rpg-systems**: Combat formulas, damage calculations, stat architecture, loot tables
- **game-architecture**: WebSocket infrastructure, game loop, state management patterns
- **idle-game-design**: Offline progression, idle-MMO hybrid mechanics, prestige systems
