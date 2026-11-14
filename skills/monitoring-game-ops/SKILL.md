---
name: monitoring-game-ops
description: >-
  Structured logs, server health signals and alert rules for a live
  multiplayer game server: tick time against the tick budget, room and
  WebSocket connection counts, disconnects, errors per game mode and message
  type, failed jobs and currency flow. Use when a game server needs logging, a
  health dashboard or alerts, when players report lag or drops and you need to
  see why, or when a release needs post-deploy checks; the code targets Bun
  and Elysia.
---

# Monitoring Game Ops

A game server needs two outputs. Log lines answer "what happened to this
player in this room". Metrics answer "is the server healthy right now".
Player behaviour (DAU, session length, D1/D7/D30 retention, funnels) is
analytics, not ops: use `gameplay-analytics` for it.

## Files

- `boilerplate/logger.ts`: copy when the server needs structured logs. It has
  `GameLogger` (JSON lines, child loggers that carry `playerId`, `sessionId`,
  `roomId`), the `requestLogger` Elysia plugin, and `createSessionLogger` for
  WebSocket connections.
- `templates/alert-config.ts`: copy when you define metrics and alerts. It
  names the game signals, the `AlertRule` shape, and three rule builders
  (tick overrun, capacity, baseline). None of them has a default threshold.
- `references/sources.md`: read when you need the source behind a rule here.

## Logging

- One JSON object per line, written to stdout/stderr. Fields: `level`,
  `message`, `timestamp`, `context` (`service`, `component`, `playerId`,
  `sessionId`, `roomId`, `requestId`), `data`, `error`.
- Per-request values (request id, start time) come from `.derive()`, never
  from `store`. Elysia's `store` is one global object for the whole app, so
  concurrent requests overwrite each other's values. `derive` runs once per
  request, and its values are not shared with other requests.
- Register `requestLogger` before the routes it should log. Elysia hooks
  apply only to routes registered after them.
- A request with no matching route, or a body that does not parse, fails
  before `derive` runs. Those lines carry no `requestId`. The plugin logs
  them, and validation failures, as `warn` `request_rejected`, so the error
  rate counts server faults only.
- Create one session logger per WebSocket connection and pass it to the room.
  Every line from that player's messages then carries the player, session and
  room.
- Do not log per entity per tick. Line volume multiplies by the tick rate and
  the room count. Count per-tick work in metrics; log state changes (player
  joined, match ended, tick overrun).

## Health signals

`templates/alert-config.ts` defines these names. Record durations as
histograms, never as averages: a mean hides the slow tail, and the tail is
what players feel as lag.

| Signal | Instrument | Where the threshold comes from |
|--------|-----------|--------------------------------|
| `game.tick.duration` (p99) | histogram, seconds | Tick budget: `1 / tickRate` times a headroom fraction. Tick rate from `game-backend-architecture`. |
| `game.tick.overruns` | counter | Ticks that took longer than the interval. A sustained count means rooms fall behind. |
| `game.rooms.active`, `game.ws.connections` | up-down counter | A load test of one server (see below). |
| `game.ws.closes` by `code` | counter | Baseline per close code. |
| `game.messages.errors` by `mode`, `messageType` | counter | Baseline rate. |
| `game.matchmaking.wait` (p95) | histogram, seconds | Baseline per mode. The queue design is in `matchmaking-system`. |
| `game.jobs.failed` by `queue` | counter | Baseline. Count failed and stalled jobs from the queue events in `bullmq-game-queues`. |
| `game.currency.minted`, `game.currency.spent` | counter | The sink and faucet targets in `game-economy-design`. |

- Error rate per room: put `roomId` in the log context and query the logs.
  Do not make `roomId`, `playerId` or `sessionId` a metric label: each value
  becomes its own time series.
- WebSocket close code 1006 means the connection closed abnormally, without
  a Close frame; Bun's `close` handler reports 1006 when the client process
  dies. 1000 is a normal close; 1001 is a page navigating away or a server
  going down. Alert on a rise in 1006, not on total closes.

## Setting thresholds

1. Tick: compute the interval from the tick rate. Profile a full room and
   pick the headroom fraction from that profile. A tick that uses the whole
   interval falls behind under the first spike, so the alert must fire below
   the interval. `tickOverrunRule` takes both values.
2. Capacity: load-test one server with bots until tick p99 crosses the
   budget. That room and connection count is the measured limit.
   `capacityRule` fires at a fraction of it that you choose.
3. Everything else: measure a baseline over normal play, including a peak
   hour and a quiet hour, then set a factor with `baselineRule`. Tighten or
   loosen it after the first false alert.
4. Route: page only for a problem players feel now that a person can act on.
   Everything else is a ticket. Every rule has a `runbook` line saying what
   the responder does first.

## Pitfalls

- Request id or start time in `store`: wrong ids and durations under load.
- Average tick time: looks fine while a few rooms stutter. Use p99
  and the overrun counter.
- 404s and bad payloads logged as errors: the error rate rises with every
  scanner bot. Keep them at `warn`.
- Alerts on DAU or retention from the ops stack: those move by day, not by
  minute. They belong in `gameplay-analytics`.
- Thresholds copied from another game: tick rate, room size and message rate
  differ. Measure your own.

## Post-deploy check

- [ ] Tick p99 and overruns per mode match the previous release at the first
      peak after deploy.
- [ ] 1006 closes did not rise.
- [ ] No new `messageType` appears in `game.messages.errors`.
- [ ] No rise in failed or stalled jobs.
- [ ] Currency minted against spent stays inside the `game-economy-design`
      targets.

`ci-cd-game` runs the deploy; this list is what to look at afterwards.
