# Real-Time Systems

WebSocket patterns, state synchronization, and presence for browser MMOs.

---

## WebSocket with Elysia

### Connection Lifecycle

```typescript
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';

type MessageType =
  | { type: 'chat'; channel: string; content: string }
  | { type: 'action'; action: string; payload: Record<string, unknown> }
  | { type: 'ping' }
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string };

const gameWs = new Elysia()
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET! }))
  .ws('/ws', {
    body: t.Union([
      t.Object({ type: t.Literal('chat'), channel: t.String(), content: t.String() }),
      t.Object({ type: t.Literal('action'), action: t.String(), payload: t.Record(t.String(), t.Unknown()) }),
      t.Object({ type: t.Literal('ping') }),
      t.Object({ type: t.Literal('subscribe'), channel: t.String() }),
      t.Object({ type: t.Literal('unsubscribe'), channel: t.String() }),
    ]),
    async beforeHandle(ctx) {
      const token = ctx.query.token;
      if (!token) throw new Error('Missing token');
      const payload = await ctx.jwt.verify(token);
      if (!payload) throw new Error('Invalid token');
      ctx.store = { userId: payload.sub };
    },
    open(ws) {
      const userId = ws.data.store.userId;
      connections.set(userId, ws);
      ws.subscribe(`user:${userId}`);
      ws.subscribe('global');
      setPresence(userId, 'online');
      ws.send({ type: 'connected', userId, serverTime: Date.now() });
    },
    message(ws, data) {
      const userId = ws.data.store.userId;

      switch (data.type) {
        case 'chat':
          handleChat(ws, userId, data.channel, data.content);
          break;
        case 'action':
          handleAction(ws, userId, data.action, data.payload);
          break;
        case 'ping':
          refreshPresence(userId);
          ws.send({ type: 'pong', serverTime: Date.now() });
          break;
        case 'subscribe':
          if (canAccessChannel(userId, data.channel)) {
            ws.subscribe(data.channel);
          }
          break;
        case 'unsubscribe':
          ws.unsubscribe(data.channel);
          break;
      }
    },
    close(ws) {
      const userId = ws.data.store.userId;
      connections.delete(userId);
      setPresence(userId, 'offline');
    },
  });
```

### Authentication

- Pass JWT as query parameter on initial connection: `ws://host/ws?token=<jwt>`
- Validate in `beforeHandle` — reject before WebSocket upgrade
- Store userId in connection context for all subsequent messages
- Token refresh: client reconnects with new token before expiry

### Room / Channel System

```typescript
const channels = {
  global: 'global',
  faction: (factionId: number) => `faction:${factionId}`,
  trade: 'trade',
  private: (userId1: number, userId2: number) => {
    const sorted = [userId1, userId2].sort();
    return `dm:${sorted[0]}:${sorted[1]}`;
  },
  user: (userId: number) => `user:${userId}`,
  area: (areaId: string) => `area:${areaId}`,
};

const canAccessChannel = async (userId: number, channel: string): Promise<boolean> => {
  if (channel === 'global' || channel === 'trade') return true;
  if (channel.startsWith('faction:')) {
    const factionId = parseInt(channel.split(':')[1]);
    return isInFaction(userId, factionId);
  }
  if (channel.startsWith('dm:')) {
    const [, id1, id2] = channel.split(':');
    return userId === parseInt(id1) || userId === parseInt(id2);
  }
  return false;
};
```

### Message Types — Discriminated Unions

```typescript
type ServerMessage =
  | { type: 'connected'; userId: number; serverTime: number }
  | { type: 'pong'; serverTime: number }
  | { type: 'chat'; channel: string; userId: number; username: string; content: string; ts: number }
  | { type: 'action_result'; action: string; success: boolean; data: Record<string, unknown> }
  | { type: 'state_update'; entity: string; changes: Record<string, unknown> }
  | { type: 'notification'; title: string; body: string; category: string }
  | { type: 'presence'; userId: number; status: 'online' | 'offline' | 'idle' }
  | { type: 'error'; code: string; message: string };
```

---

## State Synchronization

### Full Sync

Send complete state on connection — used for initial load only.

```typescript
const sendFullSync = async (ws: WebSocket, userId: number) => {
  const player = await getFullPlayerState(userId);
  ws.send({
    type: 'state_update',
    entity: 'player',
    changes: {
      stats: player.stats,
      energy: calculateEnergy(player),
      inventory: player.inventory,
      cooldowns: player.activeCooldowns,
      location: player.location,
    },
  });
};
```

### Delta Sync

Only send what changed — used for ongoing updates.

```typescript
const broadcastDelta = (channel: string, entity: string, changes: Record<string, unknown>) => {
  gameWs.server?.publish(channel, JSON.stringify({
    type: 'state_update',
    entity,
    changes,
    ts: Date.now(),
  }));
};

// After an attack resolves
broadcastDelta(`user:${attackerId}`, 'player', {
  energy: newEnergy,
  'stats.attacksWon': attacksWon + 1,
});
broadcastDelta(`user:${defenderId}`, 'player', {
  'stats.hp': newHp,
  hospitalUntil: hospitalExpiry,
});
```

### Event-Driven Updates

For game-wide events visible to many players.

