#!/usr/bin/env bash
# Tests for tools/check-skills.sh. Each case builds a temp repo with one
# violation and asserts the lint fails with exactly that check ID.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-skills.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Machine-path patterns, built from fragments so this file never contains them.
HOME_MAC="/Us""ers/someone/proj"
HOME_LNX="/ho""me/someone/proj"
DEP_LINK="li""nk:/opt/pkg"
DEP_FILE="fi""le:/opt/pkg"

PASSED=0
FAILED=0
FX=""
OUT=""
CODE=0

new_fixture() {
  FX="$(mktemp -d "$WORK/fx.XXXXXX")"
  mkdir -p "$FX/.claude-plugin" "$FX/skills/demo"
  printf '%s\n' '{"plugins":[{"name":"game-dev","description":"Game dev plugin","keywords":["game"],"skills":["./skills/demo"]}]}' \
    >"$FX/.claude-plugin/marketplace.json"
  printf '# Readme\n' >"$FX/README.md"
  link_readme skills/demo
  write_skill demo "A demo skill." "Body."
}

# link_readme <skill-path> ...: add a README link to each path, as M2 wants.
link_readme() {
  local p
  for p in "$@"; do
    printf -- '- [%s](%s/)\n' "${p##*/}" "$p" >>"$FX/README.md"
  done
}

# count_lines <ID>: number of FAIL <ID> lines in the last run.
count_lines() {
  printf '%s\n' "$OUT" | grep -c "^FAIL $1 "
}

# write_skill <dir-name> <description> <body>
write_skill() {
  mkdir -p "$FX/skills/$1"
  printf -- '---\nname: %s\ndescription: %s\n---\n# %s\n%s\n' "$1" "$2" "$1" "$3" \
    >"$FX/skills/$1/SKILL.md"
}

skill_md() { printf '%s' "$FX/skills/demo/SKILL.md"; }

run_lint() {
  OUT="$(CHECK_SKILLS_ROOT="$FX" bash "$SCRIPT" "$@" 2>&1)"
  CODE=$?
}

report() { # ok? label detail
  if [[ $1 == 1 ]]; then
    PASSED=$((PASSED + 1))
    printf 'ok - %s\n' "$2"
  else
    FAILED=$((FAILED + 1))
    printf 'FAIL - %s\n%s\n' "$2" "$3"
  fi
}

# expect_fail <ID> <label> [lint args]: exit 1 and only FAIL <ID> lines.
expect_fail() {
  local id=$1 label=$2
  shift 2
  run_lint "$@"
  local ids
  ids="$(printf '%s\n' "$OUT" | grep -oE '^FAIL [A-Z][0-9]+' | sort -u | tr '\n' ' ')"
  if [[ $CODE == 1 && $ids == "FAIL $id " ]]; then
    report 1 "$id $label"
  else
    report 0 "$id $label" "exit=$CODE ids=[$ids]
$OUT"
  fi
}

expect_pass() {
  local label=$1
  shift
  run_lint "$@"
  if [[ $CODE == 0 && $OUT != *FAIL* ]]; then
    report 1 "pass: $label"
  else
    report 0 "pass: $label" "exit=$CODE
$OUT"
  fi
}

# ---------------------------------------------------------------- script exists
if [[ ! -f $SCRIPT ]]; then
  printf 'FAIL - script not found: %s\n' "$SCRIPT"
  exit 1
fi

# ---------------------------------------------------------------- clean
new_fixture
expect_pass "clean fixture"

new_fixture
mkdir -p "$FX/skills/game-dev-commands/game-build" "$FX/skills/claude-agent-sdk" "$FX/skills/react-animations"
write_skill claude-agent-sdk "Excluded." "Body."
write_skill react-animations "Excluded." "Body."
printf -- '---\nname: game-build\ndescription: Build.\n---\n# Build\nApply the `demo` skill.\n\n## Requires\n- `demo`\n- `game-build`\n' \
  >"$FX/skills/game-dev-commands/game-build/SKILL.md"
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo","./skills/game-dev-commands/game-build"]}]}' \
  >"$FX/.claude-plugin/marketplace.json"
