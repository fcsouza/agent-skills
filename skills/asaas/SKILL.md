---
name: asaas
description: >-
  Use when building or debugging an integration with the Asaas payment API (Brazil): Pix charges and QR codes, Pix Automático recurring debit, subscriptions, payment links, boleto, card, customers, refunds, webhooks or a paused webhook queue, or a `$aact_` API key that arrives empty. Also use when the user says Asaas, cobrança, assinatura via Pix, QR code copia e cola, asaas-access-token, subconta or split de pagamento.
---

# Asaas API

Brazilian payment provider. REST and JSON, one API key per environment. Every claim below is traced in `references/sources.md`. Lines marked "this skill's rule" are advice, not vendor facts. Lines marked "inference" follow from a doc line, but no page states them outright. Lines marked "observed in production, not in the docs" or "observed in sandbox, not in the docs" come from live integrations and may change without notice.

The docs serve Markdown: append `.md` to any `docs.asaas.com/docs/<page>` or `/reference/<page>` URL. `https://docs.asaas.com/llms.txt` indexes the per-section indexes (`/docs/llms.txt`, `/reference/llms.txt`, `/recipes/llms.txt`, `/changelog/llms.txt`). The docs MCP server at `https://docs.asaas.com/mcp` has six tools: `search`, `fetch`, `list-endpoints`, `get-endpoint`, `search-endpoints` and `execute-request`. Read the guide page before you write code. The guide pages carry rules the reference pages leave out, and some pages still contradict each other.

## Auth and environments

| Environment | Base URL |
| --- | --- |
| Sandbox | `https://api-sandbox.asaas.com/v3` |
| Production | `https://api.asaas.com/v3` |

```json
{ "Content-Type": "application/json", "User-Agent": "your-app-name", "access_token": "$aact_..." }
```

- The key goes in the `access_token` header. Asaas does not use `Authorization: Bearer`.
- `User-Agent` is mandatory for root accounts created from 2024-06-13 on.
- Sandbox keys start `$aact_hmlg_`, production keys `$aact_prod_`. A key sent to the wrong environment returns 401 `invalid_environment`. Accounts, data and keys are separate per environment.
- Other 401 codes: `access_token_not_found`, `invalid_access_token_format`, `invalid_access_token`.
- The key is shown once. An account holds up to 10 keys. An unused key is disabled after 3 months (you can re-enable it) and expires for good after 6 months. Events `ACCESS_TOKEN_DISABLED`, `ACCESS_TOKEN_EXPIRING_SOON` and `ACCESS_TOKEN_EXPIRED` warn you.
- This skill's rule: derive the environment from the key prefix and log at boot which environment the deploy charges. Never log the key.

### The `$` in the key

The `$` is part of the key. `.env` loaders read `$aact_…` as a variable reference and substitute an empty string. The key then arrives empty, and code that treats "no key" as "feature off" goes quiet with no error. Tested on 2026-11-15 with Bun 1.4.4 and Docker Compose v5.5.0, using the fake key `$aact_hmlg_TEST`:

