# Query rewrites

When the plan is bad because the query is bad, no index fixes it. These are the rewrites
that come up most often, roughly in order of how much time they tend to recover.

## Sargability: let the index see the column

A predicate can use an index only when the indexed expression appears unwrapped on one
side of the comparison.

```sql
-- no index can help
WHERE date_trunc('day', created_at) = '2026-08-01'
WHERE EXTRACT(year FROM created_at) = 2026
WHERE total_cents::text LIKE '15%'
WHERE lower(email) = 'a@b.com'        -- unless you indexed lower(email)

-- rewritten to ranges the index can scan
WHERE created_at >= '2026-08-01' AND created_at < '2026-08-02'
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'
WHERE total_cents >= 1500 AND total_cents < 1600
```

Implicit casts do the same damage. A `bigint` column compared to a parameter the driver
sends as `text` forces a cast on the column side and kills the index. Check the plan for
`Filter: ((id)::text = $1)` — that cast is the bug.

`LIKE 'prefix%'` can use a B-tree only under the C collation or an index built with
`text_pattern_ops`. `LIKE '%anywhere%'` needs `pg_trgm` + GIN.

## N+1: the query that is fast and still the problem

`pg_stat_statements` shows it as a low `mean_exec_time` with an enormous `calls`. The
database is not slow; it is being asked 4,000 times for one page.

The fix is in the application, not the database:

- ORM eager loading (`include` / `with` / `joinedload` / Drizzle's `with`).
- One query with `IN (...)` or `= ANY($1)` over the collected ids.
- A `LATERAL` join when you need "top N per group" rather than N separate queries.

```sql
-- one query instead of one per user
SELECT u.id, o.*
FROM users u
LEFT JOIN LATERAL (
  SELECT * FROM orders o
  WHERE o.user_id = u.id
  ORDER BY o.created_at DESC
  LIMIT 3
) o ON true
WHERE u.tenant_id = $1;
```

`LATERAL` with `LIMIT` is the idiomatic top-N-per-group in Postgres, and it uses the index
on `(user_id, created_at DESC)` for each probe. The window-function alternative
(`row_number() OVER (PARTITION BY ...)`) reads every row before filtering, so it loses on
wide groups and wins when you need the ranking anyway.

## Pagination: stop using OFFSET

`OFFSET 50000` makes the server produce 50,000 rows and throw them away. Cost grows
linearly with page number, so page 1 is fast and page 500 times out.

Keyset (cursor) pagination reads only what it returns:

```sql
-- first page
SELECT * FROM orders
WHERE tenant_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- next page, using the last row of the previous one
SELECT * FROM orders
WHERE tenant_id = $1
  AND (created_at, id) < ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

The row-value comparison `(a, b) < ($1, $2)` maps directly onto a `(a DESC, b DESC)` index,
which is what makes this constant-time per page. Include a unique tiebreaker (`id`) or
rows with equal timestamps will be skipped or repeated.

The trade: no "jump to page 37". Offer "next/previous" instead, which is what users
actually use past page 3.

Counting for a total is the other half of the problem. `COUNT(*)` over a large filtered
set scans everything. Options: cache the count, show "50+" past a threshold using
`LIMIT 51`, or accept the estimate from `EXPLAIN`'s row count for non-critical displays.

## OR across columns

An `OR` spanning different columns often prevents a single index scan.

```sql
-- frequently a seq scan
WHERE email = $1 OR phone = $1

-- two index scans the planner can combine
SELECT * FROM users WHERE email = $1
UNION ALL
SELECT * FROM users WHERE phone = $1 AND email IS DISTINCT FROM $1;
```

Check the plan before rewriting: a `BitmapOr` over two Bitmap Index Scans already does
this internally, and then the `UNION` gains nothing. Rewrite only when you see the seq
scan.

`IN (...)` on a single column is fine and uses the index. Very long `IN` lists are better
as `= ANY($1::bigint[])`, which keeps the statement text stable so `pg_stat_statements`
can aggregate it — Postgres also squashes long constant lists into one entry, shown as
`IN ($1 /*, ... */)`.

## EXISTS vs IN vs JOIN

- `EXISTS (SELECT 1 FROM ... WHERE ...)` — semi-join, stops at the first match. Best for
  "does any related row exist".
- `IN (subquery)` — the planner usually turns it into the same semi-join. Equivalent in
  most cases.
- `NOT IN (subquery)` — **avoid**. If the subquery returns a single NULL, the whole
  predicate is NULL and you get zero rows. Use `NOT EXISTS`, which handles NULLs correctly
  and usually plans better as an anti-join.
- `JOIN` — use when you need columns from the other table. If you only need existence, a
  join can multiply rows and force a `DISTINCT`, which is more expensive than `EXISTS`.

## DISTINCT as a symptom

A `DISTINCT` bolted onto a query is usually cleaning up duplicates a join created. That
means the server built the duplicates, sorted or hashed them, and then discarded them.
Look at whether the join should be an `EXISTS`, or whether a join key is missing.

`DISTINCT ON (col)` is the Postgres-specific form for "one row per col" and is efficient
when it can consume an index in the right order:

```sql
SELECT DISTINCT ON (user_id) user_id, created_at, status
FROM orders
ORDER BY user_id, created_at DESC;   -- ORDER BY must start with the DISTINCT ON columns
```

## CTEs

Since PG 12, a non-recursive CTE referenced once is inlined and optimized with the rest of
the query. Two things still bite:

- `WITH x AS MATERIALIZED (...)` forces the old fence behaviour. Use it deliberately — for
  example to stop an expensive function being re-evaluated — not by habit.
- A CTE referenced more than once is materialized by default. If each use has a different
  selective filter, repeating the subquery can be faster than sharing one materialized
  result.

`MATERIALIZED` is a real tool when the planner keeps pushing a filter into a subquery that
becomes expensive. Just say why you used it.

## Aggregations

- Filter before you aggregate. `WHERE` runs before grouping; `HAVING` runs after. A
  condition that does not reference an aggregate belongs in `WHERE`.
- `FILTER` beats `CASE WHEN` inside aggregates for readability and is no slower:
  `count(*) FILTER (WHERE status = 'paid')`.
- Rolling counters, dashboards and "total orders per day" belong in a summary table or
  materialized view refreshed on a schedule, not recomputed per request over the whole
  history. `REFRESH MATERIALIZED VIEW CONCURRENTLY` avoids locking readers but needs a
  unique index on the view.

## Batch writes

- `UPDATE`/`DELETE` over millions of rows in one statement holds locks, generates one huge
  WAL burst, and gives autovacuum a mountain of dead tuples at once. Chunk it by primary
  key range with a `LIMIT`, commit between chunks, and let autovacuum keep up.
- Bulk load with `COPY`, not row-by-row `INSERT`. For very large loads, drop non-essential
  indexes first and rebuild them after — but only when you can afford the window where
  they are missing.
- `INSERT ... ON CONFLICT DO NOTHING/UPDATE` in one statement beats a `SELECT` then
  `INSERT` round trip, and is race-free.
- Always `ANALYZE` after a bulk load. Until you do, the planner is working from
  pre-load statistics and every plan is suspect.

## Two ORM-specific traps

- `SELECT *` generated by the ORM defeats index-only scans and drags TOASTed columns across
  the wire. Select the columns you use.
- Query builders that add `ORDER BY id` implicitly can turn a cheap `LIMIT 1` into a full
  sort when no matching index exists. Check the generated SQL, not the builder code.
