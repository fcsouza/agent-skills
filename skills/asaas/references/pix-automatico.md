# Pix Automático (recurring auto-debit)

BACEN product. The payer authorizes once, then charges debit automatically. Asaas implements
"Jornada 3": one QR code both takes the first payment and grants the authorization.

## Account eligibility (check before promising this to anyone)

- PJ account (CNPJ), approved, no registration pendencies.
- CNPJ active at Receita Federal for at least 6 months.
- No Pix-related restrictions.

If the account stops qualifying, Asaas fires `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED` with
`eligibility.status = INELIGIBLE`, and **cancels every active authorization and pending instruction**.
Handle that event or paying customers go dark silently.

## 1. Create the authorization

```http
POST /v3/pix/automatic/authorizations
```

Required: `frequency`, `contractId`, `startDate`, `customerId`, `immediateQrCode`.

```json
{
  "customerId": "cus_000005735721",
  "frequency": "MONTHLY",
  "contractId": "sub_internal_123",
  "startDate": "2026-09-01",
  "value": 159.90,
  "description": "Plano Básico",
  "paymentCreationMode": "SUBSCRIPTION",
  "retryPolicy": "ALLOW_THREE_IN_SEVEN_DAYS",
  "immediateQrCode": { "expirationSeconds": 3600, "originalValue": 159.90, "description": "Primeiro mês" }
}
```

| Field | Notes |
| --- | --- |
| `frequency` | `WEEKLY`, `MONTHLY`, `QUARTERLY`, `SEMIANNUALLY`, `ANNUALLY` (note: `ANNUALLY`, not `YEARLY` as in subscriptions) |
| `contractId` | max 35 chars. Your internal contract/subscription id — use it to reconcile |
| `description` | max 35 chars |
| `value` | Fixed amount for every future charge. **Omit it for variable amounts** |
| `minLimitValue` | Floor if the payer sets their own ceiling. Forbidden on fixed-value authorizations |
| `finishDate` | Optional; omit for open-ended |
| `immediateQrCode` | `expirationSeconds` and `originalValue` required; `pixKey` and `description` optional. Give it a day, not an hour: an expired QR code does not merely fail that payment, it drives the authorization to `REFUSED`, so a customer who steps away comes back to a dead subscription. Confirmed in sandbox |

Response carries `id` (the authorization, a UUID), plus `payload` (copia e cola) and `encodedImage`
(base64 PNG) **at the top level**, not nested under `immediateQrCode`. Status comes back `CREATED`.
Store the `id`.

The account needs a registered Pix key first, or the call fails with
`{"errors":[{"code":"invalid_action","description":"Chave Pix não encontrada."}]}`. Create one with
`POST /v3/pix/addressKeys` `{"type":"EVP"}`. Verified against sandbox, 2026-08.

### The fork: who creates each cycle's charge

`paymentCreationMode`, default `MANUAL`:

- **`SUBSCRIPTION`** — Asaas generates the recurring charges itself. Requires a fixed `value`. No
  scheduler on your side.
- **`MANUAL`** — your application creates every charge via API with `pixAutomaticAuthorizationId`.
  Each charge must be created shortly before its due date, or the API throws. **The docs contradict
  each other on the unit**: the implementation guide says "entre 2 e 10 dias úteis", the recipe says
  "entre 2 e 10 dias". Satisfy both — at least 2 business days out, at most 10 calendar days out.
  Under 48 hours the payer's bank may fail to schedule the debit at all. Lets each cycle carry a
  different amount.

Changing a fixed `value` is not possible: cancel the authorization and create a new one, which means
the customer scans and authorizes again. If amounts change over a contract's life (plan upgrades,
proration), create the authorization without `value` and use `MANUAL`.

`retryPolicy`, default `NOT_ALLOWED`. **`ALLOW_THREE_IN_SEVEN_DAYS` grants permission to retry, it
does not retry.** Read that twice: nothing happens on its own past the due date. The payer's bank
retries only within the due date itself (it must try again once between 18:00 and 21:00, and never
after 21:00) — that intraday attempt is automatic and doesn't count against the limit. Every attempt
on a *later* date is a command you send:

```http
POST /v3/pix/automatic/paymentInstructions/{instructionId}/retries
{ "dueDate": "2026-07-13" }
```

Central Bank rule 3R_7D, which Asaas enforces with a 400 on each violation:

- at most **3** attempts on different dates for the same failed charge;
- all within **7 calendar days** of the original settlement date;
- never on or after the day the next cycle starts;
- same value as the original charge;
- the command must arrive by **23:59 the day before** the date requested, so the earliest date you
  can name is tomorrow.

The retry cannot be enabled later: an authorization created without the policy treats any failure as
final. Retry instructions come back with `purpose: RETRY_AFTER_DUE_DATE` (the original is `SCHEDULE`)
and carry `retryAttempt` — 1, 2, 3 — on their webhook events, which is how you count what is left.

## The first payment does not look like you expect

Verified end to end against sandbox, 2026-08. When the payer settles the immediate QR code:

- The authorization goes `ACTIVE`, and the money lands. Both take minutes, not seconds — the payer
  side shows "Em processamento" meanwhile.
