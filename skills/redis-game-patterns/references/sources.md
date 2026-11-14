# Sources

Each line: source, URL, what it supports, date checked.

- ioredis README (redis/ioredis, main) - https://github.com/redis/ioredis/blob/main/README.md - supports: "For new projects, node-redis is the recommended client library."; a connection "can't play both roles" of subscriber and command client, so create a separate connection; RESP3 is the default protocol and `replyMapping: "legacy"` (default) returns RESP2-compatible shapes - checked 2026-11-14
- ioredis 6.0.0 published types (`built/Redis.d.ts`, `built/utils/RedisCommander.d.ts`) - https://unpkg.com/ioredis@6.0.0/built/utils/RedisCommander.d.ts - supports: `Redis` defaults to `"legacy"` mapping; `zrange(..., "REV", "WITHSCORES")` returns `string[]` under that mapping; `stop` is typed `string | Buffer` - checked 2026-11-14
- BullMQ docs, "Connections" - https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/connections.md - supports: "By default, BullMQ creates Redis connections with ioredis"; adapters exist for ioredis, node-redis, Bun's Redis client and Valkey GLIDE - checked 2026-11-14
- BullMQ 6.7.6 package.json - https://unpkg.com/bullmq@6.7.6/package.json - supports: ioredis is an optional peer dependency - checked 2026-11-14
- Redis docs, "Redis sorted sets" - https://redis.io/docs/latest/develop/data-types/sorted-sets/ - supports: sorted sets maintain ordered lists of the highest scores in a massive online game (leaderboards) - checked 2026-11-14
- Redis docs, ZADD - https://redis.io/docs/latest/commands/zadd/ - supports: `GT` only updates when the new score is greater; equal scores are ordered lexicographically; doubles represent integers exactly between -(2^53) and +(2^53) - checked 2026-11-14
- Redis docs, ZRANGE - https://redis.io/docs/latest/commands/zrange/ - supports: `REV` returns high to low with ties in reverse lexicographic order; since 6.2.0 ZRANGE replaces ZREVRANGE - checked 2026-11-14
- Redis docs, ZREVRANGE - https://redis.io/docs/latest/commands/zrevrange/ - supports: deprecated as of Redis 6.2.0 - checked 2026-11-14
- Redis docs, ZREVRANK - https://redis.io/docs/latest/commands/zrevrank/ - supports: rank is 0-based with the highest score at 0; nil when the member is absent - checked 2026-11-14
- Redis docs, EXPIRE - https://redis.io/docs/latest/commands/expire/ - supports: the timeout is cleared by commands that overwrite the key, including SET - checked 2026-11-14
- Redis docs, "Transactions" - https://redis.io/docs/latest/develop/using-commands/transactions/ - supports: a request from another client is never served in the middle of a MULTI/EXEC; WATCH aborts EXEC (null reply) when a watched key changed - checked 2026-11-14
- Redis docs, "Redis Pub/sub" - https://redis.io/docs/latest/develop/pubsub/ - supports: at-most-once delivery, a disconnected subscriber loses the message; a subscribed RESP2 client may only issue subscribe-family commands; Pub/Sub ignores database numbers, so prefix channels with the environment - checked 2026-11-14
