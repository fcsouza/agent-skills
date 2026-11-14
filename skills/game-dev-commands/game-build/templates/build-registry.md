# Build registry template

`/game-build` copies the skeleton into a new `docs/build-registry.md`, then adds one entry per component in the entry format. Do not copy the entry format into the registry as an entry.

## Registry skeleton

```markdown
# Build Registry

Managed by `/game-build`. Edit by hand only to fix a wrong entry.

## Summary

- Total components planned: [from the MVP plan]
- Built: 0 | Rebuilding: 0 | Mocked: 0 | Remaining: 0

## Components

<!-- entries are added by /game-build -->
```

## Entry format

One entry per component. A component's dependents are the entries whose "Depends on" names it, so no entry records them.

```markdown
## [component-name]
- **Status:** built | mock | rebuilding
- **Path:** src/[component-name]/index.ts
- **Built at:** [ISO timestamp]
- **Depends on:** [real dependencies used]
- **Mocks generated:** [mocks this build created, or "none"]
- **Skills applied:** [skills that informed this build]
- **Open TODOs:** [items marked NOT IN PLAN or left incomplete]
```

`rebuilding` means a `--rebuild` is under way. A run that finds it offers to resume with `--rebuild`.
