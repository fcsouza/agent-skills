# Diagnosing a Postgres server

The diagnostic queries here only read. Two steps are exceptions and are marked as such:
installing `pg_stat_statements` and creating `pgstattuple`. Both are DDL. Ask first. Run the
queries against a replica when one exists. Query time and index usage are per-server, so a
replica tells you about replica traffic, but plans, schema and bloat are the same.

Contents:
1. Statement-level: pg_stat_statements
2. Table and index level
3. Unused, duplicate and invalid indexes
4. Bloat
5. Live activity, waits and locks
6. Connections
7. IO and cache

---

## 1. Statement-level: pg_stat_statements

This is the single most useful view on the server. It aggregates by normalized query
(constants replaced with `$1`), per database, per user, per top-level flag.

Install check:

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';
```

It needs `pg_stat_statements` in `shared_preload_libraries` and a restart, then
`CREATE EXTENSION pg_stat_statements`. Ask before doing either on a production server.

### Column names by version

Column names changed in PG 13, 17 and 18. Check `SHOW server_version_num` first, then use
the version table in [SKILL.md](../SKILL.md). The two that break queries most often:
`blk_read_time` became `shared_blk_read_time` in PG 17, and `total_time` became
`total_exec_time` in PG 13.

Query text: only superusers and members of `pg_read_all_stats` see the SQL text and
`queryid` of other roles' statements. Other roles see `<insufficient privilege>`. Run the
script as a `pg_monitor` member.

Long `IN (...)` lists: on PG 18 and newer, lists that differ only in length share one entry,
shown as `IN ($1 /*, ... */)`. On PG 17 and older every length is a separate entry, so one
hot query can fill many rows. Group by hand or pass the list as one array parameter.

### Top consumers by total time

This is the ranking that matters — it finds the cheap query called constantly.

```sql
SELECT
  queryid,
  calls,
  round(total_exec_time::numeric, 1)            AS total_ms,
  round(mean_exec_time::numeric, 2)             AS mean_ms,
  round(stddev_exec_time::numeric, 2)           AS stddev_ms,
  rows,
  round(100.0 * shared_blks_hit
        / nullif(shared_blks_hit + shared_blks_read, 0), 1) AS hit_pct,
  left(regexp_replace(query, '\s+', ' ', 'g'), 120) AS query
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 20;
```

How to read it:

- **High `total_ms`, low `mean_ms`, huge `calls`** — an N+1 or a hot path. The fix is
  usually in the application (batch it, cache it) or a covering index. See
  [query-rewrites.md](query-rewrites.md).
- **High `mean_ms`, few `calls`** — a report or a job. `EXPLAIN` it directly.
- **High `stddev_ms`** — the plan is unstable, or the parameter values vary wildly in
  selectivity. Suspect parameter sniffing or a missing partial index.
- **Low `hit_pct` on a hot query** — it is reading from disk every time. Either the
  working set does not fit in `shared_buffers`, or the query touches far more pages than
  it needs (missing index, or a wide row set).
- **`rows / calls` much larger than what the app uses** — the query fetches more than the
  application needs. `SELECT *` on a wide table, or a missing `LIMIT`.

### Temp file writers

Sorts and hashes that spill to disk. These are `work_mem` problems or row-estimate
problems.

```sql
SELECT queryid, calls, temp_blks_written,
       left(regexp_replace(query, '\s+', ' ', 'g'), 100) AS query
FROM pg_stat_statements
WHERE temp_blks_written > 0
ORDER BY temp_blks_written DESC
LIMIT 10;
```

### WAL producers

Write amplification — often the real cost of an index you added.

```sql
SELECT queryid, calls, wal_bytes, wal_records, wal_fpi,
       left(regexp_replace(query, '\s+', ' ', 'g'), 100) AS query
FROM pg_stat_statements
ORDER BY wal_bytes DESC
LIMIT 10;
```

### Resetting

`SELECT pg_stat_statements_reset();` clears everything. Before an after-measurement,
prefer resetting a single statement so you keep the rest of the history:

```sql
SELECT pg_stat_statements_reset(0, 0, :queryid);
```

Say in your report that you reset, and when. A "50% faster" claim measured against a
window that started after the fix is meaningless.

### Entry eviction

If `pg_stat_statements.max` is too low, entries get evicted and you lose the tail. Check:

```sql
SELECT * FROM pg_stat_statements_info;
```

A large and growing `dealloc` means the ranking above is incomplete — mention it rather
than treating the list as the whole truth.

---

## 2. Table and index level

```sql
SELECT
  relname,
  seq_scan, seq_tup_read,
  idx_scan, idx_tup_fetch,
  n_live_tup, n_dead_tup,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
  last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY seq_tup_read DESC
