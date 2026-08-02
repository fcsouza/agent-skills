# Index design

An index is a bet: you pay on every write and every vacuum to make some reads cheap.
Before adding one, be able to say which query it serves, how often that query runs, and
what it costs the write path. If you cannot, you are guessing.

## Before adding: can an existing index do the job?

A B-tree can serve any **leading prefix** of its key columns. An index on
`(tenant_id, status, created_at)` also serves queries on `(tenant_id)` and
`(tenant_id, status)`. So:

- Extending an existing index is usually better than adding a new one.
- An index on `(a)` is dead weight when `(a, b)` exists — drop the narrow one.

On **PG 18+** the planner can also use a composite index when the leading column is *not*
constrained, via B-tree **skip scan**: it iterates the distinct leading values and searches
within each. This works best when the leading column has few distinct values. It does not
make the leading column irrelevant — a query that filters only on `created_at` against
`(tenant_id, created_at)` will be much slower than one that also pins `tenant_id` — but it
does mean some indexes you would have added on PG 17 are no longer worth it. Measure both.

## Column order

For a composite B-tree, order by how the columns are used, not by cardinality:

1. Columns compared with **equality** (`=`, `IN`) come first.
2. Then the column used for **range** (`<`, `>`, `BETWEEN`) or for `ORDER BY`.
3. Anything after a range column cannot be used for further index-level filtering — the
   scan is already reading a contiguous span.

```sql
-- WHERE tenant_id = $1 AND status = $2 AND created_at > $3 ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY orders_tenant_status_created_idx
  ON orders (tenant_id, status, created_at DESC);
```

The `DESC` matters when the query sorts descending and you want the index to supply the
order without a sort node. Postgres can scan a B-tree backwards, so a plain ascending
index usually works too — but not when you mix directions across columns
(`ORDER BY a ASC, b DESC` needs `(a ASC, b DESC)`).

`NULLS FIRST` / `NULLS LAST` follows the same rule: the index must match the query's null
ordering for the sort to be free. Default is `NULLS LAST` for `ASC`, `NULLS FIRST` for
`DESC`.

## Partial indexes

Index only the rows you query. Smaller index, cheaper writes for rows outside the
predicate, and often a much better plan.

```sql
CREATE INDEX CONCURRENTLY orders_pending_idx
  ON orders (created_at)
  WHERE status = 'pending';
```

The planner uses a partial index only when it can prove the query predicate implies the
index predicate. `WHERE status = 'pending'` matches; `WHERE status = $1` does **not**,
because the planner cannot prove it at plan time for a generic plan. That is the most
common reason a partial index looks ignored.

Best cases: soft-delete flags (`WHERE deleted_at IS NULL`), state machines where one state
is a tiny fraction of the table, and nullable columns where you only ever query non-nulls.

## Covering indexes and INCLUDE

`INCLUDE` adds non-key columns to the leaf entries. They cannot be searched or used for
ordering, but they can be returned, which enables an index-only scan for queries that
would otherwise need a heap fetch.

```sql
CREATE INDEX CONCURRENTLY orders_lookup_idx
  ON orders (tenant_id, created_at) INCLUDE (total_cents, status);
```

Constraints worth knowing before you reach for it:

- Only B-tree, GiST and SP-GiST support `INCLUDE`.
- An index can have at most 32 columns total, counting `INCLUDE` columns.
- Included columns duplicate table data, so the index gets bigger and searches slower. Be
  conservative, especially with wide columns; if an index tuple exceeds the maximum size
  the insert fails outright.
- **B-tree deduplication is never used on an index with `INCLUDE` columns.** On a table
  with many repeated key values that can outweigh the benefit.

An index-only scan also depends on the visibility map being current. If `Heap Fetches` is
high in the plan, the index is fine and vacuum is behind — see [maintenance.md](maintenance.md).

## Expression indexes

When the query filters on a function result, the plain column index cannot be used.

```sql
-- WHERE lower(email) = lower($1)
CREATE INDEX CONCURRENTLY users_email_lower_idx ON users (lower(email));
```

