#!/usr/bin/env python3
# Adapted from review_gate.py in The Judge v1.4.0, tech-leads-club/agent-skills. MIT License, Copyright (c) 2026 Tech Leads Club.
# invariant: stdlib only, no network. Run from the repo root so cited paths resolve.
# Checks what a regex can check: every changed file is accounted for, every
# finding cites evidence that exists, and the verdict matches the open findings.
import json
import os
import sys

SEVERITIES = ("blocker", "should-fix", "nit", "pre-existing")
STATUSES = ("open", "fixed", "accepted")
FILE_PASSES = ("A", "B", "C", "D", "F")
VERDICTS = ("MERGE", "FIX_FIRST")
MAX_ROUND = 3


def line_count(path):
    try:
        with open(path, "rb") as fh:
            return sum(1 for _ in fh)
    except OSError:
        return None


def check_internal(ref, label):
    path, sep, line = ref.rpartition(":")
    if not sep or not line.isdigit() or int(line) < 1:
        return [f"{label}: internal evidence '{ref}' must be path:line"]
    if os.path.isabs(path) or os.path.normpath(path).startswith(".."):
        return [f"{label}: cited path '{path}' must be relative and inside the repo"]
    total = line_count(path)
    if total is None:
        return [f"{label}: cited file '{path}' does not exist in this checkout"]
    if int(line) > total:
        return [f"{label}: '{path}' has {total} lines, citation points at line {line}"]
    return []


def check_finding(f):
    label = f"{f.get('id', '?')} ({f.get('path', '?')}:{f.get('line', '-')})"
    sev = f.get("severity")
    if sev not in SEVERITIES:
        return [f"{label}: invalid severity '{sev}'"]
    v = []
    if f.get("status", "open") not in STATUSES:
        v.append(f"{label}: status must be one of {STATUSES}")
    if not str(f.get("claim", "")).strip():
        v.append(f"{label}: empty claim")
    if f.get("status") == "fixed" and not str(f.get("fixed_in", "")).strip():
        v.append(f"{label}: fixed findings need 'fixed_in' naming the commit")
    if f.get("status") == "accepted" and not str(f.get("accepted_reason", "")).strip():
        v.append(f"{label}: accepted findings need 'accepted_reason' quoting the user")
    ev = f.get("evidence") or []
    if sev in ("blocker", "should-fix") and not ev:
        v.append(f"{label}: '{sev}' requires at least one evidence entry")
    for e in ev:
        t, ref = e.get("type"), str(e.get("ref", ""))
        if t == "internal":
            # a fix may shorten, split or delete the cited file
            if f.get("status", "open") != "fixed":
                v += check_internal(ref, label)
        elif t == "external":
            if not ref.startswith("https://"):
                v.append(f"{label}: external evidence must be an https URL, got '{ref}'")
        elif t == "repro":
            if not ref.strip():
                v.append(f"{label}: repro evidence must carry the command")
        else:
            v.append(f"{label}: evidence type must be internal, external or repro, got '{t}'")
    return v


def check_coverage(data, changed):
    v = []
    files = data.get("files") or {}
    core = files.get("core") or []
    skipped = files.get("skipped") or []
    coverage = data.get("coverage") or {}
    unverified = {u.get("path"): u for u in data.get("unverified") or []}
    skipped_paths = set()
    for s in skipped:
        skipped_paths.add(s.get("path"))
        if not str(s.get("reason", "")).strip():
            v.append(f"COVERAGE: skipped file '{s.get('path')}' has no reason")
    for path in changed:
        if path not in core and path not in skipped_paths:
            v.append(f"COVERAGE: changed file '{path}' is neither reviewed nor skipped")
    for path in core:
        missing = [p for p in FILE_PASSES if p not in (coverage.get(path) or [])]
        if not missing:
            continue
        gap = unverified.get(path) or {}
        if not str(gap.get("reason", "")).strip():
            v.append(f"COVERAGE: '{path}' missing pass(es) {','.join(missing)} with no 'unverified' entry explaining why")
    if "claims" not in data:
        v.append("COVERAGE: 'claims' is required (Pass E); use [] when the change makes no claims")
    return v


def main():
    if len(sys.argv) != 3:
        print("usage: judge_gate.py findings.json changed-files.txt", file=sys.stderr)
        return 2
    try:
        data = json.loads(open(sys.argv[1], encoding="utf-8").read())
        changed = [l.strip() for l in open(sys.argv[2], encoding="utf-8") if l.strip()]
    except (OSError, json.JSONDecodeError) as e:
        print(f"malformed input: {e}", file=sys.stderr)
        return 2

    if not isinstance(data, dict):
        print("malformed input: findings.json must hold a JSON object", file=sys.stderr)
        return 2
    v = []
    findings = data.get("findings")
    if not isinstance(findings, list):
        v.append("SCHEMA: 'findings' must be a list")
        findings = []
    if not all(isinstance(f, dict) for f in findings):
        v.append("SCHEMA: every finding must be a JSON object")
        findings = [f for f in findings if isinstance(f, dict)]
    ids = [f.get("id") for f in findings]
    if len(ids) != len(set(ids)):
        v.append("SCHEMA: finding ids must be unique")
    for f in findings:
        v += check_finding(f)
    v += check_coverage(data, changed)

    round_n = data.get("round", 1)
    if isinstance(round_n, bool) or not isinstance(round_n, int) or not 1 <= round_n <= MAX_ROUND:
        v.append(f"ROUND: must be 1..{MAX_ROUND} (one review plus two fix rounds), got {round_n!r}")

    open_real = [f for f in findings
                 if f.get("severity") in ("blocker", "should-fix") and f.get("status", "open") == "open"]
    expected = "FIX_FIRST" if open_real else "MERGE"
    verdict = data.get("verdict")
    if verdict not in VERDICTS:
        v.append(f"VERDICT: '{verdict}' not in {VERDICTS}")
    elif verdict != expected:
        v.append(f"VERDICT: '{verdict}' but {len(open_real)} blocker/should-fix still open, expected '{expected}'")

    if v:
        print("\n".join(v))
        print(f"\ngate: FAIL ({len(v)} violations)")
        return 1
    print(f"gate: PASS ({len(findings)} findings, {len(changed)} changed files, verdict {verdict})")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (AttributeError, TypeError) as e:
        # A nested value has the wrong shape (a string where an object belongs, say).
        print(f"malformed input: wrong shape in findings.json ({e})", file=sys.stderr)
        sys.exit(2)