LIMIT 20;
```

- **`seq_scan` high on a big table** — candidate for an index. But a sequential scan on a
  small table is correct and fast; check `pg_relation_size` before reacting.
- **`seq_tup_read / seq_scan`** is the average rows read per scan. That is the number that
  hurts.
- **`dead_pct` above ~20%** on a busy table means autovacuum is not keeping up. See
  [maintenance.md](maintenance.md).
- **`last_autoanalyze` old** on a table that changed a lot — the planner is working from
  stale statistics, and every estimate downstream is suspect.

Per-index usage:

```sql
SELECT
  s.relname AS table_name,
  s.indexrelname AS index_name,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
  i.indisunique, i.indisvalid
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
ORDER BY s.idx_scan ASC, pg_relation_size(s.indexrelid) DESC;
```

---

## 3. Unused, duplicate and invalid indexes

Dropping a dead index is usually a bigger, safer win than adding a new one: it returns
write throughput, shrinks WAL, and speeds up vacuum.

### Never used

```sql
SELECT
  s.schemaname, s.relname AS table_name, s.indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0
  AND NOT i.indisunique
  AND NOT i.indisprimary
ORDER BY pg_relation_size(s.indexrelid) DESC;
```

Two caveats that matter before you drop anything:

- Counters reset when the server restarts or when someone runs
  `pg_stat_reset()`. Check `pg_postmaster_start_time()` and only trust the number if the
  server has been up across a full business cycle, including month-end jobs.
- Statistics are per-server. An index unused on the primary may be carrying every read on
  a replica. Check every node.

A unique index also enforces a constraint — dropping it changes behaviour, not just
performance.

### Duplicate and redundant

An index on `(a)` is redundant when `(a, b)` exists, because a B-tree can be used for a
prefix of its key columns. The reverse is not true.

Two indexes are exact duplicates only when all of these match: table, access method,
uniqueness (and `indnullsnotdistinct` on PG 15+), key columns, operator classes,
collations, per-column sort options (`indoption`: DESC, NULLS FIRST) and the partial
predicate. The query is in `scripts/pg-diagnose.sh` (section "Exact duplicate indexes").
Read its `GROUP BY` before you copy the idea. Dropping any column from that list reports
false pairs:

- `(a)` unique and `(a)` plain differ. The unique one enforces a rule.
- `(a)` and `(a DESC)` differ for ordered scans.
- Two `text` indexes with different collations answer different comparisons.
- Two partial indexes with different `WHERE` clauses cover different rows.

Group on the *rendered* expression and predicate (`pg_get_expr`), not on the raw
`indexprs`/`indpred` columns. Those are `pg_node_tree`, which has no equality operator and
whose text form embeds the parse position, so two identical `lower(email)` indexes would
not group.

This finds exact duplicates only. For prefix redundancy, compare the leading columns of
every index on a table by hand. It is a small list per table and worth doing carefully.
If a duplicate backs a primary key, unique or exclusion constraint, or a foreign key, drop
the constraint instead of the index.

Note for PG 18 and newer: B-tree **skip scan** lets the planner use a composite index even
when the query does not constrain the leading column, so a narrow index that used to be
necessary may now be redundant. Do not assume — check `idx_scan` on both after the
upgrade before dropping either.

### Invalid

Left behind by a failed `CREATE INDEX CONCURRENTLY`. They are ignored for queries but
still cost on every write, so they are pure loss.

```sql
SELECT indexrelid::regclass AS index_name, indrelid::regclass AS table_name
FROM pg_index WHERE NOT indisvalid;
```

`psql`'s `\d table` marks them `INVALID`. Fix by dropping and rebuilding — see
[apply-safely.md](apply-safely.md).

---

## 4. Bloat

Dead tuples that vacuum has not reclaimed. Bloat makes every scan read more pages for the
same rows, so a query can get slower with no change to the query or the data volume.

Exact numbers need the `pgstattuple` extension. This step is not read-only: `CREATE
EXTENSION` is DDL, and the functions read the whole relation, so ask first and run it on one
table at a time, off-peak:

```sql
CREATE EXTENSION IF NOT EXISTS pgstattuple;
SELECT * FROM pgstattuple('orders');
SELECT * FROM pgstatindex('orders_pkey');
```

Without it, use the dead-tuple ratio from `pg_stat_user_tables` as a proxy, plus the gap
between table size and the size implied by `n_live_tup * avg row width`. Estimates from
catalog-only queries are approximations — say so when you report them.

The fix is almost never `VACUUM FULL` on a live system: it takes an `ACCESS EXCLUSIVE`
lock for the whole rewrite. See [maintenance.md](maintenance.md).

---

## 5. Live activity, waits and locks

What is running right now:

```sql
SELECT
  pid, state, wait_event_type, wait_event,
  now() - query_start AS runtime,
  now() - state_change AS in_state,
  left(regexp_replace(query, '\s+', ' ', 'g'), 100) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND pid <> pg_backend_pid()
