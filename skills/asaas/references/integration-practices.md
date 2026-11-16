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
- Chargebacks are not final when they open. The docs' chargeback flow: `PAYMENT_CHARGEBACK_REQUESTED`, then either `PAYMENT_REFUNDED` (no dispute, or the payer wins) or `PAYMENT_CHARGEBACK_DISPUTE` → `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` → `PAYMENT_CONFIRMED` or `PAYMENT_RECEIVED` on the same payment id when the merchant wins. So suspend on `PAYMENT_CHARGEBACK_REQUESTED` and `PAYMENT_CHARGEBACK_DISPUTE`, and revoke on `PAYMENT_REFUNDED`. Restore only after `GET /v3/payments/{id}` returns `status` `CONFIRMED` or `RECEIVED`, never on a `PAYMENT_CONFIRMED` or `PAYMENT_RECEIVED` event alone: delivery is not ordered, resends keep their `id`, and a card's `PAYMENT_RECEIVED` can land mid-dispute. The status enum has `CHARGEBACK_REQUESTED`, `CHARGEBACK_DISPUTE` and `AWAITING_CHARGEBACK_REVERSAL` for the open states. The grant-once rule must allow suspended → paid.
- Revoke on `PAYMENT_REFUNDED` and `PAYMENT_RECEIVED_IN_CASH_UNDONE`.
- A partial refund is not a full one. On `PAYMENT_PARTIALLY_REFUNDED`, read the payment's `refunds` array and sum the items whose `status` is `DONE` or `PENDING` (skip `CANCELLED`). Revoke in full when that sum reaches `netValue`. Compare with `netValue`, not `value`, because a full Pix refund can return only the net amount and arrive as partial (see `SKILL.md`). Below that, record the partial amount and keep or reduce access, as your product decides.
- No webhook is documented for a refund item moving from `PENDING` to `DONE` or `CANCELLED`. Re-check such payments in a sweep until no item is `PENDING`, and restore access if a `CANCELLED` item drops the sum below `netValue`.
- Key money records by payment id, not subscription id. The fee for a charge is `value - netValue`.

## Creating charges

Two workers, a reclaimed lease or a retry after a timeout can each create the same charge twice. For Pix Automático in `MANUAL` mode a second charge is a second debit.

- Before the call, commit an intent row with a unique key for the charge, for example subscription id plus cycle date, a state (`pending`, `created`) and a lease expiry. Set the lease longer than the HTTP client timeout plus a margin, so the sweeper never retries a create that is still in flight. A second worker hits the unique constraint and stops.
- Send that key as `externalReference` on the charge. Mark the row `created` with the charge id as soon as the response arrives.
- A sweeper picks up `pending` rows whose lease has expired, since a worker can die after the commit and leave the cycle uncharged. It, and any retry, first queries `GET /v3/payments?externalReference=<key>` and keeps only results whose `externalReference` equals the key exactly (the docs call the field a free search field). If one matches, store its id; create a charge only if none does.
- Never hold a database lock or an open transaction across an Asaas call. Calls can take many seconds. Save each Asaas id (customer, charge, authorization) the moment it exists, then continue.

## Manual changes to a charge

When staff edit, cancel or mark paid by hand a charge that also exists at Asaas, the Asaas charge stays payable. The payer can pay the old amount, or pay twice: once at the desk and once by Pix.

- Read the charge first (`GET /v3/payments/{id}`). Delete it only when its `status` is `PENDING` or `OVERDUE`, as in offboarding below. The delete page names no states a delete refuses, so do not count on a failed delete to catch a paid charge. Any other status means the payer may have paid: block the manual change and process the payment.
- Delete the Asaas charge (`DELETE /v3/payments/{id}`), then change your own record. A deleted charge is no longer open for payment, fires `PAYMENT_DELETED` and can be restored. Deleting one charge of a subscription does not end the subscription.
- If the delete fails, block the manual change and show the error. A 404 counts as done only under the same-key rule in "Calling the API".
- For a new amount, create a new charge under a new intent key (see "Creating charges"). Deleting removed the charge's split, so send `split` again on the new charge (see `references/subaccounts-and-split.md`).
- Your own delete comes back as `PAYMENT_DELETED`. Do not read it as the payer cancelling.
- A restore (`POST /v3/payments/{id}/restore`) makes the deleted charge payable again after staff recorded it by hand. On `PAYMENT_RESTORED` for a charge changed by hand, alert, or delete it again.
- Asaas also offers `POST /v3/payments/{id}/receiveInCash` for a payment made outside Asaas. It fires `PAYMENT_RECEIVED` and credits no balance, and the charge's `billingType` becomes `RECEIVED_IN_CASH`. If you use it, do not count that event as money in.

