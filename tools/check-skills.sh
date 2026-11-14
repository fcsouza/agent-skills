#!/usr/bin/env bash
# Lint for the game-dev skills.
#
# Usage: tools/check-skills.sh [--only ID,ID] [--final] [skill-dir ...]
#
# With no skill directory it checks every skill listed in the marketplace
# `game-dev` entry, plus the repo-level checks (R1 on README and marketplace,
# R2, M1, M2, P1, Z1). With directories it runs only the per-skill checks on
# them. Each failure prints `FAIL <ID> <path>: <message>`. Exit 1 on any
# failure, 0 otherwise.
#
# The repo root comes from CHECK_SKILLS_ROOT, else `git rev-parse --show-toplevel`.
#
# A new check goes in check_skill when it reads one skill (content checks
# under its is_pending guard), or in the REPO_LEVEL block at the end.

# Check IDs:
#   N1 name equals the directory, kebab-case, at most 64 characters
#   N2 description exists, at most 1,024 characters
#   N3 frontmatter parses as YAML
#   S1 SKILL.md under 500 lines
#   R1 no banned legacy strings in a skill, README or marketplace entry
#   R2 no skill count in README or marketplace
#   L1 relative links and templates/ boilerplate/ references/ paths resolve
#   L2 every file under templates/ boilerplate/ references/ is mentioned
#   M1 marketplace loads and every listed path has a SKILL.md
#   M2 every skill directory is listed in the marketplace and linked in README
#   X1 required, applied and routed skills exist; a command lists what it applies
#   P1 no machine path or local dependency URL
#   C1 no "## Sources" heading in SKILL.md
#   C2 no block quote in SKILL.md
#   C3 every bullet in references/sources.md has an https:// link
#   C4 a .ts file with a third-party import starts with a "Verified against" line
#   C5 description has no "Triggers:" list
#   O1 closing sections in order: Pitfalls, Files, Related skills, after every
#      other `## ` heading; Related, Cross-references, Reference files and
#      Citations are named Related skills / Files
#   Z1 with --final, no .content-pending file remains
ALL_IDS="N1 N2 N3 S1 R1 R2 L1 L2 M1 M2 X1 P1 C1 C2 C3 C4 C5 O1 Z1"
MARKETPLACE=".claude-plugin/marketplace.json"
# Directories under skills/ that the game-dev set leaves out.
EXCLUDED="claude-agent-sdk database-performance-tuning foundry-vtt-module-dev foundry-vtt-system-dev nuvemshop-sdk openclaw-genie react-animations"

ONLY=""
FINAL=0
STATUS=0
DIRS=()
SKILLS=()
ENTRY=""

usage() {
  printf 'usage: check-skills.sh [--only ID,ID] [--final] [skill-dir ...]\n' >&2
  exit 2
}

# ---------------------------------------------------------------- helpers

# fail <ID> <path> <message>: print the failure and record it.
# --only filters here, so every check can run unconditionally.
fail() {
  if [[ -n $ONLY && ",$ONLY," != *",$1,"* ]]; then
    return
  fi
  printf 'FAIL %s %s: %s\n' "$1" "$2" "$3"
  STATUS=1
}

# fail_load <path> <message>: a manifest that cannot be loaded, or a skill
# directory with no SKILL.md, leaves nothing to check, so its M1 line prints
# whatever --only says.
fail_load() {
  printf 'FAIL M1 %s: %s\n' "$1" "$2"
  STATUS=1
}

is_pending() { [[ -e $ROOT/$1/.content-pending ]]; }

