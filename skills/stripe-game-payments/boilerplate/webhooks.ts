// Verified against: stripe 23.1.0 (2026-11-14)
import type Stripe from 'stripe';

/**
 * Stripe webhook handler for a game store. Framework-agnostic: takes the raw
 * body and the `stripe-signature` header, returns a web `Response`.
 *
 * The caller implements `PaymentStore` against the game's database.
 * Checkout Sessions must be created server-side with
 * `metadata: { playerId, productId }` (one-time purchases) or
 * `subscription_data: { metadata: { playerId } }` (subscriptions).
 */

/** One database transaction. Every method is idempotent. */
export interface PaymentTx {
  /** Record the purchase and grant its rewards. Unique on checkoutSessionId. */
  grantCurrency(input: {
    checkoutSessionId: string;
    paymentIntentId: string | null;
    playerId: string;
    productId: string;
  }): Promise<void>;
  /**
   * Take back what a one-time purchase granted. Returns false when no grant
   * matches paymentIntentId (subscription payments, unknown payments).
   * Revoking an already revoked grant changes nothing and returns true.
   * The player may have spent part of the grant. Never let the balance go
   * below zero, or the `CHECK (amount >= 0)` from `postgres-game-schema`
   * rolls back the whole event and Stripe retries it forever: subtract
   * `LEAST(amount, granted)` and, when that is less than `granted`, call
   * flagForReview with the shortfall in the same transaction.
   */
  revokeCurrency(input: {
    paymentIntentId: string;
    reason: 'refund' | 'dispute';
  }): Promise<boolean>;
  /**
   * Store the current subscription status for the player. Never move a row
   * out of a terminal status ('canceled', 'incomplete_expired'): two events
   * for one subscription can run at once, and the one that retrieved the
   * older status may commit last. Store example (Postgres):
   *
   *   INSERT INTO subscriptions (id, player_id, status) VALUES ($1, $2, $3)
   *   ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
   *   WHERE subscriptions.status NOT IN ('canceled', 'incomplete_expired');
   */
  setSubscription(input: {
    subscriptionId: string;
    playerId: string;
    status: Stripe.Subscription.Status;
  }): Promise<void>;
  /** Grant one paid subscription period. Unique on invoiceId. */
  grantSubscriptionPeriod(input: {
    invoiceId: string;
    subscriptionId: string;
    playerId: string;
  }): Promise<void>;
  /** Hand a case to a human: missing metadata, partial refund, failed payment. */
  flagForReview(input: { stripeObjectId: string; reason: string }): Promise<void>;
}

export interface PaymentStore {
  /**
   * In one transaction: insert eventId into the `processed_events` table
   * from the `postgres-game-schema` skill (primary key on id, kind
   * 'stripe_event'), then run `apply`. If the insert conflicts, skip
   * `apply` and return false. If `apply` throws, roll back the whole
   * transaction, event id included, so Stripe's retry can process it.
   */
  processOnce(
    eventId: string,
    apply: (tx: PaymentTx) => Promise<void>,
  ): Promise<boolean>;
}

export interface StripeWebhookDeps {
  stripe: Stripe;
  webhookSecret: string;
  store: PaymentStore;
}

type Apply = (tx: PaymentTx) => Promise<void>;

/** The events planFor acts on. Subscribe the endpoint to exactly these. */
export const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'invoice.paid',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.refunded',
  'charge.dispute.created',
] as const satisfies readonly Stripe.Event.Type[];

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];
type HandledEvent = Extract<Stripe.Event, { type: HandledEventType }>;

const isHandled = (event: Stripe.Event): event is HandledEvent =>
  (HANDLED_EVENT_TYPES as readonly string[]).includes(event.type);

const idOf = (ref: string | { id: string } | null): string | null =>
  typeof ref === 'string' ? ref : (ref?.id ?? null);

