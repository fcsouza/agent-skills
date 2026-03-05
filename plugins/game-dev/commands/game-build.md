---
description: Builds a game component from the MVP plan — production TypeScript + Vitest tests + mock dependencies + build registry tracking. Run /game-architect first to generate the plan.
argument-hint: component name (e.g. auth, matchmaking, shop) or "status" to check progress
---

# Game Build — Component Builder Command

## Phase 0 — Context Load (silent, mandatory before writing a single line of code)

Execute in this exact order:
1. READ `${CLAUDE_PLUGIN_ROOT}/README.md`
2. READ `${CLAUDE_PLUGIN_ROOT}/AGENTS.md`
3. Check if `docs/mvp-first-draft.md` exists in the project
   - If it does NOT exist: output `⛔ Cannot proceed. Run /game-dev:game-architect first to generate the MVP plan. /game-build requires an existing plan to avoid architectural drift.` and stop.
4. READ `docs/mvp-first-draft.md` (the MVP plan from /game-architect)
5. IDENTIFY which skills are relevant to `$ARGUMENTS` — load only those SKILL.md files from `${CLAUDE_PLUGIN_ROOT}/engineering/`, `${CLAUDE_PLUGIN_ROOT}/design/`, `${CLAUDE_PLUGIN_ROOT}/narrative/`, `${CLAUDE_PLUGIN_ROOT}/infrastructure/`
6. READ `docs/build-registry.md` if it exists (create it if not, using the template below)
7. READ `docs/world-lore.md` if component touches narrative/quests
8. READ `docs/quest-registry.md` if component touches quests

**Special case: `$ARGUMENTS` == "status"**
Read `docs/build-registry.md` and output a progress table showing built/mocked/remaining components. Do not build anything. Stop after outputting the status.

**Build registry initial template** (create at `docs/build-registry.md` if missing):
```markdown
# Build Registry
> Managed by /game-build — do not edit manually

## Summary
- Total components planned: [from MVP plan]
- Built: 0 | Mocked: 0 | Remaining: 0

## Components

<!-- entries added automatically by /game-build -->
```

## Phase 1 — Dependency Check

Before writing any code, resolve the component's dependency graph from the MVP plan:

For each dependency of the component:
- CHECK `docs/build-registry.md` for status
- If already **built**: import from its registered path — do not regenerate
- If **NOT built**: generate a typed mock/stub:
  - Same TypeScript interface as the real implementation will have
  - Returns realistic fake data matching the expected types
  - Clearly marked with: `// MOCK — replace with real implementation via /game-dev:game-build [dependency-name]`
  - Register in `docs/build-registry.md` as `status: "mock"`

List all mocks generated at the top of your output so the user knows what to build next.

**Special case: component already in build-registry as "built"**
Warn the user: `⚠️ [component] is already marked as built in docs/build-registry.md. Do you want to refactor it instead?` Stop and wait for confirmation before regenerating.

## Phase 2 — Pre-Build Clarification (only if truly ambiguous)

Ask **at most 2 questions** if critical decisions cannot be inferred from the MVP plan.
If the MVP plan has the answer, use it — do not ask.

Valid questions:
- "The MVP plan lists both REST and WebSocket for this component — which should this implementation use?"
- "[feature] was listed as out-of-scope in MVP Section 10 — confirm you want it now?"

Never ask about naming conventions, code style, or anything the skill files already define.

## Phase 3 — Build the Component

### Code Standards
- **TypeScript strict mode** — no `any`, no implicit types
- **Production-ready** — error handling, edge cases, input validation included
- **Minimal** — only what the MVP plan specifies for this component, nothing beyond
- **No premature abstraction** — optimize for clarity at MVP stage
- **Cite the skill** in inline comments for every major decision:
  ```typescript
  // [→ engineering-bullmq-game-queues: retry with exponential backoff]
  const retryConfig = { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  ```

### File Output Structure
```
src/
  [component-name]/
    index.ts           ← main entry point / public API
    [component].ts     ← core logic
    [component].test.ts ← Vitest tests (required, no exceptions)
    types.ts           ← all TypeScript types/interfaces for this component
  __mocks__/
    [dependency].mock.ts  ← any mocks generated in Phase 1
```

