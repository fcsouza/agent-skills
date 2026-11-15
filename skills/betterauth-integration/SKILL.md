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
2. Add the admin plugin with the game roles from `templates/role-definitions.ts`: `admin({ ac, roles, defaultRole: 'player' })` on the server and `adminClient({ ac, roles })` on the client. Without `defaultRole: 'player'`, new users get the plugin's default role `user`, which the game matrix does not define, and every permission check fails.
3. Add the `staffGuard()` plugin from `templates/staff-guard.ts` after `admin()`: `plugins: [admin({ ... }), staffGuard()]`. A plugin hook does not take the single user-level `hooks.before` slot, and its place relative to `bearer()` does not matter. If a project must call `guardStaffTargets(ctx)` from its own `hooks.before` instead, `await` it as the first statement, do not catch its error, and do not rewrite the body of `/admin/*` requests in any hook.
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
- Moderators act on players only. The admin plugin's endpoints check the caller's permission, never the target's role, so a moderator with `user: ['ban']` could ban an admin. `staffGuard` denies by default: on every `/admin/*` path outside its allow list (`list-users`, `get-user`, `has-permission`, `stop-impersonating`), a caller who is not an admin must name a target user whose every role is `player` (no role counts as the plugin's `defaultRole`). Any other role, a new staff role included, is refused.
- The guard decides who is an admin the way the plugin does. It reads the caller from the session store, not the cookie cache, so a demotion takes effect at once. It splits roles on commas without trimming. It treats ids in the plugin's `adminUserIds` as admins when they call and as staff when they are the target. It reads a bearer-token caller the way the endpoint will.
- The guard reads the target only from the field each endpoint reads (`sessionToken` for `revoke-user-session`, `userId` for the rest), coerces `userId` the way the endpoints do, and rejects a request whose target it cannot find. Server code that calls `auth.api.createUser({ body })` with no headers passes, as the plugin allows.
- Hooks run for `auth.api.*` calls but not for writes through `internalAdapter`. Game code that acts on another user calls `auth.api.*` with the acting moderator's own request headers, never with an admin or service session and never through `internalAdapter`, or it applies the same player-only target check itself.
- Do not give moderators `session: ['list']`. `/admin/list-user-sessions` returns each session's token, and a token is a login. Moderators revoke a player's sessions with `/admin/revoke-user-sessions`, which needs only `session: ['revoke']`.
- `user.role` holds a comma-separated list when a user has several roles. `rolesOf` in `role-definitions.ts` splits it without trimming, as the plugin does, and treats a missing role as `defaultRole`. `can()` and `staffGuard` both use it, so the two never read a role differently. Pass `can()` the same `defaultRole` you gave the plugin (it defaults to `player`).
- If the project adds user fields with `returned: false`, a moderator can still test their values through the `filterField` query of `/admin/list-users`.
- Check a permission with `can(session.user.role, { chat: ['delete'] })` when you already hold the session, or with `auth.api.userHasPermission({ body: { userId, permissions } })` when you only have the id.
- Ownership is not a role. A player edits their own profile or inventory because the session user id equals the owner id. Check that separately: `session.user.id === ownerId`.
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

Browsers send `Origin` on every WebSocket upgrade, so they are checked by `Origin` plus the session cookie. Native clients (the `game-godot` and `game-unity` skills) send no `Origin`: RFC 6455 says only browser clients must send `Origin` (section 4.1), and that the check is not meant to keep non-browsers out (section 10.2). Check them by a bearer session instead: a request with no `Origin` passes only with `Authorization: Bearer <token>` that `getSession` accepts, and is 403 otherwise. A client-set `Origin` proves nothing, so an untrusted `Origin` is 403 even with a valid token. `game-backend-architecture` has this as `authorizeUpgrade` in its server boilerplate.

This needs the `bearer()` plugin. In 1.7.23 it is `import { bearer } from 'better-auth/plugins'` and `plugins: [admin({ ... }), staffGuard(), bearer({ requireSignature: true })]`. The plugin reads `Authorization: Bearer <token>` in a before hook, also for `auth.api.getSession({ headers })`, and turns a valid token into the session cookie for that call. Sign-in and sign-up responses carry the token in the `set-auth-token` header. `requireSignature: true` refuses an unsigned token; that is this skill's choice, since the header gives the signed value (default `false`).

`bearer()` is app-wide, and it changes two things for web clients. First, every response that sets the session cookie, a browser sign-in included, also returns the token in a `set-auth-token` header and adds that header to `Access-Control-Expose-Headers`. Page JavaScript can read it, unlike the httpOnly cookie, so an XSS bug would hand over a reusable session token. Web clients must never read or store `set-auth-token`. Second, every Better Auth route now accepts `Authorization: Bearer` with no `Origin`, so a stolen token works on every route. CSRF is unchanged: a cross-site page cannot send that header without a preflight. The plugin has one option, `requireSignature`. It cannot limit which routes send the header or which clients get it, so keep the token out of web code and protect it where it is stored.

The bearer token is a session credential: whoever holds it is logged in as the player. A native client keeps it in the OS secure store (Keychain on iOS and macOS, Android Keystore, or the platform's credential store on desktop; this skill's rule, the plugin docs only say "store this token securely"). It never goes in a URL or query string, and never in a log, crash report or analytics event. Send it only in the `Authorization` header. The server reads it from that header alone.

## Pitfalls

- Trusting a user id or role sent by the client.
- Trusting `Origin` to identify a native client, or taking a session token from the query string.
- Reading the role from a token issued at login. Read it from the current session so a demotion or ban takes effect.
- A single `isAdmin` boolean instead of roles.
- Leaving rate limits at their defaults for a public game. Better Auth's built-in limiter applies only to client requests, not to `auth.api` calls made by the server.
- Giving moderators admin-plugin permissions without `staffGuard()`. They can then ban or log out admins and each other.
- Upgrading Better Auth without reviewing `staffGuard`. It denies by default, but its allow list, its reading of `userId` and `sessionToken`, and its bearer handling match 1.7.23. Check both against any admin endpoint a new version adds.
- Turning a custom header into the session cookie in another hook. `staffGuard` reads the caller only from cookies or `bearer()`, so it refuses those callers until you replay that hook the way it replays `bearer()`.
- Cookie-only (stateless) deployments with no database. There the caller's role comes from the cookie, so a demotion takes effect only when the cookie cache expires.
- Forgetting `trustedOrigins` and CORS when the game client runs on another origin. Better Auth rejects auth requests from origins it does not trust.

## Files

- `templates/role-definitions.ts`: read when you set up roles or add a game permission.
- `templates/staff-guard.ts`: read when you give moderators ban or session powers.
- `references/sources.md`: read when you need the documentation page behind a claim in this skill.

## Related skills

- `postgres-game-schema` for the player tables that reference the auth user
- `game-backend-architecture` for the server and the WebSocket endpoint
- `redis-game-patterns` for game session state
- `stripe-game-payments` for payments tied to an authenticated player