link_readme skills/game-dev-commands/game-build
expect_pass "nested command skill, excluded dirs, X1 resolves"

new_fixture
cat >"$FX/README.md" <<'EOF'
# Readme

## Upgrading from 1.x

Old layout: skills/game-dev/design and plugins/game-dev. Use bun.lockb no more.

## Usage

Fine.
EOF
link_readme skills/demo
expect_pass "R1 exempts the Upgrading section"

# ---------------------------------------------------------------- N1
new_fixture
printf -- '---\nname: other\ndescription: d\n---\nBody\n' >"$(skill_md)"
expect_fail N1 "name differs from directory"

new_fixture
mkdir -p "$FX/skills/bad_name"
rm -r "$FX/skills/demo"
write_skill bad_name "d" "Body."
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/bad_name"]}]}' >"$FX/.claude-plugin/marketplace.json"
link_readme skills/bad_name
expect_fail N1 "name has an underscore"

new_fixture
long="$(printf 'a%.0s' $(seq 1 65))"
rm -r "$FX/skills/demo"
write_skill "$long" "d" "Body."
printf '{"plugins":[{"name":"game-dev","skills":["./skills/%s"]}]}\n' "$long" >"$FX/.claude-plugin/marketplace.json"
link_readme "skills/$long"
expect_fail N1 "name longer than 64"

# ---------------------------------------------------------------- N2
new_fixture
printf -- '---\nname: demo\n---\nBody\n' >"$(skill_md)"
expect_fail N2 "description missing"

new_fixture
desc="$(printf 'x%.0s' $(seq 1 1025))"
write_skill demo "$desc" "Body."
expect_fail N2 "description over 1024"

new_fixture
desc="$(printf 'x%.0s' $(seq 1 1024))"
write_skill demo "$desc" "Body."
expect_pass "description of exactly 1024"

new_fixture
printf -- '---\nname: demo\ndescription: >\n  First line\n  second line.\n---\nBody\n' >"$(skill_md)"
expect_pass "folded multi-line description"

new_fixture
half="$(printf 'x%.0s' $(seq 1 600))"
printf -- '---\nname: demo\ndescription: %s\n  %s\n---\nBody\n' "$half" "$half" >"$(skill_md)"
expect_fail N2 "plain description wrapped onto a second line, over 1024 in all"

new_fixture
printf -- '---\r\nname: demo\r\ndescription: A demo skill\r\n  wrapped onto a second line.\r\n---\r\nBody\r\n' >"$(skill_md)"
expect_pass "CRLF frontmatter with a wrapped plain description"

new_fixture
printf -- '---\r\nname: demo\r\ndescription: %s\r\n  %s\r\n---\r\nBody\r\n' "$half" "$half" >"$(skill_md)"
expect_fail N2 "CRLF wrapped description over 1024 in all"

# ---------------------------------------------------------------- S1
new_fixture
{
  printf -- '---\nname: demo\ndescription: d\n---\n'
  for _ in $(seq 1 496); do printf 'line\n'; done
} >"$(skill_md)"
expect_fail S1 "SKILL.md has 500 lines"

new_fixture
{
  printf -- '---\nname: demo\ndescription: d\n---\n'
  for _ in $(seq 1 495); do printf 'line\n'; done
} >"$(skill_md)"
expect_pass "SKILL.md has 499 lines"

# ---------------------------------------------------------------- R1
new_fixture
write_skill demo "d" "Reads CLAUDE_PLUGIN_ROOT here."
expect_fail R1 "banned token in SKILL.md"

new_fixture
write_skill demo "d" "Body."
printf 'Run bunx biome check.\n' >"$FX/skills/demo/notes.txt"
expect_fail R1 "banned token in a non-SKILL file of the skill"