### Testing Standards (Vitest)
Every component ships with tests. No exceptions.
Required coverage:
1. **Happy path** — core functionality works as expected
2. **Edge cases** — boundary conditions from the skill files
3. **Failure path** — what happens when dependencies throw or return bad data
4. **Mock validation** — confirm mocks match the interface they stand in for

No snapshot tests for game logic — assert on behavior, not structure.

### Technology Integration

| If component involves... | Apply skill + patterns |
|---|---|
| DB reads/writes | `engineering-postgres-game-schema` — Drizzle typed queries, no raw SQL strings |
| Cache / realtime | `engineering-redis-game-patterns` — correct data structure, key naming `{entity}:{id}:{field}` |
| Background jobs | `engineering-bullmq-game-queues` — typed job payload, processor, retry config with `attempts`+`backoff` |
| Auth / sessions | `engineering-betterauth-integration` — `auth.api.getSession()`, never trust client-sent user IDs |
| Payments | `engineering-stripe-game-payments` — verify `Stripe-Signature` before processing, never fulfill on checkout redirect |
| Audio / SFX | `engineering-elevenlabs-sound-music` — audio state machine, API call with fallback |
| Quest / mission logic | `design-quest-mission-design` + `narrative-quest-narrative-coherence` — coherence check FIRST |
| Client-server sync | `engineering-game-state-sync` — server-authoritative, delta encoding, rollback buffer |
| Matchmaking | `engineering-matchmaking-system` — expanding bracket, BullMQ queue, atomic dequeue |
| Analytics | `engineering-gameplay-analytics` — event emit pattern, sessionId not userId for funnels |

## Phase 4 — Narrative Coherence Check (only if component touches story/quests)

Skip this phase entirely if the component has no narrative content.

If the component creates or modifies quests, characters, or lore:
1. READ `docs/world-lore.md`
2. READ `docs/quest-registry.md`
3. Verify:
   - No faction/character/location contradictions with existing lore
   - At least one existing world element referenced
   - New content will be registered in `docs/quest-registry.md`
4. If conflict detected: output `⚠️ LORE CONFLICT: [description]` and propose resolution before writing the final implementation

## Phase 5 — Update Build Registry

After every successful build, add/update the component entry in `docs/build-registry.md`:

```markdown
## [component-name]
- **Status:** built
- **Path:** src/[component-name]/index.ts
- **Built at:** [ISO timestamp]
- **Depends on:** [list of real dependencies used]
- **Depended on by:** [leave empty — populated as other components reference this one]
- **Mocks generated:** [list any mocks this build created, or "none"]
- **Skills applied:** [list of skills that informed this build]
- **Open TODOs:** [anything flagged ⚠️ NOT IN PLAN or left incomplete]
```

Also update the Summary section counts.

## Phase 6 — Output to User

Present in this order:

### 1. Build Summary
```
✅ Built: [component-name]
📁 Files created: [list with paths]
🧪 Tests: [X test cases written]
🔗 Dependencies: [real: X | mocked: Y]
⚠️  Mocks to replace (build these next): [list in dependency order]
```

### 2. The Code
Output each file in a clearly labeled fenced code block with the filename as the label. Full file — no truncation, no "// rest of file here" shortcuts.

### 3. How to Run It
```bash
# Commands to run and test this component right now
bun run dev
bun vitest run src/[component-name]/
```

### 4. What to Build Next
Based on the MVP plan build sequence (Section 9) and the mocks generated:
```
Recommended next:
  /game-dev:game-build [mock-dependency]   ← replaces mock created today
  /game-dev:game-build [next-in-sequence]  ← next item from MVP plan Section 9
```

---

## Hard Constraints

1. **Never regenerate** a component marked `built` in `docs/build-registry.md` — warn the user and stop
2. **Never invent** schema, queue names, routes, or features not in the MVP plan — flag with `⚠️ NOT IN PLAN:` and ask
3. **Never skip tests** — a component without tests is considered incomplete
4. **Never remove mock markers** — `// MOCK —` comments must stay until replaced with real implementations
5. **Always cite the skill** that informed each major decision in inline comments
6. **Server-authoritative** for any multiplayer component — client sends intentions, server validates and broadcasts