| Where | bare `$aact_…` | `"$aact_…"` | `'$aact_…'` | `$$aact_…` | `\$aact_…` |
| --- | --- | --- | --- | --- | --- |
| Bun, local `.env` | empty | empty | **empty** | `$` | **works** |
| Docker Compose `.env` (interpolation and `env_file:`) | empty | empty | **works** | **works** | `\` |

Single quotes work in Compose and fail in Bun. A backslash works in Bun and fails in Compose. This skill's rule: check the key's prefix at startup and fail loudly when it is missing or malformed.

An unset variable empties the key a second way. In Compose, `${VAR:-default}` gives the default when `VAR` is unset or empty. So `ASAAS_API_KEY: ${ASAAS_API_KEY:-}` hands the container the variable set to `''`, not unset (tested with Compose v5.5.0). Code defaults such as `process.env.X ?? fallback` then never apply, because `''` is not `undefined`.

This skill's rule: turn `''` into `undefined` when you read the environment, and also fail at startup when the key is empty while any other Asaas setting (base URL, webhook token) is set. Without that check, the normalising step turns a key the `$` trap emptied into "Asaas off".

For a service that cannot run without the key, `${ASAAS_API_KEY:?error}` makes Compose refuse to start.

## Choosing how to charge on a schedule

Three products sound alike. Only one is a recurring Pix debit.

| | Assinatura (`/subscriptions`), `billingType: PIX` | Pix Automático | Pix Recorrente |
| --- | --- | --- | --- |
| What it is | Asaas creates a new charge each cycle | Recurring debit the payer authorized once | A recurring outbound transfer the payer schedules |
| Automatic debit | No for Pix and boleto; card is charged on the due date | Yes, while the authorization is `ACTIVE` | It is a transfer, not a charge |
| Who creates each charge | Asaas | Your code (`MANUAL`, default) or Asaas (`SUBSCRIPTION`) | n/a |
| First payment | First charge of the subscription | One QR code pays and authorizes | n/a |

A Pix subscription is not Pix Automático: the payer must pay each charge. Pix Automático needs a PJ account with a CNPJ active for at least 6 months. Read `references/pix-automatico.md` before you build on it. This skill's rule: pick one strategy per business flow.

## Customers

`POST /v3/customers` before any charge. `name` and `cpfCnpj` are the required fields, so a product that adds Asaas must collect and store a tax id.

```json
{ "name": "Marcelo Almeida", "cpfCnpj": "24971563792", "externalReference": "user_123" }
```

- The response holds `cus_…`. Store it.
- Asaas accepts two customers with the same CPF/CNPJ. Reuse the stored id or list customers before you create one. This skill's rule: after a timeout, query before you retry.
- `notificationDisabled: true` stops Asaas's own charge notifications. Set it when you send your own.
- `mobilePhone` is the mobile number; `phone` is a landline.

## One-off Pix charge

```http
POST /v3/lean/payments
{ "customer": "cus_…", "billingType": "PIX", "value": 100.90, "dueDate": "2027-01-15" }

GET /v3/payments/{id}/pixQrCode   → encodedImage (base64), payload (copia e cola), expirationDate
```

The dynamic QR code can be paid once and expires 12 months after the charge's due date.

Register a Pix key on the account: `POST /v3/pix/addressKeys` with `{"type":"EVP"}` (the API creates only random keys). Without a key, Asaas ties the QR code to a partner institution, it is payable only until 23:59 that day, and processing takes longer. Asaas says this fallback will end, with 30 days' notice. Creating a key needs the account fully approved and proof of life done. Limits: 5 keys for a person, 20 for a company, one minute between creations.

- If you update the charge, fetch a new QR code.
- `expirationDate` has no offset: the reference types it `date-time` and its example is `2022-06-24 23:59:59`. No page names the time zone. Observed in production, not in the docs: Asaas datetimes in this format are Brasília time. Parse them as such; see "Dates" in `references/integration-practices.md`.
- The sandbox 404 page says a key registered later does not fix QR codes made before it. Create a new charge.

## Payment links

`POST /v3/paymentLinks` creates a hosted page. `chargeType` is `DETACHED` (one charge per payer), `INSTALLMENT` or `RECURRENT` (creates a subscription). `billingType: UNDEFINED` lets the payer choose the method. The link creates the customer when the payer fills it in, so a returning payer becomes a duplicate customer. Charges from a link carry `paymentLink` in the webhook payload. Observed in production, not in the docs: later charges of a subscription created by a link can lack `paymentLink`; read the subscription to tie them back.

## Payment ids

From 2026-11-09 in sandbox and 2026-11-23 to 2026-11-27 in production, new payment ids gain a numeric segment and an underscore: `pay_1_a1B2c3D4e5F6g7` beside the old `pay_a1B2c3D4e5F6g7H8`. Both stay 20 characters and both formats coexist. Treat ids as opaque strings. Check regexes, fixed-position parsing and column constraints.

## Subscriptions

```http
POST /v3/subscriptions
{ "customer": "cus_…", "billingType": "PIX", "nextDueDate": "2027-01-15",
  "value": 19.90, "cycle": "MONTHLY", "description": "Plano Pró" }