new_fixture
printf '# Readme\n\nSee plugins/game-dev for more.\n' >"$FX/README.md"
link_readme skills/demo
expect_fail R1 "banned path in README"

new_fixture
printf '# Readme\n\n## Upgrading from 1.x\n\nOld: skills/game-dev/design.\n\n## Usage\n\nStill uses CLAUDE_HOOK_INPUT.\n' >"$FX/README.md"
link_readme skills/demo
expect_fail R1 "README violation after the exempt section"

new_fixture
write_skill demo "d" "Install with \`npx skills add fcsouza/agent-skills --skill demo\`."
expect_fail R1 "npx skills in a skill"

new_fixture
write_skill demo "d" "Install with \`bunx skills add fcsouza/agent-skills --skill demo\`."
printf 'npx skills add fcsouza/agent-skills --skill demo\n' >>"$FX/README.md"
expect_pass "bunx skills in a skill, npx skills in README"

new_fixture
printf '%s\n' '{"plugins":[{"name":"game-dev","keywords":["bun.lockb"],"skills":["./skills/demo"]}]}' >"$FX/.claude-plugin/marketplace.json"
expect_fail R1 "banned token in marketplace.json"

new_fixture
printf '%s\n' '{"plugins":[{"name":"bun-only","description":"Runs bunx biome"},{"name":"game-dev","skills":["./skills/demo"]}]}' >"$FX/.claude-plugin/marketplace.json"
expect_pass "R1 ignores a banned string in another plugin entry"

new_fixture
printf '%s\n' '{"plugins":[{"name":"bun-only","description":"ok"},{"name":"game-dev","description":"Runs bunx biome","skills":["./skills/demo"]}]}' >"$FX/.claude-plugin/marketplace.json"
expect_fail R1 "banned string in the game-dev entry description"

new_fixture
write_skill demo "d" "Use the design-demo skill."
expect_fail R1 "prefixed name of a real skill directory"

new_fixture
write_skill demo "d" "See game-asset-gen."
expect_fail R1 "retired skill name"

# ---------------------------------------------------------------- R2
new_fixture
printf '%s\n' '{"plugins":[{"name":"game-dev","description":"Plugin with 25 skills","skills":["./skills/demo"]}]}' >"$FX/.claude-plugin/marketplace.json"
expect_fail R2 "skill count in marketplace entry"

new_fixture
printf '# Readme\n\nThis ships 12 skills.\n' >"$FX/README.md"
link_readme skills/demo
expect_fail R2 "skill count in README"

# ---------------------------------------------------------------- L1
new_fixture
write_skill demo "d" "See [guide](references/guide.md)."
expect_fail L1 "markdown link target missing"

new_fixture
write_skill demo "d" "Copy \`templates/missing.md\` first."
expect_fail L1 "backticked template path missing"

new_fixture
mkdir -p "$FX/skills/demo/references"
printf 'x\n' >"$FX/skills/demo/references/guide.md"
write_skill demo "d" "See [guide](references/guide.md), [site](https://example.com), [top](#top)."
expect_pass "links that resolve, URLs and anchors"

new_fixture
write_skill demo "d" "$(printf 'Example:\n\n```md\nSee [guide](references/missing.md) and `templates/missing.md`.\n```\n')"
expect_pass "L1 skips links inside a fenced code block"

new_fixture
write_skill demo "d" "$(printf '```md\nfenced\n```\n\nSee [guide](references/missing.md).\n')"
expect_fail L1 "L1 checks links after a fenced code block closes"

new_fixture
mkdir -p "$FX/skills/demo/references"
printf 'x\n' >"$FX/skills/demo/references/guide.md"
write_skill demo "d" "See [refs](references) and [guide](references/guide.md)."
expect_fail L1 "link to a directory without a trailing slash"

