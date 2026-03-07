/**
 * Game product catalog — maps Stripe products to in-game rewards.
 * Genre-agnostic: works for any game type.
 */

type ProductType =
	| "consumable"
	| "subscription"
	| "currency_bundle"
	| "cosmetic"
	| "expansion";

interface GameProduct {
	id: string;
	name: string;
	type: ProductType;
	stripePriceId: string;
	description: string;
	rewards: ProductReward[];
	limits?: {
		maxPerPlayer?: number;
		maxPerDay?: number;
	};
}

interface ProductReward {
	type: "currency" | "item" | "unlock" | "subscription_flag";
	currencyType?: string;
	amount?: number;
	itemDefinitionId?: string;
	unlockId?: string;
	duration?: number; // seconds, for time-limited rewards
}

/**
 * Example product catalog.
 * Replace stripePriceId with actual Stripe price IDs.
 */
const PRODUCT_CATALOG: GameProduct[] = [
	// Premium currency bundles
	{
		id: "currency_small",
		name: "Small Currency Pack",
		type: "currency_bundle",
		stripePriceId: "price_xxx_small",
		description: "100 premium currency",
		rewards: [{ type: "currency", currencyType: "premium", amount: 100 }],
	},
	{
		id: "currency_large",
		name: "Large Currency Pack",
		type: "currency_bundle",
		stripePriceId: "price_xxx_large",
		description: "1,000 premium currency + bonus 100",
		rewards: [{ type: "currency", currencyType: "premium", amount: 1100 }],
	},

	// Subscription / Battle Pass
	{
		id: "premium_pass",
		name: "Premium Pass",
		type: "subscription",
		stripePriceId: "price_xxx_pass",
		description: "Monthly premium access with exclusive rewards",
		rewards: [
			{ type: "subscription_flag", unlockId: "premium_active" },
			{ type: "currency", currencyType: "premium", amount: 500 },
		],
	},

	// Cosmetic (one-time)
	{
		id: "cosmetic_bundle_01",
		name: "Cosmetic Bundle",
		type: "cosmetic",
		stripePriceId: "price_xxx_cosmetic",
		description: "Exclusive visual customization pack",
		rewards: [{ type: "unlock", unlockId: "cosmetic_bundle_01" }],
		limits: { maxPerPlayer: 1 },
	},

	// Content expansion
	{
		id: "expansion_01",
		name: "Content Expansion",
		type: "expansion",
		stripePriceId: "price_xxx_expansion",
		description: "Unlock new content areas and features",
		rewards: [{ type: "unlock", unlockId: "expansion_01" }],
		limits: { maxPerPlayer: 1 },
	},
];

function getProductByPriceId(priceId: string): GameProduct | undefined {
	return PRODUCT_CATALOG.find((p) => p.stripePriceId === priceId);
}

function getProductById(id: string): GameProduct | undefined {
	return PRODUCT_CATALOG.find((p) => p.id === id);
}

export { PRODUCT_CATALOG, getProductByPriceId, getProductById };
export type { GameProduct, ProductReward, ProductType };
