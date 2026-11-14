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

ALL_IDS="N1 N2 S1 R1 R2 L1 L2 M1 M2 X1 P1 C1 C2 C3 C4 C5 Z1"
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

rel() { printf '%s' "${1#"$ROOT"/}"; }

is_pending() { [[ -e $ROOT/$1/.content-pending ]]; }

# fm_field <file> <key>: value of a frontmatter key, quotes stripped.
# Handles `key: value` and folded or literal blocks (`key: >` / `key: |`).
# Exit 1 when the key is absent.
fm_field() {
  awk -v key="$2" '
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
        if (v ~ /^[>|][-+]?$/) { collecting = 1; val = "" } else { val = v }
      }
    }
    END {
      if (!found) exit 1
      if (val ~ /^".*"$/ || val ~ /^'\''.*'\''$/) val = substr(val, 2, length(val) - 2)
      print val
    }' "$1"
}

# p1_files: files P1 scans: every file under the listed game-dev skill
# directories, plus tools/, evals/, docs/superpowers/ and bun.lock. Tracked
# files when ROOT is its own git repo, every file in those places otherwise.
p1_files() {
  local top paths=(tools evals docs/superpowers bun.lock) dir
  for dir in "${SKILLS[@]}"; do
    paths+=("$dir")
  done
  top="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null)"
  if [[ $top == "$ROOT" ]]; then
    git -C "$ROOT" ls-files -- "${paths[@]}"
  else
    (
      cd "$ROOT" || exit
      for p in "${paths[@]}"; do
        if [[ -d $p ]]; then find "$p" -type f; elif [[ -f $p ]]; then printf '%s\n' "$p"; fi
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

check_s1() {
  local dir=$1 lines
  lines="$(wc -l <"$ROOT/$dir/SKILL.md" | tr -d ' ')"
  ((lines < 500)) || fail S1 "$dir/SKILL.md" "$lines lines, limit is 499"
}

check_l1() {
  local dir=$1 skill="$ROOT/$dir/SKILL.md" target path
  while IFS= read -r target; do
    case $target in
      *://* | '#'* | mailto:* | *[\*\<\>\{\}\$]*) continue ;;
    esac
    path="${target%%[#?]*}"
    [[ -n $path ]] || continue
    [[ -e $ROOT/$dir/$path ]] || fail L1 "$dir/SKILL.md" "'$target' does not resolve"
  done < <(
    grep -oE '\]\([^)[:space:]]+\)' "$skill" | sed -E 's/^\]\(//; s/\)$//'
    grep -oE '`(templates|boilerplate|references)/[^`]+`' "$skill" | tr -d '`'
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

check_x1() {
  local dir=$1 name
  while IFS= read -r name; do
    [[ -f $ROOT/skills/$name/SKILL.md || -f $ROOT/skills/game-dev-commands/$name/SKILL.md ]] ||
      fail X1 "$dir/SKILL.md" "required skill '$name' does not exist"
  done < <(
    # "Requires" block: backticked names on "- " lines up to the next heading.
    awk '
      /^#+[ \t]+Requires[ \t]*$/ { inblock = 1; next }
      /^#/ { inblock = 0 }
      inblock && /^- / { print }
    ' "$ROOT/$dir/SKILL.md" | grep -oE '`[^`]+`' | tr -d '`'
    grep -oE 'Apply the `[^`]+`' "$ROOT/$dir/SKILL.md" | sed -E 's/^Apply the `//; s/`$//'
  )
}

check_c1() {
  grep -qE '^##[[:space:]]+Sources[[:space:]]*$' "$ROOT/$1/SKILL.md" &&
    fail C1 "$1/SKILL.md" "has a '## Sources' heading"
}

check_c2() {
  local n
  while IFS=: read -r n _; do
    fail C2 "$1/SKILL.md" "line $n is a block quote"
  done < <(grep -nE '^>[[:space:]]*("|“)' "$ROOT/$1/SKILL.md")
}

check_c3() {
  local file="$ROOT/$1/references/sources.md" n
  [[ -f $file ]] || return 0
  while IFS=: read -r n _; do
    fail C3 "$1/references/sources.md" "line $n has no https:// link"
  done < <(grep -nE '^- ' "$file" | grep -v 'https://')
}

check_c4() {
  local dir=$1 file mod
  while IFS= read -r file; do
    while IFS= read -r mod; do
      case $mod in . | ./* | ../* | node:*) continue ;; esac
      head -n 1 "$file" | grep -q '^// Verified against:' ||
        fail C4 "${file#"$ROOT"/}" "imports '$mod' without a '// Verified against:' first line"
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

check_skill() {
  local dir=$1
  if [[ ! -f $ROOT/$dir/SKILL.md ]]; then
    fail M1 "$dir" "no SKILL.md"
    return
  fi
  check_n1 "$dir"
  check_n2 "$dir"
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
  fi
}

# ---------------------------------------------------------------- R1

# r1_scan <label> <file> [filter-readme]: report banned patterns in a file.
r1_scan() {
  local label=$1 file=$2 readme=${3:-0} n hit
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
    fi | grep -noE -f "$R1_PATTERNS"
  )
}

check_r1() { # repo-level flag: 1 when README and marketplace are in scope
  local dir file name
  R1_PATTERNS="$TMP/r1-patterns"
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
  } >"$R1_PATTERNS"

  for dir in "${SKILLS[@]}"; do
    [[ -d $ROOT/$dir ]] || continue
    while IFS= read -r file; do
      grep -qI . "$file" 2>/dev/null || continue
      r1_scan "${file#"$ROOT"/}" "$file"
    done < <(find "$ROOT/$dir" -type f | sort)
  done
  if [[ $1 == 1 ]]; then
    [[ -f $ROOT/README.md ]] && r1_scan README.md "$ROOT/README.md" 1
    [[ -f $ROOT/$MARKETPLACE ]] && r1_scan "$MARKETPLACE" "$ROOT/$MARKETPLACE"
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
    fail M1 "$MARKETPLACE" "file not found"
    return
  fi
  ENTRY="$(jq -c '[.plugins[]? | select(.name == "game-dev")][0] // empty' "$ROOT/$MARKETPLACE" 2>/dev/null)"
  if [[ -z $ENTRY ]]; then
    fail M1 "$MARKETPLACE" "no plugin named game-dev"
    return
  fi
  if ! printf '%s' "$ENTRY" | jq -e '.skills | type == "array"' >/dev/null 2>&1; then
    fail M1 "$MARKETPLACE" "game-dev entry has no skills array"
    return
  fi
  HAS_SKILLS_ARRAY=1
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
    ((listed)) || fail M2 "$MARKETPLACE" "'$d' is not listed in the game-dev skills array"
  done
}

check_p1() {
  local file label n
  local pats=(-e "/Us""ers/" -e "/ho""me/" -e "li""nk:/" -e "fi""le:/")
  while IFS= read -r file; do
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

ROOT="${CHECK_SKILLS_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null)}"
if [[ -z $ROOT || ! -d $ROOT ]]; then
  printf 'cannot find the repo root; set CHECK_SKILLS_ROOT\n' >&2
  exit 2
fi
ROOT="$(cd "$ROOT" && pwd)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
HAS_SKILLS_ARRAY=0

if ((${#DIRS[@]})); then
  for d in "${DIRS[@]}"; do
    d="${d%/}"
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
  ((HAS_SKILLS_ARRAY)) && check_m2
  check_p1
  check_z1
fi

if ((STATUS == 0)); then
  printf 'check-skills: ok\n'
fi
exit "$STATUS"
