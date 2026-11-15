# MySQL and MariaDB

The loop from SKILL.md is unchanged — measure, get the plan, classify, change one thing,
verify. What changes is the tooling and a few structural facts about InnoDB that have no
Postgres equivalent.

Version note, checked 2026-11-15: the 8.4 and 9.7 lines are LTS. MySQL 8.0 moved to Oracle
Sustaining Support on 2026-04-21 and Oracle recommends 8.4 LTS or 9.7 LTS. This file targets
8.4 and newer and was checked against the 9.7 manual. Where a feature has an introduction
version below, the version comes from a release note listed in
[sources.md](sources.md); features without one are described as present in 9.7.
MariaDB is a separate server with its own optimizer and manual (see its docs); this file
does not cover it.

For MySQL work on PlanetScale, use the `mysql` skill if it is installed, otherwise
https://github.com/planetscale/database-skills.

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

Not every name below was re-opened on 2026-11-15. Checked in the 9.7 manual: the
`sys.statement_analysis` view and the related views `statements_with_full_table_scans`,
`statements_with_errors_or_warnings`, `schema_unused_indexes`, `schema_redundant_indexes`
and `innodb_lock_waits`; EXPLAIN join types and `Extra` values; invisible indexes; the
default isolation level; the `innodb_stats_persistent_sample_pages` default of 20. Common
practice, not rechecked: the other `sys` views, `sys.ps_truncate_all_tables`, the
`performance_schema` lock tables, `mysqldumpslow`, `pt-query-digest`,
`pt-online-schema-change`, `gh-ost`, and the primary-key and UUID advice in section 3
(the UUID advice is this skill's rule).

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
Check `long_query_time` first. A high value hides almost everything worth seeing, so lower
it for a measurement window. Tools such as `mysqldumpslow` and `pt-query-digest` read the
log file.

## 2. Get the plan

```sql
EXPLAIN FORMAT=JSON  SELECT ...;   -- estimates, full detail, cost model
EXPLAIN ANALYZE      SELECT ...;   -- actually runs it, real timings
EXPLAIN ANALYZE FORMAT=TREE SELECT ...;
```

`EXPLAIN ANALYZE` is the one to reach for. Like Postgres's `EXPLAIN (ANALYZE)`, it
executes the statement and reports what really happened per iterator (the manual lists
estimated cost and rows, time to first row, time per iterator, rows and loops):

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

`EXPLAIN FORMAT=JSON INTO @var` stores the plan in a variable, which is handy for diffing
plans in a script. `INTO` needs `FORMAT=JSON` written out, and is not allowed with
`FOR CONNECTION`.

For a query already running, `EXPLAIN ... FOR CONNECTION <id>` shows the plan it actually
got.

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
serves `(a)`, `(a, b)` and `(a, b, c)`. A query that skips the leading column normally cannot
use the index. MySQL does have a Skip Scan range access method (added in 8.0.13), but the
manual limits it to one table, no `GROUP BY` or `DISTINCT`, only indexed columns, equality
constants on the leading parts, and a range condition on a later part. Check `EXPLAIN`
for `Using index for skip scan` before you count on it, and index for the leading column
otherwise.

Index features worth knowing (present in the 9.7 manual):

- **Descending indexes** — `INDEX (a ASC, b DESC)` is stored in that order and can remove
  the filesort for mixed-direction sorts.
- **Invisible indexes** — `ALTER TABLE t ALTER INDEX idx INVISIBLE` hides an index from the
  optimizer while keeping it maintained. This is the safe way to test dropping an index:
  make it invisible, watch for a day, drop it if nothing regressed, or make it visible
  again instantly if something did. Postgres has no equivalent.
- **Functional indexes** — `INDEX ((lower(email)))` (added in 8.0.13). A generated column
  plus an index on it also works and is more portable.
- **Multi-valued indexes** on JSON arrays, used by `MEMBER OF` and `JSON_CONTAINS`. See
  the `CREATE INDEX` page in the manual for the rules.
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

**Histograms** cover columns that are *not* indexed, which is where the optimizer is
otherwise blind:

```sql
ANALYZE TABLE orders UPDATE HISTOGRAM ON status, currency WITH 32 BUCKETS;
ANALYZE TABLE orders UPDATE HISTOGRAM ON status WITH 32 BUCKETS AUTO UPDATE;
ANALYZE TABLE orders DROP HISTOGRAM ON status;
```

By default a histogram is `MANUAL UPDATE`: it stays as it was until you run the statement
again, and a stale one gives wrong estimates. MySQL 8.4.0 added the `AUTO UPDATE` option. With
it, a later `ANALYZE TABLE` on the table recalculates the histogram with the same bucket
count, and so does InnoDB's background recalculation of persistent statistics. Histograms
that existed before an upgrade to 8.4 stay `MANUAL UPDATE`. Pick `AUTO UPDATE` for columns
whose distribution drifts.

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
want. It tells you to use an external online schema change tool instead (for example
`pt-online-schema-change` or `gh-ost`).

`ALGORITHM=INSTANT` changes only metadata and rebuilds nothing. In 9.7 it is the default
algorithm for adding a column, and the column can go at any position. The manual lists the
limits: no mixing with `ALTER` actions that lack INSTANT support, no `ROW_FORMAT=COMPRESSED`
or `FULLTEXT` tables or temporary tables, a row-size check, and at most 1022 columns in the
internal table after the add. Which other operations support INSTANT differs by version, so
read the operations table in the Online DDL chapter of the manual for your version rather
than relying on a list here, and state `ALGORITHM=INSTANT` so the statement fails if it cannot.

Everything in [apply-safely.md](apply-safely.md) about pre-flight checks, backups, batched
backfills and rollback plans applies here unchanged.

## Quick translation table

| Postgres | MySQL 8.4+ |
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
