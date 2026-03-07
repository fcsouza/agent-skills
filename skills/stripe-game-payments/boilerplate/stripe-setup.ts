// ============================================================
// Stripe Client Configuration — SDK Init, Catalog Sync, Customer Linking
// ============================================================

import Stripe from "stripe";

// ============================================================
// Stripe Client
// ============================================================

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2024-12-18.acacia",
	typescript: true,
});

// ============================================================
// Customer Management — Link Stripe customers to player accounts
// ============================================================

export const getOrCreateCustomer = async (
	playerId: string,
	email: string,
	metadata?: Record<string, string>,
): Promise<Stripe.Customer> => {
	// Search for existing customer by playerId metadata
	const existing = await stripe.customers.search({
		query: `metadata["playerId"]:"${playerId}"`,
	});

	if (existing.data.length > 0) {
		return existing.data[0];
	}

	return stripe.customers.create({
		email,
		metadata: {
			playerId,
			...metadata,
		},
	});
};

export const getCustomerByPlayerId = async (
	playerId: string,
): Promise<Stripe.Customer | null> => {
	const result = await stripe.customers.search({
		query: `metadata["playerId"]:"${playerId}"`,
	});

	return result.data[0] ?? null;
};

// ============================================================
// Product Catalog Sync — Ensure Stripe products match game catalog
// ============================================================

export interface CatalogProduct {
	id: string;
	name: string;
	description: string;
	stripePriceId: string;
	type: "one_time" | "recurring";
	metadata: Record<string, string>;
}

export const syncProductToStripe = async (
	product: CatalogProduct,
): Promise<Stripe.Product> => {
	const existing = await stripe.products.search({
		query: `metadata["catalogId"]:"${product.id}"`,
	});

	if (existing.data.length > 0) {
		return stripe.products.update(existing.data[0].id, {
			name: product.name,
			description: product.description,
			metadata: {
				catalogId: product.id,
				...product.metadata,
			},
		});
	}

	return stripe.products.create({
		name: product.name,
		description: product.description,
		metadata: {
			catalogId: product.id,
			...product.metadata,
		},
	});
};

export const syncCatalog = async (
	products: CatalogProduct[],
): Promise<Stripe.Product[]> => {
	return Promise.all(products.map(syncProductToStripe));
};

// ============================================================
// Subscription Helpers
// ============================================================

export const getActiveSubscription = async (
	customerId: string,
	priceId?: string,
): Promise<Stripe.Subscription | null> => {
	const params: Stripe.SubscriptionListParams = {
		customer: customerId,
		status: "active",
	};

	if (priceId) {
		params.price = priceId;
	}

	const subscriptions = await stripe.subscriptions.list(params);
	return subscriptions.data[0] ?? null;
};

export const cancelSubscription = async (
	subscriptionId: string,
	cancelAtPeriodEnd = true,
): Promise<Stripe.Subscription> => {
	if (cancelAtPeriodEnd) {
		return stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: true,
		});
	}

	return stripe.subscriptions.cancel(subscriptionId);
};

// ============================================================
// Idempotency Key Generator
// ============================================================

export const makeIdempotencyKey = (
	playerId: string,
	action: string,
	uniqueId: string,
): string => {
	return `${playerId}:${action}:${uniqueId}`;
};