ORDER BY query_start;
```

`wait_event_type` tells you the shape of the problem immediately:

- `Lock` — blocked by another transaction. Find the blocker below.
- `IO` — reading from disk. Cache or index problem.
- `LWLock` — internal contention, often buffer mapping or WAL. Usually a capacity issue.
- `Client` — waiting on the application. The database is idle and the problem is elsewhere.
- `IPC` — waiting on a parallel worker or a sync replica.

Who blocks whom:

```sql
SELECT
  blocked.pid          AS blocked_pid,
  blocked.query        AS blocked_query,
  blocking.pid         AS blocking_pid,
  blocking.query       AS blocking_query,
  now() - blocking.xact_start AS blocking_xact_age
FROM pg_stat_activity blocked
JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS b(pid) ON true
JOIN pg_stat_activity blocking ON blocking.pid = b.pid
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

Long-running idle transactions are the usual villain. They hold the xmin horizon back, so
vacuum cannot clean anything newer than them anywhere in the database:

```sql
SELECT pid, state, now() - xact_start AS xact_age, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
ORDER BY xact_start;
```

An `idle in transaction` connection open for hours will quietly bloat the whole cluster.
Fix it in the application, and consider `idle_in_transaction_session_timeout` as a guard.

---

## 6. Connections

```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
SHOW max_connections;
```

Each Postgres connection is a process with its own memory. Hundreds of mostly-idle
connections cost real RAM and context switches. If the app opens connections per request,
the answer is a pooler (PgBouncer in transaction mode, or the provider's built-in pooler),
not a bigger `max_connections`.

Pooler limits that affect diagnosis and tuning, from the PgBouncer manual:

- Transaction pooling hands a server connection to a client only for one transaction. In
  that mode `SET`/`RESET`, `LISTEN`, `WITH HOLD` cursors, `PREPARE`/`DEALLOCATE`, temp tables
  with `PRESERVE`/`DELETE ROWS`, `LOAD` and session-level advisory locks do not work.
  So a session-level `SET work_mem` or `SET lock_timeout` does not carry to the next
  statement. Use `SET LOCAL` inside a transaction, or a direct connection.
- PgBouncer accepts only startup parameters it can track. Others raise an error unless
  `ignore_startup_parameters` lists them (listing `options` makes it ignore the unknown
  parameters inside `options`: tracked ones such as `default_transaction_read_only` survive,
  the timeouts are dropped). PgBouncer supports the `options`
  startup parameter since 1.20.0 (2023-07-20), and only for settings it tracks, which
  `track_extra_parameters` can extend. `pg-diagnose.sh` passes its read-only and timeout
  settings through `PGOPTIONS`, which arrives as `options`. Behind a pooler the connection
  can fail, or succeed with some or all of the settings dropped. The script runs `SHOW` for
  `default_transaction_read_only`, `statement_timeout` and `lock_timeout` before any query
  and stops if any of them is not applied. Use the direct connection (the provider's
  non-pooled URL) for diagnosis.

Note that `work_mem` is per sort or hash node, per connection — a query with three sort
nodes across 100 connections can allocate 300 × `work_mem`. That is why raising
`work_mem` globally is dangerous and why the right move is usually a session-level `SET`
for the one report that needs it.

---

## 7. IO and cache

Cluster-wide cache hit ratio:

```sql
SELECT
  sum(heap_blks_hit) AS hit,
  sum(heap_blks_read) AS read,
  round(100.0 * sum(heap_blks_hit)
        / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS hit_pct
FROM pg_statio_user_tables;
```

Treat this as a smell, not a target. A 99% hit ratio on a query that reads 100x more pages
than it should is still a bad query. Fix the page count first, and the ratio follows.

`track_io_timing` must be on for the io-time columns anywhere to be non-zero. It has
measurable overhead on some platforms — check `pg_test_timing` before enabling it on a
busy server.

On servers that have it, `pg_stat_io` breaks IO down by backend type and context, which
tells you whether the reads come from regular backends, vacuum, or the bgwriter. Check
availability rather than assuming: `SELECT to_regclass('pg_stat_io');`
