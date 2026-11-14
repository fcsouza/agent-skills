# Sources

Code checked against the versions pinned in the repo's root `package.json`: `elysia` 1.4.32, `@elysiajs/cors` 1.4.3, `better-auth` 1.7.23, `ioredis` 6.0.0.

## Game architecture

- Glenn Fiedler, "Fix Your Timestep!" (Gaffer On Games) - https://gafferongames.com/post/fix_your_timestep/ - supports: the accumulator loop ("the renderer produces time and the simulation consumes it in discrete dt sized steps"), the spiral of death ("being behind causes your update to simulate more steps to catch up, which causes you to fall further behind"), the frame-time clamp in the final example (`if ( frameTime > 0.25 ) frameTime = 0.25;`), and reproducible results from a fixed dt - checked 2026-11-14
- Gabriel Gambetta, "Fast-Paced Multiplayer (Part I): Client-Server Game Architecture" (gabrielgambetta.com) - https://www.gabrielgambetta.com/client-server-game-architecture.html - supports: server authority ("the one and only authority regarding everything that happens in the world is the server"; "don't trust the player"), clients send intentions, not results - checked 2026-11-14

## Elysia

- Elysia, "Extends Context" (Elysia docs) - https://elysiajs.com/patterns/extends-context - supports: "store is a representation of a single-source-of-truth global mutable object for the entire Elysia app"; "derive is assigned once a new request starts"; "If error is returned from derive, Elysia will return early exit and return the error as response." A run against 1.4.32 confirmed the early exit on a WebSocket route (403 and 401, no upgrade) - checked 2026-11-14
- Elysia, "Lifecycle" (Elysia docs) - https://elysiajs.com/essential/life-cycle - supports: "Unlike state and decorate, properties assigned by derive are unique and not shared with other requests" - checked 2026-11-14
- Elysia, "WebSocket" (Elysia docs) - https://elysiajs.com/patterns/websocket - supports: `.ws(path, { body, open, message, close })`; context is read from `ws.data` - checked 2026-11-14
- Elysia, "Mount" (Elysia docs) - https://elysiajs.com/patterns/mount - supports: `.mount()` takes a handler that uses Request and Response - checked 2026-11-14
- Elysia, "CORS Plugin" (Elysia docs) - https://elysiajs.com/plugins/cors - supports: `origin` accepts an array ("Array<string | RegExp | Function> - iterate through all cases above in order"); the 1.4.3 types declare `origin?: Origin | boolean | Origin[]` - checked 2026-11-14
- Elysia, "Elysia 2 beta - DayDream" (Elysia blog, 2026) - https://elysiajs.com/blog/elysia-20 - supports: "WebSocket is now an opt-in feature"; "ws.data is now inline to ws directly"; "It's not a stable release yet." - checked 2026-11-14

## Better Auth

- Better Auth, "Elysia Integration" (Better Auth docs) - https://www.better-auth.com/docs/integrations/elysia - supports: "We need to mount the handler to Elysia endpoint."; CORS through `@elysiajs/cors` with `credentials: true` - checked 2026-11-14
- Better Auth, "Basic Usage" (Better Auth docs) - https://www.better-auth.com/docs/basic-usage - supports: "It requires request headers object to be passed to the `getSession` method." - checked 2026-11-14
- Better Auth, "Session Management" (Better Auth docs) - https://www.better-auth.com/docs/concepts/session-management - supports: `disableCookieCache:true` "will force the server to fetch the session from the database"; "When `cookieCache` is enabled, revoked sessions may remain active on other devices until the cookie cache expires" - checked 2026-11-14
- Better Auth, "Security" (Better Auth docs) - https://www.better-auth.com/docs/reference/security - supports: "A direct `auth.api` call skips them, even when you pass the browser's headers."; extra origins go in `trustedOrigins` - checked 2026-11-14
- Better Auth, "Admin" (Better Auth docs) - https://www.better-auth.com/docs/plugins/admin - supports: a ban prevents sign-in "and revokes all of their existing sessions" - checked 2026-11-14

## Redis

- Redis, "Redis Pub/sub" (Redis docs) - https://redis.io/docs/latest/develop/pubsub/ - supports: "Redis' Pub/Sub exhibits at-most-once message delivery semantics." - checked 2026-11-14
- ioredis, README (ioredis 6.0.0 on unpkg) - https://unpkg.com/ioredis@6.0.0/README.md - supports: a connection in subscriber mode accepts only subscribe-family commands, `ping` and `quit`; "If you want to do pub/sub in the same file/process, you should create a separate connection"; a URL string connects (`new Redis("redis://:authpassword@127.0.0.1:6380/4")`) - checked 2026-11-14
- IETF RFC 6455, "The WebSocket Protocol" - https://www.rfc-editor.org/rfc/rfc6455 - supports: "The WebSocket Protocol is an independent TCP-based protocol"; "Message fragments MUST be delivered to the recipient in the order sent by the sender" - checked 2026-11-14
- IETF RFC 9293, "Transmission Control Protocol (TCP)" - https://www.rfc-editor.org/rfc/rfc9293 - supports: "TCP provides a reliable, in-order, byte-stream service to applications." (why previous-tick deltas are safe over WebSocket) - checked 2026-11-14
- Elysia 1.4.32 published source, `dist/ws/index.mjs` and `dist/ws/index.d.ts` - https://unpkg.com/elysia@1.4.32/dist/ws/index.d.ts - supports: `ElysiaWS` exposes `get id(): string`, which returns `this.data.id`; `dist/adapter/bun/index.mjs` fills that id with `randomId()` on upgrade (the per-connection id `removePlayerFromAllRooms` compares); `dist/index.d.ts` re-exports `Static` from `@sinclair/typebox` - checked 2026-11-14