# fm_field <file> <key>: value of a frontmatter key, quotes stripped.
# Handles `key: value`, a plain value wrapped onto indented lines, and folded
# or literal blocks (`key: >` / `key: |`). Continuation lines join with a
# space. CRLF line ends are read as LF. Exit 1 when the key is absent.
fm_field() {
  awk -v key="$2" '
    { sub(/\r$/, "") }
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 {
      if (collecting) {
        if ($0 ~ /^[ \t]/ || $0 == "") {
          line = $0; sub(/^[ \t]+/, "", line)
          if (line != "") val = val (val == "" ? "" : " ") line
          next
        }
        collecting = 0
      }
      if (index($0, key ":") == 1) {
        v = substr($0, length(key) + 2); sub(/^[ \t]+/, "", v); sub(/[ \t]+$/, "", v)
        found = 1
        collecting = 1
        val = (v ~ /^[>|][-+]?$/) ? "" : v
      }
    }
    END {
      if (!found) exit 1
      if (val ~ /^".*"$/ || val ~ /^'\''.*'\''$/) val = substr(val, 2, length(val) - 2)
      print val
    }' "$1"
}

# p1_files: NUL-separated files P1 scans: every file under the listed game-dev
# skill directories, plus tools/, evals/, docs/superpowers/, bun.lock,
# README.md, LICENSE and the marketplace manifest. Tracked files when ROOT is
# its own git repo, every file in those places otherwise.
p1_files() {
  local prefix paths=(tools evals docs/superpowers bun.lock README.md LICENSE "$MARKETPLACE") dir
  for dir in "${SKILLS[@]}"; do
    paths+=("$dir")
  done
  # An empty prefix means ROOT is the top of a work tree. Comparing it with
  # --show-toplevel would fail where ROOT sits behind a symlink.
  if prefix="$(git -C "$ROOT" rev-parse --show-prefix 2>/dev/null)" && [[ -z $prefix ]]; then
    git -C "$ROOT" -c core.quotePath=false ls-files -z -- "${paths[@]}"
  else
    (
      cd "$ROOT" || exit
      for p in "${paths[@]}"; do
        if [[ -d $p ]]; then find "$p" -type f -print0; elif [[ -f $p ]]; then printf '%s\0' "$p"; fi
      done
    )
  fi
}

# ---------------------------------------------------------------- per-skill checks

