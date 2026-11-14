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
3. Pass `staffGuard` from `templates/staff-guard.ts` (read when you give moderators ban or session powers) as `hooks: { before: staffGuard }`. Better Auth takes one `before` hook; if the project has one already, call `guardStaffTargets(ctx)` inside it.
4. Do not add a `role` field through `additionalFields`. The admin plugin adds `role` (plus `banned`, `banReason`, `banExpires`) to the user table.
5. Generate the auth schema, then migrate it with Drizzle Kit. Better Auth's `migrate` command works only with its built-in Kysely adapter.

   ```bash
   bunx auth@latest generate
   bunx drizzle-kit generate
   bunx drizzle-kit migrate
   ```

6. Mount the Better Auth handler in the game server and guard routes. For Elysia, follow https://www.better-auth.com/docs/integrations/elysia, and use the `elysiajs` skill if it is installed for the Elysia version the project runs.

## Role matrix

| Role | May do |
|---|---|
| player | join and create matches, send chat, file reports |
| moderator | player actions; list and view users; ban, unban and revoke all sessions of players only; end matches, delete chat, read and resolve reports, read game config and analytics |
| admin | every admin-plugin action (including changing roles), every game action, update game config |

- The admin plugin's endpoints check its own `user` and `session` resources. Unban checks `user: ['ban']`. Changing a role checks `user: ['set-role']`.
- Moderators act on players only. The admin plugin's endpoints check the caller's permission, never the target's role, so a moderator with `user: ['ban']` could ban an admin. `staffGuard` denies by default: on every `/admin/*` path outside its allow list (`list-users`, `get-user`, `has-permission`, `stop-impersonating`), a caller who is not an admin must name a target user, and the target must not be a moderator or admin. It reads the target only from the field each endpoint reads (`sessionToken` for `revoke-user-session`, `userId` for the rest), coerces `userId` the way the endpoints do, and rejects a request whose target it cannot find.
- Do not give moderators `session: ['list']`. `/admin/list-user-sessions` returns each session's token, and a token is a login. Moderators revoke a player's sessions with `/admin/revoke-user-sessions`, which needs only `session: ['revoke']`.
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
- Giving moderators admin-plugin permissions without `staffGuard`. They can then ban or log out admins and each other.
- Upgrading Better Auth without reviewing `staffGuard`. It denies by default, but its allow list and its reading of `userId` and `sessionToken` match 1.7.23. Check both against any admin endpoint a new version adds.
- Forgetting `trustedOrigins` and CORS when the game client runs on another origin. Better Auth rejects auth requests from origins it does not trust.

## Related skills

- `postgres-game-schema` for the player tables that reference the auth user
- `game-backend-architecture` for the server and the WebSocket endpoint
- `redis-game-patterns` for game session state
- `stripe-game-payments` for payments tied to an authenticated player

## Reference files

Read `references/sources.md` when you need the documentation page behind a claim in this skill.
