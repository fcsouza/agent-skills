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
  # Folded block, so a description holding ": " stays valid YAML (N3).
  printf -- '---\nname: %s\ndescription: >-\n  %s\n---\n# %s\n%s\n' "$1" "$2" "$1" "$3" \
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

# ---------------------------------------------------------------- N3
new_fixture
printf -- '---\nname: demo\ndescription: Covers dialogue: NPCs and companions.\n---\nBody\n' >"$(skill_md)"
expect_fail N3 "plain description with ': ' is invalid YAML"

new_fixture
printf -- '---\nname: demo\ndescription: >-\n  Covers dialogue: NPCs and companions.\n---\nBody\n' >"$(skill_md)"
expect_pass "folded description with ': ' is valid YAML"

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

new_fixture
write_skill demo "d" "See skills/game-dev/design for more."
expect_fail R1 "old skills/game-dev/<group> path"

new_fixture
write_skill demo "d" "See idle-game-design."
expect_fail R1 "retired skill name idle-game-design"

new_fixture
write_skill demo "d" "See claude-code-game-workflow."
expect_fail R1 "retired skill name claude-code-game-workflow"

new_fixture
write_skill demo "d" "See cursor-codex-integration."
expect_fail R1 "retired skill name cursor-codex-integration"

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

# x1_other_fixture: x1_fixture plus a second, existing skill `other` that the
# command does not list under Requires.
x1_other_fixture() {
  x1_fixture
  write_skill other "d" "Body."
  printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo","./skills/other","./skills/game-dev","./skills/game-dev-commands/game-build"]}]}' \
    >"$FX/.claude-plugin/marketplace.json"
  link_readme skills/other
  sed 's/| Demo work | `demo` |/| Demo work | `demo` |\
| Other work | `other` |/' "$FX/skills/game-dev/SKILL.md" >"$FX/skills/game-dev/SKILL.tmp"
  mv "$FX/skills/game-dev/SKILL.tmp" "$FX/skills/game-dev/SKILL.md"
}

x1_other_fixture
printf '\nApply `other` to the result.\n' >>"$FX/skills/game-dev-commands/game-build/SKILL.md"
expect_fail X1 "capital Apply without 'the' applies a skill not in Requires"

x1_other_fixture
printf '\nApply `demo` and `other` together.\n' >>"$FX/skills/game-dev-commands/game-build/SKILL.md"
expect_fail X1 "apply a and b: the second name is not in Requires"

x1_other_fixture
printf '\nApply `typo-name`.\n' >>"$FX/skills/game-dev-commands/game-build/SKILL.md"
expect_fail X1 "bare Apply names an unknown skill"

x1_fixture
printf '\nApply `demo`, then apply `demo` and `demo`.\n' >>"$FX/skills/game-dev-commands/game-build/SKILL.md"
expect_pass "bare apply of a listed skill passes"

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

new_fixture
printf '# Readme\n\nPath %s here.\n' "$HOME_MAC" >"$FX/README.md"
link_readme skills/demo
expect_fail P1 "machine path in README.md"

new_fixture
printf 'Copyright %s\n' "$HOME_MAC" >"$FX/LICENSE"
expect_fail P1 "machine path in LICENSE"

new_fixture
printf '{"plugins":[{"name":"game-dev","homepage":"%s","skills":["./skills/demo"]}]}\n' "$DEP_FILE" >"$FX/.claude-plugin/marketplace.json"
expect_fail P1 "local dependency URL in marketplace.json"

git_fixture
printf 'Copyright %s\n' "$HOME_MAC" >"$FX/LICENSE"
git -C "$FX" add -- LICENSE
expect_fail P1 "git repo: tracked LICENSE with a machine path"

# A name with a space and a newline: without -z git quotes it and the file is skipped.
git_fixture
mkdir -p "$FX/tools"
printf 'cd %s\n' "$HOME_LNX" >"$FX/tools/$(printf 'a b\nc.sh')"
git -C "$FX" add -- tools
expect_fail P1 "git repo: path with a space and a newline"

new_fixture
mkdir -p "$FX/tools"
printf 'cd %s\n' "$HOME_LNX" >"$FX/tools/$(printf 'a b\nc.sh')"
expect_fail P1 "no git: path with a space and a newline"

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
if [[ $OUT == *"line 7 is a block quote; state it as plain text and put its source in references/sources.md"* ]]; then
  report 1 "C2 message gives the line and the fix"
else
  report 0 "C2 message gives the line and the fix" "$OUT"
fi

new_fixture
write_skill demo "d" "$(printf '```\n> a shell prompt or template line\n```\n')"
expect_pass "C2 ignores a > line inside a code fence"

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
printf -- '---\nname: demo\ndescription: >-\n  Does things.\n  Triggers: a, b.\n---\nBody\n' >"$(skill_md)"
expect_fail C5 "Triggers: on the second line of a wrapped description"

# ---------------------------------------------------------------- O1
new_fixture
write_skill demo "d" "## Steps
Do it.

## Pitfalls
- One.

