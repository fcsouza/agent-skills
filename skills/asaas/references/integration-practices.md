# Integration practices

Everything in this file is this skill's rule: practice from integrations that run Asaas in production, not vendor documentation. Where a rule rests on a vendor fact, the fact is named and sourced in `references/sources.md`.

## Webhook handler

- Check the `asaas-access-token` header first, before you store anything. On a mismatch answer `401` and store nothing. Alert on repeated `401`s: if your configured token is wrong, real events fail too, and 15 failures pause the queue.
- Then store the event row before you answer `200`. Asaas treats `200` as delivered and stops retrying, so a crash after the answer can lose the event.
- Process from your own table and run your own retry sweep. A workable shape: retry `pending` or `failed` rows after 2 minutes, reclaim rows stuck in `processing` after 10 minutes, stop after 5 attempts and alert. Claim rows with `FOR UPDATE SKIP LOCKED` and compare times against the database clock, not the worker's. A reclaimed row can run twice, so every side effect it triggers must be idempotent (see "Creating charges").
- Dedupe on the event `id` (Asaas resends the same event with the same `id`).
- When required config is missing (no key, no webhook token), answer `503`, not `200`. A `503` keeps the event queued for retry; a `200` drops it. The retry schedule covers about 13 hours before the 15th failure pauses the queue, and a paused queue keeps events for 14 days, so you have time to fix the config and reactivate. Alert on it.
- Never answer `4xx` to an authenticated body you do not recognise. Store it, answer `200`, and look at it later. Turn off framework body validation that would answer `422` on its own.
- A 404 from an Asaas lookup inside the handler is not a server error; do not let it become a `500` that fills the retry queue. A 404 also means "not in this account", so tell the cases apart: if your records show the id was created with the same key, treat it as deleted; otherwise mark the event for review and alert, because the key or the account is wrong.
- Register the exact path your router serves. A trailing-slash redirect is a failed delivery.
- Your own API calls come back as webhooks (`SUBSCRIPTION_DELETED` after your own `DELETE`, `PAYMENT_UPDATED` after your own `PUT`). Do not count them as customer churn or customer edits.

## Granting access

- Model each purchase as a state machine keyed by payment id: created, paid, suspended, refunded, revoked. Check the payment's current `status` before you grant on a late "paid" event; a refund that landed first must block a later grant.
- An overdue charge can still be paid. Do not close the order on `PAYMENT_OVERDUE`.
- A card payment fires `PAYMENT_CONFIRMED` and later `PAYMENT_RECEIVED`. Grant once per payment id.
- Chargebacks are not final when they open. The docs' chargeback flow: `PAYMENT_CHARGEBACK_REQUESTED`, then either `PAYMENT_REFUNDED` (no dispute, or the payer wins) or `PAYMENT_CHARGEBACK_DISPUTE` → `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` → `PAYMENT_CONFIRMED` or `PAYMENT_RECEIVED` on the same payment id when the merchant wins. So suspend on `PAYMENT_CHARGEBACK_REQUESTED` and `PAYMENT_CHARGEBACK_DISPUTE`, restore when the reversal ends in `CONFIRMED` or `RECEIVED`, and revoke on `PAYMENT_REFUNDED`. The grant-once rule must allow suspended → paid.
- Revoke on `PAYMENT_REFUNDED` and `PAYMENT_RECEIVED_IN_CASH_UNDONE`.
- A partial refund is not a full one. On `PAYMENT_PARTIALLY_REFUNDED`, read the payment's `refunds` array, sum the items whose `status` is `DONE`, and compare with `value`. Revoke in full only when the refunds cover the value less the Asaas fee you expect to keep (a full Pix refund can arrive as partial; see `SKILL.md`). Otherwise record the partial amount and keep access, or reduce it, as your product decides.
- Key money records by payment id, not subscription id. The fee for a charge is `value - netValue`.

## Creating charges

Two workers, a reclaimed lease or a retry after a timeout can each create the same charge twice. For Pix Automático in `MANUAL` mode a second charge is a second debit.

- Before the call, commit an intent row with a unique key for the charge, for example subscription id plus cycle date. A second worker hits the unique constraint and stops.
- Send that key as `externalReference` on the charge.
- Before any retry, query `GET /v3/payments?externalReference=<key>`. If a charge exists, store its id and do not create another.
- Never hold a database lock or an open transaction across an Asaas call. Calls can take many seconds. Save each Asaas id (customer, charge, authorization) the moment it exists, then continue.

## Calling the API

- On cleanup calls (`DELETE` of a subscription, charge or authorization), treat 404 as "already done" only when the id was created with the same key. Otherwise alert: the id may belong to another account.
- Page through lists with `offset` and `limit` (1 to 100) until `hasMore` is false.
- When several products share one Asaas account, prefix `externalReference` with the product and give each product its own key and webhook.

## Dates

- Work in `America/Sao_Paulo`. Due dates are calendar dates in Brazil; a UTC conversion can move a charge to the wrong day.
- `clientPaymentDate` is when the payer paid (the schema documents it for boleto); `paymentDate` is when Asaas settled the charge. For "when did the customer pay", read `clientPaymentDate`, then `paymentDate`, then the event's `dateCreated`. For cash flow, use `paymentDate` and `creditDate`.

## Recurring jobs

- Offboarding a customer: cancel any Pix Automático authorization, then delete the subscription or the `PENDING` and `OVERDUE` charges. Treat 404 as done under the same-key condition above.
- A renewal job that creates charges should alert when it creates none while subscriptions sit inside the creation window. Schedule it mid-window, not at the edge, so one failed run still leaves days to recover.
- No event fires when a paid period ends after a cancellation. Run a daily sweep that ends access at period end.

## Tests

- Test without the network. Pick a fake client when the key has a test-only prefix, and refuse that fake in production.
- Point an end-to-end test at a fake server through a base-URL setting.
- Build date fixtures relative to today, so a due date never slides into the past.

## Privacy

- Keep CPF and CNPJ out of logs, error trackers and session replay. Mask them in the UI where you can.
- Never log the API key or the webhook token.
