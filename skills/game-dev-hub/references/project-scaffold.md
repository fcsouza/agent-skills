# Project Scaffold Reference

Complete monorepo scaffold for a browser game using Turborepo, Next.js,
Elysia, Drizzle, and Neon.

---

## Directory Tree

```
my-game/
├── apps/
│   ├── game/                        # Next.js App Router
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx       # Root layout, providers
│   │   │   │   ├── page.tsx         # Landing page (SSR)
│   │   │   │   ├── play/
│   │   │   │   │   └── page.tsx     # Game client (client-side)
│   │   │   │   ├── leaderboard/
│   │   │   │   │   └── page.tsx     # Leaderboard (SSR)
│   │   │   │   └── profile/
│   │   │   │       └── page.tsx     # Player profile
│   │   │   ├── components/
│   │   │   │   ├── game/            # Game-specific UI
│   │   │   │   │   ├── game-canvas.tsx
│   │   │   │   │   ├── resource-bar.tsx
│   │   │   │   │   └── upgrade-panel.tsx
│   │   │   │   └── ui/              # shadcn/ui components
│   │   │   ├── hooks/
│   │   │   │   ├── use-game-loop.ts
│   │   │   │   ├── use-game-store.ts
│   │   │   │   └── use-websocket.ts
│   │   │   ├── stores/
│   │   │   │   ├── game-store.ts    # Zustand game state
│   │   │   │   └── ui-store.ts      # UI state (menus, modals)
│   │   │   └── lib/
│   │   │       ├── api-client.ts    # Typed API client
│   │   │       └── utils.ts
│   │   ├── public/
│   │   │   └── assets/              # Static game assets
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                         # Elysia API server
│       ├── src/
│       │   ├── index.ts             # Server entry point
│       │   ├── routes/
│       │   │   ├── game.ts          # /api/game — actions, state, tick
│       │   │   ├── auth.ts          # /api/auth — sessions, OAuth
│       │   │   └── social.ts        # /api/social — chat, guilds, friends
│       │   ├── services/
│       │   │   ├── game-service.ts  # Game logic orchestration
│       │   │   ├── tick-service.ts  # Server-side tick loop
│       │   │   └── auth-service.ts  # Better Auth integration
│       │   ├── ws/
│       │   │   ├── handler.ts       # WebSocket connection handler
│       │   │   └── messages.ts      # Message type definitions
│       │   └── db/
│       │       ├── schema.ts        # Drizzle schema
│       │       ├── index.ts         # DB connection
│       │       └── migrations/      # Drizzle migrations
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── game-engine/                 # Pure TypeScript game logic
│   │   ├── src/
│   │   │   ├── index.ts             # Public API
│   │   │   ├── systems/
│   │   │   │   ├── resource-system.ts
│   │   │   │   ├── combat-system.ts
│   │   │   │   ├── upgrade-system.ts
│   │   │   │   └── prestige-system.ts
│   │   │   ├── types/
│   │   │   │   ├── game-state.ts
│   │   │   │   ├── resources.ts
│   │   │   │   ├── player.ts
│   │   │   │   └── actions.ts
│   │   │   └── utils/
│   │   │       ├── big-number.ts    # BigInt/Decimal handling
│   │   │       ├── formulas.ts      # Growth curves, scaling
│   │   │       └── random.ts        # Seeded RNG
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── shared/                      # Shared types + validation
│       ├── src/
│       │   ├── index.ts
│       │   ├── schemas/             # Zod schemas
│       │   │   ├── game-action.ts
│       │   │   ├── player.ts
│       │   │   └── api-response.ts
│       │   ├── constants/
│       │   │   ├── game-config.ts   # Tuning constants
│       │   │   └── enums.ts
│       │   └── types/
│       │       └── index.ts         # Re-exported types
│       ├── tsconfig.json
│       └── package.json
│
├── turbo.json
├── package.json
├── drizzle.config.ts
├── docker-compose.yml
├── biome.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Root package.json

```json
{
  "name": "my-game",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "check": "bunx biome check --write .",
    "db:generate": "bunx drizzle-kit generate",
    "db:migrate": "bunx drizzle-kit migrate",
    "db:studio": "bunx drizzle-kit studio"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  }
}
```

---

## turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## apps/game/package.json

```json
{
  "name": "@my-game/game",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "lint": "bunx biome check ."
  },
  "dependencies": {
    "@my-game/game-engine": "workspace:*",
    "@my-game/shared": "workspace:*",
    "next": "^15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  }
}
```

---

## apps/api/package.json

```json
{
  "name": "@my-game/api",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "lint": "bunx biome check ."
  },
  "dependencies": {
    "@my-game/game-engine": "workspace:*",
    "@my-game/shared": "workspace:*",
    "better-auth": "^1.2.0",
    "drizzle-orm": "^0.38.0",
    "elysia": "^1.2.0",
    "@neondatabase/serverless": "^0.10.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0"
  }
}
```

---

## Elysia API Entry Point

```typescript
// apps/api/src/index.ts
import { Elysia } from 'elysia';
import { gameRoutes } from './routes/game';
import { authRoutes } from './routes/auth';
import { socialRoutes } from './routes/social';
import { wsHandler } from './ws/handler';

