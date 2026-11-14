---
name: stripe-game-payments
description: >-
  Covers selling premium currency, items and subscriptions in a game through Stripe: product catalog, webhook fulfilment, refund and dispute revocation, and the idempotency table. Use when a game needs real-money purchases, a battle pass or premium membership, or has to grant and take back currency safely from Stripe events.
---

# Stripe Game Payments

For client setup, Checkout Sessions and the API itself, use the `stripe-docs` skill if it is installed, otherwise https://docs.stripe.com. This skill covers the game side: what to sell, when to grant, when to take back.

## Decisions

1. All payment logic runs on the server. The client never sends a price, a quantity or an entitlement.
2. Sell premium currency, then let players spend it on items. Prices can change without new Stripe products.
3. Grant only from webhooks. The player may never load the success page.
4. Grant inside the same database transaction that records the Stripe event id. A crash then leaves neither, and Stripe retries.
5. A subscription period is granted once per invoice. Stripe's guide provisions on `checkout.session.completed` and again on each `invoice.paid`; both can name the first invoice, so the grant is unique on invoice id.
6. A full refund or a dispute revokes what a one-time purchase granted. A partial refund, or a refund or dispute on a subscription payment, goes to a human: grants of subscription periods are keyed by invoice, not by payment intent.

## Steps

1. `bun add stripe`. Do not pass `apiVersion`: the SDK uses the version it was released with.
2. Define the catalog. Copy when starting the store: `templates/product-catalog.ts`. Each product `id` is what Checkout metadata carries.
3. Create Checkout Sessions on the server (vendor docs). Set `metadata: { playerId, productId }` for one-time purchases and `subscription_data: { metadata: { playerId } }` for subscriptions. Pass an idempotency key on the create call so a retried request does not create a second session.
4. Add the `processed_events` table from the `postgres-game-schema` skill: event id as primary key, a `kind` (`stripe_event`) and `created_at`. It is the idempotency table this skill and `bullmq-game-queues` share. Purchases need their own unique keys on your purchase and subscription-period tables: checkout session id for one-time grants, invoice id for subscription periods. That skill has no purchase tables; add them following its conventions.
5. Copy when wiring the webhook endpoint: `boilerplate/webhooks.ts`. Implement its `PaymentStore` and `PaymentTx` against those tables, then call `handleStripeWebhook(rawBody, signatureHeader, { stripe, webhookSecret, store })` from your route and return its `Response`.
6. Keep `grantCurrency` short: write the purchase row and enqueue reward delivery with the `bullmq-game-queues` skill. Stripe wants a 2xx response before slow work.
7. Read when designing the payment audit log: `templates/webhook-events.ts`. It holds the audit row type; log every handled event with player, product, amount and status.
8. Subscribe the endpoint to the events in `HANDLED_EVENT_TYPES` (`webhooks.ts`): `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`.

## How `webhooks.ts` handles each event

| Event | Action |
| --- | --- |
| `checkout.session.completed` | `mode === 'payment'`: grant unless `payment_status === 'unpaid'` (so `paid` and `no_payment_required` both grant); `unpaid` waits for `async_payment_succeeded`. `mode === 'subscription'`: retrieve the subscription from `session.subscription`, store its status, grant the period for `session.invoice` if `active`. |
| `checkout.session.async_payment_succeeded` | Same as completed. Delayed methods such as bank debits land here. |
| `checkout.session.async_payment_failed` | Flag for review so the game can tell the player. |
| `invoice.paid` | Read the subscription id from `invoice.parent.subscription_details.subscription` after checking `invoice.parent?.type === 'subscription_details'`. Retrieve the subscription; grant the period for this invoice only if its status is `active`. |
| `customer.subscription.updated` / `.deleted` | Retrieve the subscription and store its current status, not the status in the event. |
| `charge.refunded` | `charge.refunded` is true only for a full refund: revoke by payment intent. Partial, or no matching grant: flag for review. |
| `charge.dispute.created` | Revoke by `dispute.payment_intent` and flag the account. The money has already left your balance. |

## Pitfalls

- Signature checks on Bun need `await stripe.webhooks.constructEventAsync(...)`. Bun loads the SDK's web build, whose crypto is async-only, so `constructEvent` throws.
- Verify against the raw body exactly as received. A framework that parses JSON first breaks the signature.
- Deduplicating by event id is not enough. Stripe can send two different events for the same object, and one session can complete on `checkout.session.completed` or later on `async_payment_succeeded`. The purchase row's unique key stops the second grant.
- An in-memory `Set` of processed ids forgets on restart and is not shared between instances. Use the database table.
- Events arrive out of order (https://docs.stripe.com/webhooks#event-ordering). Do not use `created` to order them. `webhooks.ts` retrieves the subscription and stores the status Stripe returns now. That alone does not stop two concurrent events: the one that retrieved `active` can commit after the one that stored `canceled`. So `setSubscription` never moves a row out of a terminal status (`canceled`, `incomplete_expired`); its doc comment has the SQL.
- `invoice.subscription` no longer exists on current API versions. Use the `parent` path above.
- Revocation must be idempotent. Duplicate events, and separate events for the same payment, can reach it more than once.
- When the player already spent the currency, decide in game rules what revocation does: take what is left and record a debt, remove items, or lock the account. A negative balance is not an option: `postgres-game-schema` puts `CHECK (amount >= 0)` on currencies. Do not let revocation throw, or Stripe retries the event for up to three days.
- Missing `playerId` metadata means a bug in session creation. Flag it; do not throw.
- Rate-limit purchases per player and turn on Radar for fraud (https://docs.stripe.com/radar).

## Related skills

- `postgres-game-schema`: inventory and currency tables, table conventions, and the `processed_events` idempotency table.
- `betterauth-integration`: the authenticated player whose id goes in Checkout metadata.
- `bullmq-game-queues`: reward delivery after the purchase is recorded.
- `game-economy-design`: currency pricing and balance.

Read when checking a claim or a field path: `references/sources.md`.
