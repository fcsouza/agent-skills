# Asaas webhooks: the delivery contract

Read this before you point Asaas at any endpoint. The rules sit across the introduction, the FAQ, the queue-penalty page, the paused-queue page and the error pages.

## The response contract

- Return a bare HTTP `200`. The FAQ, the paused-queue page and the "other errors" page count only `200` as delivered; `201`, `204` and any `3xx` fail. Two pages still say any 2xx: the queue-penalty page and the API creation guide. `200` satisfies both readings.
- An event that got `200` is delivered and is never sent again. Persist it before you answer.
- 10 seconds to respond. Past that the attempt fails.
- Persist the event, return `200`, then process it asynchronously. This is Asaas's own recommendation.
- Redirects are not followed: `301`, `302`, `307` and `308` all fail. Register the final URL, and check hosts that redirect a bare domain to `www`, http to https, or add a trailing slash.
- Asaas sends `POST` with `Content-Type: application/json`. There is no Bearer or Basic auth. Your `authToken` arrives in the `asaas-access-token` header. Do not use an API key as the `authToken`. This skill's rule: compare it in constant time.

## Failure, penalty and the paused queue

Each failure lengthens the wait before the next attempt:

| Attempt | Wait | Email |
| --- | --- | --- |
| 1 | 0 | |
| 2 | 30 s | |
| 3 | 1 min | |
| 4 | 3 min 30 s | |
| 5 | 5 min | 1st alert |
| 6 | 15 min | |
| 7 | 25 min | |
| 8–12 | 1 h each | 2nd alert at 10 |
| 13–14 | 2 h each | |
| 15 | 3 h | 3rd: queue paused |

- 15 consecutive failures pause that webhook's queue. Other webhooks on the account keep working.
- While paused, events are still created and stored but not sent.
- Events are kept 14 days. Older events are deleted for good.
- Fix the cause, then reactivate in Integrações → Webhooks, or `PUT /v3/webhooks/{id}` with `{"interrupted": false}`. Reactivating into a broken endpoint pauses it again. Stored events are sent after reactivation.
- A queue still in backoff but not paused: `POST /v3/webhooks/{id}/removeBackoff` (204) retries now. It has a tight rate limit; do not automate it.
- The delivery log is in Integrações → Logs de Webhooks: HTTP code, time, payload, error, retry count.

## Delivery semantics

- At least once. The same event can arrive more than once with the same `id`. Dedupe on the event `id`.
- Ordering depends on `sendType`. `SEQUENTIALLY` keeps the order and holds later events behind a penalized one. `NON_SEQUENTIALLY` delivers in parallel with no order guarantee. The Pix Automático flows page says not to rely on delivery order alone to know a resource's state.
- New attributes can appear. Asaas emails the webhook's `email` address and posts on Discord when it adds fields, but an exception on an unknown field can stop the queue. Read the fields you need and ignore the rest.

## Registering one

`POST /v3/webhooks`. Required: `name`, `url`, `email`, `enabled`, `interrupted`, `sendType`, `events[]`. Also send `apiVersion: 3` and an `authToken` of 32 to 255 characters, with no spaces, no simple sequences and not an API key.

- The `authToken` comes back only in the create response. Store it then.
- Up to 10 webhooks per account, each with its own event list. Subscribe only to the events you handle.
- `email` gets the failure and pause alerts. Use an address someone reads.
- A subaccount can get its webhooks in the `webhooks` field of `POST /v3/accounts`.
- Sandbox can send from IPs beyond the production list. If you filter by IP, test both environments.
- This skill's rule: keep the subscribed event list in code and compare it with `GET /v3/webhooks` at deploy time.
