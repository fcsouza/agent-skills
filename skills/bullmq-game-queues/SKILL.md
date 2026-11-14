---
name: bullmq-game-queues
description: >-
  Background job design for game backends on BullMQ and Redis: one queue per game domain, idempotent reward fulfilment, and cron schedulers for daily rewards and season ends. Use when a game needs matchmaking requests, reward grants, match results, notifications or analytics processed off the request path, or recurring and timed jobs such as daily login rewards, leaderboard snapshots and season rollovers.
---

# BullMQ Game Queues

Working BullMQ 6 code for a game backend. The code in `boilerplate/` and `templates/` compiles against `bullmq` 6.7.6. For any API this skill does not cover, read the BullMQ docs at https://docs.bullmq.io.

## Setup

```bash
bun add bullmq ioredis
```

BullMQ 6 connects with ioredis by default but lists it only as an optional peer dependency, so install it yourself (https://docs.bullmq.io/guide/connections). `redis-game-patterns` explains why the bundle uses ioredis.

Then copy the files in the order numbered under Files.

## One queue per domain

| Queue | Holds | Why it is separate |
|---|---|---|
| `matchmaking` | find-match, cancel | Players are waiting on it |
| `game-event` | match results, action resolution | Changes live game state |
| `reward` | grants, daily login, achievements | Must pay exactly once |
| `notification` | push, in-game mail, email | Bound by a provider's send limit |
| `analytics` | tracking, aggregation | Must never slow the others |

Separate queues let you scale, pause and drain one domain without touching the rest.

## Priority rules

- Matchmaking stays ahead of analytics because they are separate queues with their own workers: an analytics backlog never sits in front of a matchmaking job. Job `priority` does not order one queue against another.
- Use `priority` only inside one queue, for example to grant purchase rewards before daily-login rewards. A lower number runs first.
- A job with no `priority` runs before every prioritized job. In a queue that uses priorities, give every job one.
- Size each queue's worker concurrency (`concurrencySettings` in `templates/queue-config.ts`) to its own load. If analytics workers compete for CPU with matchmaking, run them in other processes.

## Idempotent processors

BullMQ retries failed jobs and re-runs stalled ones, so any job can run more than once.

- Every job that changes player state carries an `idempotencyKey`. The worker checks it, applies the change and records the key in one database transaction. Checking and marking in two separate writes pays twice if the worker crashes between them.
- To stop the same job being enqueued twice, give it a custom `jobId` such as `season-end-${seasonId}`. A second add with that id is ignored while the first job exists. Ids must not contain colons or be plain integers.
- Keep each job small: one state change per job. Spawn follow-up jobs (rewards, notifications) instead of doing everything in one processor.
- Pass ids in job data, not whole records. The worker loads current state from the database.

## Reward fulfilment

- Grants go through the `reward` queue, never inline in a request handler.
- `rewardWorker` in `boilerplate/workers.ts` shows the order: build the key, then call `applyRewardOnce(key, (tx) => ...)`, which records the key and credits currency, items and experience in one transaction, or skips everything if the key is already recorded. Log for analytics after it commits.
- A broadcast reward (`BROADCAST_PLAYER_ID`) is a trigger. The worker enqueues one reward job per eligible player, each keyed `<run key>:<playerId>`, and grants nothing itself.
- `stripe-game-payments` records the purchase, then enqueues reward delivery here. Key that job by the checkout session id (one-time purchase) or the invoice id (subscription period), the same keys its purchase rows are unique on, so a replayed webhook cannot grant twice.

## Schedulers for daily rewards and season ends

- Recurring work uses `queue.upsertJobScheduler(id, { pattern, tz: 'UTC' }, template)`. BullMQ 6 removed `repeat.utc` and the legacy `Queue.add(..., { repeat })` API.
- Upsert on every server start. It updates the scheduler in place and does not create duplicates.
- The template's data is fixed at upsert time and every run inherits it. Never put a date or `Date.now()` in it. `rewardWorker` builds the per-run key from the produced job's id, which is new for each run and stays the same across retries.
- A scheduler adds the next job only when the previous one starts. If the reward queue is backed up at midnight, the daily grant runs late; size reward concurrency for that peak.
- Season ends and event starts are one-off delayed jobs (`delay` plus a `jobId`), not schedulers. A delayed job runs at or after its time, not exactly on it. Close the season by its stored end time, not by the time the job ran.

## Connections and failures

- Producers (API handlers) use `maxRetriesPerRequest: 1` so a Redis outage returns an error to the player instead of hanging. Workers use `maxRetriesPerRequest: null`; BullMQ throws if a hand-made ioredis client passed to a worker has any other value. `templates/queue-config.ts` has both.
- Every `Queue`, `Worker` and `QueueEvents` uses the same `prefix`. Without one, `QueueEvents` listens on the default `bull` prefix and hears nothing.
- Do not set ioredis `keyPrefix`; BullMQ has its own `prefix`.
- Jobs that use up their retries move to the failed set, where `removeOnFail` keeps them at least 7 days. Alert on the `failed` event and inspect them there.
- A CPU-heavy processor cannot renew its lock and its job is marked stalled and run again. Move heavy simulation out of the worker's event loop.

## Checklist

- [ ] `bullmq` and `ioredis` both in `package.json`.
- [ ] One queue per domain; concurrency set per queue.
- [ ] Every state-changing job has an idempotency key checked and recorded in the same transaction.
- [ ] Schedulers use `tz: 'UTC'` and carry no per-run values in their template.
- [ ] Producers fail fast; workers use `maxRetriesPerRequest: null`.
- [ ] Same `prefix` on queues, workers and queue events.
- [ ] Alert on failed and stalled jobs (`monitoring-game-ops`).
- [ ] All queues, workers and queue events closed on shutdown.

## Pitfalls

- Per-player rate limits do not belong in BullMQ: the worker `limiter` is global for the whole queue. Limit matchmaking requests per player at the API, with the rate limiter in `redis-game-patterns`.
- Throwing to "retry later" in matchmaking re-runs the same payload with the same criteria after each backoff. If the search should widen over time, compute the range from `queuedAt` in the processor.
- Use `QueueEvents` for dashboards and alerts. `worker.on(...)` sees only its own process.

## Files

1. `templates/job-types.ts`: copy when you start. Queue names, job payload and result types, job names, the `Priority` enum.
2. `templates/queue-config.ts`: copy when you start. Producer and worker connections, the shared key prefix, retries, rate limits, concurrency.
3. `boilerplate/queues.ts`: copy when you add jobs from the game server. One typed `Queue` per domain plus `QueueEvents` for monitoring.
4. `boilerplate/workers.ts`: copy when you write processors. One `Worker` per queue; replace the placeholder functions at the bottom.
5. `boilerplate/scheduler.ts`: copy when you need daily rewards, season ends, timed events or periodic snapshots. It uses the queues from `queues.ts`, so `closeAllQueues()` closes them too.
- `references/sources.md`: read when you need the doc page and sentence behind a rule above.

## Related skills

- `redis-game-patterns`: Redis connection, per-player rate limiting.
- `postgres-game-schema`: the `processed_events` table that `applyRewardOnce` writes its keys to (shared with `stripe-game-payments`), and the currency and inventory tables rewards credit.
- `matchmaking-system`: the matching logic the matchmaking worker calls.
- `stripe-game-payments`: purchases that enqueue reward jobs.
- `game-backend-architecture`: the game server, rooms and tick loop that enqueue jobs.
- `monitoring-game-ops`: queue alerts and dashboards.
