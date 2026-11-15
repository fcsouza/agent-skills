# Pix Automático (recurring debit)

A Central Bank (BACEN) product. The payer authorizes once; later charges are debited from their account. The Asaas API uses "Jornada 3": one QR code takes the first payment and asks for the authorization.

## Account eligibility

Check this before you promise the product to anyone:

- PJ account (CNPJ), approved, no pending registration items.
- CNPJ active at Receita Federal for at least 6 months.
- No Pix-related restrictions or fraud marks.

Eligibility can change. `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED` carries `eligibility.status` (`ELIGIBLE` or `INELIGIBLE`) and `eligibility.ineligibleReasons`. When an account turns ineligible, Asaas can cancel its authorizations and instructions. Handle the event, or paying customers lose access with no error on your side.

## 1. Create the authorization

```http
POST /v3/pix/automatic/authorizations
```

Required: `frequency`, `contractId`, `startDate`, `customerId`, `immediateQrCode`.

```json
{
  "customerId": "cus_000005735721",
  "frequency": "MONTHLY",
  "contractId": "Plano Basico mensal",
  "startDate": "2027-01-01",
  "value": 159.90,
  "description": "Plano Basico",
  "paymentCreationMode": "SUBSCRIPTION",
  "retryPolicy": "ALLOW_THREE_IN_SEVEN_DAYS",
  "immediateQrCode": { "expirationSeconds": 86400, "originalValue": 159.90, "description": "Primeiro mes" }
}
```

| Field | Notes |
| --- | --- |
| `frequency` | `WEEKLY`, `MONTHLY`, `QUARTERLY`, `SEMIANNUALLY`, `ANNUALLY`. Subscriptions say `YEARLY`; this field says `ANNUALLY` |
| `contractId` | Max 35 chars. The docs call it the number, identifier or code of what the authorization covers. Observed in production, not in the docs: the payer's bank app shows it to the payer as "Código da cobrança". This skill's rule: make it readable, never a secret or an internal key, and reconcile by the authorization `id` and `immediateQrCode.conciliationIdentifier` instead |
| `description` | Max 35 chars. Observed in production, not in the docs: the payer's bank app shows it as "Serviço". Write it for the payer |
| `value` | Fixed amount for every later charge. Omit it for variable amounts. Required when `paymentCreationMode` is `SUBSCRIPTION` |
| `minLimitValue` | If the payer sets a ceiling, it cannot be below this floor. Not allowed when `value` is set |
| `finishDate` | Optional; omit for an open-ended authorization |
| `immediateQrCode` | `expirationSeconds` and `originalValue` required; `pixKey` and `description` optional. A QR code that expires unpaid sends the authorization to `REFUSED`. This skill's rule: give the payer hours, not minutes |

The response carries the authorization `id`, and `payload` (copia e cola) and `encodedImage` at the top level, plus `immediateQrCode.conciliationIdentifier`. Status starts at `CREATED`. Store the `id` and the `conciliationIdentifier`.

The docs recommend a registered Pix key on the account; see the one-off Pix section of `SKILL.md`.

### Who creates each cycle's charge

`paymentCreationMode`, default `MANUAL`:

- `SUBSCRIPTION`: a subscription linked to the authorization creates the charges. Requires a fixed `value`. Do not create charges yourself.
- `MANUAL`: your code creates every charge with `POST /v3/payments` and `pixAutomaticAuthorizationId`. Create it between 2 and 10 business days before the due date; the implementation guide and the recipe now agree on business days. Under 2 business days the payer's bank may fail to schedule the debit. Each cycle can carry a different amount when the authorization has no `value`.

When `value` is set, charges must match it. This skill's rule: to change a fixed amount, cancel the authorization and create a new one, and expect the payer to scan again. If amounts change over a contract (upgrades, proration), omit `value` and use `MANUAL`.

Observed in production, not in the docs: a second instruction for the same cycle returns 400 `invalid_object`, with the reason only in the message text. Treat that 400 as "this cycle is already charged" in a renewal job.

### Retries

`retryPolicy`, default `NOT_ALLOWED`. `ALLOW_THREE_IN_SEVEN_DAYS` permits retries; it does not perform them. Two kinds exist:

- Intraday: the payer's institution retries on the due date by itself. It does not count against the limit.
- Later dates: your code commands each one.

```http
POST /v3/pix/automatic/paymentInstructions/{instructionId}/retries
{ "dueDate": "2027-01-13" }
```

Rule 3R_7D. Asaas answers 400 when you break it:

- at most 3 retries on different dates;
- within 7 calendar days after the original due date;
- before the next cycle starts;
- same value as the original charge;
- sent by 23:59 the day before the new date, never on the same day.

The policy must be set at creation; it cannot be turned on later. Retry instructions carry `purpose: RETRY_AFTER_DUE_DATE` (the original has `SCHEDULE`) and `retryAttempt`. Wait for one retry's result before you send the next. A retry cannot be cancelled on its own; cancelling the authorization ends pending schedules.

