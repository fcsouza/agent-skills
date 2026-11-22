# Levels

Pick the highest level that makes the mistake fail. Write down why each higher level did not work; the reply needs it.

Assume every contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles. A change that looks right from one file must be right for the whole repo.

## Level 1: remove the mistake with architecture or API design

The mistake cannot happen because the wrong path no longer exists.

Fits when:

- Two pieces of code own the same state, and the mistake is updating one and not the other. Give the state one owner.
- There are two ways to do a task, and agents pick the old one. Delete the old one and migrate its callers in the same change.
- An internal module is importable from outside its feature. Stop exporting it, so the wrong import fails to resolve.
- A list is kept in sync by hand in two places. Derive one from the other.
- Dead code or a deprecated helper still sits in the tree. An agent will copy it. Delete it.
- An API needs nuance to use well, and agents keep misusing it. Wrap it once in a narrow API that only allows the safe uses, and ban the raw API everywhere else (level 3 does the banning).
- Context belongs in the directory layout. Code that must not mix lives in separate top-level folders with a name that says why, and imports between them are forbidden (level 3 does the forbidding).

Needs approval: these changes reshape code other people depend on. Propose the change, the files it touches and the migration, then wait.

Not enough on its own when the old path can come back by accident. Pair it with a level 3 check that fails if it does.

## Level 2: make the bad state unwritable with types

The compiler rejects the mistake.

Fits when:

- Two values share a primitive type but mean different things: a user id and an org id, cents and reais, a raw path and a checked one. Brand each one, so passing the wrong one is a type error.
- External data (JSON, request bodies, env vars, CLI args, database rows, IPC messages) is used without a check. Parse it at the boundary into a typed model. Inside, trust the type and drop redundant checks.
- An object can hold contradictory fields (`loading: true` with `error` set). Model the states as a discriminated union.
- A new variant gets added and some `switch` forgets it. Add an exhaustiveness check so the compiler names every missed case.
- Code reaches for `as`, `!` or a "should never happen" throw. The input type is too loose. Strengthen it (a non-empty tuple, a parsed type) and the assertion disappears.
- A type is written by hand next to a schema that already defines it. Derive the type from the schema.

Not enough when the bad code still type-checks: an allowed call in the wrong place, a cast that lies. Add level 3.

## Level 3: a lint or CI check whose message names the fix

Bad code still compiles, so a tool flags it before merge.

Fits when the mistake has a shape a tool can match:

- A banned import, or a banned name imported from a module (a nuanced framework hook outside its wrapper).
- A banned global (raw timers used to patch over an ordering bug).
- A call shape (`x.setTimeout(...)`, a logger option, a query built by string concatenation).
- An import across a layer boundary (renderer to main, UI to database).
- A count that must not grow (the ratchet).
- A file or config fact (a lockfile path, a missing env key in the example file).

Write the message so an agent can act on it with no other context:

- Bad: `Do not use setTimeout.`
- Good: `Timers here patch over an ordering bug. Use schedule() from src/framework/time.ts, or fix the event order.`

The good message names the root cause, the replacement and where it lives. It leaves no room for a workaround that silences the lint.

When the pattern is already common, a plain ban would fail every build. Add a ratchet that fails only when a change adds occurrences, put the current count in the table row, and clean up the old ones in their own change.

## Level 4: a behaviour test

Fits when the mistake is wrong behaviour no static rule can see: a wrong total, a missed retry, an event handled twice.

- Assert what a user of the code observes: a return value, a written record, a response, a rendered screen.
- The test must fail when the behaviour breaks and survive a refactor of the internals. A test that passes with the behaviour broken, or that fails when only internals change, is worse than none. Fix or delete it.
- Run the real thing where you can. Mock only what you cannot run locally.

## Level 5: a harness hook

Fits when the mistake is agent behaviour, not code:

- Running a command the project forbids (the wrong package manager, a formatter binary called directly).
- Skipping safety steps (`--no-verify`, force-push to `main`).
- Writing outside the allowed area, or staging a secrets file.

A hook runs before the tool call, so it stops the action before it happens. It only stops agents running in this harness. If the mistake also shows up as code a human could write, a level 3 check is better, because it runs for everyone and in CI.

Recipes: `harness-hooks.md`.

## Level 6: prose

Only for judgment calls no tool can decide: "ask before renaming a public API", "prefer deleting a feature flag to adding a branch".

- Write the rule, the failure it prevents, and one short example of that failure.
- Put it in the rule table with "prose" as the enforcer.
- If the same correction comes back, the prose did not work. Look again for a higher level.

## Worked examples

- **A framework hook misused across product code.** Level 1: wrap the safe uses in one data-loading helper. Level 3: ban the raw hook outside the wrapper's folder, with a message that names the helper. Prose: none.
- **Main-process code imported into the UI process, causing jank.** Level 1: two top-level folders named for the two processes. Level 3: a dependency-graph rule that forbids imports from one to the other, with a message that names the IPC bridge.
- **Timers added as quick fixes, each with a comment explaining why it was fine.** Level 1: fix the ordering clash the timers patched over. Level 3: ratchet raw timers in `src/`; ban the call shape with a message that names the scheduler. Delete the justifying comments.
- **`npm` run in a bun project.** No code to lint. Level 5: a hook that refuses the command and names the bun equivalent.
- **A user id passed where an org id was expected.** Level 2: brand both ids and build them only through parse functions at the boundary.