check_n1() { # dir
  local dir=$1 base name
  base="$(basename "$dir")"
  if ! name="$(fm_field "$ROOT/$dir/SKILL.md" name)"; then
    fail N1 "$dir/SKILL.md" "frontmatter has no name"
    return
  fi
  [[ $name == "$base" ]] || fail N1 "$dir/SKILL.md" "name '$name' differs from directory '$base'"
  [[ $name =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail N1 "$dir/SKILL.md" "name '$name' is not lowercase kebab-case"
  ((${#name} <= 64)) || fail N1 "$dir/SKILL.md" "name is ${#name} characters, limit is 64"
}

check_n2() {
  local dir=$1 desc
  if ! desc="$(fm_field "$ROOT/$dir/SKILL.md" description)" || [[ -z $desc ]]; then
    fail N2 "$dir/SKILL.md" "description is missing"
    return
  fi
  ((${#desc} <= 1024)) || fail N2 "$dir/SKILL.md" "description is ${#desc} characters, limit is 1024"
}

# N3: the frontmatter must parse as YAML. Claude Code and `npx skills` skip a
# skill whose frontmatter does not parse, and a plain scalar holding ": " is
# the usual cause. Uses Bun's YAML parser; skipped when bun is not installed.
check_n3() {
  local dir=$1 err
  command -v bun >/dev/null 2>&1 || return 0
  if ! err="$(bun -e '
const t = (await Bun.file(process.argv[1]).text()).replace(/\r\n/g, "\n");
const m = t.match(/^---\n([\s\S]*?)\n---(\n|$)/);
if (!m) process.exit(0);
try { Bun.YAML.parse(m[1]); } catch (e) { console.log(e.message); process.exit(1); }
' "$ROOT/$dir/SKILL.md" 2>&1)"; then
    fail N3 "$dir/SKILL.md" "frontmatter is not valid YAML (${err}); quote the value or use a folded block (>-)"
  fi
}

check_s1() {
  local dir=$1 lines
  lines="$(wc -l <"$ROOT/$dir/SKILL.md" | tr -d ' ')"
  ((lines < 500)) || fail S1 "$dir/SKILL.md" "$lines lines, limit is 499"
}

# unfenced <file>: the file with the lines inside ``` or ~~~ code fences blanked.
unfenced() {
  awk '/^[ \t]*(```|~~~)/ { fenced = !fenced; print ""; next } { print (fenced ? "" : $0) }' "$1"
}

# A target ending in / may be a directory; any other target must be a file.
check_l1() {
  local dir=$1 target path
  while IFS= read -r target; do
    case $target in
      *://* | '#'* | mailto:* | *[\*\<\>\{\}\$]*) continue ;;
    esac
    path="${target%%[#?]*}"
    [[ -n $path ]] || continue
    if [[ $path == */ ]]; then
      [[ -d $ROOT/$dir/$path ]] || fail L1 "$dir/SKILL.md" "'$target' is not a directory"
    else
      [[ -f $ROOT/$dir/$path ]] || fail L1 "$dir/SKILL.md" "'$target' does not resolve to a file"
    fi
  done < <(
    unfenced "$ROOT/$dir/SKILL.md" >"$TMP/l1-body"
    grep -oE '\]\([^)[:space:]]+\)' "$TMP/l1-body" | sed -E 's/^\]\(//; s/\)$//'
    grep -oE '`(templates|boilerplate|references)/[^`]+`' "$TMP/l1-body" | tr -d '`'
  )
}

check_l2() {
  local dir=$1 file relpath
  while IFS= read -r file; do
    relpath="${file#"$ROOT/$dir/"}"
    [[ $(basename "$file") == .DS_Store ]] && continue
    grep -qF -- "$relpath" "$ROOT/$dir/SKILL.md" || fail L2 "$dir/$relpath" "not mentioned in SKILL.md"
  done < <(find "$ROOT/$dir/templates" "$ROOT/$dir/boilerplate" "$ROOT/$dir/references" -type f 2>/dev/null | sort)
}

skill_exists() {
  [[ -f $ROOT/skills/$1/SKILL.md || -f $ROOT/skills/game-dev-commands/$1/SKILL.md ]]
}

# x1_requires <file>: backticked names on "- " lines of the Requires block.
x1_requires() {
  awk '
    /^#+[ \t]+Requires[ \t]*$/ { inblock = 1; next }
    /^#/ { inblock = 0 }
    inblock && /^- / { print }
  ' "$1" | grep -oE '`[^`]+`' | tr -d '`' | sort -u
}

# x1_applied <file>: names in "apply the `name`", "apply `name`" and
# "apply `a` and `b`", any case.
x1_applied() {
  grep -oiE 'apply (the )?`[^`]+`( and `[^`]+`)*' "$1" | grep -oE '`[^`]+`' | tr -d '`' | sort -u
}

# x1_route <file>: backticked tokens in the last column (Skill) of the table
# rows of the "## Route" section, a leading / stripped.
x1_route() {
  awk -F'|' '
    /^##[ \t]+Route[ \t]*$/ { inroute = 1; next }
    /^##[ \t]/ { inroute = 0 }
    inroute && /^\|/ {
      sub(/\r$/, "")
      last = NF
      if ($last ~ /^[ \t]*$/) last--
      print $last
    }
  ' "$1" | grep -oE '`[^`]+`' | tr -d '`' | sed 's#^/##' | sort -u
}

check_x1() {
  local dir=$1 file="$ROOT/$1/SKILL.md" name required is_command=0
  [[ $dir == skills/game-dev-commands/* ]] && is_command=1
  required="$(x1_requires "$file")"

  if ((is_command)) && ! grep -qE '^##[[:space:]]+Requires[[:space:]]*$' "$file"; then
    fail X1 "$dir/SKILL.md" "command has no '## Requires' heading"
  fi

  while IFS= read -r name; do
    [[ -n $name ]] || continue
    skill_exists "$name" || fail X1 "$dir/SKILL.md" "required skill '$name' does not exist"
  done <<<"$required"

  while IFS= read -r name; do
    [[ -n $name ]] || continue
    if ! skill_exists "$name"; then
      fail X1 "$dir/SKILL.md" "applied skill '$name' does not exist"
    elif ((is_command)) && ! grep -qxF -- "$name" <<<"$required"; then
      fail X1 "$dir/SKILL.md" "applied skill '$name' is not listed under Requires"
    fi
  done < <(x1_applied "$file")

  if [[ $dir == skills/game-dev ]]; then
    local route listed
    route="$(x1_route "$file")"
    while IFS= read -r name; do
      [[ -n $name ]] || continue
      skill_exists "$name" || fail X1 "$dir/SKILL.md" "Route table names '$name', which does not exist"
    done <<<"$route"
    # Every other listed skill needs a Route row. Paths with no SKILL.md are M1's.
    if ((REPO_LEVEL)); then
      for listed in "${SKILLS[@]}"; do
        [[ $listed == skills/game-dev || ! -f $ROOT/$listed/SKILL.md ]] && continue
        name="$(basename "$listed")"
        grep -qxF -- "$name" <<<"$route" ||
          fail X1 "$dir/SKILL.md" "Route table does not name '$name', which the marketplace lists"
      done
    fi
  fi
}

check_c1() {
  grep -qE '^##[[:space:]]+Sources[[:space:]]*$' "$ROOT/$1/SKILL.md" &&
    fail C1 "$1/SKILL.md" "has a '## Sources' heading"
}

check_c2() {
  local n
  while IFS=: read -r n _; do
    fail C2 "$1/SKILL.md" "line $n is a block quote; state it as plain text and put its source in references/sources.md"
  done < <(unfenced "$ROOT/$1/SKILL.md" | grep -n '^>')
}

check_c3() {
  local file="$ROOT/$1/references/sources.md" n
  [[ -f $file ]] || return 0
  while IFS=: read -r n _; do
    fail C3 "$1/references/sources.md" "line $n has no https:// link"
  done < <(grep -nE '^- ' "$file" | grep -v 'https://')
}

# First line of a .ts file with a third-party import:
# `// Verified against: <pkg> <version>[, <pkg> <version>...] (<YYYY-MM-DD>)`.
C4_HEADER='^// Verified against: [^ ,]+ [^ ,()]+(, [^ ,]+ [^ ,()]+)* \([0-9]{4}-[0-9]{2}-[0-9]{2}\)$'

check_c4() {
  local dir=$1 file mod
  while IFS= read -r file; do
    while IFS= read -r mod; do
      case $mod in . | ./* | ../* | node:*) continue ;; esac
      head -n 1 "$file" | tr -d '\r' | grep -qE "$C4_HEADER" ||
        fail C4 "${file#"$ROOT"/}" "imports '$mod' without the first line '// Verified against: <pkg> <version> (<YYYY-MM-DD>)'"
      break
    done < <(
      grep -oE "(from|import)[[:space:]]+['\"][^'\"]+['\"]" "$file" |
        sed -E "s/^(from|import)[[:space:]]+['\"]//; s/['\"]\$//"
    )
  done < <(find "$ROOT/$dir/boilerplate" "$ROOT/$dir/templates" -name '*.ts' -type f 2>/dev/null | sort)
}

check_c5() {
  local desc
  desc="$(fm_field "$ROOT/$1/SKILL.md" description)" || return 0
  [[ $desc == *"Triggers:"* ]] && fail C5 "$1/SKILL.md" "description contains 'Triggers:'"
}

# O1: the closing sections of a topic skill come last and in one order:
# `## Pitfalls`, `## Files`, `## Related skills`. Commands and the index have
# their own layout and are skipped. Headings inside code fences do not count.
check_o1() {
  local dir=$1 n name canon key
  case $dir in skills/game-dev | skills/game-dev-commands/*) return 0 ;; esac
  unfenced "$ROOT/$dir/SKILL.md" | awk '/^## / { sub(/\r$/, ""); sub(/^## +/, ""); sub(/[ \t]+$/, ""); print NR "\t" $0 }' >"$TMP/o1-headings"
  local prev_rank=0 prev_name="" rank
  while IFS=$'\t' read -r n name; do
    # Compare without a leading "N. " and without case; "...pitfalls" is a
    # Pitfalls heading under another spelling.
    key="$(printf '%s' "$name" | sed -E 's/^[0-9]+\.[ \t]+//' | tr '[:upper:]' '[:lower:]')"
    canon=""
    case $key in
      related | cross-references) canon="Related skills" ;;
      "related skills") canon="Related skills" ;;
      "reference files" | citations | files) canon="Files" ;;
      pitfalls | *" pitfalls") canon="Pitfalls" ;;
    esac
    if [[ -n $canon ]]; then
      [[ $name == "$canon" ]] || fail O1 "$dir/SKILL.md" "line $n: heading '$name' is named '$canon'"
      name=$canon
    fi
    case $name in
      Pitfalls) rank=1 ;;
      Files) rank=2 ;;
      "Related skills") rank=3 ;;
      *) rank=0 ;;
    esac
    if ((rank == 0)); then
      if ((prev_rank > 0)); then
        fail O1 "$dir/SKILL.md" "line $n: '## $name' comes after '## $prev_name'; Pitfalls, Files and Related skills close the file"
      fi
    else
      if ((rank < prev_rank)); then
        fail O1 "$dir/SKILL.md" "line $n: '## $name' comes after '## $prev_name'; the order is Pitfalls, Files, Related skills"
      fi
      prev_rank=$rank
      prev_name=$name
    fi
  done <"$TMP/o1-headings"
}

check_skill() {
  local dir=$1
  if [[ ! -f $ROOT/$dir/SKILL.md ]]; then
    # In repo mode check_m1 reports a listed path with no SKILL.md.
    ((REPO_LEVEL)) || fail_load "$dir" "no SKILL.md"
    return
  fi
  check_n1 "$dir"
  check_n2 "$dir"
  check_n3 "$dir"
  check_l1 "$dir"
  check_x1 "$dir"
  if ! is_pending "$dir"; then
    check_s1 "$dir"
    check_l2 "$dir"
    check_c1 "$dir"
    check_c2 "$dir"
    check_c3 "$dir"
    check_c4 "$dir"
    check_c5 "$dir"
    check_o1 "$dir"
  fi
}

# ---------------------------------------------------------------- R1

# r1_scan <label> <file> <pattern-file> [filter-readme]: report banned
# patterns in a file.
r1_scan() {
  local label=$1 file=$2 patterns=$3 readme=${4:-0} n hit
  while IFS=: read -r n hit; do
    fail R1 "$label" "line $n contains '$hit'"
  done < <(
    if [[ $readme == 1 ]]; then
      # Drop the "Upgrading from 1.x" section: it must name the old paths.
      awk '
        /^## Upgrading from 1\.x/ { skip = 1; next }
        /^## / { skip = 0 }
        { print (skip ? "" : $0) }
      ' "$file"
    else
      cat "$file"
    fi | grep -noE -f "$patterns"
  )
}

check_r1() { # repo-level flag: 1 when README and marketplace are in scope
  local dir file name d
  local patterns="$TMP/r1-patterns" skill_patterns="$TMP/r1-skill-patterns"
  {
    printf '%s\n' \
      'skills/game-dev/(design|engineering|narrative|infrastructure)' \
      'plugins/game-dev' 'CLAUDE_HOOK_INPUT' 'CLAUDE_PLUGIN_ROOT' 'bunx biome' \
      'bun\.lockb' 'game-asset-gen' 'idle-game-design' 'claude-code-game-workflow' \
      'cursor-codex-integration'
    for d in "$ROOT"/skills/*/ "$ROOT"/skills/game-dev-commands/*/; do
      [[ -d $d ]] || continue
      name="$(basename "$d")"
      printf '(design|engineering|narrative|infrastructure)-%s\n' "$name"
    done
  } >"$patterns"
  # The skills install with `bunx skills`; README keeps the public `npx skills` line.
  { cat "$patterns"; printf '%s\n' 'npx skills'; } >"$skill_patterns"

  for dir in "${SKILLS[@]}"; do
    [[ -d $ROOT/$dir ]] || continue
    while IFS= read -r file; do
      grep -qI . "$file" 2>/dev/null || continue
      r1_scan "${file#"$ROOT"/}" "$file" "$skill_patterns"
    done < <(find "$ROOT/$dir" -type f | sort)
  done
  if [[ $1 == 1 ]]; then
    [[ -f $ROOT/README.md ]] && r1_scan README.md "$ROOT/README.md" "$patterns" 1
    # Only the game-dev entry: the manifest also lists unrelated plugins.
    if [[ -n $ENTRY ]]; then
      printf '%s' "$ENTRY" | jq . >"$TMP/game-dev-entry.json"
      r1_scan "$MARKETPLACE (game-dev entry)" "$TMP/game-dev-entry.json" "$patterns"
    fi
  fi
}

# ---------------------------------------------------------------- repo-level checks

check_r2() {
  local desc
  desc="$(printf '%s' "$ENTRY" | jq -r 'tostring' 2>/dev/null)"
  if [[ -n $ENTRY ]] && printf '%s' "$desc" | grep -qE '[0-9]+ skills'; then
    fail R2 "$MARKETPLACE" "game-dev entry contains a skill count"
  fi
  if [[ -f $ROOT/README.md ]] && grep -qE '[0-9]+ skills' "$ROOT/README.md"; then
    fail R2 README.md "contains a skill count"
  fi
}

# load_entry: set ENTRY and SKILLS from the marketplace; prints M1 on failure.
load_entry() {
  local skills_json
  if [[ ! -f $ROOT/$MARKETPLACE ]]; then
    fail_load "$MARKETPLACE" "file not found"
    return
  fi
  if ! jq empty "$ROOT/$MARKETPLACE" >/dev/null 2>&1; then
    fail_load "$MARKETPLACE" "not valid JSON"
    return
  fi
  ENTRY="$(jq -c '[.plugins[]? | select(.name == "game-dev")][0] // empty' "$ROOT/$MARKETPLACE" 2>/dev/null)"
  if [[ -z $ENTRY ]]; then
    fail_load "$MARKETPLACE" "no plugin named game-dev"
    return
  fi
  if ! printf '%s' "$ENTRY" | jq -e '.skills | type == "array"' >/dev/null 2>&1; then
    fail_load "$MARKETPLACE" "game-dev entry has no skills array"
    return
  fi
  if printf '%s' "$ENTRY" | jq -e '.skills | length == 0' >/dev/null 2>&1; then
    fail_load "$MARKETPLACE" "game-dev entry lists no skills"
    return
  fi
  skills_json="$(printf '%s' "$ENTRY" | jq -r '.skills[]')"
  local p
  while IFS= read -r p; do
    [[ -n $p ]] || continue
    p="${p#./}"
    SKILLS+=("${p%/}")
  done <<<"$skills_json"
}

check_m1() {
  local dir
  for dir in "${SKILLS[@]}"; do
    [[ -f $ROOT/$dir/SKILL.md ]] || fail M1 "$MARKETPLACE" "listed path '$dir' has no SKILL.md"
  done
}

check_m2() {
  local d name listed ex
  for d in "$ROOT"/skills/*/ "$ROOT"/skills/game-dev-commands/*/; do
    [[ -d $d ]] || continue
    name="$(basename "$d")"
    [[ $name == game-dev-commands ]] && continue
    case " $EXCLUDED " in *" $name "*) continue ;; esac
    d="${d%/}"
    d="${d#"$ROOT"/}"
    listed=0
    for ex in "${SKILLS[@]}"; do
      [[ $ex == "$d" ]] && listed=1
    done
    ((listed)) || fail M2 "$MARKETPLACE" "'$d' is not listed in the game-dev skills array; add it there, or, if it is not a game-dev skill, add its name to EXCLUDED in tools/check-skills.sh"
  done

  # README links each listed skill as (skills/<name>/), commands as
  # (skills/game-dev-commands/<name>/). Paths with no SKILL.md are M1's.
  [[ -f $ROOT/README.md ]] || return 0
  for d in "${SKILLS[@]}"; do
    [[ -f $ROOT/$d/SKILL.md ]] || continue
    grep -qF -- "($d/)" "$ROOT/README.md" ||
      fail M2 README.md "'$d' has no link ($d/); add it to the README tables"
  done
}

check_p1() {
  local file label n
  # Split into fragments so P1 (which scans tools/) and the owner's pre-commit
  # path grep do not match this file.
  local pats=(-e "/Us""ers/" -e "/ho""me/" -e "li""nk:/" -e "fi""le:/")
  while IFS= read -r -d '' file; do
    [[ -f $ROOT/$file ]] || continue
    grep -qI . "$ROOT/$file" 2>/dev/null || continue
    label="$file"
    while IFS=: read -r n _; do
      fail P1 "$label" "line $n has a machine path or a local dependency URL"
    done < <(grep -nF "${pats[@]}" "$ROOT/$file")
  done < <(p1_files)
}

check_z1() {
  local file
  ((FINAL)) || return 0
  while IFS= read -r file; do
    fail Z1 "${file#"$ROOT"/}" ".content-pending still exists"
  done < <(find "$ROOT/skills" -name .content-pending 2>/dev/null | sort)
}

# ---------------------------------------------------------------- main

while (($#)); do
  case $1 in
    --only)
      (($# >= 2)) || usage
      ONLY="$2"
      for id in ${ONLY//,/ }; do
        [[ " $ALL_IDS " == *" $id "* ]] || {
          printf 'unknown check ID: %s\n' "$id" >&2
          exit 2
        }
      done
      shift 2
      ;;
    --final)
      FINAL=1
      shift
      ;;
    -h | --help) usage ;;
    -*) usage ;;
    *)
      DIRS+=("$1")
      shift
      ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  printf 'check-skills: jq not found; install jq\n' >&2
  exit 2
fi

ROOT="${CHECK_SKILLS_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null)}"
if [[ -z $ROOT || ! -d $ROOT ]]; then
  printf 'cannot find the repo root; set CHECK_SKILLS_ROOT\n' >&2
  exit 2
fi
ROOT="$(cd "$ROOT" && pwd)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ((${#DIRS[@]})); then
  for d in "${DIRS[@]}"; do
    d="${d%/}"
    d="${d#./}"
    [[ $d == "$ROOT"/* ]] && d="${d#"$ROOT"/}"
    SKILLS+=("$d")
  done
  REPO_LEVEL=0
else
  load_entry
  REPO_LEVEL=1
fi

for dir in "${SKILLS[@]}"; do
  check_skill "$dir"
done
check_r1 "$REPO_LEVEL"

if ((REPO_LEVEL)); then
  check_r2
  check_m1
  ((${#SKILLS[@]})) && check_m2
  check_p1
  check_z1
fi

if ((STATUS == 0)); then
  printf 'check-skills: ok\n'
fi
exit "$STATUS"
