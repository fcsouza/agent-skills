# Asaas endpoints

Base: `https://api-sandbox.asaas.com/v3` (sandbox) or `https://api.asaas.com/v3` (production). Full reference: https://docs.asaas.com/reference (append `.md` to any page). The docs MCP `list-endpoints` tool returns every path and method.

## Customers
- `POST /customers`: create. Required `name`, `cpfCnpj`. Optional `email`, `mobilePhone` (mobile), `phone` (landline), `externalReference`, `notificationDisabled`, `additionalEmails` (comma-separated). Returns `cus_…`.
- `GET /customers`: list and search. Duplicate CPF/CNPJ is allowed, so search before you create.
- `GET /customers/{id}`, `PUT /customers/{id}` (update), `DELETE /customers/{id}`, `POST /customers/{id}/restore`.

## Payments (charges)
- `POST /payments`: full response. `POST /lean/payments`: trimmed response; the Pix guide uses it.
  Required `customer`, `billingType` (`PIX`, `BOLETO`, `CREDIT_CARD`, `UNDEFINED`), `value`, `dueDate`.
  Optional `description` (500 chars), `externalReference`, `split`, `callback`, `pixAutomaticAuthorizationId`.
- `GET /payments/{id}/pixQrCode`: `encodedImage` (base64), `payload` (copia e cola), `expirationDate`.
- `GET /payments`: list, filter by `customer`, `subscription`, `status`, `billingType`, `externalReference`, `pixQrCodeId`, and date ranges such as `dueDate[ge]`, `dueDate[le]`, `paymentDate[ge]`.
- `GET /payments/{id}`, `PUT /payments/{id}`, `DELETE /payments/{id}`, `POST /payments/{id}/restore`, `POST /payments/{id}/refund`.
- Response fields worth storing: `netValue` (after the Asaas fee), `paymentDate`, `clientPaymentDate` (when the payer paid a boleto), `creditDate`, `invoiceUrl`, `transactionReceiptUrl`, `paymentLink`, `subscription`.
- A refunded charge returns a `refunds` array. Count an item as returned only when its `status` is `DONE`; a charge can have several.

## Payment links
- `POST /paymentLinks`: `name`, `billingType` (`UNDEFINED` lets the payer choose), `chargeType` (`DETACHED`, `INSTALLMENT`, `RECURRENT`), optional `value` (omit it to let the payer type the amount), `dueDateLimitDays` (send it when boleto is allowed), `maxInstallmentCount`, `subscriptionCycle`, `externalReference`, `callback`, `notificationEnabled`, `limit`.
- `GET /paymentLinks`, `GET|PUT|DELETE /paymentLinks/{id}`, `POST /paymentLinks/{id}/images` (up to 5).

## Subscriptions
- `POST /subscriptions`: required `customer`, `billingType`, `value`, `nextDueDate`, `cycle`. Optional `description`, `externalReference`, `endDate`, `maxPayments`, `split`, `pixAutomaticAuthorizationMode`. On 2026-11-15 the create schema accepts only `DISABLED` for that mode; the response schema also lists `OPTIONAL` and `REQUIRED`.
- `GET /subscriptions/{id}/payments`: the charges already created.
- `PUT /subscriptions/{id}`: update (`updatePendingPayments: true` also rewrites pending charges; `status: INACTIVE` pauses).
- `DELETE /subscriptions/{id}`: cancel; also removes its pending and overdue charges. `GET /subscriptions`: list.
- `POST /subscriptions/{id}/updateCreditCard`: swap the card without charging; pending charges get the new card too. The subscriptions FAQ shows `PUT /subscriptions/{id}/creditCard` instead; the reference and `list-endpoints` say `POST …/updateCreditCard`.

## Webhooks
- `POST /webhooks`: required `name`, `url`, `email`, `enabled`, `interrupted`, `sendType`, `events[]`; send `apiVersion` 3 and `authToken` (32 to 255 chars).
- `GET /webhooks`, `GET /webhooks/{id}`, `PUT /webhooks/{id}` (`interrupted: false` restarts a paused queue), `DELETE /webhooks/{id}`, `POST /webhooks/{id}/removeBackoff`.
- Inbound requests carry your `authToken` in the `asaas-access-token` header.

## Pix
- `POST /pix/addressKeys`: register a key, `{"type":"EVP"}` only. Needs the account fully approved with proof of life done.
- `GET /pix/addressKeys`, `GET|DELETE /pix/addressKeys/{id}`.
- `POST /pix/qrCodes/pay`: pay a QR code (sandbox testing uses it).

## Pix Automático
- `POST /pix/automatic/authorizations`: create the authorization and its immediate QR code.
- `GET /pix/automatic/authorizations`, `GET /pix/automatic/authorizations/{id}`.
- `DELETE /pix/automatic/authorizations/{id}`: cancel; ends future debits.
- `GET /pix/automatic/paymentInstructions`, `GET /pix/automatic/paymentInstructions/{id}`.
- `POST /pix/automatic/paymentInstructions/{id}/retries`: one later-date retry, body `{"dueDate":"YYYY-MM-DD"}`. Rule 3R_7D; see `references/pix-automatico.md`.
- Recurring charge in `MANUAL` mode: `POST /payments` with `pixAutomaticAuthorizationId`.

## Pix Recorrente (outbound transfers)
- `GET /pix/transactions/recurrings`, `GET /pix/transactions/recurrings/{id}`, `POST /pix/transactions/recurrings/{id}/cancel`.

## Subaccounts
- `POST /accounts`: required `name`, `email`, `cpfCnpj`, `mobilePhone`, `incomeValue`, `address`, `addressNumber`, `province`, `postalCode`. Returns `apiKey` (once) and `walletId`.
- `GET /accounts`, `GET /accounts/{id}`, `GET|POST /accounts/{id}/accessTokens`, `PUT|DELETE /accounts/{id}/accessTokens/{accessTokenId}`.

## Sandbox only
- `POST /sandbox/payment/{id}/confirm`: mark a charge paid.
- `POST /sandbox/payment/{id}/overdue`: force a charge overdue.
- `POST /sandbox/myAccount/approve`: approve the test account.

## Errors and limits
`{"errors":[{"code":"invalid_access_token","description":"..."}]}`. 400 for validation (several items can come back), 401 for auth, 403 for permission or an IP outside the allowlist (also a `GET` sent with a body), 404 for a missing resource or one in another account, 429 for limits.

Limits: 25,000 requests per 12 hours per account, 50 concurrent `GET` requests, and per-endpoint rate limits reported in `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`.