## Files
- \`references/a.md\`: read when stuck.

## Related skills
- \`demo\`: itself."
mkdir -p "$FX/skills/demo/references"
printf 'x\n' >"$FX/skills/demo/references/a.md"
expect_pass "O1 canonical closing order"

new_fixture
write_skill demo "d" "## Steps
Do it.

## Pitfalls
- One."
expect_pass "O1 Pitfalls alone"

new_fixture
write_skill demo "d" "## Steps
Do it.

## Related skills
- x

## Pitfalls
- One."
expect_fail O1 "Related skills before Pitfalls"

new_fixture
write_skill demo "d" "## Pitfalls
- One.

## Steps
Do it."
expect_fail O1 "body section after Pitfalls"

new_fixture
write_skill demo "d" "## Files
- x

## Steps
Do it.

## Pitfalls
- One."
expect_fail O1 "Files before a body section"

new_fixture
write_skill demo "d" "## Steps
Do it.

## Pitfalls
- One.

## Related skills
- x

## Files
- y"
expect_fail O1 "Files after Related skills"

new_fixture
write_skill demo "d" "## Steps
Do it.

## Related
- x"
expect_fail O1 "Related heading names Related skills"
case $OUT in *"Related skills"*) report 1 "O1 message names the canonical heading" ;; *) report 0 "O1 message names the canonical heading" "$OUT" ;; esac

new_fixture
write_skill demo "d" "## Steps
Do it.

## Cross-references
- x"
expect_fail O1 "Cross-references heading"

new_fixture
write_skill demo "d" "## Steps
Do it.

## Reference files
- x"
expect_fail O1 "Reference files heading"

new_fixture
write_skill demo "d" "## Steps
Do it.

## Citations
- x"
expect_fail O1 "Citations heading"

new_fixture
write_skill demo "d" "## Steps
Do it.

\`\`\`
## Related
## Pitfalls
\`\`\`

## Pitfalls
- One."
expect_pass "O1 ignores headings inside code fences"

new_fixture
mkdir -p "$FX/skills/game-dev-commands/game-build"
printf -- '---\nname: game-build\ndescription: Build.\n---\n# Build\n\n## Requires\n- `demo`\n\n## Rules\nx\n\n## Related\nx\n' \
  >"$FX/skills/game-dev-commands/game-build/SKILL.md"
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/demo","./skills/game-dev-commands/game-build"]}]}' \
  >"$FX/.claude-plugin/marketplace.json"
link_readme skills/game-dev-commands/game-build
expect_pass "O1 skips commands"

new_fixture
mkdir -p "$FX/skills/game-dev"
printf -- '---\nname: game-dev\ndescription: Index.\n---\n# Index\n\n## Related\nx\n\n## Route\n| a | `demo` |\n' \
  >"$FX/skills/game-dev/SKILL.md"
printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/game-dev","./skills/demo"]}]}' \
  >"$FX/.claude-plugin/marketplace.json"
link_readme skills/game-dev
expect_pass "O1 skips the game-dev index"

new_fixture
write_skill demo "d" "## Steps
Do it.

## 7. Pitfalls
- One.

## Later
x"
expect_fail O1 "numbered Pitfalls heading counts and must be last"
case $OUT in *"comes after"*) report 1 "O1 ranks a numbered Pitfalls heading after normalizing" ;; *) report 0 "O1 ranks a numbered Pitfalls heading after normalizing" "$OUT" ;; esac

new_fixture
write_skill demo "d" "## Steps
Do it.

## 7. Pitfalls
- One."
expect_fail O1 "numbered Pitfalls heading is not the canonical spelling"

new_fixture
write_skill demo "d" "## Steps
Do it.

## Related Skills
- x"
expect_fail O1 "Related Skills spelling"

new_fixture
write_skill demo "d" "## Steps
Do it.

## Common pitfalls
- One.

## Later
x"
expect_fail O1 "Common pitfalls heading"
case $OUT in *"comes after"*) report 1 "O1 ranks a Common pitfalls heading after normalizing" ;; *) report 0 "O1 ranks a Common pitfalls heading after normalizing" "$OUT" ;; esac
case $OUT in *"'Pitfalls'"*) report 1 "O1 names Pitfalls for Common pitfalls" ;; *) report 0 "O1 names Pitfalls for Common pitfalls" "$OUT" ;; esac

new_fixture
write_skill demo "d" "## Steps
Do it.

~~~
## Related
## Pitfalls
~~~

## Pitfalls
- One."
expect_pass "O1 ignores headings inside tilde fences"

new_fixture
write_skill demo "d" "## Steps
Do it.

~~~
\`\`\`
> quote
## Pitfalls
~~~

## Pitfalls
- One."
expect_pass "a backtick line inside a tilde fence does not close it"

new_fixture
write_skill demo "d" "## Steps
Do it.

\`\`\`\`
\`\`\`
> quote
## Pitfalls
\`\`\`\`

## Pitfalls
- One."
expect_pass "a short fence line inside a four-backtick fence does not close it"

new_fixture
write_skill demo "d" "## Pitfalls
- One.

## Steps
Do it."
expect_fail O1 "directory arg runs O1" skills/demo

# ---------------------------------------------------------------- .content-pending and Z1
new_fixture
{
  printf -- '---\nname: demo\ndescription: >-\n  Does things. Triggers: a.\n---\n## Sources\n> "quote"\n'
  for _ in $(seq 1 600); do printf 'line\n'; done
} >"$(skill_md)"
mkdir -p "$FX/skills/demo/templates" "$FX/skills/demo/references" "$FX/skills/demo/boilerplate"
printf 'x\n' >"$FX/skills/demo/templates/orphan.md"
printf -- '- no link here\n' >"$FX/skills/demo/references/sources.md"
printf "import { z } from 'zod';\n" >"$FX/skills/demo/boilerplate/a.ts"
: >"$FX/skills/demo/.content-pending"
expect_pass ".content-pending skips C1-C5, L2 and S1"

new_fixture
: >"$FX/skills/demo/.content-pending"
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

new_fixture
write_skill demo "Does things. Triggers: a." "$(printf '## Sources\n')"
run_lint --only C1,C5
ids="$(printf '%s\n' "$OUT" | grep -oE '^FAIL [A-Z][0-9]+' | sort -u | tr '\n' ' ')"
if [[ $CODE == 1 && $ids == "FAIL C1 FAIL C5 " ]]; then
  report 1 "--only C1,C5 shows both"
else
  report 0 "--only C1,C5 shows both" "exit=$CODE ids=[$ids]
$OUT"
fi

new_fixture
write_skill demo "Does things. Triggers: a." "$(printf '## Sources\n')"
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

# ---------------------------------------------------------------- E1
# e1_fixture: marketplace lists demo and the index skill game-dev; evals/game-dev
# holds a trigger case for demo and one negative case naming both.
e1_fixture() {
  new_fixture
  mkdir -p "$FX/skills/game-dev"
  printf -- '---\nname: game-dev\ndescription: Index.\n---\n# Index\n\n## Route\n\n| Need | Skill |\n|---|---|\n| demo | `demo` |\n' \
    >"$FX/skills/game-dev/SKILL.md"
  printf '%s\n' '{"plugins":[{"name":"game-dev","skills":["./skills/game-dev","./skills/demo"]}]}' \
    >"$FX/.claude-plugin/marketplace.json"
  link_readme skills/game-dev
  mkdir -p "$FX/evals/game-dev/trigger-demo"
  e1_negative a "(?:demo|game-dev)"
}

# e1_negative <case> <alternation>: write a negative grader with that alternation.
e1_negative() {
  mkdir -p "$FX/evals/game-dev/trigger-negative-$1/graders"
  printf -- "---\ntype: tool_used\ninput_match: '\"skill\"\\\\s*:\\\\s*\"(?:[\\\\w-]+:)?%s\"'\nmin: 0\n---\n" "$2" \
    >"$FX/evals/game-dev/trigger-negative-$1/graders/no-game-skill.md"
}

e1_fixture
expect_pass "E1 clean eval tree"

new_fixture
expect_pass "E1 skipped without evals/game-dev"

e1_fixture
rmdir "$FX/evals/game-dev/trigger-demo"
expect_fail E1 "missing trigger case for a skill"
if [[ $OUT == *"evals/game-dev/trigger-demo"* ]]; then
  report 1 "E1 names the trigger directory to create"
else
  report 0 "E1 names the trigger directory to create" "$OUT"
fi

e1_fixture
expect_pass "E1 asks no trigger case for the index skill"

e1_fixture
e1_negative a "(?:demo)"
expect_fail E1 "negative grader omits the index skill"
if [[ $OUT == *"trigger-negative-a/graders/no-game-skill.md"* && $OUT == *"game-dev"* ]]; then
  report 1 "E1 names the grader file and the missing skill"
else
  report 0 "E1 names the grader file and the missing skill" "$OUT"
fi

e1_fixture
e1_negative a "(?:game-dev-foo|demo)"
expect_fail E1 "game-dev is not satisfied by game-dev-foo"

e1_fixture
e1_negative a "(?:demo-two|game-dev)"
expect_fail E1 "demo is not satisfied by demo-two"

e1_fixture
e1_negative a "(demo|game-dev)"
expect_pass "E1 accepts alternatives bounded by parentheses"

e1_fixture
e1_negative "b c" "(?:game-dev)"
expect_fail E1 "negative grader in a directory with a space is checked"

e1_fixture
expect_pass "E1 --only E1 passes on a clean tree" --only E1

e1_fixture
rmdir "$FX/evals/game-dev/trigger-demo"
expect_fail E1 "--only E1 reports a failure" --only E1
run_lint --only N1
if [[ $CODE == 0 && $OUT != *"FAIL E1"* ]]; then
  report 1 "--only N1 skips E1"
else
  report 0 "--only N1 skips E1" "exit=$CODE
$OUT"
fi

# ---------------------------------------------------------------- summary
printf '\n%s passed, %s failed\n' "$PASSED" "$FAILED"
if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
printf 'all checks passed\n'
