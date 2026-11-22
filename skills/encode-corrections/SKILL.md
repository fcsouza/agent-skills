---
name: encode-corrections
license: MIT
description: Use when the user corrects the agent, above all for a mistake it was corrected for before, or asks that a mistake never come back. Turns each correction into something that fails when the mistake recurs, in this order of preference, an architecture or API change, a type, a lint or CI check whose message names the fix, a behaviour test, or a Claude Code hook, and leaves prose in CLAUDE.md or AGENTS.md only for judgment calls. Also use for an explicit sweep, when the user asks to mine commits, reverts, review comments, instruction files and workaround comments for mistake classes that happened at least twice. Use on phrases like "I already told you this", "you did it again", "you keep doing X", "stop doing that", "add a rule so this never happens again", "turn this into a lint", "encode this lesson", "já te corrigi isso", "para de fazer isso", "de novo isso?", "quantas vezes vou ter que falar", or "varre o repo atrás de erros repetidos".
---

# Encode corrections

Turn each correction into a check that fails when the mistake comes back. A line of prose in CLAUDE.md fails silently: the next agent may not read it, may not weigh it, or may find a reason to skip it. A type error, a lint error or a failing test stops the change.

Adapted from pstack v0.15.46 by Lauren Tan, https://github.com/cursor/plugins/tree/main/pstack (the `correct` and `no-comments` skills, the comment-reviewer agent, five principle skills and the TypeScript guide) under the MIT licence, with ideas from her 2026 AI Engineer talk on keeping agent-written code clean. Modified: two modes, a level for harness hooks, an approval rule, TypeScript and Biome recipes checked against current docs, and a tested ratchet script. Licence details: [NOTICE.md](NOTICE.md).

## Why this works

- The codebase is the largest input an agent reads. It copies what it finds there. One workaround becomes the pattern the next agent follows.
- A rule in prose holds only while someone reads it and agrees. A check holds every time it runs.
- Some APIs need nuance to use well, and agents use them badly. Ban them outside one wrapper instead of teaching the nuance.
- Comments cannot be enforced. They go stale, and they give an agent a place to justify a workaround instead of fixing the cause.
- Each mistake encoded is one less thing a reviewer has to look for.

## Rules

1. **Highest level that works.** Go through the levels below in order. Stop at the first level that makes the mistake fail.
2. **Prove the check.** Reintroduce the real past mistake in a scratch change, watch the new check fail, then drop the scratch change. A check you have not seen fail is a guess.
3. **Same command locally and in CI.** Wire the check into the script developers already run and into CI under that same script. A check that runs only in CI teaches the agent nothing until push.
4. **Exceptions sit on the offending line, with a reason.** Use the tool's one-line suppression, naming the rule and the reason. No file-wide or range suppressions, and no rule switched off for a whole folder to get past one hit.
5. **The error message names the fix.** It says what to use instead and where it lives: the function, the file, the type. "Do not use X" alone sends the agent looking for a way around.
6. **Stop new occurrences first.** If the pattern is already common, add a ratchet that fails only when a change adds more, then clean up the old ones in their own change.
7. **No prose when structure exists.** If a type, lint, test or hook now enforces the rule, do not also add the rule to CLAUDE.md. The table row (below) is the only prose.
8. **Ask before you reshape.** Architecture changes, public API changes and anything that touches many files: propose and wait. Use AskUserQuestion. A hook changes harness settings the team shares, so propose it and wait too. Adding a lint, type or test for the correction at hand needs no approval.
9. **Fix the cause, not the spot.** Encoding the check does not finish the job. Fix the instance that triggered the correction at its root, and find every other instance of the same fault.

## Levels

| Level | Encode as | Fits when |
| --- | --- | --- |
| 1 | Architecture or API design | The wrong path can be deleted, hidden or made unreachable: one owner per piece of state, one supported way per task, internals not exported. |
| 2 | Types | The bad state can be made unwritable: branded ids, parse at the boundary, discriminated unions, exhaustive `switch`. |
| 3 | Lint or CI check | Bad code still compiles: a banned import, global or call shape, an import across a layer boundary, a count that must not grow. |
| 4 | Behaviour test | The mistake is wrong behaviour that no static rule can see. The test asserts what a user of the code observes. |
| 5 | Harness hook | The mistake is agent behaviour, not code: the wrong package manager, a skipped git hook, a forbidden command. |
| 6 | Prose | A judgment call that no tool can decide. Write the rule, the failure it prevents, and one example of it. |

Details, signs that a level fits and stack-agnostic examples: `references/levels.md`. TypeScript, bun and Biome recipes: `references/typescript-biome.md`. Hooks: `references/harness-hooks.md`.

## Mode 1: a correction just happened

