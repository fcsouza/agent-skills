# Integration practices

Everything in this file is this skill's rule: practice from integrations that run Asaas in production, not vendor documentation. Where a rule rests on a vendor fact, the fact is named and sourced in `references/sources.md`.

## Webhook handler

- Store the event row before you answer `200`. Asaas treats `200` as delivered and stops retrying, so a crash after the answer can lose the event.
- Process from your own table and run your own retry sweep. A workable shape: retry `pending` or `failed` rows after 2 minutes, reclaim rows stuck in `processing` after 10 minutes, stop after 5 attempts and alert. Claim rows with `FOR UPDATE SKIP LOCKED` and compare times against the database clock, not the worker's.
- Dedupe on the event `id` (Asaas resends the same event with the same `id`).
- When required config is missing (no key, no webhook token), answer `503`, not `200`. A `503` keeps the event queued for retry; a `200` drops it. The retry schedule covers about 13 hours before the 15th failure pauses the queue, and a paused queue keeps events for 14 days, so you have time to fix the config and reactivate. Alert on it.
- Never answer `4xx` to a body you do not recognise. Store it, answer `200`, and look at it later. Turn off framework body validation that would answer `422` on its own.
- A 404 from an Asaas lookup inside the handler (the subscription or charge was deleted) is a business state, not a server error. Do not let it become a `500` that fills the retry queue.
- Register the exact path your router serves. A trailing-slash redirect is a failed delivery.
- Your own API calls come back as webhooks (`SUBSCRIPTION_DELETED` after your own `DELETE`, `PAYMENT_UPDATED` after your own `PUT`). Do not count them as customer churn or customer edits.

## Granting access

- Model each purchase as a state machine (created, paid, refunded, revoked). Check the payment's current `status` before you grant on a late "paid" event; a refund that landed first must block a later grant.
- An overdue charge can still be paid. Do not close the order on `PAYMENT_OVERDUE`.
- A card payment fires `PAYMENT_CONFIRMED` and later `PAYMENT_RECEIVED`. Grant once: dedupe the grant by payment id.
- Revoke on `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED` and the `PAYMENT_CHARGEBACK_*` events.
- Key money records by payment id, not subscription id. The fee for a charge is `value - netValue`.

## Calling the API

- Never hold a database lock or an open transaction across an Asaas call. Calls can take many seconds. Save each Asaas id (customer, charge, authorization) the moment it exists, then continue.
- Treat 404 on cleanup calls (`DELETE` of a subscription, charge or authorization) as "already done".
- Page through lists with `offset` and `limit` (1 to 100) until `hasMore` is false.
- When several products share one Asaas account, prefix `externalReference` with the product and give each product its own key and webhook.

## Dates

- Work in `America/Sao_Paulo`. Due dates are calendar dates in Brazil; a UTC conversion can move a charge to the wrong day.
- For "when was it paid", read `paymentDate`, then `clientPaymentDate` (boleto), then the event's `dateCreated`.

## Recurring jobs

- Offboarding a customer: cancel any Pix Automático authorization, then delete the subscription or the `PENDING` and `OVERDUE` charges. Treat 404 as done.
- A renewal job that creates charges should alert when it creates none while subscriptions sit inside the creation window. Schedule it mid-window, not at the edge, so one failed run still leaves days to recover.
- No event fires when a paid period ends after a cancellation. Run a daily sweep that ends access at period end.

## Tests

- Test without the network. Pick a fake client when the key has a test-only prefix, and refuse that fake in production.
- Point an end-to-end test at a fake server through a base-URL setting.
- Build date fixtures relative to today, so a due date never slides into the past.

## Privacy

- Keep CPF and CNPJ out of logs, error trackers and session replay. Mask them in the UI where you can.
- Never log the API key or the webhook token.