The expression in the index must match the expression in the query exactly. The function
must be `IMMUTABLE`; `now()` and anything timezone-dependent cannot be indexed.

Postgres does not collect statistics on a plain column for the expression's distribution,
but it does collect them for the expression index itself once `ANALYZE` has run — which is
a second reason expression indexes often help more than expected.

For case-insensitive text, a `citext` column or a non-deterministic collation is an
alternative, at the cost of losing B-tree deduplication on that column.

## Choosing the index type

| Type | Use it for | Notes |
| --- | --- | --- |
| **B-tree** | equality, ranges, sorting, `LIKE 'prefix%'` on a C-collation or `text_pattern_ops` index | the default; the only type supporting unique indexes |
| **GIN** | `jsonb` containment, arrays, full-text search, trigram `LIKE '%mid%'` | large, slow to update; `fastupdate` batches writes into a pending list |
| **GiST** | ranges, geometry, nearest-neighbour (`ORDER BY point <-> $1`), exclusion constraints | lossy, so results are rechecked |
| **SP-GiST** | non-balanced structures: quadtrees, text prefix trees, IP ranges | |
| **BRIN** | very large tables where the column correlates with physical order (append-only timestamps, ids) | tiny index, coarse; useless once physical order is broken by updates |
| **Hash** | equality only, on large values | WAL-logged and crash-safe since PG 10; rarely beats B-tree in practice |

Two combinations worth knowing:

- `pg_trgm` + GIN turns `LIKE '%substring%'` and similarity search into an index scan.
  Without it, a leading wildcard always means a sequential scan.
- `btree_gin` / `btree_gist` let you mix a scalar column into a GIN or GiST index, which is
  how you get `WHERE tenant_id = $1 AND jsonb_col @> $2` served by one index.

## B-tree deduplication

On by default since PG 13. Repeated key values are stored once with a list of row pointers,
which shrinks indexes on low-cardinality columns and speeds up scans. It is disabled
automatically — silently — for:

- `numeric` (display scale must be preserved)
- `jsonb` (uses `numeric` internally)
- `float4` / `float8` (`-0` and `0` compare equal but differ)
- `text`/`varchar`/`char` under a **non-deterministic** collation
- container types: composite types, arrays, ranges
- any index with `INCLUDE` columns

If you have a low-cardinality index that is larger than you expect, check whether one of
these applies. Storing a status as `text` rather than `numeric` can make its index
dramatically smaller.

## When not to add an index

- **The table is small.** A sequential scan of a few thousand rows beats index maintenance.
- **The predicate is not selective.** An index that matches 40% of the table will be
  ignored in favour of a seq scan, and the planner is right.
- **The table is write-heavy and the query is rare.** Compute the trade: an index on a
  table taking 5,000 inserts/second to serve a query that runs hourly is a bad deal.
- **The real problem is upstream.** An N+1 loop does not get fixed by indexing it; it gets
  fixed by not running 4,000 queries. See [query-rewrites.md](query-rewrites.md).
- **The predicate is not sargable.** No index helps `WHERE date_trunc('day', created_at) = $1`
  unless you index that exact expression or rewrite the query to a range.

## Verifying an index is used

After creating it:

```sql
ANALYZE orders;                            -- fresh stats first
EXPLAIN (ANALYZE, BUFFERS) <the query>;    -- is the index in the plan?
SELECT idx_scan FROM pg_stat_user_indexes
WHERE indexrelname = 'orders_tenant_status_created_idx';
```

If the planner ignores it, the usual reasons are: stale statistics, a type mismatch in the
predicate (`bigint` column compared to a `text` parameter), a function wrapping the column,
a partial-index predicate the planner cannot prove, or the index genuinely not being
cheaper. Confirm which by testing with `SET enable_seqscan = off` **in your session only** —
if it still refuses the index, the index does not apply; if it uses it and is slower, the
planner was right.

Never leave `enable_seqscan = off` behind. It is a diagnostic, not a fix.
