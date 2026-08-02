# MySQL and MariaDB

The loop from SKILL.md is unchanged — measure, get the plan, classify, change one thing,
verify. What changes is the tooling and a few structural facts about InnoDB that have no
Postgres equivalent.

Version note: MySQL 8.4 is the current LTS and 9.x is the innovation line. Almost
everything below needs 8.0 or newer. MariaDB diverged after 10.x — its optimizer, its
`ANALYZE FORMAT=JSON` and its histogram support differ, so check MariaDB's own manual
rather than assuming MySQL behaviour carries over.

## 0. Ground truth first

```sql
SELECT VERSION();
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
SHOW VARIABLES LIKE 'innodb_flush_log_at_trx_commit';
SHOW VARIABLES LIKE 'slow_query_log%';
SHOW VARIABLES LIKE 'long_query_time';
SELECT @@performance_schema;
```

`performance_schema` must be on for statement-level statistics. `sys` is a set of views
over it and ships by default in 8.0+.

## 1. Find the expensive statements

The equivalent of `pg_stat_statements` is
`performance_schema.events_statements_summary_by_digest`, most easily read through `sys`:

```sql
-- ranked by total latency, the number that matters
SELECT * FROM sys.statement_analysis LIMIT 20;

-- narrower views for specific symptoms
SELECT * FROM sys.statements_with_full_table_scans LIMIT 20;
SELECT * FROM sys.statements_with_temp_tables   LIMIT 20;
SELECT * FROM sys.statements_with_sorting       LIMIT 20;
SELECT * FROM sys.statements_with_errors_or_warnings LIMIT 20;
```

`sys.statement_analysis` gives total and average latency, rows examined vs rows sent, temp
tables (memory and on disk), and full scans per digest. The ratio **rows examined to rows
sent** is the fastest index-quality signal MySQL offers: examining 400,000 rows to send 20
is a missing or unusable index.

Reset the counters when you want a clean before/after window:

```sql
CALL sys.ps_truncate_all_tables(FALSE);
```

The slow query log is the other source, and it catches what the digest table has evicted.
`long_query_time` defaults to 10 seconds, which hides almost everything worth seeing; set
it lower on a session or for a measurement window, and read the file with `mysqldumpslow`
or `pt-query-digest`.

## 2. Get the plan

```sql
EXPLAIN FORMAT=JSON  SELECT ...;   -- estimates, full detail, cost model
EXPLAIN ANALYZE      SELECT ...;   -- actually runs it, real timings (8.0.18+)
EXPLAIN ANALYZE FORMAT=TREE SELECT ...;
```

`EXPLAIN ANALYZE` is the one to reach for — like Postgres's `EXPLAIN (ANALYZE)`, it
executes the statement and reports what really happened per iterator:

```
-> Nested loop inner join  (cost=1200 rows=980) (actual time=0.05..14.2 rows=1024 loops=1)
    -> Table scan on o  (cost=400 rows=10000) (actual time=0.02..3.1 rows=10000 loops=1)
    -> Index lookup on u using PRIMARY  (actual time=0.008..0.009 rows=1 loops=1024)
```

Read it the same way as a Postgres plan: `loops` multiplies the per-loop time, and a large
gap between estimated `rows` and actual `rows` means the optimizer decided on bad
information. `never executed` on a branch means it was pruned at runtime.

In classic tabular `EXPLAIN`, the columns that carry the most information are `type`
(`ALL` = full scan, `index` = full index scan, `range`, `ref`, `eq_ref`, `const`), `key`
(the index chosen), `rows` (estimate), `filtered` (percentage surviving the condition), and
`Extra`. In `Extra`, `Using filesort` and `Using temporary` are the two to chase — both mean
work MySQL could have avoided with the right index. `Using index` is the good one: an
index-only (covering) read.

`EXPLAIN FORMAT=JSON INTO @var` (8.0.21+) stores the plan in a variable, which is handy for
diffing plans in a script.

For a query already running, `EXPLAIN FOR CONNECTION <id>` shows the plan it actually got.
`EXPLAIN ... FOR SCHEMA` lets you plan a statement against a different schema.

## 3. InnoDB facts that change how you index

**Every table is a clustered index on the primary key.** Rows are stored inside the PK
B-tree, ordered by PK. Consequences:

- A **secondary index stores the primary key** as its row pointer. Every non-covering
  secondary lookup is two B-tree descents: one in the secondary index, one in the PK.
- A **wide primary key makes every secondary index wide.** A UUID PK stored as `CHAR(36)`
  adds 36 bytes to every entry of every secondary index. Use `BIGINT AUTO_INCREMENT`, or
  `BINARY(16)` for UUIDs, and prefer time-ordered UUIDv7 over random v4.
- A **random primary key causes page splits** on insert, because rows land in the middle of
  the clustered index instead of appending at the end. This is the single most common
  self-inflicted MySQL write problem.
- **Covering indexes matter more than in Postgres**, because they avoid the second descent
  entirely. `Using index` in `Extra` is the goal. MySQL has no `INCLUDE` clause — you add
  the columns as trailing key columns.

**Leftmost prefix rule** is the same as Postgres's prefix rule: an index on `(a, b, c)`
serves `(a)`, `(a, b)` and `(a, b, c)`, and nothing that does not start with `a`. MySQL has
no skip scan for the general case, so the leading column really is required.

Index features worth knowing (all 8.0+):

- **Descending indexes** — `INDEX (a ASC, b DESC)` is stored in that order and removes the
  filesort for mixed-direction sorts. In 5.7 the `DESC` was parsed and ignored.
