# Asaas endpoints

Base: `https://api-sandbox.asaas.com/v3` (sandbox) / `https://api.asaas.com/v3` (prod).
Full reference: https://docs.asaas.com/reference — append `.md` to any page for markdown.

## Customers
- `POST /customers` — create. Body: `name`, `cpfCnpj` (required), `email`, `mobilePhone`, `externalReference`, `notificationDisabled`, `additionalEmails`. Returns `cus_...`.
- `GET /customers` — list/search (use before creating, to avoid duplicates).
- `GET /customers/{id}`, `POST /customers/{id}` (update), `DELETE /customers/{id}`.

## Payments (charges)
- `POST /payments` — full response. `POST /lean/payments` — trimmed response, preferred for Pix.
  Body: `customer`, `billingType` (`PIX` | `BOLETO` | `CREDIT_CARD` | `UNDEFINED`), `value`, `dueDate`,
  optional `description`, `externalReference`, `split`.
- `GET /payments/{id}/pixQrCode` — `encodedImage` (base64), `payload` (copia e cola), `expirationDate`.
- `GET /payments` — list, filterable by `customer`, `subscription`, `status`, date ranges.
- `DELETE /payments/{id}`, `POST /payments/{id}/refund`.

## Subscriptions
- `POST /subscriptions` — `customer`, `billingType`, `value`, `cycle`, `nextDueDate`, `description`,
  `externalReference`, optional `endDate`, `maxPayments`.
- `GET /subscriptions/{id}/payments` — the charges this subscription generated.
- `POST /subscriptions/{id}` — update (`updatePendingPayments: true` to also rewrite pending charges).
- `DELETE /subscriptions/{id}` — cancel. `GET /subscriptions` — list.

## Webhooks
- `POST /webhooks` — `name`, `url`, `email`, `enabled`, `interrupted`, `authToken`, `sendType`, `events[]`.
- `GET /webhooks`, `PUT /webhooks/{id}` (send `interrupted: false` to restart a paused queue), `DELETE /webhooks/{id}`.
- Inbound requests carry your `authToken` in the `asaas-access-token` header.

## Pix
- `POST /pix/addressKeys` — register a Pix key (do this; QR codes without one expire same-day).
  Needs the account fully approved with proof of life completed.
- `GET /pix/addressKeys` — list keys.

## Pix Automático
- `POST /pix/automatic/authorizations` — create the authorization + immediate QR code.
- `GET /pix/automatic/authorizations` / `/{id}` — list / retrieve.
- `DELETE /pix/automatic/authorizations/{id}` — cancel (kills future debits).
- `POST /pix/automatic/paymentInstructions/{id}/retries` — command one extra-day retry,
  body `{"dueDate":"YYYY-MM-DD"}`. Rule 3R_7D; see references/pix-automatico.md.
- Recurring charge: `POST /payments` with `pixAutomaticAuthorizationId`.

## Sandbox only
- `POST /sandbox/payment/{id}/confirm` — mark a charge paid.
- `POST /sandbox/payment/{id}/overdue` — force a charge overdue.
- `POST /sandbox/myAccount/approve` — approve the test account.

## Errors
`{"errors":[{"code":"invalid_access_token","description":"..."}]}` — 401 for auth, 400 for validation.