new_fixture
mkdir -p "$FX/skills/demo/references"
printf 'x\n' >"$FX/skills/demo/references/guide.md"
write_skill demo "d" "See [refs](references/) and \`references/guide.md\`."
expect_pass "link to a directory with a trailing slash"

new_fixture
write_skill demo "d" "See [guide](guide.md/)."
printf 'x\n' >"$FX/skills/demo/guide.md"
expect_fail L1 "trailing slash on a regular file"

# ---------------------------------------------------------------- L2
new_fixture
mkdir -p "$FX/skills/demo/templates"
printf 'x\n' >"$FX/skills/demo/templates/orphan.md"
expect_fail L2 "file never mentioned in SKILL.md"

new_fixture
mkdir -p "$FX/skills/demo/templates"
printf 'x\n' >"$FX/skills/demo/templates/used.md"
write_skill demo "d" "Use \`templates/used.md\`."
expect_pass "mentioned template"

# ---------------------------------------------------------------- M1
new_fixture
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo","./skills/ghost"]}]}' >"$FX/.claude-plugin/marketplace.json"
expect_fail M1 "listed path has no SKILL.md"
m1n="$(count_lines M1)"
if [[ $m1n == 1 && $(printf '%s\n' "$OUT" | grep -c '^FAIL ') == 1 ]]; then
  report 1 "M1 listed path with no SKILL.md prints one line"
else
  report 0 "M1 listed path with no SKILL.md prints one line" "m1=$m1n
$OUT"
fi

new_fixture
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo"]}' >"$FX/.claude-plugin/marketplace.json"
run_lint
if [[ $CODE == 1 && $OUT == "FAIL M1 .claude-plugin/marketplace.json: not valid JSON" ]]; then
  report 1 "M1 invalid JSON is reported as invalid JSON"
else
  report 0 "M1 invalid JSON is reported as invalid JSON" "exit=$CODE
$OUT"
fi

new_fixture
printf '%s\n' '{"plugins":[{"name":"game-dev","description":"no list"}]}' >"$FX/.claude-plugin/marketplace.json"
run_lint
count="$(printf '%s\n' "$OUT" | grep -c '^FAIL ')"
if [[ $CODE == 1 && $count == 1 && $OUT == *"FAIL M1 .claude-plugin/marketplace.json:"* ]]; then
  report 1 "M1 game-dev entry without skills array prints one line"
else
  report 0 "M1 game-dev entry without skills array prints one line" "exit=$CODE count=$count
$OUT"
fi

new_fixture
printf '%s\n' '{"plugins":[{"name":"other","skills":[]}]}' >"$FX/.claude-plugin/marketplace.json"
run_lint
count="$(printf '%s\n' "$OUT" | grep -c '^FAIL ')"
if [[ $CODE == 1 && $count == 1 && $OUT == *"FAIL M1 "* ]]; then
  report 1 "M1 missing game-dev entry prints one line"
else
  report 0 "M1 missing game-dev entry prints one line" "exit=$CODE count=$count
$OUT"
fi

# ---------------------------------------------------------------- M2
new_fixture
write_skill unlisted "d" "Body."
expect_fail M2 "directory not listed in marketplace"
if [[ $OUT == *"game-dev skills array"* && $OUT == *"EXCLUDED in tools/check-skills.sh"* ]]; then
  report 1 "M2 unlisted message names both fixes"
else
  report 0 "M2 unlisted message names both fixes" "$OUT"
fi

new_fixture
printf '# Readme\n\nNo links here.\n' >"$FX/README.md"
expect_fail M2 "listed skill has no README link"
if [[ $OUT == *"'skills/demo'"* && $OUT == *"add it to the README tables"* ]]; then
  report 1 "M2 README message names the skill and the fix"
else
  report 0 "M2 README message names the skill and the fix" "$OUT"
fi

new_fixture
mkdir -p "$FX/skills/game-dev-commands/game-build"
printf -- '---\nname: game-build\ndescription: Build.\n---\n# Build\n\n## Requires\n\n- `demo`\n' \
  >"$FX/skills/game-dev-commands/game-build/SKILL.md"
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo","./skills/game-dev-commands/game-build"]}]}' \
  >"$FX/.claude-plugin/marketplace.json"
