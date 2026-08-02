# Maintenance: vacuum, statistics, bloat, partitioning

Most "the database got slower and nothing changed" reports are a maintenance problem. The
query is the same, the data volume is similar, and what moved is bloat, statistics, or the
visibility map.

## Why vacuum exists

Postgres never overwrites a row in place. An `UPDATE` writes a new version and marks the
old one dead; a `DELETE` only marks. Vacuum reclaims that space, updates the visibility
map, refreshes planner statistics, and freezes old transaction ids to prevent wraparound.

Three consequences you will meet in practice:

- **An update-heavy table grows even when the row count is flat.** That is bloat.
- **Index-only scans depend on the visibility map**, which only vacuum maintains. A stale
  map turns an index-only scan into an index scan with heap fetches.
- **Nothing can be cleaned that is newer than the oldest open transaction.** One
  `idle in transaction` connection held open for hours stops vacuum across the whole
  cluster.

## When autovacuum fires

For dead tuples (PG 18 formula; the `Minimum(...)` cap is new in PG 18):

```
vacuum threshold = Minimum(autovacuum_vacuum_max_threshold,
                           autovacuum_vacuum_threshold
                           + autovacuum_vacuum_scale_factor * reltuples)
```

Defaults are `autovacuum_vacuum_threshold = 50` and
`autovacuum_vacuum_scale_factor = 0.2`. That 0.2 is the problem on big tables: a
100-million-row table waits for 20 million dead tuples before autovacuum touches it. On
PG 18 the new `autovacuum_vacuum_max_threshold` caps that; on PG 17 and older you set the
scale factor per table yourself:

```sql
ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.005
);
```

Per-table settings are the right tool. Changing the global default affects every table
including the tiny ones, where the current defaults are fine.

For inserts (PG 13+):

```
vacuum insert threshold = autovacuum_vacuum_insert_threshold
                        + autovacuum_vacuum_insert_scale_factor
                          * reltuples * percent_of_table_not_frozen
```

This is what keeps append-only tables — events, logs, audit trails — getting frozen and
marked all-visible. Without it, an insert-only table never got vacuumed until anti-wraparound
kicked in and did the whole thing at once.

For analyze:

```
analyze threshold = autovacuum_analyze_threshold
                  + autovacuum_analyze_scale_factor * reltuples
```

## Is autovacuum keeping up?

```sql
SELECT relname, n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       last_autovacuum, last_autoanalyze, autovacuum_count
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

Running right now:

```sql
SELECT pid, relid::regclass, phase, heap_blks_scanned, heap_blks_total,
       round(100.0 * heap_blks_scanned / nullif(heap_blks_total, 0), 1) AS pct
