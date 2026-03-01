# Social Systems

Faction schemas, permissions, territory, wars, profiles, and messaging for browser MMOs.

---

## Drizzle Schemas

### Factions

```typescript
import {
  pgTable,
  integer,
  text,
  timestamp,
  boolean,
  pgEnum,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const factionRoleEnum = pgEnum('faction_role', [
  'leader',
  'co_leader',
  'officer',
  'member',
  'recruit',
]);

const factions = pgTable('factions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  tag: text('tag').notNull().unique(),
  description: text('description'),
  leaderId: integer('leader_id').notNull(),
  respect: integer('respect').notNull().default(0),
  money: integer('money').notNull().default(0),
  capacity: integer('capacity').notNull().default(15),
  level: integer('level').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const factionMembers = pgTable(
  'faction_members',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    factionId: integer('faction_id').notNull().references(() => factions.id),
    userId: integer('user_id').notNull(),
    role: factionRoleEnum('role').notNull().default('recruit'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
    daysInFaction: integer('days_in_faction').notNull().default(0),
    contributedRespect: integer('contributed_respect').notNull().default(0),
  },
  (table) => [uniqueIndex('faction_members_user_idx').on(table.userId)],
);
```

### Faction Wars

```typescript
const warStatusEnum = pgEnum('war_status', [
  'pending',
  'active',
  'ended',
  'surrendered',
]);

const factionWars = pgTable('faction_wars', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  attackerFactionId: integer('attacker_faction_id').notNull().references(() => factions.id),
  defenderFactionId: integer('defender_faction_id').notNull().references(() => factions.id),
  status: warStatusEnum('status').notNull().default('pending'),
  attackerScore: integer('attacker_score').notNull().default(0),
  defenderScore: integer('defender_score').notNull().default(0),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  winnerId: integer('winner_id'),
  respectStake: integer('respect_stake').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const warActions = pgTable('war_actions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  warId: integer('war_id').notNull().references(() => factionWars.id),
  attackerId: integer('attacker_id').notNull(),
  defenderId: integer('defender_id').notNull(),
  points: integer('points').notNull(),
  actionType: text('action_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Faction Permissions

```typescript
const factionPermissions = pgTable('faction_permissions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  factionId: integer('faction_id').notNull().references(() => factions.id),
  role: factionRoleEnum('role').notNull(),
  permission: text('permission').notNull(),
  granted: boolean('granted').notNull().default(false),
});

// Default permission map
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  leader: [
    'manage_faction', 'manage_members', 'manage_wars',
    'manage_armory', 'manage_money', 'manage_announcements',
    'promote', 'demote', 'kick', 'invite', 'disband',
  ],
  co_leader: [
    'manage_members', 'manage_wars', 'manage_armory',
    'manage_money', 'manage_announcements',
    'promote', 'demote', 'kick', 'invite',
  ],
  officer: ['manage_announcements', 'kick', 'invite'],
  member: ['use_armory', 'participate_wars'],
  recruit: ['participate_wars'],
};
```

---

## Permission System

### Role-Based Access

```typescript
const hasPermission = async (
  userId: number,
  factionId: number,
  permission: string,
): Promise<boolean> => {
  const member = await db.query.factionMembers.findFirst({
    where: and(
      eq(factionMembers.userId, userId),
      eq(factionMembers.factionId, factionId),
    ),
  });

  if (!member) return false;

  // Check custom permission override first
  const custom = await db.query.factionPermissions.findFirst({
    where: and(
      eq(factionPermissions.factionId, factionId),
      eq(factionPermissions.role, member.role),
      eq(factionPermissions.permission, permission),
    ),
  });

  if (custom) return custom.granted;

  // Fall back to defaults
  return DEFAULT_PERMISSIONS[member.role]?.includes(permission) ?? false;
};
```

### Middleware

```typescript
import { Elysia } from 'elysia';

const factionGuard = (permission: string) => {
  return new Elysia().derive(async ({ userId, params }) => {
    const factionId = parseInt(params.factionId);
    const allowed = await hasPermission(userId, factionId, permission);
    if (!allowed) throw new Error('Insufficient faction permissions');
    return { factionId };
  });
};

// Usage
const factionRoutes = new Elysia({ prefix: '/factions/:factionId' })
  .use(factionGuard('manage_members'))
  .post('/kick', async ({ factionId, body }) => {
    await kickMember(factionId, body.targetUserId);
    return { success: true };
  })
  .use(factionGuard('manage_wars'))
  .post('/declare-war', async ({ factionId, body }) => {
    return declareWar(factionId, body.targetFactionId, body.duration);
  });
