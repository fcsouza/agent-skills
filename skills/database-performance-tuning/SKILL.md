---
name: database-performance-tuning
description: >-
  Diagnoses and fixes slow Postgres and MySQL/InnoDB databases: measure first, read the plan, change one thing, verify. Use when a query, endpoint, job or report is slow, times out or got slower after a deploy; when the question is about indexes (missing, unused, duplicate, composite order, partial, covering), EXPLAIN plans, seq scans, N+1 queries, slow pagination, bloat, autovacuum, stale statistics, lock pileups, connection limits, or a migration that locked a table; or when a page is slow and the first job is to find out whether the database is the cause. Also for "query lenta", "banco lento", "falta indice", "travou a tabela".
---

# Database Performance Tuning

Someone says "it's slow". Turn that into a number, find where the time goes, change the
smallest thing that moves the number, and prove it moved. This skill is vendor-neutral:
it covers plain Postgres and MySQL. For platform features, see Related skills.

## Boundary with other skills

- This skill: why a query is slow and what to change. Measurement, plans, indexes,
  rewrites, vacuum, bloat, safe rollout.
- `postgresql-optimization`, if installed: Postgres features (JSONB, arrays, ranges,
  full-text search, window functions). Use it for "how do I express this", not "why is
  this slow".
- `postgres-game-schema`: schema design for game backends.
- Managed platforms (Supabase, Neon, PlanetScale): pooling, branching and provider limits
  are in their own skills, listed under Related skills.

## The loop

Measure, get the plan, classify, change one thing, verify. Every index costs write
throughput, WAL and vacuum time, so earn each one.

### 0. Establish the ground truth

Facts here are version-gated. Run this first and keep the major version in view:

```sql
SELECT version();
SELECT name, setting FROM pg_settings
WHERE name IN ('shared_buffers','work_mem','effective_cache_size',
               'random_page_cost','track_io_timing','max_parallel_workers_per_gather');
SELECT extname, extversion FROM pg_extension;
```

If `pg_stat_statements` is missing, say so and ask before installing it. It needs
`shared_preload_libraries` and a restart.

Version table. It is the one copy; the references link here. Sources are in
[references/sources.md](references/sources.md), checked 2026-11-15 against the PostgreSQL 18
manual (18.7 was current).

| Thing | Rule |
| --- | --- |
| `pg_stat_statements.total_exec_time` | PG 13+. PG 12 and older call it `total_time`. |
| `shared_blk_read_time`, `shared_blk_write_time` | PG 17+. PG 16 and older: `blk_read_time`, `blk_write_time`. |
| `stats_since`, `minmax_stats_since` | PG 17+. |
| `wal_buffers_full`, `parallel_workers_to_launch`, `parallel_workers_launched` (statements) | PG 18+. |
| Long `IN (...)` lists collapse to one `pg_stat_statements` entry, `IN ($1 /*, ... */)` | PG 18+ only. On PG 17 and older each list length is its own entry. |
| `EXPLAIN (ANALYZE)` adds BUFFERS by itself | PG 18+. On PG 17 and older write `EXPLAIN (ANALYZE, BUFFERS)`. |
| `EXPLAIN (SERIALIZE, MEMORY)` | PG 17+. |
| `EXPLAIN (GENERIC_PLAN)` | PG 16+. |
| `pg_stat_io` | PG 16+. |
| B-tree skip scan (leading column may be unconstrained) | PG 18+. On older majors a composite index needs its leading column. |
| `autovacuum_vacuum_max_threshold` | PG 18+. |
| `REPACK`, `REPACK (CONCURRENTLY)`, `EXPLAIN (ANALYZE, IO)`, parallel autovacuum, `pg_plan_advice` | PG 19, not released as of 2026-11-15 (RC 2 on 2026-11-12). Taken from the draft release notes dated 2026-10-09. Recheck at release. |

If unsure whether a feature exists on the server in front of you, ask the server
(`SELECT to_regclass('pg_stat_io')`) or read the manual for that major.

### 1. Find where the time goes

Run the bundled diagnostic. It only runs `SELECT` and `SHOW`, and adapts to the server
version:

```bash
bash <skill-dir>/scripts/pg-diagnose.sh "postgresql://user@host:5432/db"
```

`<skill-dir>` is the base directory shown when this skill loads. Options go before the
connection string: `-n 30` for more rows, `-q` to skip the `pg_stat_statements` sections.

Connection rules for the script:

- **No password in the string.** A connection string is a process argument and `ps` shows
  it. The script refuses one that has a password. Use `~/.pgpass` (or `PGPASSFILE`), or a
  `service=NAME` entry in `~/.pg_service.conf`. `PGPASSWORD` works but the libpq manual
  advises against it.
- **Direct connection only.** The script sends its read-only and timeout settings as
  startup options. PgBouncer rejects startup parameters it does not track, drops them if
  `ignore_startup_parameters` lists `options`, and tracks only some settings. The script
  checks `default_transaction_read_only`, `statement_timeout` and `lock_timeout` with `SHOW`
  and stops if any is not applied. Details in
  [references/diagnose-postgres.md](references/diagnose-postgres.md).
- **Read-only is a default, not a lock.** Any `SET` in the session undoes it. For a hard
  guarantee connect as a role without write privileges, such as one in `pg_monitor`.

Rank by total time, not mean. A 5 ms query run two million times an hour costs more than a
3-second report run once. They get different fixes.

