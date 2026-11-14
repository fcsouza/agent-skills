# Branching Narrative Diagram Template

Use this template to document branching story paths. Two formats are provided: Mermaid flowchart (for rendering) and indented list (for quick reference).

---

## Format 1: Mermaid Flowchart

Use this in any Markdown renderer that supports Mermaid (GitHub, GitLab, Obsidian, etc.).

```mermaid
flowchart TD
    START([Game Start]) --> BEAT_001[Wake in unknown location]
    BEAT_001 --> BEAT_002{First encounter: Fight or Hide?}

    %% Branch: Fight
    BEAT_002 -->|Fight| BEAT_002A[Defeat the Captain]
    BEAT_002A --> BEAT_002A_R[Gain weapon + combat reputation]

    %% Branch: Hide
    BEAT_002 -->|Hide| BEAT_002B[Sneak past patrols]
    BEAT_002B --> BEAT_002B_R[Gain intel + stealth reputation]

    %% Merge point
    BEAT_002A_R --> BEAT_003[Mentor reveals core conflict]
    BEAT_002B_R --> BEAT_003

    BEAT_003 --> ACT2{Act 2: Choose your path}

    ACT2 -->|Path A: Direct assault| ACT2_A[Storm the fortress]
    ACT2 -->|Path B: Infiltration| ACT2_B[Infiltrate from within]
    ACT2 -->|Path C: Diplomacy| ACT2_C[Negotiate with factions]

    ACT2_A --> MIDPOINT[Midpoint: Betrayal revealed]
    ACT2_B --> MIDPOINT
    ACT2_C --> MIDPOINT

    MIDPOINT --> ACT3{Act 3: Final choice}
    ACT3 -->|Sacrifice| FINALE[Final scene, text shaped by flags]
    ACT3 -->|Compromise| FINALE
    ACT3 -->|Seize power| FINALE
    FINALE --> ENDING([One ending, shaped by the flags set earlier])

    %% Styling
    style START fill:#4CAF50,color:#fff
    style ENDING fill:#2196F3,color:#fff
```

### Node Types

| Shape | Meaning | Syntax |
|-------|---------|--------|
| `([text])` | Terminal (start/end) | `START([Game Start])` |
| `[text]` | Story beat (linear) | `BEAT_001[Description]` |
| `{text}` | Decision node (player choice) | `BEAT_002{Fight or Hide?}` |
| `-->` | Transition | `A --> B` |
| `-->\|label\|` | Labeled transition (choice text) | `A -->\|Fight\| B` |

---

## Format 2: Indented List

For quick documentation without rendering tools.

```
START: Game Start
├── BEAT-001: Wake in unknown location
│   └── BEAT-002: [CHOICE] First encounter — Fight or Hide?
│       ├── (Fight) BEAT-002A: Defeat the Captain
│       │   └── RESULT: Gain weapon + combat reputation
│       │       └── → MERGE → BEAT-003
│       └── (Hide) BEAT-002B: Sneak past patrols
│           └── RESULT: Gain intel + stealth reputation
│               └── → MERGE → BEAT-003
├── BEAT-003: Mentor reveals core conflict
│   └── ACT2: [CHOICE] Choose your path
│       ├── (Path A) Storm the fortress
│       ├── (Path B) Infiltrate from within
│       └── (Path C) Negotiate with factions
│           └── → ALL MERGE → MIDPOINT
├── MIDPOINT: Betrayal revealed
│   └── ACT3: [CHOICE] Final choice
│       ├── (Sacrifice) → FINALE
│       ├── (Compromise) → FINALE
│       └── (Seize power) → FINALE
│           └── ENDING: one ending, shaped by the flags set earlier
```

### Legend

- `[CHOICE]` — Player decision point
- `→ MERGE →` — Branches converge to a single node
- `RESULT:` — Consequence of a choice
- `(Label)` — Choice option text

---

## Guidelines

1. **Decision nodes**: keep the option count low. Every option needs its own written result.
2. **Merge points** cheapen earlier choices. Carry their effects past the merge in the world, dialogue and options.
3. **Track variables**: Note which flags/variables each branch sets (e.g., `combat_reputation += 1`).
4. **Test every path that remains after the cuts**: each branch combination you kept must be playable start-to-finish. The full tree is too large to test.
5. **Shape the ending with flags**: document which flags change the final scene. If you add separate endings, each must be a full, different story, and you name and document how each is reached.
6. **Avoid dead ends**: Every node must lead somewhere. If a branch fails, redirect rather than terminate.
