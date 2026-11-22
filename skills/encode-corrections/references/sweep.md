# Sweep: where to look

A sweep finds mistake classes that happened at least twice and encodes them. Read only this workspace. Send each source to its own subagent with the Agent tool and ask for candidates in this shape: what went wrong, where (commit hash, `path:line`, PR number or transcript file and line), and how often.

## Commits and reverts

```bash
git log --oneline -i -E --grep='^revert' -n 200
git log --oneline -i -E --grep='fix(es|ed)?|again|forgot|missing|wrong|oops|typo' -n 300
git log --format='%h %s' --since='6 months ago' -- <a file that keeps changing>
```

- A revert names a mistake that reached the main branch. Read the reverted diff to name the class.
- A fix commit that follows a feature commit within a day or two often fixes the same mistake class each time.
- Files that change in many small fix commits mark where agents keep getting it wrong.

## Review comments

```bash
gh api 'repos/{owner}/{repo}/pulls/comments?sort=created&direction=desc&per_page=100' --paginate \
  --jq '.[] | [.html_url, .path, .body] | @tsv'
gh pr list --state merged --limit 100 --json number,title,body
```

`gh api` fills `{owner}` and `{repo}` from the current repository. A reviewer who writes the same remark on several PRs has named a class.

## Instruction files

```bash
git log -p --follow -- CLAUDE.md
git log -p -- AGENTS.md .claude/rules
```

Each line someone added to an instruction file is a past correction. A rule added, then reworded or repeated louder later, is a correction that did not hold. Check each rule against the rule table: if nothing enforces it, it is a candidate.

## Comments in the code

```bash
git grep -n -i -E 'hack|workaround|for now|temporary|do not (remove|change|touch)|don.t (remove|change|touch)|talk to .* before|important:' -- ':!*.md'
git grep -n -E 'biome-ignore|eslint-disable|@ts-ignore|@ts-expect-error|as unknown as' -- ':!*.md'
```

- Constraint comments are rules nobody enforces. Each is a candidate for a type, test or lint.
- Workaround comments point at a root cause. Several around the same API or pattern form a class.
- Suppressions without a reason, or of a rule that guards correctness, are findings.

## This workspace's agent transcripts

Claude Code keeps each session's transcript at `~/.claude/projects/<project>/<session>.jsonl`, and auto memory, which records corrections the user gave, at `~/.claude/projects/<project>/memory/`. `<project>` is the session's working directory path with every character other than letters and digits replaced by `-` (inferred from the docs; list `~/.claude/projects/` to confirm the folder name). Transcripts older than `cleanupPeriodDays` (default 30) are gone.

- Read only the folder for this workspace's path. A git worktree has its own path, so its sessions sit in a different folder. Read a sibling worktree's folder only if the user says to.
- Transcripts are plaintext and can hold secrets a tool printed. Quote only the lines that show the correction. Never copy credentials into the reply or a file.
- Search the user's turns for correction phrases, then read around each hit:

```bash
grep -l -i -E "already told you|again\?|keep doing|stop doing|I said|já te (falei|corrigi)|de novo|para de" ~/.claude/projects/<project>/*.jsonl
```

The jsonl line format is not documented on the pages this skill was checked against. Read a few lines before you write a parser for it.

## Group and rank

- Name each class by the mistake, not the file: "parses request bodies without a schema", not "bug in `invite.ts`".
- Keep a class only with two or more occurrences. List single occurrences in the reply as notes.
- Rank by count, then by cost: a revert or a production fix outranks a review nit.
- For each class, record the evidence and the level you plan, then follow the Mode 2 steps in SKILL.md.
