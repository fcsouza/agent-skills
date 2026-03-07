// ============================================================
// Checkout Session Creation — One-Time, Subscription, Currency Bundles
// ============================================================

import type Stripe from "stripe";
import {
	getOrCreateCustomer,
	makeIdempotencyKey,
	stripe,
} from "./stripe-setup";

// ============================================================
// Checkout Parameters
// ============================================================

interface BaseCheckoutParams {
	playerId: string;
	playerEmail: string;
	priceId: string;
	successUrl: string;
	cancelUrl: string;
	metadata?: Record<string, string>;
}

interface ConsumableCheckoutParams extends BaseCheckoutParams {
	quantity: number;
}

interface CurrencyBundleCheckoutParams extends BaseCheckoutParams {
	quantity?: number;
}

type SubscriptionCheckoutParams = BaseCheckoutParams;

// ============================================================
// Consumable Purchase — One-time items, loot boxes, boosts
// ============================================================

export const createConsumableCheckout = async (
	params: ConsumableCheckoutParams,
): Promise<Stripe.Checkout.Session> => {
	const customer = await getOrCreateCustomer(
		params.playerId,
		params.playerEmail,
	);
	const idempotencyKey = makeIdempotencyKey(
		params.playerId,
		"checkout-consumable",
		`${params.priceId}-${Date.now()}`,
	);

	return stripe.checkout.sessions.create(
		{
			customer: customer.id,
			mode: "payment",
			line_items: [
				{
					price: params.priceId,
					quantity: params.quantity,
				},
			],
			metadata: {
				playerId: params.playerId,
				productType: "consumable",
				quantity: String(params.quantity),
				...params.metadata,
			},
			success_url: params.successUrl,
			cancel_url: params.cancelUrl,
			payment_intent_data: {
				metadata: {
					playerId: params.playerId,
					productType: "consumable",
				},
			},
		},
		{ idempotencyKey },
	);
};

// ============================================================
// Subscription — Battle pass, premium membership, VIP tiers
// ============================================================

export const createSubscriptionCheckout = async (
	params: SubscriptionCheckoutParams,
): Promise<Stripe.Checkout.Session> => {
	const customer = await getOrCreateCustomer(
		params.playerId,
		params.playerEmail,
	);
	const idempotencyKey = makeIdempotencyKey(
		params.playerId,
		"checkout-subscription",
		`${params.priceId}-${Date.now()}`,
	);

	return stripe.checkout.sessions.create(
		{
			customer: customer.id,
			mode: "subscription",
			line_items: [
				{
					price: params.priceId,
					quantity: 1,
				},
			],
			metadata: {
				playerId: params.playerId,
				productType: "subscription",
				...params.metadata,
			},
			success_url: params.successUrl,
			cancel_url: params.cancelUrl,
			subscription_data: {
				metadata: {
					playerId: params.playerId,
					productType: "subscription",
				},
			},
		},
		{ idempotencyKey },
	);
};

// ============================================================
// Currency Bundle — Premium currency packs
// ============================================================

export const createCurrencyBundleCheckout = async (
	params: CurrencyBundleCheckoutParams,
): Promise<Stripe.Checkout.Session> => {
	const customer = await getOrCreateCustomer(
		params.playerId,
		params.playerEmail,
	);
	const idempotencyKey = makeIdempotencyKey(
		params.playerId,
		"checkout-currency",
		`${params.priceId}-${Date.now()}`,
	);

	return stripe.checkout.sessions.create(
		{
			customer: customer.id,
			mode: "payment",
			line_items: [
				{
					price: params.priceId,
					quantity: params.quantity ?? 1,
				},
			],
			metadata: {
				playerId: params.playerId,
				productType: "currency_bundle",
				quantity: String(params.quantity ?? 1),
				...params.metadata,
			},
			success_url: params.successUrl,
			cancel_url: params.cancelUrl,
			payment_intent_data: {
				metadata: {
					playerId: params.playerId,
					productType: "currency_bundle",
				},
			},
		},
		{ idempotencyKey },
	);
};

// ============================================================
// Customer Portal — Manage subscriptions, payment methods
// ============================================================

export const createCustomerPortalSession = async (
	playerId: string,
	playerEmail: string,
	returnUrl: string,
): Promise<Stripe.BillingPortal.Session> => {
	const customer = await getOrCreateCustomer(playerId, playerEmail);

	return stripe.billingPortal.sessions.create({
		customer: customer.id,
		return_url: returnUrl,
	});
};