1. **Name the class.** State the mistake as a class, not an instance. "Imported a main-process module into renderer code", not "wrong import in `view.ts`".
2. **Check the table.** Open the rule table in CLAUDE.md or AGENTS.md. If a row covers this class and its enforcer is prose, this is a repeat: encode it at the highest level in this same change. If a check already covers it and did not fire, the check misses this case: widen it.
3. **Pick the level.** Go through the levels from level 1. Write down why each higher level does not work.
4. **Fix the instance at its root.** Then search for other instances of the same class (`git grep`, the new lint run over the whole tree).
5. **Encode.** Write the type, lint, test or hook. If it needs approval (rule 8), ask now and finish the parts that do not depend on the answer.
6. **Prove it.** Reintroduce the original mistake, run the check, see it fail with a message that names the fix, drop the scratch change.
7. **Wire it.** Same script locally and in CI.
8. **Update the table.** Add or change the row. Delete prose the check now covers.
9. **Reply** in the format below.

## Mode 2: sweep

Run when the user asks for one. Read only this workspace's history.

1. **Collect evidence.** Commits, reverts, PR review comments, the agent instruction files (CLAUDE.md, AGENTS.md, `.claude/rules/`), comments that justify a workaround or forbid a change, and this workspace's own agent transcripts. Commands and locations: `references/sweep.md`. Send bulk reading to subagents with the Agent tool. Give each one source and ask for candidate mistakes with evidence.
2. **Group into classes.** A class counts once it has happened at least twice. One occurrence stays a note in the reply.
3. **Rank** by count and by cost: reverts and production fixes first.
4. **Plan.** List each class with its evidence and proposed level. Classes at levels 2 to 4 that touch few files go ahead. Level 1, level 5 and wide edits wait for approval (rule 8).
5. **Encode** the top classes, one commit each, with Mode 1 steps 4 to 8.
6. **Reply** in the format below, with the classes left open and why.

## Comments as evidence

- A constraint comment ("do not remove", "keep this order", "talk to X before changing") is an unenforced rule. Encode it as a type, test or lint, prove the check, then delete the comment. If you cannot encode it now, report it as open.
- A comment that justifies a workaround ("hack", "needed because", "for now", a long apology above a timer) points at a root cause. Fix the cause and delete the workaround with its comment. If the cause is out of scope, report it.
- Keep: licence headers, doc comments on a public API, notes on behaviour forced by something outside the repo (a vendor, a protocol, a platform bug) with a link, and lint suppressions that carry a reason.
- A suppression of a rule that guards correctness or safety is a finding, not an exception. Fix the code it hides.

## The rule table

Keep one table in the agent instruction file the repo already uses (CLAUDE.md or AGENTS.md). Create it if it is missing.

```markdown
## Encoded rules

| Rule | Enforced by | Since |
| --- | --- | --- |
| Renderer code never imports from `src/main/` | dependency-graph rule `renderer-not-to-main`, run by the lint script | 2026-11-22 |
| No new raw timers in `src/` | ratchet in the lint script; 41 left | 2026-11-22 |
| Ask before changing a public API name | prose (judgment) | 2026-11-22 |
```

- "Enforced by" names the check and the command that runs it. "prose" means nothing enforces the row.
- Drop a row once its mistake cannot happen at all, for example after the API that allowed it is gone.
- A prose row that comes back as a correction moves to a higher level in the same change.

## Reply format

For each mistake class:

- **Class**: one line.
- **Evidence**: the correction, commits, comments or transcript lines, with hashes or `path:line`.
- **Level chosen** and the check: file, rule name, command.
- **Why not higher**: one line per level skipped.
- **Proof**: the command run against the reintroduced mistake and the failing output.
- **Open**: what waits for approval or was left out of scope.

## Pitfalls

- Do not answer a correction with only a CLAUDE.md line when a check could enforce it. That is the failure this skill exists to stop.
- Do not register a check at warning severity and call it enforced. Many linters exit 0 on warnings. Set it to fail the run.
- Do not trust a check you have not seen fail on the real mistake.
- Do not use a hook to guard a code pattern. A hook stops only the agent; a lint stops every author and runs in CI.
- Do not widen an exception. One line, one rule, one reason.
- Do not ban a pattern the codebase still uses in hundreds of places with a plain lint. Ratchet it, then clean up.
- Do not let one correction turn into a sweeping rule. Encode the class the user named; ask before you generalise it to more.
- Do not read other workspaces' transcripts during a sweep.

## Files

- `references/levels.md`: read when choosing a level. Each level, how to tell it fits, examples.
- `references/typescript-biome.md`: read before writing a check in a TypeScript, bun and Biome (ultracite) repo. Restricted imports and globals, per-directory overrides, GritQL plugins, suppressions, layer boundaries, branded types, parse at the boundary, the ratchet.
- `references/harness-hooks.md`: read when the mistake is agent behaviour. Settings hooks and mods, with a tested hook script.
- `references/sweep.md`: read before a sweep. Where to look and the commands.
- `references/sources.md`: read when you need the page behind a claim or want to recheck one.
- `scripts/ratchet.sh`: copy into the target repo. Fails when a change adds lines that match a pattern.

## Related skills

- `runtime-verification`: when the mistake shows only in the running app.
- `formal-verification`: when the mistake breaks an invariant of a state machine or algorithm.
- `bombadil`: when the mistake is a UI behaviour a property test can find.
- `judge`: its "Promote to lint rule" section feeds this skill.