```

### Custom Roles

Leaders can override default permissions per role:

```typescript
const setCustomPermission = async (
  factionId: number,
  role: string,
  permission: string,
  granted: boolean,
) => {
  await db
    .insert(factionPermissions)
    .values({ factionId, role, permission, granted })
    .onConflictDoUpdate({
      target: [factionPermissions.factionId, factionPermissions.role, factionPermissions.permission],
      set: { granted },
    });
};
```

---

## Territory / Turf System

### Grid Map

```typescript
const territories = pgTable('territories', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  name: text('name').notNull(),
  ownerId: integer('owner_id').references(() => factions.id),
  defensePower: integer('defense_power').notNull().default(0),
  income: integer('income').notNull().default(100),
  capturedAt: timestamp('captured_at'),
  lastMaintenanceAt: timestamp('last_maintenance_at').notNull().defaultNow(),
});
```

### Capture Mechanics

- Factions attack territories owned by others or unclaimed
- Requires minimum faction members online (e.g., 5)
- Attack window: 1 hour per attempt
- Defense scales with territory upgrades and online defenders
- Successful capture transfers ownership, resets defense to base

### Maintenance

```typescript
const processTerritorMaintenance = async () => {
  const allTerritories = await db.query.territories.findMany({
    where: isNotNull(territories.ownerId),
  });

  for (const territory of allTerritories) {
    const faction = await db.query.factions.findFirst({
      where: eq(factions.id, territory.ownerId!),
    });

    if (!faction || faction.money < territory.income * 0.1) {
      // Can't afford maintenance — territory goes neutral
      await db
        .update(territories)
        .set({ ownerId: null, defensePower: 0, capturedAt: null })
        .where(eq(territories.id, territory.id));
    } else {
      // Deduct maintenance, add income
      await db.transaction(async (tx) => {
        await tx
          .update(factions)
          .set({ money: sql`${factions.money} - ${territory.income * 0.1} + ${territory.income}` })
          .where(eq(factions.id, faction.id));
        await tx
          .update(territories)
          .set({ lastMaintenanceAt: new Date() })
          .where(eq(territories.id, territory.id));
      });
    }
  }
};
```

---

## War System

### Declaration

```typescript
const declareWar = async (
  attackerFactionId: number,
  defenderFactionId: number,
  durationHours: number,
) => {
  const attacker = await db.query.factions.findFirst({
    where: eq(factions.id, attackerFactionId),
  });

  const respectCost = Math.floor(durationHours * 10);
  if (!attacker || attacker.respect < respectCost) {
    throw new Error('Not enough faction respect');
  }

  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h grace period
  const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    await tx
      .update(factions)
      .set({ respect: sql`${factions.respect} - ${respectCost}` })
      .where(eq(factions.id, attackerFactionId));

    const [war] = await tx
      .insert(factionWars)
      .values({
        attackerFactionId,
        defenderFactionId,
        status: 'pending',
        startsAt,
        endsAt,
        respectStake: respectCost,
      })
      .returning();

    return war;
  });
};
```

### Scoring

| Action | Points |
|--------|--------|
| Attack enemy member (win) | 3 |
| Hospitalize enemy member | 5 |
| Mug enemy member | 2 |
| Bounty enemy member | 1 |
| Territory capture during war | 10 |

### War Rewards

```typescript
const resolveWar = async (warId: number) => {
  const war = await db.query.factionWars.findFirst({
    where: eq(factionWars.id, warId),
  });
  if (!war || war.status !== 'active') return;

  const winnerId = war.attackerScore > war.defenderScore
    ? war.attackerFactionId
    : war.defenderFactionId;

  await db.transaction(async (tx) => {
    await tx
      .update(factionWars)
      .set({ status: 'ended', winnerId })
      .where(eq(factionWars.id, warId));

    // Winner gets staked respect + bonus
    await tx
      .update(factions)
      .set({ respect: sql`${factions.respect} + ${war.respectStake * 2}` })
      .where(eq(factions.id, winnerId));
  });
};
```

---

## Player Profiles

### Profile Schema

```typescript
const playerProfiles = pgTable('player_profiles', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').notNull().unique(),
  bio: text('bio'),
  isPublic: boolean('is_public').notNull().default(true),
  showStats: boolean('show_stats').notNull().default(true),
  showFaction: boolean('show_faction').notNull().default(true),
  reputation: integer('reputation').notNull().default(0),
  title: text('title'),
});

const achievements = pgTable('achievements', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').notNull(),
  achievementKey: text('achievement_key').notNull(),
  unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
  metadata: jsonb('metadata'),
});
```

### Reputation System

- Gained: Winning fair fights, helping faction, trading honestly
- Lost: Attacking much weaker players, scamming, exploiting
- Thresholds unlock titles and perks

---

## Mail System

### Schema

```typescript
const messages = pgTable('messages', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  senderId: integer('sender_id'),
  recipientId: integer('recipient_id').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  isSystem: boolean('is_system').notNull().default(false),
  category: text('category').notNull().default('personal'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Message Categories

| Category | Sender | Description |
|----------|--------|-------------|
| personal | Players | Direct player-to-player mail |
| faction | Leaders/Officers | Faction-wide announcements |
| system | System | Game notifications (attack results, market sales) |
| war | System | War declarations, results |
| bounty | System | Bounty placed on you, bounty claimed |

### Faction Announcements

```typescript
const sendFactionAnnouncement = async (
  factionId: number,
  senderId: number,
  subject: string,
  body: string,
) => {
  const members = await db.query.factionMembers.findMany({
    where: eq(factionMembers.factionId, factionId),
  });

  const messageValues = members.map((m) => ({
    senderId,
    recipientId: m.userId,
    subject,
    body,
    category: 'faction' as const,
  }));

  await db.insert(messages).values(messageValues);

  // Also push via WebSocket for online members
  for (const member of members) {
    const ws = connections.get(member.userId);
    if (ws) {
      ws.send({
        type: 'notification',
        title: subject,
        body: body.substring(0, 100),
        category: 'faction',
      });
    }
  }
};
```

### System Notifications

```typescript
const sendSystemNotification = async (
  recipientId: number,
  subject: string,
  body: string,
  category = 'system',
) => {
  await db.insert(messages).values({
    senderId: null,
    recipientId,
    subject,
    body,
    isSystem: true,
    category,
  });

  const ws = connections.get(recipientId);
  if (ws) {
    ws.send({
      type: 'notification',
      title: subject,
      body: body.substring(0, 100),
      category,
    });
  }
};

// Usage after combat
await sendSystemNotification(
  defenderId,
  'You were attacked!',
  `${attackerName} attacked you and won. You are in hospital for ${hospitalMinutes} minutes.`,
  'system',
);
```
