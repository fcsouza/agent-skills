# Event Catalog

Document all tracked gameplay events here. Share this with your entire team (engineering, design, product, QA) so everyone agrees on event names, triggers, and required properties.

## Naming Convention

All events use `noun_verb` format in `snake_case`. Examples: `level_completed`, `item_purchased`, `match_ended`.

**Rules:**
- Noun first, verb second: `session_started`, not `started_session`
- Past tense for completed actions: `level_completed`, not `level_complete`
- Present tense for state changes: `item_equipped`, `quest_accepted`
- No camelCase, no dots, no slashes

## Required Properties (Every Event)

These fields are attached automatically by the `AnalyticsClient` and must be present on every event:

| Field | Type | Description |
|---|---|---|
| `userId` | `string` | Opaque player identifier (UUID) |
| `sessionId` | `string` | Current session identifier (UUID) |
| `timestamp` | `ISO 8601` | When the event occurred |
| `version` | `string` | Game build version (e.g., `1.2.3`) |
| `platform` | `string` | Platform identifier (e.g., `web`, `ios`, `android`, `steam`) |

## Event Definitions

### Session Events

| Event Name | Trigger | Required Properties | Optional Properties | Notes |
|---|---|---|---|---|
| `session_started` | Player connects / opens game | — | `referrer`, `deepLink` | Auto-tracked by `AnalyticsClient.trackSession('start')` |
| `session_ended` | Player disconnects / closes game | `sessionId` | `reason` (`logout`, `timeout`, `crash`) | Auto-tracked by `AnalyticsClient.trackSession('end')` |

### Level / Stage Events

| Event Name | Trigger | Required Properties | Optional Properties | Notes |
|---|---|---|---|---|
| `level_started` | Player begins a level/stage | `levelId` | `difficulty`, `retryCount` | |
| `level_completed` | Player finishes a level/stage | `levelId`, `score` | `timeSeconds`, `stars`, `deaths`, `itemsCollected` | |
| `level_failed` | Player fails a level/stage | `levelId` | `failReason`, `timeSeconds`, `progress` | Track `failReason` to identify difficulty spikes |

### Economy Events

| Event Name | Trigger | Required Properties | Optional Properties | Notes |
|---|---|---|---|---|
| `item_purchased` | Player buys an item | `itemId`, `currency`, `amount` | `source` (`shop`, `bundle`, `reward`) | `amount` is the cost, not quantity |
| `item_equipped` | Player equips an item | `itemId`, `slot` | `previousItemId` | |
| `currency_earned` | Player receives currency | `currency`, `amount`, `source` | `questId`, `levelId` | `source`: `quest`, `drop`, `daily`, `iap` |
| `currency_spent` | Player spends currency | `currency`, `amount`, `sink` | `itemId` | `sink`: `shop`, `upgrade`, `reroll` |

### Progression Events

| Event Name | Trigger | Required Properties | Optional Properties | Notes |
|---|---|---|---|---|
| `achievement_unlocked` | Player earns an achievement | `achievementId` | `progress` | |
| `tutorial_step_completed` | Player completes a tutorial step | `step` | `experimentId`, `variant` | Great A/B test candidate |
| `quest_accepted` | Player picks up a quest | `questId` | `source` | |
| `quest_completed` | Player finishes a quest | `questId` | `timeSeconds`, `rewards` | |

### Match / Multiplayer Events

| Event Name | Trigger | Required Properties | Optional Properties | Notes |
|---|---|---|---|---|
| `match_started` | Multiplayer match begins | `matchId`, `mode` | `playerCount`, `teamSize`, `mapId` | |
| `match_ended` | Multiplayer match ends | `matchId`, `result` | `score`, `duration`, `kills`, `assists` | `result`: `win`, `loss`, `draw`, `abandon` |

## Adding Custom Events

1. **Choose a name** following the `noun_verb` convention
2. **Define required properties** — the minimum data needed to make the event useful
3. **Define optional properties** — extra context that enriches analysis but isn't always available
4. **Add a row** to the appropriate category table above (or create a new category)
5. **Notify the team** — update this document and announce in your team channel

### Custom Event Template

| Event Name | Trigger | Required Properties | Optional Properties | Notes |
|---|---|---|---|---|
| `{noun}_{verb}` | When does this fire? | What data is always present? | What data is sometimes present? | Any caveats? |

## Validation Checklist

Before shipping a new event:

- [ ] Name follows `noun_verb` snake_case format
- [ ] All required properties are documented
- [ ] No PII (emails, IPs, real names) in properties
- [ ] Event is tracked in the correct place (server-authoritative events on the server, client UX events on the client)
- [ ] Event appears in local dev telemetry before deploying
- [ ] Team has been notified of the new event