```

- `cycle`: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `BIMONTHLY`, `QUARTERLY`, `SEMIANNUALLY`, `YEARLY`.
- `nextDueDate` is the first due date. Creating the subscription confirms no payment.
- Each charge is created 40 days before its due date by default; the account can set 14 or 7. Follow them with `PAYMENT_CREATED` (it carries `subscription`) or `GET /v3/subscriptions/{id}/payments`, which lists only charges already created. This skill's rule: send reminders from your own daily job keyed on `dueDate`, not on `PAYMENT_CREATED`, which fires weeks early.
- `PUT /v3/subscriptions/{id}` changes future charges. Add `updatePendingPayments: true` to change pending ones too.
- `status: INACTIVE` pauses it and fires `SUBSCRIPTION_INACTIVATED`. `DELETE` ends it, fires `SUBSCRIPTION_DELETED` and also removes its pending and overdue charges.

## Webhooks

Read `references/webhooks.md` before you point Asaas at an endpoint. In short: return HTTP `200`. The FAQ and the paused-queue page accept only `200`; the queue-penalty page says any 2xx, so `200` is the only safe answer. Answer within 10 seconds. Redirects are not followed. An event that got `200` counts as delivered and leaves the retry cycle, so do not count on a second delivery. 15 consecutive failures pause that webhook's queue, and queued events are deleted after 14 days. Asaas sends the `authToken` you set in the `asaas-access-token` header.

Payment events worth handling:

- `PAYMENT_CREATED`: a charge exists. A subscription cycle shows up this way.
- `PAYMENT_RECEIVED`: paid and available in the account. For an ordinary Pix charge this is the money event.
- `PAYMENT_CONFIRMED`: paid, balance not yet available. Card and boleto, and the success event of a Pix Automático recurring debit.
- `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_RECEIVED_IN_CASH_UNDONE`: money going back. Observed in production, not in the docs: a full Pix refund can arrive as `PAYMENT_PARTIALLY_REFUNDED`, because Asaas keeps its fee. This skill's rule: on a partial refund, sum the `DONE` and `PENDING` items in the payment's `refunds` array and revoke in full only when the sum reaches `netValue`; see `references/integration-practices.md`.
- `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`: a chargeback. It ends in `PAYMENT_REFUNDED` if the payer wins, or in `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` on the same payment id if the merchant wins. This skill's rule: suspend, do not revoke, while it is open.
- `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_RESTORED`, `PAYMENT_UPDATED`.

Flows: Pix `PAYMENT_CREATED → PAYMENT_RECEIVED`, with `PAYMENT_OVERDUE` between them when late. Boleto inserts `PAYMENT_CONFIRMED` before `PAYMENT_RECEIVED`. Credit card waits 32 days between the two, debit card 3. An overdue charge can still be paid.

## Building the integration

`references/integration-practices.md` holds this skill's rules for the code around the API: persisting events before the `200` and running your own retry sweep, a payment state machine with chargeback suspend and restore, partial refunds, charge-creation idempotency, deleting the Asaas charge before staff change it by hand, no database lock across an Asaas call, 404 and missing-config handling, which error messages to show users, São Paulo dates and zoneless datetimes, per-seat price sync, renewal-job alerts, tests without the network, and keeping CPF/CNPJ out of logs.

## Sandbox

Create a separate account at `sandbox.asaas.com` and a sandbox key. Coverage differs from production: check "O que pode ser testado" before you trust a green sandbox run. For example, discounts, interest and fines on boleto or Pix cannot be tested there, and WhatsApp notices are not sent.

```http
POST /v3/sandbox/payment/{id}/confirm    (marks a charge paid; also how you add test balance)
POST /v3/sandbox/payment/{id}/overdue    (forces a charge overdue)
POST /v3/sandbox/myAccount/approve       (approves the sandbox account)
```

Observed in sandbox, not in the docs: `/sandbox/payment/{id}/confirm` settles the charge as a boleto, and refunds work only for Pix and card. So a charge confirmed through `/confirm` cannot be refunded in sandbox, splits included. Paying the QR code from a second sandbox account (below) may settle it as Pix; that path was not tried.

To pay a Pix QR code with `POST /v3/pix/qrCodes/pay`, use a second sandbox account that holds a balance. A QR code from an account with no Pix key can return 404. Email and SMS notifications do go out in sandbox, so use only addresses and numbers you may use.

## Subaccounts and payment split

A marketplace gives each seller a subaccount (`POST /v3/accounts`, root key) and splits each charge's net value between Asaas accounts by `walletId`. Read `references/subaccounts-and-split.md` before you build it. The points that break integrations:

- Only PJ (CNPJ) accounts can create subaccounts. The first production subaccount starts an evaluation period: up to 10 subaccounts, R$ 2.000 of charges per subaccount, 60 days at most. Past any limit, new subaccounts, charges, subscriptions and payment links are blocked until Asaas approves the operation. Sandbox allows 20 subaccounts per day.
- The create response returns the subaccount's API key once, its `walletId` and its `id`. The guides put the key at `apiKey`; the reference schema puts it at `accessToken.apiKey`. Store all three at once.
- After the evaluation period, the docs tie further use of subaccount keys to BaaS, or to branches that share the root's CNPJ prefix. One page says this of the keys, another of key management. Confirm with Asaas before a non-BaaS marketplace issues charges with seller keys.
- Track onboarding with the `ACCOUNT_STATUS_*` webhooks; the account is approved when `general` is `APPROVED`. Each subaccount has its own webhooks; tell sellers apart by `account.id`, or by a tenant id in each subaccount's webhook URL.
- Split is blocked until the root account enables it in Integrações > Segurança. Until then a request with `split` returns `invalid_action`.
- Split uses `netValue`, after fees. Percentages may not exceed 100%; the total may not exceed the net value. Never list the issuing account's own `walletId`: the remainder stays with whoever issued the charge, so the issuing key sets which way the money flows (inference).
- A refund reverses the splits; `splitRefunds` sets how much each recipient returns. A subscription whose split outgrows the net value is blocked; if you do not fix it within 2 business days, it resumes with no split.

## Pitfalls

- Do not send the key in `Authorization`. Use `access_token`.
- Do not trust a quoted `.env` value without a startup check. The quote that works depends on the loader.
- Do not call a Pix subscription auto-debit. Only card subscriptions and Pix Automático debit by themselves.
- Do not generate Pix QR codes on an account with no Pix key.
- Do not validate payment ids with a pattern. New ids contain an underscore.
- Do not return `201` or `204` from a webhook handler, and do not let the URL redirect.
- Do not answer `200` before the event is stored. A `200` ends Asaas's retries for that event.
- Do not link new Pix Automático charges to an authorization before `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED`. `PAYMENT_RECEIVED` on the first QR code means the first payment arrived, not that the authorization is active.
- Do not handle only `PAYMENT_RECEIVED`. Pix Automático renewals end in `PAYMENT_CONFIRMED`.

## Files

- `references/pix-automatico.md`: read before you build Pix Automático. Authorization, eligibility, the first payment, retries, `paymentCreationMode`, events.
- `references/webhooks.md`: read before you register a webhook or debug a paused queue. Delivery contract, retry schedule, penalties, ordering.
- `references/integration-practices.md`: read when you write the webhook handler, the grant logic, manual charge edits, the renewal or price-sync job, error messages or the tests.
- `references/subaccounts-and-split.md`: read before you create a subaccount, send `split`, or handle a seller's onboarding, refund or payout. Creation, storing and encrypting keys, onboarding, keys, webhook routing, split rules, refunds, events, withdrawal validation, evaluation limits.
- `references/endpoints.md`: read when you need an endpoint, its method or its payload fields.
- `references/sources.md`: read when you need the page behind a claim or want to recheck one.
