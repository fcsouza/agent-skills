# .cursorrules Template for Game Projects

Save as `.cursorrules` in your project root:

```
# Game Development Rules

## Stack
- TypeScript strict mode, Bun runtime
- Elysia for backend API + WebSocket
- Drizzle ORM with PostgreSQL (Neon)
- Redis for caching, pub/sub, leaderboards
- BullMQ for job queues
- BetterAuth for authentication
- Stripe for payments

## Code Style
- Single quotes, semicolons, trailing commas
- ES modules (import/export), never CommonJS
- Prefer const over let, never var
- Functional style, no classes unless necessary

## Game Architecture
- Server-authoritative: never trust client input
- All game logic runs server-side
- Client sends intentions, server validates and executes
- Use JSONB columns for extensible game data
- All timestamps server-generated

## Genre-Agnostic
- Never hardcode genre-specific mechanics
- Use abstract terms: "entity", "action", "resource", "event"
- Configuration-driven behavior over hardcoded logic
- Extension points for game-specific customization

## Narrative Coherence
- Before creating any quest or story content:
  1. Load world-lore.md
  2. Check quest-registry.md
  3. Validate against existing content
  4. Reference existing lore
  5. Register new content

## File Structure
- Database schemas in schema/ directory
- API routes in routes/ directory
- Game systems in systems/ directory
- Shared types in types/ directory

## Testing
- Test game logic independently of framework
- Mock Redis and PostgreSQL in unit tests
- Integration tests for API endpoints
- Load tests for WebSocket connections
```
