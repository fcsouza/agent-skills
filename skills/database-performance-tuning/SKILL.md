---
name: database-performance-tuning
description: "Diagnose and fix slow databases the way a DBA does — measure first, read the plan, then change one thing. Use this skill whenever a query, endpoint, job or report is slow, times out, or got slower after a deploy; whenever someone asks about indexes (missing, unused, duplicate, composite order, partial, covering, GIN/BRIN), EXPLAIN or query plans, seq scans, N+1 queries, slow pagination, table or index bloat, autovacuum, VACUUM, ANALYZE, stale statistics, connection or lock pileups, high CPU/IO on the database, partitioning, or a migration that locked a table. Also trigger on Portuguese phrasings: 'query lenta', 'consulta lenta', 'banco lento', 'timeout no banco', 'falta índice', 'criar índice', 'travou a tabela', 'lock', 'vacuum', 'plano de execução'. Postgres is the core; MySQL/InnoDB is covered in references/mysql.md. Use it even when the user just says 'this page is slow' and the data comes from a database — the first job of this skill is to find out whether the database is actually the problem."
---

# Database Performance Tuning

You are the database engineer on call. Someone says "it's slow". Your job is to turn
that into a number, find where the time goes, change the smallest thing that moves the
number, and prove it moved.

## Boundary with other skills

- This skill: **why is it slow and what do I change** — measurement, plans, indexes,
  rewrites, vacuum, bloat, safe rollout.
- `postgresql-optimization`: Postgres **features** — JSONB operators, arrays, ranges,
  full-text search, window functions. Reach for it when the question is "how do I express
  this in Postgres", not "why is this slow".
- `postgres-game-schema`, `neon-postgres`, `supabase`: schema design and platform
  specifics. If the fix is a new index or a rewrite, stay here.

## The loop

Measure → get the plan → classify → change one thing → verify. Skipping straight to
"add an index" is the single most common way to make a database slower: every index costs
write throughput, bloats WAL, and slows vacuum. Earn each one.

### 0. Establish the ground truth before anything else

Facts in this domain are version-gated. Column names, EXPLAIN options and planner
behaviour all changed in recent majors, so the first thing you run is:

```sql
SELECT version();
SELECT name, setting FROM pg_settings
WHERE name IN ('shared_buffers','work_mem','effective_cache_size',
               'random_page_cost','track_io_timing','max_parallel_workers_per_gather');
SELECT extname, extversion FROM pg_extension;
```

Write the major version down and keep it in mind for the rest of the session. If
`pg_stat_statements` is not installed you are flying blind — say so and ask before
installing it, since it needs `shared_preload_libraries` and a restart.

Version notes you will actually trip over (checked against the PostgreSQL 18 manual,
which is `docs/current` as of August 2026):

| Thing | Rule |
| --- | --- |
| `pg_stat_statements.total_exec_time` | PG 13+. Older servers call it `total_time`. |
| `shared_blk_read_time` / `shared_blk_write_time` | PG 17+. PG 16 and older call them `blk_read_time` / `blk_write_time`. |
| `local_blk_read_time`, `stats_since`, `minmax_stats_since` | PG 17+. |
| `wal_buffers_full`, `parallel_workers_to_launch`, `parallel_workers_launched` | PG 18+. |
| `EXPLAIN (ANALYZE)` includes buffers automatically | PG 18+. On PG 17 and older you must write `EXPLAIN (ANALYZE, BUFFERS)`. |
| `EXPLAIN (SERIALIZE, MEMORY)` | PG 17+. |
| `EXPLAIN (GENERIC_PLAN)` | PG 16+. |
| B-tree skip scan (leading column can be omitted) | PG 18+. On older majors a composite index is unusable without its leading column. |

When you are unsure whether a feature exists on the server in front of you, ask the
server rather than guessing — `\d pg_stat_io`, `SELECT ... FROM pg_extension`, or read
the manual for that exact major.

### 1. Find where the time actually goes

Run the bundled read-only diagnostic instead of hand-rolling the queries — it adapts its
SQL to the server version and covers the whole picture in one pass:

```bash
<skill-dir>/scripts/pg-diagnose.sh "$DATABASE_URL"
```

`<skill-dir>` is the base directory printed when this skill loads — the script lives
next to this file, not in the user's project. Options go before the connection string
(`-n 30` for more rows per section, `-q` to skip the pg_stat_statements sections).

It reports: top statements by total and by mean time, cache hit ratios, tables taking
sequential scans, unused and duplicate and invalid indexes, dead-tuple and autovacuum lag,
bloat estimates, and current blocking locks. Read
[references/diagnose-postgres.md](references/diagnose-postgres.md) when you need to go
past what the script prints, or to interpret what it printed.

Rank by **total time**, not by mean. A 5 ms query called two million times an hour costs
more than a 3-second report run once. Both matter, but they get different fixes.

