#!/usr/bin/env bash
# Read-only Postgres performance diagnostic.
#
#   ./pg-diagnose.sh "postgres://user@host:5432/db"
#   ./pg-diagnose.sh              # uses $DATABASE_URL
#
# Every statement runs with default_transaction_read_only=on and a statement
# timeout, so it cannot write and cannot hang a busy server. It adapts its SQL to
# the server version: pg_stat_statements renamed its io-timing columns in PG 17.
#
# Options:
#   -n N   rows per ranking section (default 15)
#   -q     skip the sections that need pg_stat_statements
set -euo pipefail

LIMIT=15
SKIP_PGSS=0

while getopts "n:qh" opt; do
  case "$opt" in
    n) LIMIT="$OPTARG" ;;
    q) SKIP_PGSS=1 ;;
    h) sed -n '2,16p' "$0"; exit 0 ;;
    *) exit 2 ;;
  esac
done
shift $((OPTIND - 1))

CONN="${1:-${DATABASE_URL:-}}"
if [[ -z "$CONN" ]]; then
  echo "error: pass a connection string or set DATABASE_URL" >&2
  exit 2
fi

PSQL_BIN="${PSQL_BIN:-psql}"
command -v "$PSQL_BIN" >/dev/null 2>&1 || {
  echo "error: psql not found. On macOS: /opt/homebrew/opt/libpq/bin/psql" >&2
  exit 2
}

export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=30s -c lock_timeout=2s"

run() { "$PSQL_BIN" -X -q -v ON_ERROR_STOP=0 -d "$CONN" -c "$1"; }
scalar() { "$PSQL_BIN" -X -q -t -A -d "$CONN" -c "$1" 2>/dev/null | tr -d '[:space:]'; }

section() { printf '\n\n═══ %s ═══\n\n' "$1"; }

VERNUM="$(scalar 'SHOW server_version_num')"
[[ -z "$VERNUM" ]] && { echo "error: could not connect" >&2; exit 1; }

printf '%s\n' "Postgres server_version_num=$VERNUM  database=$(scalar 'SELECT current_database()')"
printf '%s\n' "read-only session, statement_timeout=30s"

# ---------------------------------------------------------------- server state

section "Server, settings and extensions"

run "SELECT version();"

run "SELECT name, setting, unit, source
     FROM pg_settings
     WHERE name IN ('shared_buffers','work_mem','maintenance_work_mem',
                    'effective_cache_size','random_page_cost','track_io_timing',
                    'max_connections','max_parallel_workers_per_gather',
                    'autovacuum_vacuum_scale_factor','autovacuum_vacuum_threshold',
                    'autovacuum_max_workers','autovacuum_vacuum_cost_delay',
                    'autovacuum_vacuum_cost_limit','default_statistics_target')
     ORDER BY name;"

run "SELECT extname, extversion FROM pg_extension ORDER BY extname;"

run "SELECT pg_postmaster_start_time() AS started_at,
            now() - pg_postmaster_start_time() AS uptime,
            pg_size_pretty(pg_database_size(current_database())) AS db_size;"

# ------------------------------------------------------- statement-level stats

HAS_PGSS="$(scalar "SELECT count(*) FROM pg_extension WHERE extname='pg_stat_statements'")"

