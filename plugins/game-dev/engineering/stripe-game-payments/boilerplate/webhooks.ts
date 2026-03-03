import Elysia from "elysia";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Track processed events for idempotency
const processedEvents = new Set<string>();

type FulfillmentResult = {
	success: boolean;
	playerId?: string;
	productType?: string;
	error?: string;
};

async function fulfillPurchase(
	session: Stripe.Checkout.Session,
): Promise<FulfillmentResult> {
	const playerId = session.metadata?.playerId;
	const productType = session.metadata?.productType;
	const _quantity = Number(session.metadata?.quantity ?? 1);

	if (!playerId || !productType) {
		return { success: false, error: "Missing metadata" };
	}

	// Phase 1: Record purchase in database
	// await db.insert(purchases).values({ ... });

	// Phase 2: Queue reward delivery via BullMQ (async, retryable)
	// await rewardQueue.add('fulfill', { playerId, productType, quantity, sessionId: session.id });

	return { success: true, playerId, productType };
}

async function handleSubscriptionChange(
	subscription: Stripe.Subscription,
): Promise<void> {
	const playerId = subscription.metadata?.playerId;
	if (!playerId) return;

	const _status = subscription.status;
	// Update player subscription status in database
	// await db.update(players).set({ subscriptionStatus: status }).where(eq(players.id, playerId));
}

async function handleRefund(charge: Stripe.Charge): Promise<void> {
	const paymentIntentId = charge.payment_intent as string;
	// Find purchase by payment intent
	// Revoke rewards: remove items, deduct currency
	// Log to audit trail
	console.warn(`Refund processed for payment: ${paymentIntentId}`);
}

export const stripeWebhooks = new Elysia({ prefix: "/webhooks" }).post(
	"/stripe",
	async ({ request }) => {
		const body = await request.text();
		const signature = request.headers.get("stripe-signature");

		if (!signature) {
			return new Response("Missing signature", { status: 400 });
		}

		let event: Stripe.Event;
		try {
			event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
		} catch (_err) {
			return new Response("Invalid signature", { status: 400 });
		}

		// Idempotency: skip already-processed events
		if (processedEvents.has(event.id)) {
			return { received: true, skipped: true };
		}
		processedEvents.add(event.id);

		// Route events
		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object as Stripe.Checkout.Session;
				if (session.payment_status === "paid") {
					await fulfillPurchase(session);
				}
				break;
			}

			case "invoice.paid": {
				const invoice = event.data.object as Stripe.Invoice;
				if (invoice.subscription) {
					const subscription = await stripe.subscriptions.retrieve(
						invoice.subscription as string,
					);
					await handleSubscriptionChange(subscription);
				}
				break;
			}

			case "customer.subscription.updated":
			case "customer.subscription.deleted": {
				const subscription = event.data.object as Stripe.Subscription;
				await handleSubscriptionChange(subscription);
				break;
			}

			case "charge.refunded": {
				const charge = event.data.object as Stripe.Charge;
				await handleRefund(charge);
				break;
			}

			default:
				// Unhandled event type — log for monitoring
				console.log(`Unhandled Stripe event: ${event.type}`);
		}

		return { received: true };
	},
);
