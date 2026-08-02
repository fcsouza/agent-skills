# Reading EXPLAIN

## The command

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT TEXT) <query>;
```

- `ANALYZE` runs the statement. For `INSERT`/`UPDATE`/`DELETE`, wrap it:
  `BEGIN; EXPLAIN (ANALYZE) UPDATE ...; ROLLBACK;`
- `BUFFERS` is included automatically with `ANALYZE` on **PG 18+**. On PG 17 and older you
  must ask for it, and you should — page counts are the most honest number in the plan
  because they do not move with cache warmth the way timings do.
- `SETTINGS` prints any planner GUC that is not at its default. This catches the "works on
  my machine" case where someone left `enable_seqscan = off` in a session.
- `SERIALIZE` (**PG 17+**) measures the cost of converting the result to wire format —
  use it when the plan looks cheap but the client still waits. TOASTed values and
  expensive output functions show up here and nowhere else.
- `MEMORY` (**PG 17+**) reports planner memory use. Relevant for queries with very many
  partitions or joins.
- `GENERIC_PLAN` (**PG 16+**) plans a parameterized query without values, which is how you
  see what a prepared statement will do after it switches to a generic plan.

`FORMAT JSON` is easier to process in a script; text is easier to read. Use text while
you are thinking and JSON only if you are diffing plans programmatically.

## Structure

Each node prints:

```
Node Type  (cost=startup..total rows=R width=W) (actual time=startup..total rows=A loops=L)
```

- `cost` is in arbitrary planner units. Only ever compare costs **within one plan**. A cost
  of 4,000 in one query says nothing about a cost of 4,000 in another.
- `rows=R` is the estimate; `rows=A` is reality, **per loop**.
- `loops=L` — the node ran L times. Total rows produced is `A × L`, and total time is
  `actual total time × L`. A node showing `actual time=0.012..0.031 loops=48000` cost
  about 1.5 seconds, not 31 microseconds. This is the single most misread number in
  Postgres plans.
- `width` is the average row width in bytes. A large width on a node feeding a sort tells
  you why the sort spills.

Read bottom-up: leaf nodes touch the data, parents combine it. Time flows up.

## The three questions per node

**1. Is the estimate right?** Compare `rows=R` against `rows=A × loops` where relevant.
Off by 10x is worth investigating; off by 100x means every decision above this node was
made on bad information, and fixing the estimate often fixes the plan without touching
anything else. Causes: stale statistics, correlated columns the planner assumes are
independent, expressions the planner cannot estimate, or a `WHERE` on a function result.
Go to [maintenance.md](maintenance.md) for `ANALYZE`, statistics targets and
`CREATE STATISTICS`.

**2. How many pages did it touch?**

```
Buffers: shared hit=1024 read=8192 dirtied=12 written=0
```

- `hit` — found in `shared_buffers`. Cheap.
- `read` — went to the OS or disk. This is the number to reduce.
- `dirtied` / `written` — this read caused writes, usually hint-bit setting or vacuum debt.
- `temp read/written` — a sort or hash spilled to disk. Raise `work_mem` for this session,
  or reduce the rows reaching the sort.

Compare pages read against rows returned. Reading 40,000 pages to return 12 rows is the
definition of a missing or unusable index.

**3. Where did the rows go?**

```
Rows Removed by Filter: 998432
```

The node read a million rows and threw away almost all of them. Either the predicate
should be in an index, or it is not sargable and no index can help until the query is
rewritten. See [query-rewrites.md](query-rewrites.md).

`Rows Removed by Join Filter` means the same thing for a join condition — usually a
missing index on the join key, or a join order the planner got wrong because of a bad
estimate below.

## Node types and what they tell you

**Seq Scan** — reads the whole table. Correct and fastest when you need most of the rows
or the table is small. A problem when it sits under a selective filter on a large table.

**Index Scan** — walks the index, then fetches each matching row from the heap. Good for
few rows. Slow when it returns many, because each heap fetch is a random page read. The
`Index Cond` line shows what the index actually satisfied; anything in a separate `Filter`
line was checked after the fetch and could not use the index.

**Index Only Scan** — answered entirely from the index. Watch the heap-fetch count:

```
Index Only Scan using orders_covering_idx on orders
  Heap Fetches: 84213
```

High `Heap Fetches` means the visibility map is stale, so it is really an index scan with
extra steps. The cause is vacuum lag, not the index. See [maintenance.md](maintenance.md).

**Bitmap Heap Scan** with a **Bitmap Index Scan** child — the planner expects too many rows
for individual fetches, so it collects the page numbers first and reads the heap in
physical order. This is the planner's compromise between the two scan types.

```
Bitmap Heap Scan on tenk1
  Recheck Cond: (unique1 < 100)
  Heap Blocks: exact=90 lossy=0
```

`lossy` blocks mean the bitmap outgrew `work_mem` and degraded to page granularity, so
every row on those pages gets rechecked. Lossy blocks are a signal to raise `work_mem` for
the query or make the predicate more selective. Multiple Bitmap Index Scans under a
BitmapAnd/BitmapOr is Postgres combining separate indexes — often a hint that one
composite index would do the job in a single pass.

**Nested Loop** — for each row on the outer side, probe the inner side. Excellent when the
outer side is tiny and the inner probe is indexed. Catastrophic when the outer estimate was
wrong: `loops=2` in the estimate and `loops=200000` in reality is the classic plan
blow-up. Fix the estimate, not the join.

**Hash Join** — builds a hash of the smaller side, streams the larger. Watch for
`Batches: 8` — more than one batch means the hash did not fit in `work_mem` and spilled.

**Merge Join** — both sides sorted on the join key. Cheap if the inputs are already
ordered by an index, expensive if it forced two sorts.

**Sort** —

```
Sort Method: quicksort  Memory: 25kB
Sort Method: external merge  Disk: 24800kB
```

`external merge` means it went to disk. Either raise `work_mem` for this statement, or
give the sort an index that already provides the order (`ORDER BY` matching an index,
including the direction).

**Gather / Gather Merge** — parallel workers. `Workers Planned: 4  Workers Launched: 2`
means the server ran out of worker slots and the query ran at half the parallelism it was
costed for. Check `max_parallel_workers` and how many other queries are competing.

**Memoize** (PG 14+) — caches inner-side results in a nested loop. When it appears and
`Hits` is high, the repeated probes were the cost and the cache fixed it.

**Materialize**, **Subquery Scan**, **CTE Scan** — the planner buffered an intermediate
result. A `CTE Scan` on PG 11 and earlier is always an optimization fence; PG 12+ inlines
non-recursive CTEs unless you write `MATERIALIZED`.

## Red flags, in the order they usually matter

1. `loops` in the thousands on a node with any real cost — multiply before judging.
2. Estimate off by more than 10x anywhere below the slow node.
3. `Rows Removed by Filter` in the same order as rows read.
4. `Buffers: shared read` far larger than the row count justifies.
5. `Sort Method: external merge` or `Batches > 1`.
6. `Heap Fetches` high on an Index Only Scan.
7. `Heap Blocks: lossy` non-zero.
8. `Workers Launched` below `Workers Planned`.
9. A Seq Scan on a table above ~10k rows with a selective predicate.

## Comparing plans

When you change something, keep both plans and compare the same three numbers per node:
rows accuracy, buffers, and total time with loops multiplied out. If the new plan is
faster but reads the same number of pages, you probably just measured a warm cache. Run
each version twice and use the second run of each.