- **Invisible indexes** — `ALTER TABLE t ALTER INDEX idx INVISIBLE` hides an index from the
  optimizer while keeping it maintained. This is the safe way to test dropping an index:
  make it invisible, watch for a day, drop it if nothing regressed, or make it visible
  again instantly if something did. Postgres has no equivalent.
- **Functional indexes** — `INDEX ((lower(email)))` (8.0.13+). Before that you needed a
  generated column plus an index on it, which still works and is more portable.
- **Multi-valued indexes** on JSON arrays (8.0.17+), used by `MEMBER OF`, `JSON_CONTAINS`.
- **Prefix indexes** — `INDEX (url(64))` indexes the first 64 characters. Useful on long
  text, but such an index can never be covering and cannot serve `ORDER BY`.

## 4. Statistics and the optimizer

```sql
ANALYZE TABLE orders;                    -- refresh index cardinality
SELECT * FROM sys.schema_index_statistics WHERE table_name = 'orders';
```

InnoDB estimates index cardinality by sampling pages. `innodb_stats_persistent_sample_pages`
(default 20) controls the depth; raising it for a large, skewed table gives the optimizer
better numbers at the cost of a slower `ANALYZE TABLE`.

**Histograms** (8.0.3+) cover columns that are *not* indexed, which is exactly where the
optimizer is otherwise blind:

```sql
ANALYZE TABLE orders UPDATE HISTOGRAM ON status, currency WITH 32 BUCKETS;
ANALYZE TABLE orders DROP HISTOGRAM ON status;
```

Histograms are not updated automatically — re-run `ANALYZE TABLE` after significant data
change, or they become the source of the wrong estimate rather than the fix.

**Optimizer trace** when you need to know *why* a plan was chosen:

```sql
SET optimizer_trace = 'enabled=on';
SELECT ...;
SELECT * FROM information_schema.OPTIMIZER_TRACE\G
SET optimizer_trace = 'enabled=off';
```

Optimizer hints (`/*+ INDEX(t idx) */`, `/*+ JOIN_ORDER(...) */`, `/*+ NO_ICP(t) */`) are a
last resort — they freeze a decision that should adapt to data. Prefer fixing statistics or
the index. If you do use one, comment why.

## 5. Finding dead and redundant indexes

```sql
SELECT * FROM sys.schema_unused_indexes;
SELECT * FROM sys.schema_redundant_indexes;
SELECT * FROM sys.schema_tables_with_full_table_scans;
```

`schema_unused_indexes` reads from `performance_schema`, so it only reflects traffic since
the server started or since the last truncate. The same warning as Postgres applies: check
the uptime, cover a full business cycle, and check every replica before dropping anything.

`schema_redundant_indexes` finds indexes made unnecessary by a wider one — the leftmost
prefix rule made concrete.

## 6. Locks and contention

```sql
SELECT * FROM sys.innodb_lock_waits;
SELECT * FROM performance_schema.data_locks;
SELECT * FROM performance_schema.data_lock_waits;
SHOW ENGINE INNODB STATUS\G          -- LATEST DETECTED DEADLOCK section
SELECT * FROM sys.processlist WHERE command <> 'Sleep';
```

InnoDB uses row-level locking with next-key locks under `REPEATABLE READ` (the default
isolation level, unlike Postgres's `READ COMMITTED`). A range scan under `REPEATABLE READ`
locks gaps as well as rows, which produces lock waits between transactions that touch no
common row. If you see contention that makes no sense, check the isolation level before
anything else.

## 7. Schema changes online

```sql
ALTER TABLE orders ADD INDEX idx_tenant_created (tenant_id, created_at),
  ALGORITHM=INPLACE, LOCK=NONE;
```

Stating `ALGORITHM` and `LOCK` explicitly makes MySQL **fail loudly** instead of silently
falling back to a table copy that blocks writes for hours. That failure is the outcome you
want — it tells you to use `pt-online-schema-change` or `gh-ost` instead.

`ALGORITHM=INSTANT` (8.0.12+) covers adding a column at the end and a few other cases with
no rebuild at all.

Everything in [apply-safely.md](apply-safely.md) about pre-flight checks, backups, batched
backfills and rollback plans applies here unchanged.

## Quick translation table

| Postgres | MySQL 8.0+ |
| --- | --- |
| `pg_stat_statements` | `performance_schema.events_statements_summary_by_digest` / `sys.statement_analysis` |
| `EXPLAIN (ANALYZE, BUFFERS)` | `EXPLAIN ANALYZE FORMAT=TREE` |
| `pg_stat_user_tables` | `sys.schema_table_statistics` |
| `pg_stat_user_indexes` | `sys.schema_index_statistics`, `sys.schema_unused_indexes` |
| `ANALYZE` | `ANALYZE TABLE` (+ `UPDATE HISTOGRAM` for unindexed columns) |
| `CREATE INDEX CONCURRENTLY` | `ALTER TABLE ... ADD INDEX ..., ALGORITHM=INPLACE, LOCK=NONE` |
| `INCLUDE` covering columns | trailing key columns |
| partial index (`WHERE`) | no equivalent; use a generated column plus an index |
| `pg_stat_activity` | `sys.processlist` / `performance_schema.threads` |
| `shared_buffers` | `innodb_buffer_pool_size` |
| `work_mem` | `sort_buffer_size`, `join_buffer_size`, `tmp_table_size` |
| no equivalent | invisible indexes (`ALTER INDEX ... INVISIBLE`) |
