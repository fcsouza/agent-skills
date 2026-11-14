---
name: betterauth-integration
description: >-
  Covers the game-specific layer of Better Auth: player, moderator and admin roles, session checks on game routes and WebSocket handshakes, and keeping the auth session apart from the game session. Use when a game needs player login, moderator or admin powers, or authenticated real-time connections, and the project uses Better Auth.
---

# Better Auth for games

Use the `better-auth-best-practices` skill if it is installed, otherwise https://www.better-auth.com/docs. This skill covers only what a game adds on top: the role matrix, the WebSocket handshake, and the split between who a player is and which match they are in.

## Requires

- `postgres-game-schema`

## Decisions

1. Every game endpoint and every WebSocket connection checks a Better Auth session. Derive the user id from the session, never from the request body or params.
2. Use Better Auth sessions, not JWTs, for players. A session lives in the database, so a ban or logout revokes it.
3. Use three roles: player, moderator, admin. They come from the admin plugin, not from a custom user field.
4. Keep the auth session ("who you are") apart from the game session ("which match or room you are in"). A logged-in player may be in no match.
5. Do not write password hashing. Better Auth hashes passwords with scrypt.

## Setup steps

1. Install the packages: `bun add better-auth @better-auth/drizzle-adapter`. Import the adapter with `import { drizzleAdapter } from '@better-auth/drizzle-adapter'`. If the project uses Drizzle Relations v2, import from `@better-auth/drizzle-adapter/relations-v2` instead.
2. Add the admin plugin with the game roles from `templates/role-definitions.ts` (read when you set up roles or add a game permission): `admin({ ac, roles, defaultRole: 'player' })` on the server and `adminClient({ ac, roles })` on the client. Without `defaultRole: 'player'`, new users get the plugin's default role `user`, which the game matrix does not define, and every permission check fails.
3. Do not add a `role` field through `additionalFields`. The admin plugin adds `role` (plus `banned`, `banReason`, `banExpires`) to the user table.
4. Generate the auth schema, then migrate it with Drizzle Kit. Better Auth's `migrate` command works only with its built-in Kysely adapter.

   ```bash
   bunx auth@latest generate
   bunx drizzle-kit generate
   bunx drizzle-kit migrate
   ```

5. Mount the Better Auth handler in the game server and guard routes. For Elysia, follow https://www.better-auth.com/docs/integrations/elysia, and use the `elysiajs` skill if it is installed for the Elysia version the project runs.

## Role matrix

| Role | May do |
|---|---|
| player | join and create matches, send chat, file reports |
| moderator | player actions; list and view users, ban and unban, list and revoke sessions, end matches, delete chat, read and resolve reports, read game config and analytics |
| admin | every admin-plugin action (including changing roles), every game action, update game config |

- The admin plugin's endpoints check its own `user` and `session` resources. Unban checks `user: ['ban']`. Changing a role checks `user: ['set-role']`.
- `user.role` holds a comma-separated list when a user has several roles. The `can()` helper in the template splits it.
- Check a permission with `can(session.user.role, { chat: ['delete'] })` when you already hold the session, or with `auth.api.userHasPermission({ body: { userId, permissions } })` when you only have the id.
- Ownership is not a role. A player edits their own profile or inventory because the session user id equals the owner id. Check that separately (`isOwner` in the template).
- A ban through the admin plugin stops sign-in and revokes all of the player's sessions. The game server must close that player's open sockets itself, because the handshake check ran only once.

## WebSocket handshake

Validate the session once, when the client upgrades the connection, from the upgrade request's headers.

```typescript
const session = await auth.api.getSession({
  headers: request.headers,
  query: { disableCookieCache: true },
});
if (!session) return new Response('Unauthorized', { status: 401 });
// Store session.user.id and session.user.role on the socket; never read them from client messages.
```

`disableCookieCache: true` makes the server read the session from the database. With `session.cookieCache` enabled and no such flag, a revoked session can pass until the cache cookie expires.

A direct `auth.api` call skips Better Auth's origin checks, even with the browser's headers. Reject an upgrade whose `Origin` header is not in your trusted origins before you read the session.

## Pitfalls

- Trusting a user id or role sent by the client.
- Reading the role from a token issued at login. Read it from the current session so a demotion or ban takes effect.
- A single `isAdmin` boolean instead of roles.
- Leaving rate limits at their defaults for a public game. Better Auth's built-in limiter applies only to client requests, not to `auth.api` calls made by the server.
- Forgetting `trustedOrigins` and CORS when the game client runs on another origin. Better Auth rejects auth requests from origins it does not trust.

## Related skills

- `postgres-game-schema` for the player tables that reference the auth user
- `game-backend-architecture` for the server and the WebSocket endpoint
- `redis-game-patterns` for game session state
- `stripe-game-payments` for payments tied to an authenticated player

## Reference files

Read `references/sources.md` when you need the documentation page behind a claim in this skill.
