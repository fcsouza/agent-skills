---
name: judge
description: Use when a pull request, branch, or diff must be reviewed before merge or auto-merge, including PRs a subagent built. Triggers on "judge this PR", "review this PR", "review before merge", "revise esse PR", "julga esse PR", "faz o code review", "pode mergear?".
---

# Judge

Review a change before merge, report in the terminal, then fix what the review found. The report shows what was checked as well as what was found, so the reader can see where the review did not look.

Adapted from The Judge v1.4.0 by Felipe Rodrigues (github.com/felipfr), https://github.com/tech-leads-club/agent-skills, CC-BY-4.0. Modified: terminal report instead of a GitHub review, a coverage table, fresh-context reviewers, and a fix loop. Licence details: [NOTICE.md](NOTICE.md).

## Rules

1. **Terminal only.** Never post a review, comment, or approval to GitHub.
2. **Evidence for every finding.** A claim about this repo cites a `path:line` you read. A claim about a library, API, or framework cites an official URL fetched during this review. A blocker that can be reproduced locally carries the command and its output.
3. **Nothing external from memory.** Read the current docs, changelog, or advisory before claiming how a dependency behaves. Inconclusive research turns the finding into a question.
4. **Report every real issue.** Severity and validity are separate: a small real issue is a nit, not a discard. Drop a finding only for lack of evidence.
5. **Tooling findings are check results.** What lint, typecheck, and tests catch goes under "Checks run", not under findings.
6. **Reviewers did not write the code.** Passes run in subagents with fresh context. The main session verifies.
7. **Coverage is part of the report.** A file no pass read is listed as not reviewed. A review reports what it checked; it cannot prove nothing was missed, and the report must not say otherwise.

## Severity

| Severity | Meaning | Verdict |
|---|---|---|
| 🔴 blocker | Data loss, exploitable security, wrong money, broken auth, irreversible migration, PII in logs | FIX_FIRST |
| 🟠 should-fix | Real defect that is not a merge risk | FIX_FIRST |
| 🟡 nit | Minor | none |
| 🟣 pre-existing | Bug this change did not introduce | none; report as follow-up |

Verdict is `MERGE` only with zero open 🔴 and 🟠. A finding the user accepts in their own words counts as closed; record the quote.

## Workflow

### Step 0: Resolve the change

With a PR: `gh pr view <n> --json number,title,body,baseRefName,headRefName` and `gh pr diff <n>`. Without one: diff the branch against its merge base with the default branch. Save the diff and the changed-file list to scratch files.

Classify each changed file as **core** or **skipped** (lockfiles, generated code, snapshots, vendored deps, build output). Every skipped file needs a reason. Code deleted in one place and added identically in another is a move; do not review it as new.

### Step 1: Deterministic checks

`<judge-skill-dir>` below is the folder this SKILL.md lives in.

Run the repo's typecheck, lint, and the tests that cover the changed files. Record the exact counts. If a check is not configured, say so. Then run the bypass scan on the diff:

```bash
python3 <judge-skill-dir>/scripts/scan_bypasses.py < diff.patch
```

Each hit is a candidate for Pass F, not a finding.

### Step 2: Research

List every external surface the diff touches: dependencies added or bumped, APIs called, version-sensitive framework and language features. Read the official source for each and log the URL with the claim it supports or refutes. If the diff touches none, write that.

### Step 3: Review passes

Dispatch reviewers as subagents. Under 400 changed core lines: one reviewer runs all passes. Above that: three reviewers in parallel (A+B, C+D, E+F). Run reviewers one model tier below this session when the harness lets you choose a model.

Each dispatch prompt carries: the diff path, the core file list, the Step 1 and Step 2 results, the absolute path of this skill's `references/review-standards.md` with an instruction to read it first, and the return shape below.

- **A. Correctness and logic**
- **B. Security**
- **C. Structure and maintainability**
- **D. AI slop and useless comments**
- **E. Claims** in the PR description or commit messages
- **F. Bypasses, duplication, and gambiarras**

Each reviewer returns: candidate findings (claim, severity, evidence), and for every core file the passes it actually read that file for. A reviewer that ran out of room says which files it did not reach.

If Claude Code's built-in `code-review` skill is available, run it on the same target as a second, independent reviewer, with `high <target>`. Never pass `--fix` or `--comment`. Its findings join the candidates for Step 4. It reports no per-file passes, so it adds findings but never counts toward coverage.

### Step 4: Verify

In the main session, for each candidate: open the cited location and confirm the claim. Reproduce 🔴 candidates from A and B when a test or short script inside the repo can do it; a feasible reproduction that fails kills the finding. Deduplicate. Set final severity; a blocker you are not sure of becomes a 🟠 question.

### Step 5: Gate

Write `findings.json` in scratch, then run from the repo root:

```bash
python3 <judge-skill-dir>/scripts/judge_gate.py findings.json changed-files.txt
```

```json
{
  "round": 1,
  "verdict": "FIX_FIRST",
  "files": {"core": ["src/billing/invoice.ts"], "skipped": [{"path": "bun.lock", "reason": "lockfile"}]},
  "coverage": {"src/billing/invoice.ts": ["A", "B", "C", "D", "F"]},
  "unverified": [],
  "claims": [{"claim": "fixes the rounding bug", "evidence": "tests/invoice.test.ts:40"}],
  "findings": [{
    "id": "F1", "path": "src/billing/invoice.ts", "line": 142, "severity": "blocker", "status": "open",
    "claim": "applyDiscount divides by items.length with no empty-list guard",
    "evidence": [{"type": "internal", "ref": "src/billing/invoice.ts:142"}]
  }]
}
```

The gate fails when a changed file is neither reviewed nor skipped, a core file lacks a pass with no `unverified` reason, a cited `path:line` does not exist, a 🔴 or 🟠 has no evidence, or the verdict disagrees with the open findings. Fix the input until it exits 0. Do not edit the gate.

### Step 6: Report

Print these sections in this order:

1. **Verdict**: `MERGE` or `FIX_FIRST`, and the reason in one sentence.
2. **Findings**: ID, severity, `path:line`, claim, fix. State the problem and its location first, then the smallest fix that works, at the root cause.
3. **Coverage**: one row per core file with the passes that read it.
4. **Not verified**: files or passes the review did not reach, and why. Write "none" if empty.
5. **Hardening notes**: see review-standards.md, Pass B.
6. **Research log**: URLs and what each supports or refutes.
7. **Checks run**: Step 1 counts.
8. **Skipped files** with reasons.
9. **Promote to lint rule**: findings a linter could catch next time, or "none".

### Step 7: Fix

Fix when the skill runs as the pre-merge gate on work the user already approved. If the user asked a question ("pode mergear?", "what's wrong with this PR?") or asked for a report, stop after Step 6.

Fix every 🔴 and 🟠. Fix 🟡 inside the change's scope. Leave 🟣 as follow-ups.

After fixing, run a new round: rerun Step 1, mark each finding `fixed` (with `fixed_in` naming the commit) or `open`, and send the fix diff to a fresh subagent that looks for new 🔴 only. Add files the fix touched to the file list and coverage. Rerun the gate and print the report again.

Two fix rounds at most. If a 🔴 or 🟠 is still open after round 3, stop and give the user the open findings and what was tried. Do not merge or enable auto-merge while the verdict is `FIX_FIRST`.