## Calling the API

- On cleanup calls (`DELETE` of a subscription, charge or authorization), treat 404 as "already done" only when the id was created with the same key. Otherwise alert: the id may belong to another account.
- Page through lists with `offset` and `limit` (1 to 100) until `hasMore` is false.
- When several products share one Asaas account, prefix `externalReference` with the product and give each product its own key and webhook.
- On a 400, show the user the `description` of each item in `errors`. It comes in Portuguese and names the field or rule (see `references/endpoints.md`), so a form can say what to fix. Branch on `code`, never on the text. For any other status, show a generic "try again" message and log the body.

## Dates

- Work in `America/Sao_Paulo`. Due dates are calendar dates in Brazil; a UTC conversion can move a charge to the wrong day.
- Datetimes such as `pixQrCode.expirationDate` arrive as `YYYY-MM-DD HH:MM:SS` with no offset, in Brasília time (see `SKILL.md`). Parse them with an explicit offset, `new Date(value.replace(' ', 'T') + '-03:00')`. Never let the runtime read them as local time or UTC.
- To turn a date-only value (`dueDate`, `paymentDate`) into an instant, anchor it at noon Brasília: `` new Date(`${day}T12:00:00-03:00`) ``. Midnight shows as the day before in any zone west of Brasília; noon keeps the day from UTC-12 to UTC+8.
- `clientPaymentDate` is when the payer paid (the schema documents it for boleto); `paymentDate` is when Asaas settled the charge. For "when did the customer pay", read `clientPaymentDate`, then `paymentDate`, then the event's `dateCreated`. For cash flow, use `paymentDate` and `creditDate`.

## Recurring jobs

- Offboarding a customer: cancel any Pix Automático authorization, then delete the subscription or the `PENDING` and `OVERDUE` charges. Treat 404 as done under the same-key condition above.
- A renewal job that creates charges should alert when it creates none while subscriptions sit inside the creation window. Schedule it mid-window, not at the edge, so one failed run still leaves days to recover.
- No event fires when a paid period ends after a cancellation. Run a daily sweep that ends access at period end.
- Per-seat or usage pricing: when the count changes, enqueue one delayed job per customer under a fixed job id, so a burst of edits syncs once. Make sure a finished job releases its id, or it swallows the next change. The job computes the price from your own data and sends `PUT /v3/subscriptions/{id}` with the new `value`; the reference gives `PUT`, not `POST`. Add a daily job that syncs every active subscription, to catch a lost job.
- Send `updatePendingPayments: true` only before the customer has paid anything, for example during a trial: the first charge then follows the real seat count. After the first payment, leave the flag out, so a charge already issued keeps its value and the new price starts with the next one. Subscription charges exist up to 40 days before their due date, so the payer may already hold the pending one. After such an update, fetch the charge's QR code and invoice link again and send them to the payer, so they cannot pay the old amount. A Pix Automático authorization with a fixed `value` cannot follow a price change; see `references/pix-automatico.md`.

## Tests

- Test without the network. Pick a fake client when the key has a test-only prefix, and refuse that fake in production.
- Point an end-to-end test at a fake server through a base-URL setting.
- Build date fixtures relative to today, so a due date never slides into the past.

## Privacy

- Keep CPF and CNPJ out of logs, error trackers and session replay. Mask them in the UI where you can.
- Never log the API key or the webhook token.
