---
name: formal-verification
license: MIT
description: >-
  Use when tests cannot reach the case that breaks the code: a race, a retry or lease, an out-of-order message, a state machine, a multi-device flow, a parser. Verifies one property with the tool that fits (a TLA+ model checked with TLC by default, property-based tests on the real code otherwise), shows the check failing on a broken variant, draws the behaviour as a Mermaid statechart a product owner can review, and leaves a project-local skill that rechecks it on every change. Also use when code covered by an existing model has changed and the model must be brought back in line. Phrases: "model check this race", "prove this invariant", "can these two retries overlap", "is the model still true to the code", "prova esse invariante", "model check dessa race", "desenha a máquina de estados".
---

# Formal verification

A test checks the cases someone thought to write. A formal check covers every case in a stated scope: every order of steps in a model, every input up to a bound, or every input. This skill verifies one property where that matters, and leaves a way to recheck it.

Adapted from the create-formal-verification-skill, maintain-formal-verification-skill and statechart skills in pstack v0.15.46 by Lauren Tan, https://github.com/cursor/plugins/tree/main/pstack, under the MIT licence. Modified: one skill with two modes, a chart drawn from the checker's own output instead of a bundled toolchain, and a property-based route for code no verifier runs on. Licence details: [NOTICE.md](NOTICE.md).

It is one layer, not a replacement for tests. A pass covers the model or the bound, never the whole system.

## Pick the mode

- **Create**: no check exists for this area. Go to "Create".
- **Maintain**: a project skill already runs a model checker, a prover, a verifier or property-based tests against named code, and that code changed. Go to "Maintain".

Find an existing check by what it does, not by its name. If the user asks for maintenance and none exists, say so and offer Create.

## Create

### 1. Choose the target from the code

Answer from the codebase. Ask the user only what you cannot observe. If the user named an area or a bug, start there.

A good target is a promise the code makes, where a break harms users and tests rarely reach the breaking case. Pick the strongest such target, not the one that is easiest to verify. Write the promise and the harm in one plain sentence each before you touch a tool:

- Promise: "A job never commits its result twice."
- Harm: "The customer is charged twice."

### 2. Let the question pick the tool

| Question | Tool |
|---|---|
| Can events happen in a bad order? | A model checker over a small model of the design. TLA+ with TLC is the default, in any language. See [references/tlc.md](references/tlc.md). |
| Does the code behave for every input? | A verifier that runs on the code itself, if one exists for the language. |
| No verifier runs on this language | Say so. Test the real code with generated inputs. See [references/property-based.md](references/property-based.md). Never test a hand copy of the function. |
| Must it hold at every size, where a bound is not enough? | A proof, for example in Lean. Costly. Say why a bound will not do. |

Prefer a tool the repo's developers can install and run. Tell the user which tool you chose and why.

### 3. Write the check to this standard

- **True to the code.** Each step of the model points to code a reviewer can open. One indivisible step in the model is one indivisible step in the code. Names come from this repo.
- **Able to fail.** A check you have never seen fail proves nothing. Show each property failing on a broken variant: a removed check, a reordered step.
- **Findings stay findings.** If the current code breaks the property, report it. Do not weaken the property or the model until it passes. Do not change product code unless the user asks.
- **Honest about scope.** State what is verified, under which bounds and assumptions, and what is left out.
- **Readable without the tool.** Tell a counterexample as a short list of steps in the code's own words.
- **Cheap to rerun.** One command, a pinned tool version, a run short enough to use on every relevant change.
- **Kept in step.** Record the files and functions each check covers, and the commit where you last confirmed the check describes them.

[references/example-job-lease/README.md](references/example-job-lease/README.md) walks one small case end to end: the model in [JobLease.tla](references/example-job-lease/JobLease.tla), a passing config in [JobLease.cfg](references/example-job-lease/JobLease.cfg), a broken variant in [JobLeaseBroken.cfg](references/example-job-lease/JobLeaseBroken.cfg), the reader's labels in [view.ts](references/example-job-lease/view.ts), the counterexample as steps, and the chart.

### 4. Draw the behaviour

A counterexample in model terms convinces you. The person who owns the behaviour needs it in their words. Draw a Mermaid `stateDiagram-v2` from the checker's state graph with `scripts/dot-to-mermaid.ts`, not from memory, so the picture and the checked model cannot drift apart. Mark each state that breaks a rule and give the shortest path to it. Follow [references/statechart.md](references/statechart.md).

Before you show a bug path to anyone, replay it against the real code as a test or a live reproduction, one step per action. If the bug does not occur, assume the model is wrong until you show otherwise.

### 5. Generate the project skill

Steps 5 and 6 and Maintain mode were not run end to end while this skill was written. The model check, the broken variant, the chart script and the property-based test were.

Write `.claude/skills/verify-<area>/SKILL.md` in the target repo. Name it after the verified area, such as `verify-job-lease`, so it does not collide with a `verify-<app>` skill that drives the running app. Give it YAML frontmatter with `name: verify-<area>` and a `description` that names the area and says when to use it. Claude decides when to load a skill from its description, so a skill without one is never matched to a change.

From that skill alone, the next agent must be able to:

1. Tell whether a change touches the verified code (the coverage record).
2. Run the check with one command.
3. Tell a real bug from a modelling error (replay the counterexample against the code).
4. Update the verification when a change is intended.

Put the coverage record and the sync commit in the skill. Tell the next agent to move the sync commit forward only after it confirms the verification describes the code at the new commit. Use this repo's real commands, paths and nouns. Leave no placeholders. Keep the model, config and any script next to the skill, and commit them. Do not commit the tool's jar or build output.

### 6. Prove it, then hand off

Follow the generated skill once, as the next agent would, on a scratch change that breaks the property in the real code. It must catch the break. Drop the scratch change. Confirm the check is back where it started: passing, or failing only on the findings you will report. If the skill misses the break, fix the skill or the verification, not the scratch change.

Tell the user: what you verified, the tool and why, the bounds, what the check found in plain words, the one command, and what it does not cover. Suggest a second target only if you found a close one.

## Maintain

A check that passes on a description of code that no longer exists is the dangerous case. It looks like a proof.

Edit only the verification: models, harnesses, property files and the verify skill. Never edit product code in this mode unless the user asks.

1. **Find the checks.** For each one collect the property, the covered code, the bounds, the command and the sync commit. If no sync commit is recorded, use the last commit that changed the verification files, and say you did.
2. **Run it as it is.** Record the result. A pass means the old description still holds, not that the code is correct. Do not judge a failure yet.
3. **Read every change to covered code** from the sync commit to now, with commit messages. Follow renamed, split or moved functions. Look for new code that writes the state a check guards. Sort each change:
   - No effect on anything the verification describes. Check this against the model, not the commit message.
   - The verification no longer describes the code: a step split in two, a branch added, a check moved, a new path to the guarded state.
   - The promise changed on purpose, with evidence in the change: a doc comment, tests, the changelog.
   - The promise may be broken: the code changed and nothing says the promise did.
4. **Update from the code, not from the result.** Write the update before you rerun. Change a property only for a promise that changed on purpose, and record the old wording, the new wording and the evidence. Keep the bounds unless the change makes them wrong.
5. **Rerun and judge.**
   - Pass: break the new code the way the property guards against, confirm the check catches it, drop the break.
   - Fail: replay the counterexample against the real code, step by step. A step that cannot happen means the verification is wrong; fix it and say what was wrong. If every step can happen, it is a bug. Name the commit that introduced it, the steps, and the harm.
6. **Update the verify skill**: coverage, commands, bounds, assumptions, sync commit. Do not move the sync commit for a blocked check. Then follow the skill once as the next agent would.

Give each check one outcome:

| Outcome | Meaning |
|---|---|
| in sync | Nothing changed what the check describes, and it passes. |
| updated | The code changed, the verification describes the new code, and it passes. |
| bug | The verification describes the current code, and the code breaks the property. |
| blocked | The check could not be brought in line or could not run. Say exactly why. |

A check can be both updated and bug. Say outright which failures were drift and which were bugs. If a check passed before your update and fails after, say the old pass was on a stale description. Put verification updates in a change of their own, apart from any product fix.

## Pitfalls

- A model that no reviewer can map to code proves a property of the model only.
- A deadlock report on a correct end state is the model's fault. Add a stuttering action for end states or turn deadlock checking off, and say which. See [references/tlc.md](references/tlc.md).
- An unbounded counter makes TLC run without end. Bound it with a constant or a `CONSTRAINT`, and report the bound.
- Weakening a property until it passes turns a finding into a false pass.
- A chart drawn by hand drifts from the model. Rebuild it from the state graph on every change.
- The chart script reads only the dump. A dump TLC wrote before it stopped at a violation holds no breaking state, so check TLC's exit status before you trust a chart with no marks.
- Property-based tests on a hand model of the function test the model, not the code.
- Tool commands change between releases. Pin the version and record it in the generated skill.

## Files

- [NOTICE.md](NOTICE.md): upstream credit and licence.
- [references/tlc.md](references/tlc.md): getting TLC, the command line, the config file, exit codes, the state graph dump.
- [references/statechart.md](references/statechart.md): drawing the Mermaid chart and marking rule breaks.
- [references/property-based.md](references/property-based.md): generated-input tests on real code with fast-check.
- [references/example-job-lease/README.md](references/example-job-lease/README.md): a worked example, with [JobLease.tla](references/example-job-lease/JobLease.tla), [JobLease.cfg](references/example-job-lease/JobLease.cfg), [JobLeaseBroken.cfg](references/example-job-lease/JobLeaseBroken.cfg) and [view.ts](references/example-job-lease/view.ts).
- `scripts/dot-to-mermaid.ts`: builds the chart and the shortest bug path from a TLC dot dump and a view module. Run with bun.
- [references/sources.md](references/sources.md): where each tool fact comes from.

## Related skills

- `runtime-verification`: drive the real app and keep evidence. Use it to replay a counterexample live.
- `bombadil`: property-based testing of a running web or terminal UI.
- `encode-corrections`: turn a correction into a lint, type or test.
- `judge`: review the change before merge. It ships in the `standalone-skills` plugin.