if [[ "$SKIP_PGSS" == "0" && "${HAS_PGSS:-0}" != "0" ]]; then
  # PG 17 renamed blk_read_time -> shared_blk_read_time.
  if (( VERNUM >= 170000 )); then
    READ_T="shared_blk_read_time"
  else
    READ_T="blk_read_time"
  fi

  if (( VERNUM < 130000 )); then
    echo
    echo "note: server is older than PG 13 — pg_stat_statements has no exec/plan split."
    echo "      Falling back to total_time/mean_time."
    TOTAL_T="total_time"; MEAN_T="mean_time"; STDDEV_T="stddev_time"
  else
    TOTAL_T="total_exec_time"; MEAN_T="mean_exec_time"; STDDEV_T="stddev_exec_time"
  fi

  section "Top statements by TOTAL time (the ranking that matters)"

  run "SELECT
         queryid,
         calls,
         round(${TOTAL_T}::numeric, 1)   AS total_ms,
         round(${MEAN_T}::numeric, 2)    AS mean_ms,
         round(${STDDEV_T}::numeric, 2)  AS stddev_ms,
         rows,
         round(rows::numeric / nullif(calls, 0), 1) AS rows_per_call,
         round(100.0 * shared_blks_hit
               / nullif(shared_blks_hit + shared_blks_read, 0), 1) AS hit_pct,
         round(${READ_T}::numeric, 1)    AS read_ms,
         left(regexp_replace(query, '\s+', ' ', 'g'), 110) AS query
       FROM pg_stat_statements
       WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
       ORDER BY ${TOTAL_T} DESC
       LIMIT ${LIMIT};"

  section "Top statements by MEAN time (slow one-offs: reports, jobs)"

  run "SELECT queryid, calls,
              round(${MEAN_T}::numeric, 1)  AS mean_ms,
              round(${TOTAL_T}::numeric, 1) AS total_ms,
              rows,
              left(regexp_replace(query, '\s+', ' ', 'g'), 110) AS query
       FROM pg_stat_statements
       WHERE calls > 1
         AND dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
       ORDER BY ${MEAN_T} DESC
       LIMIT ${LIMIT};"

  section "Statements spilling to temp files (work_mem or row-estimate problem)"

  run "SELECT queryid, calls, temp_blks_written,
              pg_size_pretty(temp_blks_written * 8192::bigint) AS temp_size,
              left(regexp_replace(query, '\s+', ' ', 'g'), 100) AS query
       FROM pg_stat_statements
       WHERE temp_blks_written > 0
       ORDER BY temp_blks_written DESC
       LIMIT 10;"

  section "Statements generating the most WAL (the write-side cost)"

  run "SELECT queryid, calls, wal_records, wal_fpi,
              pg_size_pretty(wal_bytes::numeric) AS wal,
              left(regexp_replace(query, '\s+', ' ', 'g'), 100) AS query
       FROM pg_stat_statements
       WHERE wal_bytes > 0
       ORDER BY wal_bytes DESC
       LIMIT 10;"

  run "SELECT * FROM pg_stat_statements_info;" 2>/dev/null || true
else
  section "pg_stat_statements"
  if [[ "$SKIP_PGSS" == "1" ]]; then
    echo "skipped (-q)"
  else
    cat <<'EOF'
NOT INSTALLED. Without it you cannot rank queries by cost and every conclusion
about "the slow query" is a guess. Installing needs a config change and a restart:

  shared_preload_libraries = 'pg_stat_statements'   # postgresql.conf, then restart
  CREATE EXTENSION pg_stat_statements;

Ask before doing either on a production server.
EOF
  fi
fi

# -------------------------------------------------------------- table activity

section "Tables by sequential-scan volume (index candidates)"

run "SELECT
       relname,
       seq_scan,
       seq_tup_read,
       CASE WHEN seq_scan > 0
            THEN round(seq_tup_read::numeric / seq_scan, 0) END AS avg_rows_per_seq_scan,
       idx_scan,
       n_live_tup,
       pg_size_pretty(pg_relation_size(relid)) AS table_size
     FROM pg_stat_user_tables
     WHERE seq_tup_read > 0
     ORDER BY seq_tup_read DESC
     LIMIT ${LIMIT};"

section "Largest relations"

run "SELECT
       relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total,
       pg_size_pretty(pg_relation_size(relid))       AS heap,
       pg_size_pretty(pg_indexes_size(relid))        AS indexes,
       n_live_tup
     FROM pg_stat_user_tables
     ORDER BY pg_total_relation_size(relid) DESC
     LIMIT ${LIMIT};"

# ----------------------------------------------------------------- index waste

section "Indexes never used (candidates to drop — read the caveats)"

run "SELECT
       s.relname       AS table_name,
       s.indexrelname  AS index_name,
       s.idx_scan,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
     FROM pg_stat_user_indexes s
     JOIN pg_index i ON i.indexrelid = s.indexrelid
     WHERE s.idx_scan = 0
       AND NOT i.indisunique
       AND NOT i.indisprimary
     ORDER BY pg_relation_size(s.indexrelid) DESC
     LIMIT ${LIMIT};"

cat <<'EOF'
Caveats before dropping any of these:
  - counters reset on restart / pg_stat_reset(); compare against the uptime above
  - stats are per server: an index unused here may carry every read on a replica
  - cover a full business cycle, including month-end jobs
EOF

section "Exact duplicate indexes (same table, same key columns)"

