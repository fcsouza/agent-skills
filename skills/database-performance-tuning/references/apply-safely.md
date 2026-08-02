# Applying changes to a live database

A tuning change that takes an outage is not a win. Everything here assumes the database is
serving traffic while you work on it.

**Before the first write to any production database, follow the `prod-api-safety` skill.**
Minimum bar regardless: read the current state, take an explicit backup or snapshot, and
know the rollback command before you run the forward one.

## The pre-flight

1. **Which server am I on?** `SELECT current_database(), inet_server_addr(), pg_is_in_recovery();`
   A `true` from `pg_is_in_recovery()` means you are on a replica and DDL will fail —
   which is a useful accident to have before a bad one.
2. **What is the rollback?** For an index: `DROP INDEX CONCURRENTLY`. For a setting: the
   previous value, written down. For a data change: a backup you have verified exists.
3. **What is the blast radius?** How long does the operation hold what lock, and what
   queues behind it.
4. **Announce it.** Anything that can queue queries on a busy table gets a heads-up.

## Locks are the real risk

Postgres DDL is transactional and fast, which lulls people. The danger is not the
operation's duration — it is that a lock request **queues behind running queries and blocks
everything arriving after it**. A 5 ms `ALTER TABLE` behind a 30-second report stalls the
whole table for 30 seconds.

Always bound the wait:

```sql
SET lock_timeout = '3s';
SET statement_timeout = '0';   -- but see below for CIC
ALTER TABLE orders ADD COLUMN notes text;
```

With `lock_timeout`, the statement gives up instead of building a queue. Failing and
retrying at a quieter moment is almost always right.

Watch what the operation actually took:

```sql
SELECT locktype, relation::regclass, mode, granted, pid
FROM pg_locks WHERE NOT granted;
```

## Creating an index without blocking writes

```sql
-- not inside a transaction block; psql outside BEGIN
SET lock_timeout = '3s';
CREATE INDEX CONCURRENTLY orders_tenant_created_idx
  ON orders (tenant_id, created_at DESC);
```

What `CONCURRENTLY` actually does, and the consequences:

- It does **two table scans** and waits between them for transactions that could modify or
  use the index. It is therefore slower in total than a regular build, and it can wait a
  long time behind a long transaction.
- It **cannot run inside a transaction block**. Migration tools that wrap every migration
  in a transaction will fail — most have a flag for this (Rails
  `disable_ddl_transaction!`, Django `atomic = False`, and for hand-written SQL, run it
  outside the migration).
- Only **one concurrent build per table** at a time.
- Only the **first scan is parallel**.
- Do **not** set a `statement_timeout` that could kill it mid-build; that produces the
  invalid index below.
- The index may not be usable immediately even after the command returns, if transactions
  older than the build are still open.

**If it fails**, it leaves an index marked `INVALID`. That index is ignored by queries but
still updated on every write — pure cost, no benefit. Find and clean up:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
DROP INDEX CONCURRENTLY orders_tenant_created_idx;
-- then retry the CREATE INDEX CONCURRENTLY
```

`REINDEX INDEX CONCURRENTLY` (PG 12+) is the alternative recovery when the index is a
constraint's index and cannot simply be dropped.

Building an index also takes real time and IO on a large table. Run it off-peak, raise
`maintenance_work_mem` for the session, and monitor:

```sql
SELECT pid, phase, blocks_done, blocks_total,
       tuples_done, tuples_total
FROM pg_stat_progress_create_index;
```

## Dropping an index

Always `DROP INDEX CONCURRENTLY`. A plain `DROP INDEX` takes an `ACCESS EXCLUSIVE` lock on
the table.

Before dropping, make it reversible cheaply: save the exact definition.

```sql
SELECT indexdef FROM pg_indexes WHERE indexname = 'orders_old_idx';
```

Paste that into your rollback note. If the drop turns out to be wrong, you recreate it
`CONCURRENTLY` from the saved definition.

A safer intermediate step when you are not certain an index is dead: mark it invisible to
the planner instead of dropping it. Postgres has no `ALTER INDEX ... INVISIBLE` (MySQL
does), so the equivalent is to test with `enable_indexscan`/`enable_bitmapscan` off in a
session, or on a copy of the database. Do not fake it by editing `pg_index` directly.

## Schema changes that are cheap, and ones that are not

Cheap in modern Postgres (metadata-only, brief lock):

- `ADD COLUMN` with no default, or with a **non-volatile** default (PG 11+ stores it in the
  catalog instead of rewriting the table).
- `DROP COLUMN` — marks it dropped; space is reclaimed as rows get rewritten.
- `ALTER COLUMN ... DROP NOT NULL`.
- Renaming a table or column — instant, but breaks the application if it is still running
  the old name. Coordinate with the deploy.

Expensive (rewrites the table or scans it, holding a strong lock):

- `ALTER COLUMN TYPE` in most cases. `varchar(50)` → `varchar(100)` and
  `varchar` → `text` are exceptions that only need a catalog change.
- `ADD COLUMN` with a volatile default such as `gen_random_uuid()`.
- `SET NOT NULL` — scans the whole table. Do it in two steps: add a `CHECK (col IS NOT
  NULL) NOT VALID` constraint, `VALIDATE CONSTRAINT` (which takes a weaker lock), then
  `SET NOT NULL` — PG 12+ can use the validated constraint to skip the scan.
- `ADD FOREIGN KEY` — scans to validate. Same two-step: `NOT VALID`, then
  `VALIDATE CONSTRAINT`.

## Large backfills

Do not update ten million rows in one statement. It holds locks, produces one enormous WAL
burst, delays replicas, and hands autovacuum a mountain of dead tuples.

```sql
-- repeat until zero rows affected; commit between batches
WITH batch AS (
  SELECT id FROM orders
  WHERE currency IS NULL
  ORDER BY id
  LIMIT 5000
  FOR UPDATE SKIP LOCKED
)
UPDATE orders o SET currency = 'BRL'
FROM batch WHERE o.id = batch.id;
```

Between batches: pause briefly, watch replication lag
(`SELECT * FROM pg_stat_replication;`) and dead tuples, and stop if either climbs.

## Verifying and rolling back

After the change:

1. Re-run the measurement from the diagnosis, not a new one.
2. Check the plan actually changed, and that the new index is being used
   (`idx_scan` in `pg_stat_user_indexes`).
3. Check the write path: insert/update latency, WAL volume
   (`pg_stat_statements.wal_bytes`), and replication lag.
4. Watch for a few hours before calling it done. Index effects on the write path show up
   under load, not in a test.

Roll back the moment the write regression is worse than the read gain. Keeping a bad index
because it took two hours to build is a sunk cost, and `DROP INDEX CONCURRENTLY` is cheap.

## What never happens without asking

- Dropping an index, table, or column on production.
- `VACUUM FULL` on a live table.
- Changing a global setting that requires a restart.
- Running `EXPLAIN ANALYZE` on a statement with side effects outside a rolled-back
  transaction.
- Killing a backend with `pg_terminate_backend` — unless the user asked, and you have said
  which query and which session.