When the last retry fails, the charge is `OVERDUE`, the instruction `REFUSED` and the authorization stays `ACTIVE`. The next cycle follows `paymentCreationMode`. The payer can still pay the overdue charge through the invoice, which fires `PAYMENT_CONFIRMED`.

## 2. Wait for activation

Status goes `CREATED` → `ACTIVE` in two steps: the first payment settles (`PAYMENT_RECEIVED`), then the payer's institution sends the authorization confirmation (`PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED`).

If the institution never confirms, you get `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED` after `PAYMENT_RECEIVED`. The first payment stays valid. `pixAutomaticAuthorizationId` accepts only `ACTIVE` authorizations, so do not link charges to it. The FAQ offers two ways out: refund and start Jornada 3 again, or keep the payment and create a new authorization with `immediateQrCode` at the next cycle.

Dead ends: `CANCELLED`, `REFUSED`, `EXPIRED` (reached `finishDate`). Track status by webhook, not polling.

Consequences:

- From the docs: wait for `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED` before you link new charges to the authorization. `PAYMENT_RECEIVED` does not prove the authorization is active, but the first payment stays received even if `AUTHORIZATION_REFUSED` follows. The activation event carries `authorization.id`, `customerId`, `contractId` and `immediateQrCode.conciliationIdentifier`.
- This skill's rule: grant the first cycle on the first payment (`PAYMENT_RECEIVED`), since the money is kept either way, and count automatic renewal as on only after `AUTHORIZATION_ACTIVATED`. If `AUTHORIZATION_REFUSED` follows, keep the paid cycle, take one of the FAQ's two ways out, and create no charges against the refused authorization. If you take the first way out and refund the first payment, the `PAYMENT_REFUNDED` revoke applies to that cycle.
- The authorization is tied to the account that paid the QR code, even when you sent another `customerId`. Do not assume the payer is your customer record.
- Observed in production, not in the docs: the first payment's `payment.pixQrCodeId` equals the authorization's `immediateQrCode.conciliationIdentifier`. Match the first payment on that pair, not on your customer id.
- This skill's rule: if you abandon an authorization (the payer never scans, or saving it failed), cancel it at Asaas with `DELETE /v3/pix/automatic/authorizations/{id}` before you drop your own row, so the QR code cannot be paid into nothing. Log any payment you cannot match.

## 3. Create recurring charges (MANUAL mode)

`POST /v3/payments` with `pixAutomaticAuthorizationId`. Without that field you get an ordinary Pix charge that no one debits. To use split, send `split` on each of these charges; the initial QR code cannot carry split.

## Debit behaviour

- The payer's institution tries on the due date and retries the same day. The recipe says a charge with no balance by 20:00 on the due date goes `REFUSED`.
- If the payer pays the charge another way up to the day before the due date, the instruction for that cycle is cancelled to avoid a double debit. The authorization stays active. Paying another way is blocked from 22:00 the day before until the due date; the recipe warns that a payment after that window can end with the payer paying twice.
- A refused instruction does not cancel the authorization.
- The payer can revoke the authorization from their bank app; you get `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED` with `cancellationReason` and `cancellationDate`. No event fires when a paid period later runs out. This skill's rule: end access with your own sweep at period end.

## Webhook events

Authorization (payload under `authorization`):

- `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED`
- `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED`: the go-live signal.
- `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED`: QR expired, payer gave up, or the institution did not confirm after payment.
- `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED`: carries `cancellationReason` (see `docs/motivos-de-cancelamento-da-autorização-do-pix-automático`).
- `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED`: reached `finishDate`; no `cancellationReason`.

Instruction (payload under `paymentInstruction`, with `paymentId` and `authorization.id`):

- `PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED`, `_SCHEDULED`, `_REFUSED`, `_CANCELLED`.

Account: `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED`.

```json
{ "event": "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED",
  "paymentInstruction": { "id": "…", "status": "SCHEDULED", "dueDate": "2027-01-04",
                          "paymentId": "pay_…", "authorization": { "id": "…" } } }
```

Expected sequences, from the webhook-flows page:

- First payment: `AUTHORIZATION_CREATED → PAYMENT_CREATED → PAYMENT_RECEIVED → AUTHORIZATION_ACTIVATED` (or `AUTHORIZATION_REFUSED`).
- Recurring debit: `PAYMENT_CREATED → INSTRUCTION_CREATED → INSTRUCTION_SCHEDULED → PAYMENT_CONFIRMED`. A refusal at scheduling or at settlement sends `INSTRUCTION_REFUSED`.
- Paid another way: `PAYMENT_CONFIRMED → INSTRUCTION_CANCELLED`.
- Authorization cancelled with a scheduled instruction: `AUTHORIZATION_CANCELLED → INSTRUCTION_CANCELLED`.

The first payment ends in `PAYMENT_RECEIVED`; renewals end in `PAYMENT_CONFIRMED`. Handle both, or renewals collect money and grant nothing. Treat `INSTRUCTION_REFUSED` as non-payment in its own right. Plus the ordinary `PAYMENT_*` events on the charges themselves.