async function fulfilCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<Apply | null> {
  if (session.mode === 'subscription') {
    const subscriptionId = idOf(session.subscription);
    const invoiceId = idOf(session.invoice);
    return subscriptionId && invoiceId
      ? syncSubscription(stripe, subscriptionId, invoiceId)
      : null;
  }
  // Stripe's fulfilment guide fulfils when payment_status is not 'unpaid',
  // so 'no_payment_required' grants as 'paid' does.
  if (session.mode !== 'payment' || session.payment_status === 'unpaid') {
    return null;
  }
  const playerId = session.metadata?.playerId;
  const productId = session.metadata?.productId;
  if (!(playerId && productId)) {
    return (tx) =>
      tx.flagForReview({ stripeObjectId: session.id, reason: 'missing metadata' });
  }
  return (tx) =>
    tx.grantCurrency({
      checkoutSessionId: session.id,
      paymentIntentId: idOf(session.payment_intent),
      playerId,
      productId,
    });
}

/**
 * Store the subscription's current status, read from the API rather than the
 * event: events arrive out of order, so a stale `updated` must not overwrite
 * `canceled`. With an invoiceId, also grant one period per invoice:
 * checkout.session.completed and invoice.paid can both name the first
 * invoice, and the unique invoiceId grants it once.
 */
async function syncSubscription(
  stripe: Stripe,
  subscriptionId: string,
  invoiceId: string | null,
): Promise<Apply> {
  // A paid invoice does not always mean an active subscription: check it.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const playerId = subscription.metadata.playerId;
  if (!playerId) {
    return (tx) =>
      tx.flagForReview({ stripeObjectId: subscriptionId, reason: 'missing playerId' });
  }
  return async (tx) => {
    await tx.setSubscription({ subscriptionId, playerId, status: subscription.status });
    if (invoiceId && subscription.status === 'active') {
      await tx.grantSubscriptionPeriod({ invoiceId, subscriptionId, playerId });
    }
  };
}

async function planFor(stripe: Stripe, event: Stripe.Event): Promise<Apply | null> {
  if (!isHandled(event)) return null;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return fulfilCheckout(stripe, event.data.object);

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object;
      return (tx) =>
        tx.flagForReview({ stripeObjectId: session.id, reason: 'async payment failed' });
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      if (invoice.parent?.type !== 'subscription_details') {
        return null;
      }
      const subscriptionId = idOf(
        invoice.parent.subscription_details?.subscription ?? null,
      );
      const invoiceId = invoice.id;
      return subscriptionId && invoiceId
        ? syncSubscription(stripe, subscriptionId, invoiceId)
        : null;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscription(stripe, event.data.object.id, null);

    case 'charge.refunded': {
      const charge = event.data.object;
      const paymentIntentId = idOf(charge.payment_intent);
      // `refunded` is true only for a full refund.
      if (!charge.refunded) {
        return (tx) =>
          tx.flagForReview({ stripeObjectId: charge.id, reason: 'partial refund' });
      }
      if (!paymentIntentId) {
        return (tx) =>
          tx.flagForReview({ stripeObjectId: charge.id, reason: 'refund without payment intent' });
      }
      return async (tx) => {
        if (!(await tx.revokeCurrency({ paymentIntentId, reason: 'refund' }))) {
          await tx.flagForReview({ stripeObjectId: charge.id, reason: 'refund matched no grant' });
        }
      };
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object;
      const paymentIntentId = idOf(dispute.payment_intent);
      if (!paymentIntentId) {
        return (tx) =>
          tx.flagForReview({ stripeObjectId: dispute.id, reason: 'dispute without payment intent' });
      }
      return async (tx) => {
        const revoked = await tx.revokeCurrency({ paymentIntentId, reason: 'dispute' });
        await tx.flagForReview({
          stripeObjectId: dispute.id,
          reason: revoked ? 'dispute' : 'dispute matched no grant',
        });
      };
    }

    default: {
      // A type added to HANDLED_EVENT_TYPES without a case fails to compile.
      const unhandled: never = event;
      return unhandled;
    }
  }
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  { stripe, webhookSecret, store }: StripeWebhookDeps,
): Promise<Response> {
  if (!signature) {
    return new Response('missing signature', { status: 400 });
  }
  let event: Stripe.Event;
  try {
    // Bun loads stripe's web build, whose crypto is async-only:
    // the sync constructEvent throws there.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    return new Response('invalid signature', { status: 400 });
  }

  // Network calls happen before the database transaction opens.
  const apply = await planFor(stripe, event);
  if (apply) {
    // A throw here reaches the caller as a 500, and Stripe retries the event.
    await store.processOnce(event.id, apply);
  }
  return new Response('ok', { status: 200 });
}
