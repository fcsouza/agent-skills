/**
 * Typed webhook event handlers and audit log format.
 */

type WebhookEventType =
	| "checkout.session.completed"
	| "invoice.paid"
	| "customer.subscription.updated"
	| "customer.subscription.deleted"
	| "charge.refunded"
	| "charge.dispute.created";

interface WebhookHandlerResult {
	success: boolean;
	action: string;
	playerId?: string;
	details?: Record<string, unknown>;
	error?: string;
}

interface PaymentAuditEntry {
	id: string;
	eventType: WebhookEventType;
	stripeEventId: string;
	playerId: string;
	action: "purchase" | "subscription_change" | "refund" | "dispute";
	productId?: string;
	amount?: number;
	currency?: string;
	status: "success" | "failed" | "pending";
	metadata: Record<string, unknown>;
	processedAt: Date;
}

type WebhookHandler = (eventData: unknown) => Promise<WebhookHandlerResult>;

/**
 * Registry pattern for webhook handlers.
 * Register handlers per event type for clean routing.
 */
class WebhookRegistry {
	private handlers = new Map<WebhookEventType, WebhookHandler>();

	register(eventType: WebhookEventType, handler: WebhookHandler): void {
		this.handlers.set(eventType, handler);
	}

	async handle(
		eventType: string,
		eventData: unknown,
	): Promise<WebhookHandlerResult> {
		const handler = this.handlers.get(eventType as WebhookEventType);
		if (!handler) {
			return {
				success: true,
				action: "ignored",
				details: { reason: "No handler registered" },
			};
		}
		return handler(eventData);
	}

	hasHandler(eventType: string): boolean {
		return this.handlers.has(eventType as WebhookEventType);
	}
}

export { WebhookRegistry };
export type {
	WebhookEventType,
	WebhookHandlerResult,
	PaymentAuditEntry,
	WebhookHandler,
};
