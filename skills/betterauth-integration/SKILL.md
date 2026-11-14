---
name: betterauth-integration
description: >-
  Use when implementing authentication, login flows, OAuth, JWT sessions, or role-based access control (RBAC) for games with BetterAuth. Triggers: auth, login, OAuth, JWT, roles, permissions, RBAC.
---

# BetterAuth Integration

## Purpose

Auth flows, session management, OAuth, JWT, RBAC for game players/admins/mods using BetterAuth with Elysia + Drizzle ORM.

## When to Use

Trigger: auth, authentication, login, signup, OAuth, JWT, session, RBAC, roles, permissions, player auth, admin auth, moderator, BetterAuth

## Prerequisites

- `postgres-game-schema` (for user tables)

## Core Principles

> "Security is not a feature. It's a foundation." — OWASP
> "Trust is the currency of multiplayer games." — Raph Koster

1. **Auth is not optional** — every game endpoint must be authenticated
2. **Role-based access: player, moderator, admin** with escalating privileges
3. **Session tokens over JWTs for web games** — stateful > stateless for games (revocable, server-controlled)
4. **OAuth for social login** — Discord, Google, GitHub, Twitch are standard for gamers
5. **Rate limit auth endpoints aggressively** — prevent brute force and credential stuffing
6. **Never store passwords** — BetterAuth handles hashing with bcrypt/argon2
7. **Separate game sessions from auth sessions** — auth session = "who you are", game session = "what room you're in"

## Step-by-Step Instructions

### 1. Install Dependencies

```bash
bun add better-auth drizzle-orm @neondatabase/serverless
bun add -d drizzle-kit @types/bun
```

### 2. Configure BetterAuth

Create the auth instance with Drizzle adapter, OAuth providers, and custom user fields. See `boilerplate/auth-setup.ts` for the complete configuration.

### 3. Add Auth Middleware to Elysia

Mount the BetterAuth handler and add session/role middleware to your Elysia app. See `boilerplate/auth-middleware.ts` for `requireAuth`, `requireRole`, and `optionalAuth` patterns.

### 4. Define Roles and Permissions

Set up the RBAC system with role enums and permission maps. See `templates/role-definitions.ts` for the full type definitions and permission matrix.

### 5. Mount Auth Routes

Add standard auth routes (signup, login, logout, OAuth, session, admin). See `templates/auth-routes.ts` for the route patterns.

### 6. Generate Auth Tables

BetterAuth manages its own tables. Run migrations after setup:

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

### 7. Protect Game Endpoints

Apply middleware to all game routes:

```typescript
import { requireAuth, requireRole } from './auth-middleware';

app
  .use(requireAuth)
  .get('/api/game/state', ({ user }) => getGameState(user.id))
  .use(requireRole('admin'))
  .delete('/api/game/reset', () => resetGame());
```

## Code Examples

### Basic auth check in a route

```typescript
import { auth } from './auth-setup';

app.get('/api/me', async ({ headers }) => {
  const session = await auth.api.getSession({ headers });
  if (!session) return { error: 'Not authenticated' };
  return { user: session.user };
});
```

### Protecting a WebSocket connection

```typescript
// Validate session before upgrading to WebSocket
app.ws('/ws', {
  async beforeHandle({ headers }) {
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error('Unauthorized');
  },
  // ... ws handlers
});
```

### Checking role before an action

```typescript
import { hasPermission } from './role-definitions';

app.delete('/api/players/:id/ban', async ({ user, params }) => {
  if (!hasPermission(user.role, 'users', 'ban')) {
    return { error: 'Insufficient permissions' };
  }
  await banPlayer(params.id, user.id);
  return { banned: true };
});
```

See `boilerplate/auth-setup.ts` and `boilerplate/auth-middleware.ts` for full implementation patterns.

## Cross-References

- `postgres-game-schema` for user/player table schemas
- `game-backend-architecture` for Elysia server setup and route structure
- `redis-game-patterns` for session caching and rate limiting
- `stripe-game-payments` for authenticated payment flows

## Pitfalls & Anti-Patterns

- **Don't roll your own password hashing** — BetterAuth handles this with battle-tested algorithms; never store plaintext or MD5
- **Don't use JWTs as the sole session mechanism for web games** — they can't be revoked server-side; use BetterAuth's session tokens with cookie storage
- **Don't skip rate limiting on auth endpoints** — `/auth/login` and `/auth/signup` are prime brute force targets; limit to 5-10 attempts per minute
- **Don't store roles in the JWT/token** — always fetch the current role from the database to ensure role changes take effect immediately
- **Don't use a single "admin" boolean** — use a proper role enum (player/moderator/admin) so permissions can be granularly assigned
- **Don't mix auth sessions with game sessions** — a player can be logged in (auth session) without being in a match (game session); these are separate concerns
- **Don't trust client-sent user IDs** — always derive the user identity from the server-validated session, never from request body/params
- **Don't forget CORS configuration** — OAuth redirects and cookie-based sessions require correct origin settings

## Designer Philosophy

Security enables trust; trust enables social gameplay. When players know their accounts are safe, they invest more in the game — socially, economically, and emotionally. Authentication is invisible when done right: players log in once, stay logged in, and never think about it again. Every friction point in auth is a player lost.

## Sources

- [BetterAuth Documentation](https://www.better-auth.com/docs)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Elysia Documentation](https://elysiajs.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