```typescript
const broadcastEvent = (event: {
  type: string;
  data: Record<string, unknown>;
  channels: string[];
}) => {
  for (const channel of event.channels) {
    gameWs.server?.publish(channel, JSON.stringify({
      type: 'game_event',
      event: event.type,
      data: event.data,
      ts: Date.now(),
    }));
  }
};

// Faction war update
broadcastEvent({
  type: 'war_score_update',
  data: { factionA: 150, factionB: 120, lastAction: 'Player X attacked Player Y' },
  channels: [`faction:${factionAId}`, `faction:${factionBId}`],
});
```

### Optimistic Updates

Client applies changes immediately, server confirms or rolls back.

```typescript
// Client-side pattern
const performAction = async (action: string, payload: Record<string, unknown>) => {
  const optimisticId = crypto.randomUUID();

  // Apply optimistically
  applyOptimistic(optimisticId, action, payload);

  // Send to server
  ws.send({ type: 'action', action, payload, optimisticId });

  // Server confirms or rejects
  // On confirm: finalize optimistic change
  // On reject: rollback optimistic change and show error
};
```

---

## Presence System

### Heartbeat

- Client sends `ping` every **30 seconds**
- Server responds with `pong` + server timestamp
- If no ping received within **90 seconds**, mark player offline

```typescript
const HEARTBEAT_INTERVAL = 30_000;
const PRESENCE_TIMEOUT = 90;

const setPresence = async (userId: number, status: 'online' | 'offline' | 'idle') => {
  await redis.hset(`presence:${userId}`, { status, lastSeen: Date.now() });
  if (status === 'online') {
    await redis.expire(`presence:${userId}`, PRESENCE_TIMEOUT);
  }
  broadcastToFriends(userId, { type: 'presence', userId, status });
};

const refreshPresence = async (userId: number) => {
  await redis.expire(`presence:${userId}`, PRESENCE_TIMEOUT);
};

// Cleanup job — runs every 60s
const cleanupPresence = async () => {
  const expired = await redis.keys('presence:*');
  for (const key of expired) {
    const ttl = await redis.ttl(key);
    if (ttl === -2) {
      const userId = parseInt(key.split(':')[1]);
      broadcastToFriends(userId, { type: 'presence', userId, status: 'offline' });
    }
  }
};
```

### Online Player Count

```typescript
const getOnlineCount = async (): Promise<number> => {
  return redis.scard('online_players');
};

const getOnlineFactionMembers = async (factionId: number): Promise<number[]> => {
  const members = await getFactionMemberIds(factionId);
  const pipeline = redis.pipeline();
  for (const id of members) {
    pipeline.hget(`presence:${id}`, 'status');
  }
  const results = await pipeline.exec();
  return members.filter((_, i) => results?.[i]?.[1] === 'online');
};
```

---

## Scaling

### Redis Pub/Sub for Cross-Server Communication

When running multiple server instances behind a load balancer:

```typescript
import { Redis } from 'ioredis';

const pub = new Redis(process.env.REDIS_URL!);
const sub = new Redis(process.env.REDIS_URL!);

// Subscribe to cross-server messages
sub.subscribe('game:broadcast', 'game:direct');

sub.on('message', (channel, message) => {
  const parsed = JSON.parse(message);

  if (channel === 'game:broadcast') {
    gameWs.server?.publish(parsed.channel, parsed.data);
  }

  if (channel === 'game:direct') {
    const ws = connections.get(parsed.userId);
    if (ws) ws.send(parsed.data);
  }
});

// When publishing from any server instance
const crossServerPublish = (channel: string, data: string) => {
  pub.publish('game:broadcast', JSON.stringify({ channel, data }));
};

const crossServerDirect = (userId: number, data: string) => {
  pub.publish('game:direct', JSON.stringify({ userId, data }));
};
```

### Sticky Sessions

- Use IP-based or cookie-based sticky sessions at the load balancer
- Ensures a player's WebSocket stays on the same server instance
- Redis pub/sub handles cross-server communication for messages targeting other servers

---

## Polling Fallback

For non-critical data that doesn't need real-time updates:

```typescript
import { Elysia } from 'elysia';

const pollingApp = new Elysia()
  .get('/api/leaderboard/:category', async ({ params, set }) => {
    const cacheKey = `lb:${params.category}`;
    const cached = await redis.get(cacheKey);
    const etag = await redis.get(`${cacheKey}:etag`);

    set.headers['ETag'] = etag ?? '';
    set.headers['Cache-Control'] = 'public, max-age=30';

    return cached ? JSON.parse(cached) : await refreshLeaderboard(params.category);
  })
  .get('/api/player/status', async ({ query, set }) => {
    // 30-60s polling for energy/nerve regeneration display
    const player = await getPlayerStatus(query.userId);
    set.headers['Cache-Control'] = 'private, max-age=30';
    return player;
  });
```

### When to Poll vs WebSocket

| Data | Method | Interval |
|------|--------|----------|
| Chat messages | WebSocket | Real-time |
| Combat results | WebSocket | Real-time |
| Presence | WebSocket | Real-time |
| Leaderboards | Polling | 30–60s |
| Faction stats | Polling | 60s |
| Market prices | Polling | 30s |
| Player profile | Polling | On demand |