run "SELECT
       indrelid::regclass AS table_name,
       array_agg(indexrelid::regclass) AS indexes,
       pg_size_pretty(sum(pg_relation_size(indexrelid))) AS combined_size
     FROM pg_index
     GROUP BY indrelid, indkey, indclass, indexprs, indpred
     HAVING count(*) > 1;"

section "Invalid indexes (failed CREATE INDEX CONCURRENTLY — pure cost, no benefit)"

run "SELECT indexrelid::regclass AS index_name,
            indrelid::regclass   AS table_name,
            pg_size_pretty(pg_relation_size(indexrelid)) AS size
     FROM pg_index
     WHERE NOT indisvalid;"

# ------------------------------------------------------- vacuum, bloat signals

section "Dead tuples and autovacuum lag"

run "SELECT
       relname,
       n_live_tup,
       n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       n_mod_since_analyze,
       last_autovacuum,
       last_autoanalyze,
       autovacuum_count
     FROM pg_stat_user_tables
     WHERE n_dead_tup > 1000
     ORDER BY n_dead_tup DESC
     LIMIT ${LIMIT};"

run "SELECT pid, relid::regclass AS table_name, phase,
            heap_blks_scanned, heap_blks_total,
            round(100.0 * heap_blks_scanned / nullif(heap_blks_total, 0), 1) AS pct
     FROM pg_stat_progress_vacuum;"

section "Transaction id age (wraparound risk)"

run "SELECT datname, age(datfrozenxid) AS xid_age,
            current_setting('autovacuum_freeze_max_age')::bigint AS freeze_max_age
     FROM pg_database
     ORDER BY age(datfrozenxid) DESC
     LIMIT 5;"

section "Things that hold the xmin horizon back (vacuum cleans nothing while these live)"

run "SELECT pid, state, now() - xact_start AS xact_age,
            left(regexp_replace(query, '\s+', ' ', 'g'), 80) AS query
     FROM pg_stat_activity
     WHERE xact_start IS NOT NULL
       AND now() - xact_start > interval '5 minutes'
     ORDER BY xact_start
     LIMIT 10;"

run "SELECT slot_name, slot_type, active, xmin, catalog_xmin
     FROM pg_replication_slots;"

run "SELECT gid, prepared, owner FROM pg_prepared_xacts;"

# ------------------------------------------------------------- live contention

section "Currently running (non-idle)"

run "SELECT pid, state, wait_event_type, wait_event,
            now() - query_start  AS runtime,
            now() - state_change AS in_state,
            left(regexp_replace(query, '\s+', ' ', 'g'), 90) AS query
     FROM pg_stat_activity
     WHERE state <> 'idle' AND pid <> pg_backend_pid()
     ORDER BY query_start NULLS LAST
     LIMIT ${LIMIT};"

section "Blocking chains"

run "SELECT
       blocked.pid   AS blocked_pid,
       left(regexp_replace(blocked.query, '\s+', ' ', 'g'), 60)  AS blocked_query,
       blocking.pid  AS blocking_pid,
       left(regexp_replace(blocking.query, '\s+', ' ', 'g'), 60) AS blocking_query,
       now() - blocking.xact_start AS blocking_xact_age
     FROM pg_stat_activity blocked
     JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS b(pid) ON true
     JOIN pg_stat_activity blocking ON blocking.pid = b.pid;"

section "Connections"

run "SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY 2 DESC;"

run "SELECT current_setting('max_connections') AS max_connections,
            count(*) AS in_use
     FROM pg_stat_activity;"

# ------------------------------------------------------------------ cache / io

section "Cache hit ratio (a smell, not a target)"

run "SELECT
       sum(heap_blks_hit)  AS hit,
       sum(heap_blks_read) AS read,
       round(100.0 * sum(heap_blks_hit)
             / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS hit_pct
     FROM pg_statio_user_tables;"

run "SELECT relname,
            heap_blks_read,
            round(100.0 * heap_blks_hit
                  / nullif(heap_blks_hit + heap_blks_read, 0), 1) AS hit_pct
     FROM pg_statio_user_tables
     WHERE heap_blks_read > 0
     ORDER BY heap_blks_read DESC
     LIMIT 10;"

printf '\n\n'
cat <<'EOF'
Next steps
  1. Pick ONE statement from the total-time ranking.
  2. EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) it.
     On PG 17 and older, BUFFERS is not automatic — keep it in the list.
  3. Classify the symptom using the table in SKILL.md, then read the matching
     reference before changing anything.
  4. Change one thing. Re-run this script and compare the same number.
EOF
