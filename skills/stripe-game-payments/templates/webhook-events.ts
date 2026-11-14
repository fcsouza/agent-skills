import type { HandledEventType } from '../boilerplate/webhooks';

/**
 * One row of the payment audit log: one per handled Stripe event. Event types
 * come from HANDLED_EVENT_TYPES in webhooks.ts, so the log and the handler
 * cannot drift apart.
 */
export interface PaymentAuditEntry {
  id: string;
  eventType: HandledEventType;
  stripeEventId: string;
  playerId: string;
  action: 'purchase' | 'subscription_change' | 'refund' | 'dispute';
  productId?: string;
  amount?: number;
  currency?: string;
  status: 'success' | 'failed' | 'pending';
  metadata: Record<string, unknown>;
  processedAt: Date;
}
