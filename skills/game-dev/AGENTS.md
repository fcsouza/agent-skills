# How AI Agents Use This Skill Ecosystem

## Navigation

When an AI agent encounters a game development task, it should:

1. **Check `claude-code-game-workflow`** for which skill covers the task
2. **Read the SKILL.md** of the relevant skill
3. **Check prerequisites** and read those first if not already loaded
4. **Copy boilerplate/ files** as starting code
5. **Use templates/** for configuration and document structure

## Skill Selection by Task

| Task | Read First | Then |
|------|-----------|------|
| Start a new game project | `claude-code-game-workflow` | `game-design-fundamentals` → `postgres-game-schema` |
| Set up the server | `game-backend-architecture` | `redis-game-patterns` → `betterauth-integration` |
| Design game mechanics | `game-design-fundamentals` | `game-economy-design` + domain-specific skills |
| Create quests | `quest-narrative-coherence` | `quest-mission-design` → `worldbuilding` |
| Build world lore | `quest-narrative-coherence` | `worldbuilding` → `character-design-narrative` |
| Add multiplayer | `game-backend-architecture` | `game-state-sync` → `redis-game-patterns` |
| Add payments | `stripe-game-payments` | `game-economy-design` |
| Add audio | `elevenlabs-sound-music` | Choose provider: ElevenLabs or Lyria |
| Deploy | `ci-cd-game` | `monitoring-game-ops` |

## Mandatory Rules

1. **Narrative content always requires coherence check** — `quest-narrative-coherence` BEFORE any quest, story, or character creation
2. **Schema before logic** — read `postgres-game-schema` before writing database queries
3. **Server-authoritative** — all game logic runs server-side; client is display only
4. **Genre-agnostic** — never hardcode genre-specific mechanics in shared code

## File Convention

| File | Purpose | When to Read |
|------|---------|-------------|
| `SKILL.md` | Knowledge + principles | Always — read this first |
| `boilerplate/*.ts` | Starter code | When implementing — copy and customize |
| `templates/*.md` | Document templates | When designing — fill in the template |
| `templates/*.ts` | Config templates | When configuring — copy and customize |
| `ARCHITECTURE.md` | Diagrams + decisions | When understanding system design |