### 2. Get the real plan

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT TEXT) <query>;
```

`ANALYZE` executes the statement. Wrap writes in a transaction you roll back. Never run it
on production for a statement whose side effects you have not read.

Read bottom-up. Per node look at estimated against actual rows, buffers and `loops`.
`actual time` is per loop; multiply before you call a node cheap. See
[references/explain-plans.md](references/explain-plans.md).

### 3. Classify before you fix

| Symptom in the plan | Likely cause | Where to go |
| --- | --- | --- |
| Seq Scan on a large table with a selective filter | missing or unusable index | [index-design](references/index-design.md) |
| Index Scan but slow, high heap buffers | index not covering | [index-design](references/index-design.md) |
| Estimated rows off by 10x or more | stale statistics, correlated columns | [maintenance](references/maintenance.md) |
| `Rows Removed by Filter` is large | predicate not sargable, or wrong column order | [query-rewrites](references/query-rewrites.md) |
| Nested Loop with a huge `loops` count | bad upstream estimate, or an N+1 from the app | [query-rewrites](references/query-rewrites.md) |
| Sort or Hash spills (`external merge`) | `work_mem` too low for this shape | [maintenance](references/maintenance.md) |
| Fast on a fresh copy, slow in prod | bloat, or a plan flip | [maintenance](references/maintenance.md) |
| Query waits, plan is fine | lock contention | [diagnose-postgres](references/diagnose-postgres.md) |

Name the cause you picked and the evidence. If two fit, measure more.

### 4. Change one thing

One index, or one rewrite, or one setting. Never a batch: a batch teaches nothing about
which part helped, and is hard to unwind.

Every change on a live system goes through [references/apply-safely.md](references/apply-safely.md):
`CREATE INDEX CONCURRENTLY`, a `lock_timeout`, a rollback path, and the `prod-api-safety`
protocol before the first write. Check that an existing index cannot be extended first.
`(a)` next to `(a, b)` means the first is usually dead weight.

### 5. Verify with the same number

Re-run the step 1 measurement and show before and after:

```
tenant dashboard query
  before: 1,240 ms mean, 38,400 shared blocks read, Seq Scan on orders
  after:    12 ms mean,     41 shared blocks read, Index Scan using orders_tenant_created_idx
  index:  orders (tenant_id, created_at DESC) - 240 MB, built CONCURRENTLY in 4m12s
```

Report the write cost too: an index that speeds a report 100x and slows inserts 20% is a
trade, and the person paying should see both sides. Reset `pg_stat_statements` before the
after-measurement and say that you did. A faster `EXPLAIN ANALYZE` on a warm cache is not a
production win.

## MySQL and MariaDB

Same loop, different tools. Read [references/mysql.md](references/mysql.md). Checked
against the MySQL 9.7 manual. 8.4 and 9.7 are the LTS lines; 8.0 is in Sustaining Support
since 2026-04-21.

## Standing rules

- Diagnosis needs no write access. Use a read-only role and keep it that way until you
  have a specific change.
- The database may not be the problem. Check the query, round trips, the pool and
  serialization. On PG 17+, `EXPLAIN (SERIALIZE)` shows output conversion cost.
- Do not `SET` a global on a live server to test a hypothesis. Use a session `SET`.
- A plan from a different data distribution proves nothing. Staging with 10k rows picks
  plans production never would.
- Run `ANALYZE` after a bulk load or big migration, before you judge anything.

## Pitfalls

- Adding an index before reading the plan. It often is not the fix and always costs writes.
- Ranking by mean time and missing the cheap query called millions of times.
- Trusting `idx_scan = 0` after a restart or on the primary only. A replica may use it.
- Dropping the "duplicate" that is unique. Uniqueness is a rule, not a cost. The script
  only pairs indexes with the same uniqueness, sort order, collation and predicate.
- Running the diagnostic through a transaction-mode pooler and assuming the read-only
  default held. Use a direct connection.
- Putting a password in a connection string that a script or `ps` can see.
- Copying `random_page_cost = 1.1` as a universal fix. The manual documents the 4.0 default
  and says lowering it can suit cached data; `1.1` is community practice. Test it per workload.
- Using PG 18 behavior (IN-list squashing, skip scan, automatic BUFFERS) when reading output
  from an older server.
- Treating PG 19 notes as released behavior before GA.

## Files

| File | Read when |
| --- | --- |
| `scripts/pg-diagnose.sh` | Step 1: collecting evidence from a live Postgres. Run with `bash`. |
| [references/diagnose-postgres.md](references/diagnose-postgres.md) | You need to go past what the script prints, interpret it, or connect through a pooler. |
| [references/explain-plans.md](references/explain-plans.md) | Reading an EXPLAIN output node by node. |
| [references/index-design.md](references/index-design.md) | Choosing an index: order, partial, covering, expression, GIN/GiST/BRIN/hash, or deciding not to. |
| [references/query-rewrites.md](references/query-rewrites.md) | The query is the problem: sargability, N+1, pagination, OR, EXISTS, LATERAL, CTEs. |
| [references/maintenance.md](references/maintenance.md) | Vacuum, autovacuum, bloat, statistics, memory settings, partitioning, reindex. |
| [references/apply-safely.md](references/apply-safely.md) | Applying a change to a live database without an outage. |
| [references/mysql.md](references/mysql.md) | The server is MySQL or MariaDB. |
| [references/sources.md](references/sources.md) | You need the page behind a version or behavior claim, or are rechecking this skill. |

## Related skills

- `postgresql-optimization`, if installed: Postgres features and idioms.
- `postgres-game-schema`: game backend schema design.
- `prod-api-safety`: required before the first write to a production resource.
- Supabase: use the `supabase-postgres-best-practices` skill (and `supabase`) if installed,
  otherwise the repository at https://github.com/supabase/agent-skills.
- Neon: use the `neon-postgres` skill if installed, otherwise
  https://github.com/neondatabase/agent-skills.
- PlanetScale: use the `postgres` and `mysql` skills if installed, otherwise
  https://github.com/planetscale/database-skills.