const app = new Elysia()
  .use(gameRoutes)
  .use(authRoutes)
  .use(socialRoutes)
  .use(wsHandler)
  .listen(3001);

console.log(`API running at ${app.server?.url}`);
```

---

## Drizzle Schema Example

```typescript
// apps/api/src/db/schema.ts
import { pgTable, text, integer, timestamp, jsonb, serial, bigint } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  level: integer('level').default(1).notNull(),
  experience: bigint('experience', { mode: 'number' }).default(0).notNull(),
  stats: jsonb('stats').$type<{
    strength: number;
    agility: number;
    intelligence: number;
    vitality: number;
  }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resources = pgTable('resources', {
  id: serial('id').primaryKey(),
  characterId: integer('character_id').references(() => characters.id).notNull(),
  type: text('type').notNull(),
  amount: bigint('amount', { mode: 'number' }).default(0).notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  characterId: integer('character_id').references(() => characters.id).notNull(),
  templateId: text('template_id').notNull(),
  slot: text('slot'),
  stats: jsonb('stats').$type<Record<string, number>>(),
  quantity: integer('quantity').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './apps/api/src/db/schema.ts',
  out: './apps/api/src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## Zustand Game Store

```typescript
// apps/game/src/stores/game-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, GameAction } from '@my-game/game-engine';
import { applyAction, tick } from '@my-game/game-engine';

interface GameStore {
  state: GameState;
  lastTick: number;
  dispatch: (action: GameAction) => void;
  runTick: (deltaMs: number) => void;
  loadState: (state: GameState) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      state: initialGameState(),
      lastTick: Date.now(),
      dispatch: (action) =>
        set((s) => ({ state: applyAction(s.state, action) })),
      runTick: (deltaMs) =>
        set((s) => ({ state: tick(s.state, deltaMs), lastTick: Date.now() })),
      loadState: (state) => set({ state, lastTick: Date.now() }),
    }),
    { name: 'game-save' },
  ),
);
```

---

## Game Loop Hook

```typescript
// apps/game/src/hooks/use-game-loop.ts
import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/game-store';

const TICK_RATE = 1000 / 20; // 20 ticks per second

export const useGameLoop = () => {
  const runTick = useGameStore((s) => s.runTick);
  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let frameId: number;

    const loop = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      accumulatorRef.current += delta;

      while (accumulatorRef.current >= TICK_RATE) {
        runTick(TICK_RATE);
        accumulatorRef.current -= TICK_RATE;
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [runTick]);
};
```

---

## WebSocket Handler

```typescript
// apps/api/src/ws/handler.ts
import { Elysia, t } from 'elysia';
import type { GameAction } from '@my-game/game-engine';
import { applyAction, validateAction } from '@my-game/game-engine';

export const wsHandler = new Elysia().ws('/ws/game', {
  body: t.Object({
    type: t.String(),
    payload: t.Unknown(),
  }),
  open(ws) {
    console.log(`Player connected: ${ws.id}`);
  },
  message(ws, message) {
    const action = message as GameAction;
    if (!validateAction(action)) {
      ws.send({ type: 'error', payload: 'Invalid action' });
      return;
    }
    const result = applyAction(getPlayerState(ws.id), action);
    savePlayerState(ws.id, result);
    ws.send({ type: 'state_update', payload: result });
  },
  close(ws) {
    console.log(`Player disconnected: ${ws.id}`);
  },
});
```

---

## Environment Variables

```bash
# .env.example

# Database (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/mydb?sslmode=require

# Auth (Better Auth)
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:3001

# Game Config
GAME_TICK_RATE=50           # Server tick interval (ms)
GAME_SAVE_INTERVAL=30000   # Auto-save interval (ms)
GAME_MAX_OFFLINE_HOURS=24  # Max offline progress hours

# Redis (optional, for multiplayer session cache)
REDIS_URL=redis://localhost:6379

# Public (exposed to client)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws/game
```

---

## Docker Compose

```yaml
# docker-compose.yml
services:
  neon-proxy:
    image: ghcr.io/neondatabase/wsproxy:latest
    environment:
      APPEND_PORT: 5432
      ALLOW_ADDR_REGEX: .*
      LOG_TRAFFIC: true
    ports:
      - '5433:80'
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: game
      POSTGRES_PASSWORD: game
      POSTGRES_DB: game
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

volumes:
  pgdata:
```

For local development, use `docker compose up -d` to start Postgres and Redis,
then run `bun run dev` from the repo root.
