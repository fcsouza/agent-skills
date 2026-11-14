#!/usr/bin/env bash
# Run the game-dev eval suite. The repo root is a marketplace, not a plugin,
# so `claude plugin eval .` finds no skills. This builds a throwaway plugin
# from the skills the marketplace lists, then runs the evals against it.
# Usage: tools/eval-game-dev.sh [claude plugin eval options...]
#   e.g. tools/eval-game-dev.sh --case 'trigger-*' --concurrency 4
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/.claude-plugin" "$work/skills" "$work/evals"
printf '{"name":"game-dev","version":"0.0.0","description":"game-dev eval copy"}\n' \
  >"$work/.claude-plugin/plugin.json"

bun -e '
const m = await Bun.file(process.argv[1]).json();
const p = m.plugins.find((x) => x.name === "game-dev");
for (const s of p.skills) console.log(s);
' "$root/.claude-plugin/marketplace.json" | while IFS= read -r skill; do
  cp -R "$root/${skill#./}" "$work/skills/"
done

cp -R "$root/evals/game-dev" "$work/evals/"
status=0
claude plugin eval "$work" --trust-plugin "$@" || status=$?
# Keep the reports: the temp plugin is deleted on exit.
if [[ -d "$work/evals/results" ]]; then
  mkdir -p "$root/evals/results"
  cp -R "$work/evals/results/." "$root/evals/results/"
  echo "Reports copied to evals/results/ (git-ignored)."
fi
exit "$status"
