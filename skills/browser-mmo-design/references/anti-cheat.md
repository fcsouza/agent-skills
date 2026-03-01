# Anti-Cheat Systems

Server-authoritative validation, rate limiting, bot detection, and audit logging for browser MMOs.

---

## Server-Authoritative Principles

The single most important rule: **the server is the source of truth**.

1. Client sends **intent** (what the player wants to do)
2. Server **validates** (can they do it right now?)
3. Server **executes** (resolves the outcome)
4. Server **responds** (sends result to client)

The client should never:
- Calculate damage, loot, or rewards
- Determine combat outcomes
- Set its own timestamps
- Modify resource values (energy, money, items)

```typescript
// BAD — client sends result
// { action: 'attack', damage: 500, loot: [{ id: 99, qty: 1 }] }

// GOOD — client sends intent
// { action: 'attack', targetId: 42 }
```

---

## Rate Limiting

### Per-Action Sliding Window

Different actions have different rate limits. Use Redis sorted sets for a sliding window approach.

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  attack: { maxRequests: 1, windowSeconds: 5 },
  chat_global: { maxRequests: 1, windowSeconds: 3 },
  chat_faction: { maxRequests: 1, windowSeconds: 1 },
  chat_trade: { maxRequests: 1, windowSeconds: 10 },
  crime: { maxRequests: 1, windowSeconds: 3 },
  train: { maxRequests: 1, windowSeconds: 2 },
  market_buy: { maxRequests: 5, windowSeconds: 10 },
  market_list: { maxRequests: 3, windowSeconds: 60 },
  api_general: { maxRequests: 60, windowSeconds: 60 },
};