- A payment **is** created, but **not under the customer you attached to the authorization**. Asaas
  registers a fresh customer from whoever actually paid, and files the charge there with
  `description: "Cobrança gerada automaticamente a partir de Pix recebido."` So
  `GET /payments?customer=<your customer>` stays empty and any lookup keyed on your customer id
  finds nothing.
- That payment carries **no** `externalReference` and **no** `pixAutomaticAuthorizationId`.
- The only link back is **`payment.pixQrCodeId`, which equals the authorization's
  `immediateQrCode.conciliationIdentifier`**. Store that identifier at creation time or you cannot
  match the first payment to anything.

Consequences worth designing around:

- **Grant access on `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED`, not on the payment.** The
  authorization only activates after the first Pix settles, so it is proof of payment, and it is the
  event that actually carries your identifiers.
- Recurring charges you create later are normal: they keep your `customer` and whatever
  `externalReference` you set. Only the first one is odd.

## 2. Wait for activation

Status goes `CREATED` → `ACTIVE` only after the first Pix settles. `CANCELLED`, `REFUSED`, `EXPIRED`
are the dead ends. No charge can attach to a non-active authorization. Track it by webhook, not polling.

## 3. Create recurring charges (MANUAL mode)

`POST /v3/payments` with `pixAutomaticAuthorizationId`. Without that field you silently get an
ordinary Pix charge that nobody auto-debits.

## Debit behaviour

- First attempt at 07:00 on the due date, then roughly 10h, 13h, 16h, 18h, 19h, 20h the same day.
  All fail → refused for that day. No attempts on later days (separate from `retryPolicy`).
- No balance and no retry left → status `OVERDUE` and a `PAYMENT_OVERDUE` event.
- If the payer pays the charge manually up to the day before it falls due, the automatic instruction
  for that cycle is cancelled to avoid a double debit. The authorization stays active.
- Split: **the two official pages disagree.** The FAQ says split is forbidden on the authorization
  QR code and allowed on the recurring charges; the recipe says the opposite, that split applies only
  to the authorization payment and not to the first instruction after it. Test before relying on it.
- No balance by 20:00 on the due date and the charge goes `REFUSED`.
- A manual payment up to 22:00 the day before cancels that cycle's automatic instruction. After that
  window the payer can end up paying both manually and automatically in the same cycle.

## Webhook payloads: the two doc pages disagree

Verified by reading both. The events reference (`docs/eventos-para-pix-automático`) documents
authorization events as a nested object:

```json
{ "event": "…AUTHORIZATION_ACTIVATED",
  "authorization": { "id": "d51008fa-…", "status": "ACTIVE", "customerId": "cus_…",
                     "immediateQrCode": { "conciliationIdentifier": "…" } } }
```

The webhook-flows page (`docs/fluxos-de-webhook`) documents the same events with a flat
`"pixAutomaticAuthorization": "aut_987654"` plus `"paymentId"`. Read both shapes; trust whichever
arrives.

Instruction events are their own shape again:

```json
{ "event": "…PAYMENT_INSTRUCTION_SCHEDULED",
  "paymentInstruction": { "id": "…", "status": "SCHEDULED", "dueDate": "2024-10-04",
                          "paymentId": "pay_…", "authorization": { "id": "…" } } }
```

## The event that ends a successful renewal is PAYMENT_CONFIRMED

The flows page is explicit: a recurring debit runs
`PAYMENT_CREATED → INSTRUCTION_CREATED → INSTRUCTION_SCHEDULED → **PAYMENT_CONFIRMED**`, while the
first payment ends in `PAYMENT_RECEIVED`. Subscribe to and handle both, or renewals collect money
and grant nothing. `INSTRUCTION_REFUSED` is the failed-debit signal and can arrive before the charge
ever reaches `OVERDUE`, so treat it as non-payment in its own right.

## What the sandbox can and cannot show you

Measured, 2026-08:

- `POST /v3/sandbox/payment/{id}/confirm` on a recurring instruction's charge settles it and fires
  **`PAYMENT_RECEIVED`**, not the `PAYMENT_CONFIRMED` the flow diagram documents for a real automatic
  debit. Handle both events or your renewal works in sandbox and silently fails in production.
- `POST /v3/sandbox/payment/{id}/overdue` fires `PAYMENT_OVERDUE`, never
  `PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED`. The refusal event needs a real debit failing
  at the due date, so the sandbox cannot manufacture it.
- Paying an instruction's charge manually **cancels the instruction**
  (`status: CANCELLED`), which is Asaas avoiding a double debit. Visible in
  `GET /v3/pix/automatic/paymentInstructions`.
- Retries are only for refusals caused by missing balance or limit. An instruction with
  `refusalReason: ERROR` returns *"A situação da instrução de pagamento original não permite agendar
  uma retentativa"*, so the retry path cannot be exercised in sandbox either. A wrong instruction id
  returns 404, which is how you tell a bad path from a refused business rule.

## Webhook events

- `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED` / `_ACTIVATED` — activation is the go-live signal.
- `PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED` / `_SCHEDULED` / `_REFUSED`.
- `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED` — account eligibility changed.
- Plus the ordinary `PAYMENT_*` events on the charges themselves.
