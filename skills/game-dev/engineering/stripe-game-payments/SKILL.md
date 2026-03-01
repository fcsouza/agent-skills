# Stripe Game Payments

## Purpose

In-app purchases, subscriptions, consumables, webhooks, idempotency, and fraud prevention for games using Stripe.

## When to Use

Trigger: payments, Stripe, IAP, in-app purchase, subscription, premium, battle pass, virtual currency, webhook, checkout, monetization

## Prerequisites

- `postgres-game-schema` (player accounts, inventory, currency tables)
- `betterauth-integration` (authenticated player sessions)

## Core Principles

> Sid Meier: "A game is a series of interesting decisions." Monetization should enable interesting decisions, not replace them.

1. **Payments are server-side only** — never trust the client with price, quantity, or entitlement logic
2. **Idempotency keys on every mutation** — prevent double-charges on retries or network failures
3. **Webhook-first fulfillment** — deliver purchases via webhook events, not checkout completion callbacks
4. **Two-phase fulfillment** — record the purchase first, then queue reward delivery separately
5. **Support both one-time and recurring** — consumables (currency packs, items) and subscriptions (battle pass, premium membership)
6. **Currency abstraction** — players buy premium currency, then spend it on items; never sell game items directly for real money
7. **Refund handling** — revoke rewards on chargebacks and refunds automatically
8. **Fraud signals** — velocity checks, suspicious purchase patterns, geographic anomalies

## Step-by-Step Instructions

### 1. Install Dependencies

```bash
bun add stripe
```

### 2. Configure Stripe Client

Use `boilerplate/stripe-setup.ts` to initialize the Stripe SDK, sync your product catalog, and link Stripe customers to player accounts.

### 3. Define Product Catalog

Start with `templates/product-catalog.ts` to define your product types (consumable, subscription, currency bundle, cosmetic) and map them to Stripe price IDs and game rewards.

### 4. Create Checkout Sessions

Use `boilerplate/checkout.ts` to create Stripe Checkout sessions for one-time purchases, subscriptions, and premium currency bundles. Always attach player metadata.

### 5. Handle Webhooks

Implement `boilerplate/webhooks.ts` for signature verification, idempotent event processing, and two-phase fulfillment. Route events to typed handlers defined in `templates/webhook-events.ts`.

### 6. Queue Reward Delivery

After recording a purchase, dispatch a fulfillment job via BullMQ (see `bullmq-game-queues`). The worker grants the items, currency, or subscription entitlement.

### 7. Handle Refunds & Chargebacks

Listen for `charge.refunded` and `charge.dispute.*` events. Revoke granted rewards, deduct premium currency, and flag the player account for review.

### 8. Monitor & Audit

Log every payment event with an audit trail. Track fulfillment status (pending, fulfilled, revoked) and alert on anomalies.

## Code Examples

### Creating a checkout for a currency bundle

```typescript
import { createCurrencyBundleCheckout } from './checkout';

const session = await createCurrencyBundleCheckout({
  playerId: 'player_123',
  priceId: 'price_premium_1000',
  quantity: 1,
  successUrl: 'https://game.example.com/store/success',
  cancelUrl: 'https://game.example.com/store',
});
```

### Creating a subscription checkout

```typescript
import { createSubscriptionCheckout } from './checkout';

const session = await createSubscriptionCheckout({
  playerId: 'player_123',
  priceId: 'price_battle_pass_monthly',
  successUrl: 'https://game.example.com/pass/success',
  cancelUrl: 'https://game.example.com/pass',
});
```

### Processing a webhook event

```typescript
import { handleStripeWebhook } from './webhooks';

app.post('/webhooks/stripe', async ({ request }) => {
  const sig = request.headers.get('stripe-signature')!;
  const body = await request.text();
  await handleStripeWebhook(body, sig);
  return new Response('ok', { status: 200 });
});
```

See `boilerplate/stripe-setup.ts` for client configuration, `boilerplate/checkout.ts` for session creation, `boilerplate/webhooks.ts` for event handling, and `templates/product-catalog.ts` for product definitions.

## Cross-References

- `betterauth-integration` for authenticated player sessions and Stripe customer linking
- `postgres-game-schema` for purchase records, inventory, and currency tables
- `bullmq-game-queues` for async fulfillment job dispatch and processing
- `game-economy-design` for pricing strategy and currency balance design

## Pitfalls & Anti-Patterns

- **Don't fulfill purchases on checkout completion** — always use webhooks; checkout success redirects can be faked or missed
- **Don't skip idempotency keys** — network retries and webhook replays will cause double-charges or double-grants without them
- **Don't store Stripe API keys in client code** — all payment logic must be server-side only
- **Don't sell game items directly for real money** — use a premium currency layer so you can adjust prices without changing Stripe products
- **Don't ignore chargebacks** — unhandled disputes lead to account bans by Stripe; always revoke rewards and flag accounts
- **Don't couple payment processing with reward delivery** — use two-phase fulfillment so a failed reward grant doesn't block payment recording
- **Don't skip webhook signature verification** — unsigned webhooks can be spoofed to grant free items
- **Don't allow unlimited purchase velocity** — rate-limit purchases per player to detect fraud and prevent accidental overspending

## Designer Philosophy

**Sid Meier:** Monetization should enable interesting decisions, not replace them. A well-designed payment system gives players meaningful choices about how they engage with content. Premium currency buys time, not power. A battle pass rewards engagement, not spending. Fair monetization respects player skill and time investment — the best purchases enhance the experience without gating core gameplay.

## Sources

- [Stripe Official Documentation](https://docs.stripe.com)
- [Stripe Checkout Integration Guide](https://docs.stripe.com/payments/checkout)
- [Stripe Webhooks Best Practices](https://docs.stripe.com/webhooks/best-practices)
- [Stripe Gaming & Digital Goods](https://stripe.com/use-cases/gaming)
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe Fraud Prevention](https://docs.stripe.com/radar)