const checkRateLimit = async (
  userId: number,
  action: string,
): Promise<{ allowed: boolean; retryAfter?: number }> => {
  const config = RATE_LIMITS[action] ?? RATE_LIMITS.api_general;
  const key = `rl:${action}:${userId}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);
  pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
  pipeline.expire(key, config.windowSeconds);

  const results = await pipeline.exec();
  const count = results?.[1]?.[1] as number;

  if (count >= config.maxRequests) {
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const retryAfter = oldest.length >= 2
      ? Math.ceil((parseInt(oldest[1]) + config.windowSeconds * 1000 - now) / 1000)
      : config.windowSeconds;

    return { allowed: false, retryAfter };
  }

  return { allowed: true };
};
```

### Burst Protection

Prevent rapid-fire requests that technically pass sliding window:

```typescript
const checkBurst = async (userId: number, action: string): Promise<boolean> => {
  const key = `burst:${action}:${userId}`;
  const lastAction = await redis.get(key);

  if (lastAction) {
    const elapsed = Date.now() - parseInt(lastAction);
    if (elapsed < 500) return false; // 500ms minimum between any action
  }

  await redis.set(key, Date.now().toString(), 'EX', 5);
  return true;
};
```

### Rate Limit Middleware

```typescript
import { Elysia } from 'elysia';

const rateLimitMiddleware = (action: string) => {
  return new Elysia().derive(async ({ userId, set }) => {
    const burst = await checkBurst(userId, action);
    if (!burst) {
      set.status = 429;
      throw new Error('Too many requests');
    }

    const { allowed, retryAfter } = await checkRateLimit(userId, action);
    if (!allowed) {
      set.status = 429;
      set.headers['Retry-After'] = String(retryAfter);
      throw new Error(`Rate limited. Retry after ${retryAfter}s`);
    }
  });
};

// Usage
const combatRoutes = new Elysia()
  .use(rateLimitMiddleware('attack'))
  .post('/attack', async ({ userId, body }) => {
    return executeAttack(userId, body.targetId);
  });
```

---

## Action Validation

Every action must be validated server-side before execution.

```typescript
interface ActionContext {
  userId: number;
  action: string;
  payload: Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const validateAction = async (ctx: ActionContext): Promise<ValidationResult> => {
  const player = await getPlayer(ctx.userId);
  if (!player) return { valid: false, error: 'Player not found' };

  // Check player is not in restricted state
  if (player.hospitalUntil && player.hospitalUntil > new Date()) {
    return { valid: false, error: 'In hospital' };
  }
  if (player.jailUntil && player.jailUntil > new Date()) {
    return { valid: false, error: 'In jail' };
  }
  if (player.travelingUntil && player.travelingUntil > new Date()) {
    return { valid: false, error: 'Currently traveling' };
  }

  // Check energy/nerve requirements
  const cost = getActionCost(ctx.action);
  if (cost.energy && player.energy < cost.energy) {
    return { valid: false, error: 'Not enough energy' };
  }
  if (cost.nerve && player.nerve < cost.nerve) {
    return { valid: false, error: 'Not enough nerve' };
  }

  // Check cooldowns
  const onCooldown = await isOnCooldown(ctx.userId, ctx.action);
  if (onCooldown) {
    return { valid: false, error: 'Action on cooldown' };
  }

  // Action-specific validation
  switch (ctx.action) {
    case 'attack': {
      const targetId = ctx.payload.targetId as number;
      return validateAttack(player, targetId);
    }
    case 'crime': {
      const crimeType = ctx.payload.crimeType as string;
      return validateCrime(player, crimeType);
    }
    default:
      return { valid: true };
  }
};
```

---

## Timestamp Security

### Server-Generated Timestamps

Never trust client-provided timestamps for game logic.

```typescript
// All time-sensitive operations use server time
const performAction = async (userId: number, action: string) => {
  const now = new Date(); // Server time only

  await db.insert(actionLog).values({
    userId,
    action,
    performedAt: now,        // Server timestamp
    // NOT: performedAt: body.timestamp  // Never use client time
  });

  await db
    .update(cooldowns)
    .set({ expiresAt: new Date(now.getTime() + COOLDOWN_MS) })
    .where(eq(cooldowns.userId, userId));
};
```

### Reject Replays

Prevent replaying captured requests:

```typescript
const requestNonces = pgTable('request_nonces', {
  nonce: text('nonce').primaryKey(),
  userId: integer('user_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const validateNonce = async (userId: number, nonce: string): Promise<boolean> => {
  try {
    await db.insert(requestNonces).values({ nonce, userId });
    return true;
  } catch {
    // Duplicate nonce — replay detected
    return false;
  }
};

// Cleanup old nonces periodically
const cleanupNonces = async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(requestNonces).where(lt(requestNonces.createdAt, cutoff));
};
```

---

## Bot Detection

### Timing Pattern Analysis

Human players have variable timing. Bots tend to be consistent.

```typescript
const analyzeTimingPattern = async (userId: number): Promise<number> => {
  const recentActions = await db
    .select({ performedAt: actionLog.performedAt })
    .from(actionLog)
    .where(
      and(
        eq(actionLog.userId, userId),
        gt(actionLog.performedAt, new Date(Date.now() - 3600_000)),
      ),
    )
    .orderBy(actionLog.performedAt)
    .limit(50);

  if (recentActions.length < 10) return 0;

  // Calculate intervals between actions
  const intervals: number[] = [];
  for (let i = 1; i < recentActions.length; i++) {
    intervals.push(
      recentActions[i].performedAt.getTime() - recentActions[i - 1].performedAt.getTime(),
    );
  }

  // Low standard deviation = suspicious (bot-like consistency)
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  // CV < 0.1 is very suspicious (humans typically > 0.3)
  if (coefficientOfVariation < 0.1) return 0.9;
  if (coefficientOfVariation < 0.2) return 0.5;
  return 0;
};
```

### CAPTCHA Integration

Trigger CAPTCHAs based on suspicion level:

```typescript
const CAPTCHA_THRESHOLD = 0.5;

const maybeRequireCaptcha = async (userId: number): Promise<boolean> => {
  const suspicion = await analyzeTimingPattern(userId);

  if (suspicion >= CAPTCHA_THRESHOLD) {
    const captchaKey = `captcha:${userId}`;
    const pendingCaptcha = await redis.get(captchaKey);

    if (!pendingCaptcha) {
      await redis.set(captchaKey, 'pending', 'EX', 300);
      return true; // Require CAPTCHA
    }

    if (pendingCaptcha === 'pending') {
      return true; // Still waiting for CAPTCHA
    }
  }

  return false;
};
```

### Honeypot Fields

Add invisible form fields that bots will fill but humans won't:

```typescript
const validateHoneypot = (body: Record<string, unknown>): boolean => {
  // These fields are hidden via CSS — bots fill them, humans don't
  if (body._hp_email || body._hp_name || body._hp_url) {
    return false; // Bot detected
  }
  return true;
};
```

---

## Economy Exploit Prevention

### Atomic Transactions

All resource transfers must be atomic to prevent duplication:

```typescript
const transferMoney = async (
  fromUserId: number,
  toUserId: number,
  amount: number,
) => {
  if (amount <= 0) throw new Error('Invalid amount');

  await db.transaction(async (tx) => {
    // Lock sender row and check balance
    const [sender] = await tx
      .select({ money: players.money })
      .from(players)
      .where(eq(players.id, fromUserId))
      .for('update');

    if (!sender || sender.money < amount) {
      throw new Error('Insufficient funds');
    }

    // Deduct from sender
    await tx
      .update(players)
      .set({ money: sql`${players.money} - ${amount}` })
      .where(eq(players.id, fromUserId));

    // Add to receiver
    await tx
      .update(players)
      .set({ money: sql`${players.money} + ${amount}` })
      .where(eq(players.id, toUserId));
  });
};
```

### Negative Value Checks

```typescript
const validateResourceChange = (current: number, change: number, min = 0): boolean => {
  const result = current + change;
  return result >= min && Number.isFinite(result) && Number.isInteger(change);
};
```

### Idempotency Keys

Prevent double-processing of the same transaction:

```typescript
const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  userId: integer('user_id').notNull(),
  result: jsonb('result'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const withIdempotency = async <T>(
  key: string,
  userId: number,
  fn: () => Promise<T>,
): Promise<T> => {
  // Check if already processed
  const existing = await db.query.idempotencyKeys.findFirst({
    where: and(
      eq(idempotencyKeys.key, key),
      eq(idempotencyKeys.userId, userId),
    ),
  });

  if (existing) return existing.result as T;

  // Execute and store result
  const result = await fn();

  await db.insert(idempotencyKeys).values({
    key,
    userId,
    result: result as Record<string, unknown>,
  });

  return result;
};

// Usage
const purchaseItem = async (userId: number, itemId: number, idempotencyKey: string) => {
  return withIdempotency(idempotencyKey, userId, async () => {
    // ... purchase logic
    return { success: true, itemId };
  });
};
```

---

## Audit Logging

### Schema

```typescript
import { pgTable, integer, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

const auditSeverityEnum = pgEnum('audit_severity', [
  'info',
  'warning',
  'critical',
]);

const auditLog = pgTable('audit_log', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id'),
  action: text('action').notNull(),
  severity: auditSeverityEnum('severity').notNull().default('info'),
  details: jsonb('details'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Logging Helper

```typescript
const logAudit = async (
  userId: number | null,
  action: string,
  severity: 'info' | 'warning' | 'critical',
  details: Record<string, unknown>,
  request?: { ip: string; userAgent: string },
) => {
  await db.insert(auditLog).values({
    userId,
    action,
    severity,
    details,
    ip: request?.ip,
    userAgent: request?.userAgent,
  });

  // Alert on critical events
  if (severity === 'critical') {
    await notifyAdmins(`Critical audit: ${action}`, details);
  }
};

// Usage
await logAudit(userId, 'money_transfer', 'info', {
  from: fromUserId,
  to: toUserId,
  amount,
});

await logAudit(userId, 'rate_limit_exceeded', 'warning', {
  action: 'attack',
  count: requestCount,
  window: '60s',
});

await logAudit(userId, 'bot_detected', 'critical', {
  suspicionScore: 0.95,
  timingCV: 0.05,
  recentActions: 200,
});
```

### What to Log

| Event | Severity | Details |
|-------|----------|---------|
| Login / logout | info | IP, user agent |
| Money transfer | info | From, to, amount |
| Item trade | info | Items, values |
| Attack | info | Attacker, defender, result |
| Rate limit hit | warning | Action, count, window |
| Failed validation | warning | Action, reason, payload |
| Suspicious timing | warning | CV score, action count |
| Bot detected | critical | Suspicion score, evidence |
| Duplicate transaction | critical | Idempotency key, details |
| Economy anomaly | critical | Transaction, before/after values |
