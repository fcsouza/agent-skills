#!/usr/bin/env bash
# Usage: ratchet.sh <base-ref> <regex> <message> [pathspec...]
# Fails when the working tree has more lines matching <regex> than the merge base with <base-ref> had.
set -euo pipefail
base=$1 pattern=$2 message=$3
shift 3
paths=("${@:-.}")

# Sums git grep -c output. Lines read path:count, or tree:path:count, so the count is the last field.
count() {
  local out rc=0
  out=$(git grep -I -c -E -e "$pattern" "$@" -- "${paths[@]}") || rc=$?
  ((rc <= 1)) || exit "$rc" # 1 means no match; anything higher is a real error.
  awk -F: '{ n += $NF } END { print n + 0 }' <<<"$out"
}

before=$(count "$(git merge-base "$base" HEAD)")
after=$(count --untracked)
if ((after > before)); then
  echo "ratchet: $after lines match /$pattern/, the base had $before. $message" >&2
  exit 1
fi
echo "ratchet: $after lines match /$pattern/ (base $before)"