### 2. Get the real plan

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT TEXT) <query>;
```

`ANALYZE` executes the statement. Wrap writes in a transaction you roll back, and never
run it against production on a statement whose side effects you have not read.

Read the plan bottom-up and look at three things per node: the ratio between estimated
and actual rows, the buffers, and `loops`. `actual time` is per loop — multiply it out
before you believe a node is cheap. [references/explain-plans.md](references/explain-plans.md)
has the node-by-node reading guide and the red flags.

### 3. Classify before you fix

Match the symptom to the cause. Most slow queries are one of these:

| Symptom in the plan | Likely cause | Where to go |
| --- | --- | --- |
| Seq Scan on a large table with a selective filter | missing or unusable index | [index-design](references/index-design.md) |
| Index Scan present but still slow, high heap buffers | index not covering, or high correlation loss | [index-design](references/index-design.md) |
| Estimated rows off by 10x or more | stale or insufficient statistics, correlated columns | [maintenance](references/maintenance.md) |
| Filter discards most rows (`Rows Removed by Filter`) | predicate not sargable, or wrong column order | [query-rewrites](references/query-rewrites.md) |
| Nested Loop with a huge `loops` count | bad row estimate upstream, or an N+1 from the app | [query-rewrites](references/query-rewrites.md) |
| Sort or Hash spilling to disk (`Sort Method: external merge`) | `work_mem` too low for this shape | [maintenance](references/maintenance.md) |
| Same query fast on a fresh copy, slow in prod | bloat, or a plan flip from parameter sniffing | [maintenance](references/maintenance.md) |
| Query waits, plan itself is fine | lock contention | [diagnose-postgres](references/diagnose-postgres.md) |

Say out loud which one you picked and what evidence picked it. If two fit, you have not
measured enough yet.

### 4. Change one thing

One index, or one rewrite, or one setting — never a batch. A batch that improves things
teaches you nothing about which part did it, and a batch that regresses is hard to unwind.

Every index change on a live system goes through
[references/apply-safely.md](references/apply-safely.md): `CREATE INDEX CONCURRENTLY`,
a `lock_timeout`, a rollback path, and the `prod-api-safety` protocol before the first
write. `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, does two table
scans, and leaves an `INVALID` index behind if it fails — that reference covers the
cleanup.

Before adding an index, check that an existing one cannot be extended instead. Two
indexes on `(a)` and `(a, b)` mean the first is usually dead weight.

### 5. Verify with the same number you started with

Re-run the exact measurement from step 1 and put the before and after side by side:

```
tenant dashboard query
  before: 1,240 ms mean, 38,400 shared blocks read, Seq Scan on orders
  after:    12 ms mean,     41 shared blocks read, Index Scan using orders_tenant_created_idx
  index:  orders (tenant_id, created_at DESC) — 240 MB, built CONCURRENTLY in 4m12s
```

Report writes too, not just the read you fixed: an index that made a report 100x faster
and inserts 20% slower is a trade, and the person paying for it should see both sides.
`SELECT pg_stat_statements_reset()` before an after-measurement, and note that you did.

Never report an improvement you have not re-measured on the same workload. A faster
`EXPLAIN ANALYZE` on a warm cache is not a production win.

## Standing rules

- **Read-only until proven otherwise.** Diagnosis never needs write access. Connect with a
  read-only role, or `SET default_transaction_read_only = on`, and keep it that way until
  you have a specific change to apply.
- **The database may not be the problem.** Check whether the time is in the query, the
  round trips, the connection pool, or serialization to the client. `EXPLAIN (SERIALIZE)`
  on PG 17+ tells you how much is output conversion.
- **Never `SET` a global on a live server to test a hypothesis.** Use a session-level
  `SET` in your own connection, or `EXPLAIN` with the setting changed locally.
- **Don't trust a plan from a different data distribution.** Staging with 10k rows will
  happily choose a plan production would never pick.
- **`ANALYZE` after any bulk load or big migration**, before you judge anything.

## References

Read the one that matches what you are doing. They are written to be opened mid-task.

| File | Read it when |
| --- | --- |
| [references/diagnose-postgres.md](references/diagnose-postgres.md) | Collecting evidence: pg_stat_statements, table and index stats, waits, locks, connections, bloat. |
| [references/explain-plans.md](references/explain-plans.md) | Reading an EXPLAIN output node by node and spotting the red flags. |
| [references/index-design.md](references/index-design.md) | Choosing the index: column order, partial, covering, expression, GIN/GiST/BRIN/hash, and when not to. |
| [references/query-rewrites.md](references/query-rewrites.md) | The query itself is the problem: sargability, N+1, pagination, OR, EXISTS, LATERAL, CTEs, window functions. |
| [references/maintenance.md](references/maintenance.md) | Vacuum, autovacuum tuning, bloat, statistics targets, extended statistics, partitioning, fillfactor, reindex. |
| [references/apply-safely.md](references/apply-safely.md) | Applying a change to a live database without taking an outage. |
| [references/mysql.md](references/mysql.md) | The server is MySQL or MariaDB — InnoDB specifics, EXPLAIN ANALYZE, sys schema, index dives. |