printf -- '- [game-build](skills/game-build/)\n' >>"$FX/README.md"
expect_fail M2 "command README link must use the game-dev-commands path"

# ---------------------------------------------------------------- X1
new_fixture
write_skill demo "d" "$(printf '## Requires\n- `no-such-skill`\n\n## Next\n- `also-not-checked`\n')"
expect_fail X1 "Requires block names an unknown skill"

new_fixture
write_skill demo "d" "$(printf '## Requires\n- `demo`\n\n## Next\n- `not-a-skill-but-after-block`\n')"
expect_pass "X1 ignores names after the Requires block ends"

new_fixture
write_skill demo "d" "Apply the \`no-such-skill\` skill first."
expect_fail X1 "Apply the names an unknown skill"

# x1_fixture: an index skill with a Route table and one command, all clean.
x1_fixture() {
  new_fixture
  mkdir -p "$FX/skills/game-dev" "$FX/skills/game-dev-commands/game-build"
  cat >"$FX/skills/game-dev/SKILL.md" <<'EOF'
---
name: game-dev
description: Index.
---
# Game Dev

Mentions `outside-the-table` before the Route section.

## Route

### Design

| Need | Skill |
|---|---|
| Demo work | `demo` |
| Build one component | `/game-build` (`game-build`) |

## Rules

- `not-a-skill-after-route`
EOF
  cat >"$FX/skills/game-dev-commands/game-build/SKILL.md" <<'EOF'
---
name: game-build
description: Build.
---
# Build

## Requires

- `demo`

Apply the `demo` skill, then apply the `demo` skill again.
EOF
  printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo","./skills/game-dev","./skills/game-dev-commands/game-build"]}]}' \
    >"$FX/.claude-plugin/marketplace.json"
  link_readme skills/game-dev skills/game-dev-commands/game-build
}

x1_fixture
expect_pass "X1 clean index and command"

x1_fixture
printf -- '---\nname: game-build\ndescription: Build.\n---\n# Build\n\nApply the `demo` skill.\n' \
  >"$FX/skills/game-dev-commands/game-build/SKILL.md"
expect_fail X1 "command without a Requires heading"

x1_fixture
printf '\nThen apply the `typo-name` skill.\n' >>"$FX/skills/game-dev-commands/game-build/SKILL.md"
expect_fail X1 "lowercase apply the names an unknown skill"

x1_fixture
write_skill other "d" "Body."
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo","./skills/other","./skills/game-dev","./skills/game-dev-commands/game-build"]}]}' \
  >"$FX/.claude-plugin/marketplace.json"
link_readme skills/other
sed 's/| Demo work | `demo` |/| Demo work | `demo` |\
| Other work | `other` |/' "$FX/skills/game-dev/SKILL.md" >"$FX/skills/game-dev/SKILL.tmp"
mv "$FX/skills/game-dev/SKILL.tmp" "$FX/skills/game-dev/SKILL.md"
printf '\nApply the `other` skill.\n' >>"$FX/skills/game-dev-commands/game-build/SKILL.md"
expect_fail X1 "command applies an existing skill not in its Requires block"

x1_fixture
write_skill other "d" "Body."
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo","./skills/other","./skills/game-dev","./skills/game-dev-commands/game-build"]}]}' \
  >"$FX/.claude-plugin/marketplace.json"
link_readme skills/other
expect_fail X1 "listed skill missing from the index Route table"
if [[ $(count_lines X1) == 1 && $OUT == *"'other'"* ]]; then
  report 1 "X1 Route coverage names the missing skill once"
else
  report 0 "X1 Route coverage names the missing skill once" "$OUT"
fi

x1_fixture
expect_pass "X1 Route coverage is skipped for a directory argument" skills/game-dev

