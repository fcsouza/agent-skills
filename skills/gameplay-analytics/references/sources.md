# Sources

Pages behind the Redis and PostgreSQL behaviour the boilerplate and queries rely on. The game-specific rules (event taxonomy, ordered funnels, session keys, cohort definition) are design decisions of this skill, tested on PostgreSQL 16; they cite no outside authority.

- Redis, "LPUSH" (Redis docs) - https://redis.io/docs/latest/commands/lpush/ - supports: LPUSH inserts at the head, so the oldest buffered events sit at the tail ("Insert all the specified values at the head of the list stored at key") - checked 2026-11-14
- Redis, "LRANGE" (Redis docs) - https://redis.io/docs/latest/commands/lrange/ - supports: negative offsets read from the tail ("-1 is the last element of the list, -2 the penultimate") - checked 2026-11-14
- Redis, "LTRIM" (Redis docs) - https://redis.io/docs/latest/commands/ltrim/ - supports: trimming with a negative stop keeps the head and drops the tail ("start and stop can also be negative numbers indicating offsets from the end of the list") - checked 2026-11-14
- PostgreSQL, "9.9. Date/Time Functions and Operators" (PostgreSQL docs) - https://www.postgresql.org/docs/current/functions-datetime.html - supports: "date + integer → date" adds days and stays a date, while "date + interval → timestamp"; `AT TIME ZONE` converts a timestamp with time zone to the wall time in a named zone - checked 2026-11-14
- PostgreSQL, "8.5. Date/Time Types" (PostgreSQL docs) - https://www.postgresql.org/docs/current/datatype-datetime.html - supports: zone-aware values are shown in the session `TimeZone` ("converted to local time in the zone specified by the TimeZone configuration parameter"), which is why queries use UTC explicitly - checked 2026-11-14
