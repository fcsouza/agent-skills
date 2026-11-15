# Asaas webhooks: the operational contract

Read this before pointing Asaas at any endpoint. Most of it is not in the introduction page; it is
scattered across the FAQ, the queue-penalty page and the paused-queue page, and every item here has
cost someone a production incident.

## The response contract

- **Only HTTP `200` counts as success.** The introduction says "2xx"; the FAQ and the paused-queue
  page both correct it: `201`, `204`, `308`, anything else, is a failure. Return a bare `200`.
- **10 seconds to respond.** Past that the attempt is a failure.
- **Answer first, process after.** Persist the event, return `200`, handle it asynchronously. This
  is Asaas's own recommendation and the only way to stay inside 10 seconds under load.
- **Redirects are not followed.** `301`, `302`, `307`, `308` all count as failures. The URL you
  register must answer the POST directly — worth checking against any host that redirects bare
  domains to `www`, or http to https.
- `Content-Type: application/json`. No Bearer token: authentication is the `authToken` you set on
  the webhook, echoed back in the `asaas-access-token` header. Compare it in constant time.

## Failure, penalty and the paused queue

- A failed delivery is retried with growing gaps (30 seconds, then longer).
- **15 consecutive failures pause that webhook's queue.** Only that one; other webhooks on the
  account keep working.
- While paused, events keep being generated and stop being delivered. Nothing syncs.
- **Events are kept 14 days.** Anything older when you reactivate is gone for good.
- Reactivate in Integrações → Webhooks, or `PUT` the webhook with `interrupted: false`. Fix the
  cause first: reactivating into a broken endpoint just pauses it again.
- The delivery log lives in Integrações → Logs de Webhooks: HTTP code, timestamp, payload, error.

## Delivery semantics

- **At least once.** The same event arrives more than once. Dedupe on the event `id`.
- Ordering depends on `sendType`: `SEQUENTIALLY` preserves the order events happened,
  `NON_SEQUENTIALLY` runs them in parallel with no ordering guarantee. Even sequential mode is not a
  reason to depend on order — the flow docs say plainly not to.
- **New attributes appear without warning.** An exception on an unknown field can interrupt the
  sync queue, so parse defensively: read the fields you need, ignore the rest.

## Registering one

`POST /v3/webhooks`, all fields required: `name`, `url`, `email`, `enabled`, `interrupted`,
`apiVersion` (3), `authToken` (32–255 chars), `sendType`, `events[]`. Up to 10 webhooks per account,
each with its own event list. Subscribe only to what you handle — extra events are load on your
server for nothing.

`email` is where Asaas warns you the queue paused. Use an address someone reads.
