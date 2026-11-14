---
name: game-build
description: Builds one game component from the MVP plan as typed TypeScript with tests and mocks for unbuilt dependencies, then records it in the build registry. Use when the user wants to implement a planned component (for example auth, matchmaking, shop), check build progress with "status", or redo a built component with "--rebuild". Takes `$ARGUMENTS` (falls back to the user's message); needs `docs/mvp-first-draft.md`, which `/game-architect` writes.
argument-hint: component name (e.g. auth, matchmaking, shop), "<component> --rebuild", or "status"
---

# Game Build

Input: `$ARGUMENTS`; if empty, use the user's message. It holds a component name, `<component> --rebuild`, or `status`.

This command skips the `game-dev` index. The skill table in Phase 3 picks the skills.

## Requires

- `game-backend-architecture`
- `game-design-fundamentals`
- `quest-mission-design`
- `quest-narrative-coherence`
- `postgres-game-schema`
- `redis-game-patterns`
- `bullmq-game-queues`
- `betterauth-integration`
- `stripe-game-payments`
- `elevenlabs-sound-music`
- `game-state-sync`
- `matchmaking-system`
- `gameplay-analytics`

Load a skill from this list only when the Phase 3 table picks it. Before you apply one, check that it appears in your available skills list. If it is not, name it, give this install line, and stop: `bunx skills add fcsouza/agent-skills --skill <name>`.

## Prerequisites

- `docs/mvp-first-draft.md` in the project (run `/game-architect` first)

## Phase 0: Load context

Do this before writing code.

1. If `docs/mvp-first-draft.md` is missing, say: "Stopped: no MVP plan. Run `/game-architect` first, so the build follows one plan." Then stop.
2. Read the plan. If the component matches an item in Section 10 (Out of Scope / Deferred), say "Deferred: [component] was deferred because [reason]. Building it now widens scope. Continue?" and wait.
3. Read `docs/build-registry.md`. If it is missing, copy the registry skeleton from `templates/build-registry.md`.
4. If the component touches quests or story, read `docs/world-lore.md` and `docs/quest-registry.md`.

`status`: read the registry, print a table of built, rebuilding, mocked and remaining components, build nothing, stop.

## Phase 1: Dependencies

Resolve the component's dependencies from the plan. For each one, check the registry.

- `built`: import it from its registered path. Do not regenerate it.
- Not built: write a typed mock with the interface the real one will have and realistic fake data. Mark it `// MOCK: replace with real implementation via /game-build [dependency-name]` and register it as `status: mock`.

List the mocks at the top of your output.

**Component already `built` or `rebuilding`.** Stop and say: "[component] is built (docs/build-registry.md). To redo it, run `/game-build [component] --rebuild`." For `rebuilding`, say instead: "[component] has a rebuild in progress. Run `/game-build [component] --rebuild` to resume it." Regenerating would overwrite code other components import, so only `--rebuild` proceeds. With `--rebuild`:
1. List the components that depend on it (the registry entries whose "Depends on" names it) and tell the user they will need a re-check.
2. Set its registry status to `rebuilding`, build as normal, and set it back to `built` in Phase 5.
3. Keep its public exports and types unless the user asked to change them; flag any change you make.

## Phase 2: Clarify (at most 2 questions)

Ask only when the plan cannot answer, for example REST or WebSocket when it lists both. Never ask about naming or style.

## Phase 3: Build

Code standards:
- TypeScript strict. No `any`, no implicit types.
- Error handling and input validation included.
- Build what the plan specifies for this component and nothing more. If you need schema, queues, routes or features the plan lacks, mark them `NOT IN PLAN` and ask.
- Cite the skill that drove each major decision in a comment:
  ```typescript
  // [-> bullmq-game-queues: retry with exponential backoff]
  const retryConfig = { attempts: 3, backoff: { type: 'exponential', delay: 1000 } };
  ```

Files:
```
src/[component-name]/
  index.ts              public API
  [component].ts        core logic
  [component].test.ts   tests
  types.ts              types for this component
src/__mocks__/[dependency].mock.ts   mocks from Phase 1
```

Skill table:

| Component involves | Apply |
|---|---|
| DB reads/writes | `postgres-game-schema` |
| Cache, realtime | `redis-game-patterns` |
| Background jobs | `bullmq-game-queues` |
| Auth, sessions | `betterauth-integration` |
| Payments | `stripe-game-payments` |
| Audio, SFX | `elevenlabs-sound-music` |
| Quests, missions | `quest-mission-design`, `quest-narrative-coherence` (coherence check first) |
| Client-server sync, multiplayer | `game-state-sync`, `game-backend-architecture` (server decides; the client sends intentions) |
| Matchmaking | `matchmaking-system` |
| Analytics | `gameplay-analytics` |

Tests cover: the happy path, boundary cases, failure when a dependency throws or returns bad data, and that each mock matches the interface it replaces. Assert on behavior, not snapshots. A component without tests is incomplete.

### Test runner

Read `package.json`.
- If `vitest` is a dependency, write tests with Vitest and run them with `bun run test` (add a `test` script of `vitest run` if missing). Vitest's guide says to use `bun run test` with Bun, because `bun test` starts Bun's own runner instead. Docs: https://vitest.dev/guide/
- Otherwise, import `describe`, `it` and `expect` from `bun:test` and run `bun test src/[component-name]/`. Docs: https://bun.com/docs/test

## Phase 4: Narrative check (only if the component has story or quest content)

Check the new content against `docs/world-lore.md` and `docs/quest-registry.md` using the checklist in `quest-narrative-coherence`. On a conflict, say "Conflict: [description]" and propose a fix before the final code. Register new content in `docs/quest-registry.md`.

## Phase 5: Verify, then update the registry

1. Run the typecheck: `bun run typecheck` if the script exists, else `bunx tsc --noEmit`.
2. Run the component's tests with the Phase 3 command.
3. Read both outputs. Fix failures that come from your code. If something fails and you cannot fix it, report it as it is; do not mark the component `built`.
4. Run `bun run format` if the script exists.
5. Read `templates/build-registry.md` when you write the entry. Add or update the entry in `docs/build-registry.md` in its entry format, and update the Summary counts.

## Phase 6: Report

1. Summary: component, files created, test count, dependencies (real and mocked), typecheck and test results from Phase 5, mocks to replace.
2. The code: each file in a labeled block, in full.
3. How to run it: the typecheck and test commands.
4. Next: the mocks this build created, in dependency order, then the next item in the plan's build sequence (Section 9), as `/game-build [name]` lines.

## Rules

1. Never regenerate a `built` or `rebuilding` component without `--rebuild`.
2. Never invent schema, queue names, routes or features outside the plan.
3. Keep `// MOCK` markers until the real implementation replaces the mock.
4. Report typecheck and test output as you read it. Do not report a component as built with errors outstanding.