FROM pg_stat_progress_vacuum;
```

When it is behind, the causes in order of likelihood:

1. **Scale factor too high for the table size** — fix per table, above.
2. **Cost limits throttling it.** `autovacuum_vacuum_cost_delay` (default 2 ms) and
   `autovacuum_vacuum_cost_limit` deliberately slow vacuum to protect foreground traffic.
   On modern SSDs the defaults are conservative; raising the cost limit is a common and
   safe win. The cost budget is shared and balanced across running workers, except for
   tables with per-table cost settings, which are excluded from the balancing.
3. **Not enough workers.** `autovacuum_max_workers` defaults to 3 for the whole cluster.
   With hundreds of tables, big ones starve.
4. **A long-running transaction pinning the xmin horizon.** Vacuum runs and reclaims
   nothing. Check `pg_stat_activity` for old `xact_start` and for stale replication slots
   and prepared transactions, which hold the horizon back just as effectively.

```sql
SELECT slot_name, active, xmin, catalog_xmin FROM pg_replication_slots;
SELECT gid, prepared FROM pg_prepared_xacts;
```

An abandoned replication slot is a classic cause of a cluster that bloats for weeks.

## Transaction id wraparound

```sql
SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;
SELECT relname, age(relfrozenxid) FROM pg_class
WHERE relkind = 'r' ORDER BY 2 DESC LIMIT 20;
```

`autovacuum_freeze_max_age` defaults to 200 million. As the age approaches it, Postgres
forces an anti-wraparound vacuum that cannot be skipped and cannot be cancelled the usual
way. Left unattended past the limit the database refuses writes. If you see ages in the
hundreds of millions and climbing, that is the emergency; everything else waits.

## Fixing bloat

- **`VACUUM` (plain)** reclaims space for reuse inside the table. The file does not shrink
  but new rows fill the gaps. Safe online; this is what you want almost always.
- **`VACUUM FULL`** rewrites the table and returns space to the filesystem, holding an
  `ACCESS EXCLUSIVE` lock for the whole rewrite. On a live table that is an outage.
- **`pg_repack`** (extension) does the same rewrite online with only brief locks. This is
  the production answer when you genuinely must shrink a table.
- **`REINDEX INDEX CONCURRENTLY`** (PG 12+) rebuilds a bloated index without blocking
  writes. Indexes bloat faster than tables on update-heavy workloads, and rebuilding them
  is often the whole fix.

Before rewriting anything, ask why it bloated. If autovacuum is not keeping up, a rewrite
buys weeks and the problem returns.

**Prevention on update-heavy tables:** a HOT (heap-only tuple) update avoids touching
indexes entirely, but only when no indexed column changes and the new version fits on the
same page. Two levers: do not index columns that change constantly, and lower `fillfactor`
so pages keep room for new versions.

```sql
ALTER TABLE sessions SET (fillfactor = 80);   -- then REINDEX / repack to apply to existing pages
```

Since PG 14, B-tree indexes also do **bottom-up index deletion**, which cleans version
churn in a leaf page before splitting it. It is automatic, and it makes non-HOT update
workloads far less damaging than they used to be — one more reason to check the major
version before importing tuning advice written for older releases.

## Statistics

Bad row estimates cause bad plans. The estimate comes from statistics collected by
`ANALYZE`.

```sql
ANALYZE orders;                          -- after any bulk load or migration
SELECT attname, n_distinct, most_common_vals, correlation
FROM pg_stats WHERE tablename = 'orders';
```

- `n_distinct` — distinct values; negative means a ratio of the row count.
- `most_common_vals` / `most_common_freqs` — the MCV list. Skewed columns need a longer one.
- `correlation` — how closely physical order matches logical order. Near 1 means index
  scans are cheap and BRIN works; near 0 means every index hit is a random page.

**When the histogram is too coarse:**

```sql
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;   -- default 100, max 10000
ANALYZE orders;
```

Raise it for skewed columns where the planner keeps guessing wrong. It costs `ANALYZE`
time and planning time, so raise it per column, not globally.

**When columns are correlated**, the planner multiplies selectivities as if they were
independent and lands orders of magnitude off. `city = 'São Paulo' AND state = 'SP'` is the
canonical case. Extended statistics fix it:

```sql
CREATE STATISTICS orders_city_state (dependencies, ndistinct, mcv)
  ON city, state FROM orders;
ANALYZE orders;
```

- `dependencies` — functional dependencies between columns.
- `ndistinct` — distinct counts for column groups, which fixes `GROUP BY` estimates.
- `mcv` — most common combinations, the most useful of the three for filter estimates.

Extended statistics also work on expressions, which fixes estimates for
`WHERE lower(email) = ...` even without an index on it.

## Memory settings that change plans

- **`work_mem`** — per sort, hash or bitmap node, per connection. Too low means spilling to
  disk (`Sort Method: external merge`, `Batches > 1`, lossy bitmap blocks). Too high, times
  many concurrent nodes, means the OOM killer. Raise it per session for the one report that
  needs it: `SET LOCAL work_mem = '256MB';` inside the transaction.
- **`shared_buffers`** — 25% of RAM is the usual starting point on a dedicated server. Past
  that the OS page cache usually serves you better than more Postgres buffers.
- **`effective_cache_size`** — not an allocation, just a hint about how much of the data the
  OS is likely caching. Set it around 50–75% of RAM. Too low and the planner avoids index
  scans it should choose.
- **`random_page_cost`** — defaults to 4.0, which assumes spinning disks. On SSD or cloud
  block storage, 1.1 is the standard adjustment and it is often the single highest-impact
  setting on a modern server, because it stops the planner preferring sequential scans.
- **`maintenance_work_mem`** — used by index builds and vacuum. Raising it makes
  `CREATE INDEX` and vacuum much faster; it is only allocated during those operations.

Change these one at a time and measure. `pg_settings.pending_restart` tells you which need
a restart.

## Partitioning

Partitioning helps when it lets you **drop** whole partitions instead of deleting rows, or
when the planner can prune to one partition. It is not a general speed-up: it adds planning
overhead and every query that cannot prune gets slower.

Good fits: time-series with a retention policy, and tables where every query filters on the
same tenant or date key. `DROP TABLE orders_2024_01` is instant; `DELETE FROM orders WHERE
created_at < '2024-02-01'` generates millions of dead tuples and days of vacuum work.

Check pruning actually happens — the plan should show only the relevant partitions, and
`EXPLAIN` reports `Subplans Removed` for run-time pruning:

```sql
EXPLAIN (ANALYZE) SELECT ... FROM orders WHERE created_at >= '2026-08-01';
```

Two things that break pruning: filtering on an expression of the partition key rather than
the key itself, and a parameterized query where the value only arrives at execution time
(that gets run-time pruning, which is weaker than plan-time pruning).

Every partition needs its own indexes. A partitioned index created on the parent cascades
to partitions, and `ATTACH PARTITION` requires a matching index to avoid a rebuild.