x1_fixture
sed 's/| Demo work |/| Demo work, see `not-a-skill` notes |/' "$FX/skills/game-dev/SKILL.md" >"$FX/skills/game-dev/SKILL.tmp"
mv "$FX/skills/game-dev/SKILL.tmp" "$FX/skills/game-dev/SKILL.md"
expect_pass "X1 reads only the Skill column of the Route table"

x1_fixture
sed 's/`demo` |/`dmeo` |/' "$FX/skills/game-dev/SKILL.md" >"$FX/skills/game-dev/SKILL.tmp"
mv "$FX/skills/game-dev/SKILL.tmp" "$FX/skills/game-dev/SKILL.md"
expect_fail X1 "typo in the index Route table"

x1_fixture
sed 's#`/game-build`#`/game-biuld`#' "$FX/skills/game-dev/SKILL.md" >"$FX/skills/game-dev/SKILL.tmp"
mv "$FX/skills/game-dev/SKILL.tmp" "$FX/skills/game-dev/SKILL.md"
expect_fail X1 "typo in a slash name in the index Route table"

# ---------------------------------------------------------------- P1
new_fixture
write_skill demo "d" "Path $HOME_MAC here."
expect_fail P1 "macOS home path in a skill"

new_fixture
mkdir -p "$FX/tools"
printf 'cd %s\n' "$HOME_LNX" >"$FX/tools/run.sh"
expect_fail P1 "Linux home path under tools/"

new_fixture
printf '{"dependencies":{"x":"%s"}}\n' "$DEP_LINK" >"$FX/bun.lock"
expect_fail P1 "link: dependency in bun.lock"

new_fixture
mkdir -p "$FX/docs/superpowers"
printf 'dep %s\n' "$DEP_FILE" >"$FX/docs/superpowers/plan.md"
expect_fail P1 "file: dependency under docs/superpowers"

new_fixture
mkdir -p "$FX/skills/react-animations" "$FX/docs/research"
write_skill react-animations "d" "Path $HOME_MAC here."
printf 'x %s\n' "$HOME_MAC" >"$FX/docs/research/note.md"
expect_pass "P1 ignores skills outside the game-dev list and docs/research"

# git_fixture: a fixture that is its own git repo with every file staged.
git_fixture() {
  new_fixture
  git -C "$FX" init -q
  git -C "$FX" add -- .claude-plugin README.md skills
}

git_fixture
write_skill demo "d" "Path $HOME_MAC here."
git -C "$FX" add skills/demo/SKILL.md
expect_fail P1 "git repo: tracked file with a machine path"

git_fixture
mkdir -p "$FX/tools"
printf 'cd %s\n' "$HOME_LNX" >"$FX/tools/untracked.sh"
expect_pass "git repo: untracked file with a machine path"

new_fixture
mkdir -p "$FX/tools" "$FX/evals"
printf '%s\n' '{"plugins":[{"name":"other"}]}' >"$FX/.claude-plugin/marketplace.json"
printf 'cd %s\n' "$HOME_LNX" >"$FX/tools/run.sh"
printf 'cd %s\n' "$HOME_LNX" >"$FX/evals/e.txt"
run_lint
p1n="$(printf '%s\n' "$OUT" | grep -c '^FAIL P1 ')"
if [[ $CODE == 1 && $p1n == 2 && $OUT == *"FAIL M1 "* ]]; then
  report 1 "P1 still scans tools/ and evals/ without a marketplace entry"
else
  report 0 "P1 still scans tools/ and evals/ without a marketplace entry" "exit=$CODE p1=$p1n
$OUT"
fi

# ---------------------------------------------------------------- C1-C5
new_fixture
write_skill demo "d" "$(printf '## Sources\n- https://example.com\n')"
expect_fail C1 "Sources heading"

new_fixture
write_skill demo "d" "$(printf '> "A quoted line"\n')"
expect_fail C2 "straight-quote blockquote"

new_fixture
write_skill demo "d" "$(printf '> \xe2\x80\x9cA curly quote\xe2\x80\x9d\n')"
expect_fail C2 "curly-quote blockquote"

new_fixture
write_skill demo "d" "$(printf '> *"quoted"*\n')"
expect_fail C2 "italic quoted blockquote"

new_fixture
write_skill demo "d" "$(printf '> Name Surname said this\n')"
expect_fail C2 "attributed blockquote without quote marks"

new_fixture
write_skill demo "d" "$(printf '> note\n')"
expect_fail C2 "plain blockquote"
if [[ $OUT == *"line 6 is a block quote; state it as plain text and put its source in references/sources.md"* ]]; then
  report 1 "C2 message gives the line and the fix"
else
  report 0 "C2 message gives the line and the fix" "$OUT"
fi

new_fixture
write_skill demo "d" "$(printf 'A line with a > sign inside.\n')"
expect_pass "no block quote"

new_fixture
mkdir -p "$FX/skills/demo/references"
printf -- '- https://ok.example\n- no link here\n' >"$FX/skills/demo/references/sources.md"
write_skill demo "d" "See \`references/sources.md\`."
expect_fail C3 "sources.md line without https"

new_fixture
mkdir -p "$FX/skills/demo/boilerplate"
printf "import { z } from 'zod';\nexport const a = z.string();\n" >"$FX/skills/demo/boilerplate/a.ts"
write_skill demo "d" "See \`boilerplate/a.ts\`."
expect_fail C4 "ts with external import and no Verified header"

new_fixture
mkdir -p "$FX/skills/demo/boilerplate"
printf "// Verified against: zod 3.23.8 (2026-11-14)\nimport { z } from 'zod';\nimport { b } from './b';\nimport fs from 'node:fs';\nexport const a = z.string();\n" >"$FX/skills/demo/boilerplate/a.ts"
write_skill demo "d" "See \`boilerplate/a.ts\`."
expect_pass "ts with Verified header"

# c4_header <first line>: a boilerplate file with that header and a bullmq import.
c4_header() {
  new_fixture
  mkdir -p "$FX/skills/demo/boilerplate"
  printf "%s\nimport { Queue } from 'bullmq';\n" "$1" >"$FX/skills/demo/boilerplate/q.ts"
  write_skill demo "d" "See \`boilerplate/q.ts\`."
}

c4_header '// Verified against:'
expect_fail C4 "empty Verified header"

c4_header '// Verified against: bullmq 6.7.6 (2026-11-14)'
expect_pass "Verified header with one package"

c4_header '// Verified against: bullmq 6.7.6, @scope/ioredis-x 5.4.1 (2026-11-14)'
expect_pass "Verified header with two packages"

c4_header '// Verified against: bullmq 6.7.6'
expect_fail C4 "Verified header without a date"

c4_header '// Verified against: bullmq (2026-11-14)'
expect_fail C4 "Verified header without a version"

new_fixture
mkdir -p "$FX/skills/demo/boilerplate"
printf "import { b } from './b';\nimport fs from 'node:fs';\nexport const a = 1;\n" >"$FX/skills/demo/boilerplate/a.ts"
write_skill demo "d" "See \`boilerplate/a.ts\`."
expect_pass "ts with only relative and node: imports"

new_fixture
write_skill demo "Does things. Triggers: a, b." "Body."
expect_fail C5 "Triggers: in description"

new_fixture
printf -- '---\nname: demo\ndescription: Does things.\n  Triggers: a, b.\n---\nBody\n' >"$(skill_md)"
expect_fail C5 "Triggers: on the second line of a wrapped description"

# ---------------------------------------------------------------- .content-pending and Z1
new_fixture
{
  printf -- '---\nname: demo\ndescription: Does things. Triggers: a.\n---\n## Sources\n> "quote"\n'
  for _ in $(seq 1 600); do printf 'line\n'; done
} >"$(skill_md)"
mkdir -p "$FX/skills/demo/templates" "$FX/skills/demo/references" "$FX/skills/demo/boilerplate"
printf 'x\n' >"$FX/skills/demo/templates/orphan.md"
printf -- '- no link here\n' >"$FX/skills/demo/references/sources.md"
printf "import { z } from 'zod';\n" >"$FX/skills/demo/boilerplate/a.ts"
: >"$FX/skills/demo/.content-pending"
expect_pass ".content-pending skips C1-C5, L2 and S1"

expect_fail Z1 "--final with a .content-pending file" --final

new_fixture
: >"$FX/skills/demo/.content-pending"
expect_pass ".content-pending without --final"

new_fixture
expect_pass "--final with no .content-pending" --final

# ---------------------------------------------------------------- --only and directory args
new_fixture
write_skill demo "Does things. Triggers: a." "$(printf '## Sources\n')"
run_lint --only C1
ids="$(printf '%s\n' "$OUT" | grep -oE '^FAIL [A-Z][0-9]+' | sort -u | tr '\n' ' ')"
if [[ $CODE == 1 && $ids == "FAIL C1 " ]]; then
  report 1 "--only C1 hides C5"
else
  report 0 "--only C1 hides C5" "exit=$CODE ids=[$ids]
$OUT"
fi

run_lint --only C1,C5
ids="$(printf '%s\n' "$OUT" | grep -oE '^FAIL [A-Z][0-9]+' | sort -u | tr '\n' ' ')"
if [[ $CODE == 1 && $ids == "FAIL C1 FAIL C5 " ]]; then
  report 1 "--only C1,C5 shows both"
else
  report 0 "--only C1,C5 shows both" "exit=$CODE ids=[$ids]
$OUT"
fi

run_lint --only N1
if [[ $CODE == 0 ]]; then
  report 1 "--only N1 passes when N1 holds"
else
  report 0 "--only N1 passes when N1 holds" "exit=$CODE
$OUT"
fi

for manifest in '{"plugins":[{"name":"other"}]}' '{"plugins":[{"name":"game-dev","skills":[]}]}' 'not json' ''; do
  new_fixture
  if [[ -n $manifest ]]; then
    printf '%s\n' "$manifest" >"$FX/.claude-plugin/marketplace.json"
  else
    rm "$FX/.claude-plugin/marketplace.json"
  fi
  run_lint --only N1
  if [[ $CODE == 1 && $OUT == *"FAIL M1 "* && $OUT != *"check-skills: ok"* ]]; then
    report 1 "--only N1 still reports a broken manifest (${manifest:-missing})"
  else
    report 0 "--only N1 still reports a broken manifest (${manifest:-missing})" "exit=$CODE
$OUT"
  fi
done

new_fixture
run_lint --only N1 skills/typo-dir
if [[ $CODE == 1 && $(count_lines M1) == 1 && $OUT == *"FAIL M1 skills/typo-dir: no SKILL.md"* ]]; then
  report 1 "--only N1 still reports a directory arg with no SKILL.md"
else
  report 0 "--only N1 still reports a directory arg with no SKILL.md" "exit=$CODE
$OUT"
fi

new_fixture
printf '# Readme\n\nShips 9 skills.\n' >"$FX/README.md"
expect_pass "directory arg skips repo-level checks" skills/demo

new_fixture
write_skill demo "Does things. Triggers: a." "Body."
expect_fail C5 "directory arg runs per-skill checks" skills/demo

x1_fixture
printf -- '---\nname: game-build\ndescription: Build.\n---\n# Build\n' \
  >"$FX/skills/game-dev-commands/game-build/SKILL.md"
expect_fail X1 "directory arg with a leading ./ runs the command rules" ./skills/game-dev-commands/game-build/

# ---------------------------------------------------------------- summary
printf '\n%s passed, %s failed\n' "$PASSED" "$FAILED"
if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
printf 'all checks passed\n'
