# Sources

Each line names the page opened and the claim it supports. All pages are Asaas's own docs on docs.asaas.com (Portuguese, `.md` form) unless noted. Lines marked "this skill's rule" are advice, not vendor facts. Lines marked "observed in production" come from live integrations and have no docs page.

## Docs tooling

- Asaas, "llms.txt" (docs.asaas.com, 2026) - https://docs.asaas.com/llms.txt - supports: index of per-section indexes for guides, reference, recipes, pages and changelog - checked 2026-11-15
- Asaas, "Docs MCP server" (docs.asaas.com, 2026) - https://docs.asaas.com/mcp - supports: tools `search`, `fetch`, `list-endpoints`, `get-endpoint`, `search-endpoints`, `execute-request`; the full path and method list used in endpoints.md - checked 2026-11-15

## Auth and keys

- Asaas, "Autenticação" (docs.asaas.com, 2026-10-13) - https://docs.asaas.com/docs/autenticação-1.md - supports: `access_token` header; headers JSON; `User-Agent` mandatory for root accounts created from 2024-06-13; base URLs; prefixes `$aact_prod_` and `$aact_hmlg_`; 401 codes `invalid_environment`, `access_token_not_found`, `invalid_access_token_format`, `invalid_access_token` - checked 2026-11-15
- Asaas, "Chaves de API" (docs.asaas.com, 2026-10-13) - https://docs.asaas.com/docs/chaves-de-api.md - supports: key shown once; up to 10 keys; disabled after 3 months, expired after 6; `ACCESS_TOKEN_DISABLED`, `ACCESS_TOKEN_EXPIRING_SOON`, `ACCESS_TOKEN_EXPIRED` - checked 2026-11-15
- Asaas, "Padrão de chave com $ e clientes PHP" (docs.asaas.com, 2026-10-13) - https://docs.asaas.com/docs/padrão-de-chave-com-e-clientes-php.md - supports: the `$` is part of the key; Asaas does not use `Authorization: Bearer` - checked 2026-11-15
- Asaas, "Comece por aqui" (docs.asaas.com, 2026-09-03) - https://docs.asaas.com/reference/comece-por-aqui.md - supports: sandbox and production accounts, data and keys are independent - checked 2026-11-15
- This skill's rule: derive the environment from the key prefix, log it at boot, never log the key, check the prefix at startup - https://docs.asaas.com/docs/autenticação-1.md - supports: the prefixes the check relies on - checked 2026-11-15

## The `.env` quoting table (tested)

- Tested by this skill, Bun 1.4.4, fake key `$aact_hmlg_TEST` in a local `.env`, read with `process.env` - https://bun.com/docs/runtime/environment-variables - supports: bare, double-quoted and single-quoted values arrive empty; `$$aact_…` arrives as `$`; `\$aact_…` arrives intact (the page documents `\$` as the way to stop expansion) - checked 2026-11-15
- Tested by this skill, Docker Compose v5.5.0, same fake key, both `${VAR}` interpolation and `env_file:`, value printed inside a running container - https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/ - supports: bare and double-quoted values arrive empty; `'$aact_…'` and `$$aact_…` arrive intact; `\$aact_…` arrives as `\` (the page documents single-quoted values as literal and interpolation on unquoted and double-quoted values) - checked 2026-11-15

## Choosing a recurring model

- Asaas, "Diferença entre Pix Automático e Assinaturas" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/diferença-entre-pix-automático-e-assinaturas-1.md - supports: a subscription with `billingType = PIX` is not Pix Automático; automatic debit only for card in subscriptions; `MANUAL` default, `SUBSCRIPTION` needs `value` - checked 2026-11-15
- Asaas, "Diferença entre Pix Recorrente e Pix Automático" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/diferença-entre-pix-recorrente-e-pix-automático.md - supports: Pix Recorrente is a transfer the payer schedules, not a charge - checked 2026-11-15
- Asaas, "Pix Recorrente" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/pix-recorrente.md - supports: recurring outbound transfers - checked 2026-11-15
- This skill's rule: pick one recurring strategy per business flow - https://docs.asaas.com/docs/diferença-entre-pix-automático-e-assinaturas-1.md - supports: the two models differ in who creates charges - checked 2026-11-15

## Customers

- Asaas, "Cadastro de clientes" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/criando-um-cliente.md - supports: `POST /v3/customers` before charges; store `cus_…`; reuse the id or list customers first; retries and async queues as duplicate risks; example body - checked 2026-11-15
- Asaas, "Criar novo cliente" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/criar-novo-cliente.md - supports: required `name` and `cpfCnpj`; `phone` is a landline and `mobilePhone` a mobile; `notificationDisabled` turns off charge notifications; `additionalEmails` comma-separated - checked 2026-11-15
- Asaas, "Criando um link de pagamentos" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/criando-um-link-de-pagamentos.md - supports: Asaas allows duplicate CPF/CNPJ customers; a payment link creates the customer on each fill - checked 2026-11-15
- This skill's rule: after a timeout, query before you retry a create - https://docs.asaas.com/docs/criando-um-cliente.md - supports: the duplicate risk it guards against - checked 2026-11-15

## Pix charges and keys

- Asaas, "Cobranças via Pix / QR Code dinâmico" (docs.asaas.com, 2026-10-13) - https://docs.asaas.com/docs/cobrancas-via-pix.md - supports: `POST /v3/lean/payments` and `GET /v3/payments/{id}/pixQrCode`; response fields; QR paid once, expires 12 months after due date; without a key the QR is tied to a partner and payable until 23:59; fetch a new QR after updating the charge; the fallback will end with 30 days' notice - checked 2026-11-15
- Asaas, "Introdução - Pix" (docs.asaas.com, 2026-08-13) - https://docs.asaas.com/docs/pix.md - supports: key creation needs approval and proof of life; without a key processing takes longer; API creates only EVP keys; 5 keys for a person, 20 for a company; 1 minute between creations - checked 2026-11-15
- Asaas, "Criar uma chave" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/criar-uma-chave.md - supports: `POST /v3/pix/addressKeys` with `type` `EVP` only - checked 2026-11-15
- Asaas, "Tentar pagar QR Code Pix no Sandbox sem chave cadastrada = erro 404" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/tentar-pagar-qr-code-pix-no-sandbox-sem-chave-cadastrada-erro-404.md - supports: 404 paying a QR from an account with no key; registering a key does not fix earlier QR codes - checked 2026-11-15
- Asaas, "Criar nova cobrança" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/criar-nova-cobranca.md - supports: required fields; `billingType` values; `description` 500 chars; `pixAutomaticAuthorizationId`; response fields `netValue`, payment `status` enum including `CHARGEBACK_REQUESTED`, `CHARGEBACK_DISPUTE`, `AWAITING_CHARGEBACK_REVERSAL`, `clientPaymentDate` (date the payer paid a boleto), `paymentDate` (settlement in Asaas), `creditDate`, `invoiceUrl`, `transactionReceiptUrl`, `paymentLink` - checked 2026-11-15
- Asaas, "Listar cobranças" (docs.asaas.com MCP `get-endpoint`, 2026) - https://docs.asaas.com/reference/listar-cobrancas.md - supports: `GET /v3/payments` filters `customer`, `subscription`, `status`, `billingType`, `externalReference`, `pixQrCodeId`, date ranges - checked 2026-11-15

## Payment links

- Asaas, "Criando um link de pagamentos" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/criando-um-link-de-pagamentos.md - supports: `POST /v3/paymentLinks`; `chargeType` values; `billingType UNDEFINED` lets the payer choose; `dueDateLimitDays` for boleto; webhook `paymentLink` field; up to 5 images - checked 2026-11-15
- Asaas, "Criar um link de pagamentos" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/criar-um-link-de-pagamentos.md - supports: required `name`, `billingType`, `chargeType`; optional `value`, `externalReference`, `callback`, `notificationEnabled`, `limit` - checked 2026-11-15
- Observed in production, not in the docs: later charges of a subscription created by a payment link can lack `paymentLink` - https://docs.asaas.com/docs/criando-um-link-de-pagamentos.md - supports: only that the docs promise `paymentLink` on link charges - checked 2026-11-15

## Payment ids

- Asaas, "Alteração no formato dos identificadores de cobranças" (docs.asaas.com changelog, 2026) - https://docs.asaas.com/changelog/alteração-no-formato-dos-identificadores-de-cobranças.md - supports: new `pay_<n>_…` format with underscore; 20 characters; sandbox 2026-11-09; production 2026-11-23 to 2026-11-27; both formats coexist; treat ids as opaque - checked 2026-11-15

## Subscriptions

- Asaas, "Criar nova assinatura" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/criar-nova-assinatura.md - supports: required fields; `cycle` values including `BIMONTHLY`; `pixAutomaticAuthorizationMode` (create accepts `DISABLED`; response lists `OPTIONAL`, `REQUIRED`) - checked 2026-11-15
- Asaas, "Criando uma assinatura" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/criando-uma-assinatura.md - supports: creation confirms no payment; `PAYMENT_CREATED` carries `subscription`; `GET /v3/subscriptions/{id}/payments` lists only created charges; `PUT /v3/subscriptions/{id}` and `updatePendingPayments` - checked 2026-11-15
- Asaas, "FAQ - Assinaturas" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/faq-assinaturas.md - supports: charges created 40 days before due by default, configurable to 14 or 7; Pix and boleto are paid by the payer, card is charged on the due date; `INACTIVE` pauses; `DELETE` removes pending and overdue charges; the FAQ's `PUT /subscriptions/{id}/creditCard` - checked 2026-11-15
- Asaas, "Atualiza o cartão de crédito sem efetuar cobrança" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/atualizar-cartao-de-credito-assinatura.md - supports: `POST /v3/subscriptions/{id}/updateCreditCard`; pending charges also updated - checked 2026-11-15
- Asaas, "Eventos para assinaturas" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/eventos-para-assinaturas.md - supports: `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED`, `SUBSCRIPTION_DELETED` and the split events - checked 2026-11-15
- This skill's rule: send reminders from a daily job keyed on `dueDate`, not on `PAYMENT_CREATED` - https://docs.asaas.com/docs/faq-assinaturas.md - supports: the 40-day lead that makes `PAYMENT_CREATED` early - checked 2026-11-15

## Payment events and refunds

- Asaas, "Eventos para cobranças" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/webhook-para-cobrancas.md - supports: meaning of `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED`; refund and chargeback events including `PAYMENT_PARTIALLY_REFUNDED`; flows for Pix, boleto, credit card (32 days) and debit card (3 days); overdue charges still reach `CONFIRMED`; `PAYMENT_RECEIVED_IN_CASH_UNDONE`; the chargeback flow (`CHARGEBACK_REQUESTED`, then `PAYMENT_REFUNDED`, or `CHARGEBACK_DISPUTE` → `AWAITING_CHARGEBACK_REVERSAL` → `CONFIRMED` or `RECEIVED` on the same payment when the merchant wins); new attributes announced by email and Discord - checked 2026-11-15
- Asaas, "Estornos" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/estornos.md - supports: `refunds` array; item statuses `PENDING`, `CANCELLED`, `DONE`; only `DONE` is returned money; several refunds per charge - checked 2026-11-15
- Observed in production, not in the docs: a full Pix refund can arrive as `PAYMENT_PARTIALLY_REFUNDED` because Asaas keeps its fee. One integration's notes say card settlement takes 30 days; the docs say 32 and the skill follows the docs - https://docs.asaas.com/docs/webhook-para-cobrancas.md - supports: only that both events exist - checked 2026-11-15

## Webhooks

- Asaas, "Introdução - Webhooks" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/sobre-os-webhooks.md - supports: `POST` with `id`, `event`; at least once; persist then answer `200`; `asaas-access-token`; do not use an API key as `authToken`; 15 failures; 14-day retention; 10 webhooks per account - checked 2026-11-15
- Asaas, "FAQ de Webhooks" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/faq-de-webhooks.md - supports: only `200` is success; 10-second timeout; same `id` on redelivery; ordering by `sendType`; no Bearer or Basic auth; redirects 301, 302, 307, 308 not followed; JSON body; sandbox may use extra IPs - checked 2026-11-15
- Asaas, "Fila pausada" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/fila-pausada.md - supports: only `200`; `201`, `204`, `3xx` fail; pause per webhook; events kept and sent after reactivation - checked 2026-11-15
- Asaas, "Outros Erros" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/outros-erros.md - supports: delivered only on `200`; redirects not followed; any other code is a failed attempt - checked 2026-11-15
- Asaas, "Penalização de filas" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/penalização-de-filas.md - supports: the retry schedule and alert emails; pause after 15; sequential queues wait behind a penalized event; `POST /v3/webhooks/{id}/removeBackoff` and its strict rate limit; this page says any 2xx counts, as does the API creation guide below - checked 2026-11-15
- Asaas, "Como reativar fila interrompida" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/como-reativar-fila-interrompida.md - supports: reactivate in the panel or with `PUT /v3/webhooks/{id}` and `interrupted: false`; fix the cause first - checked 2026-11-15
- Asaas, "Criar novo Webhook pela API" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/criar-novo-webhook-pela-api.md - supports: `sendType` values; `authToken` 32 to 255 chars, no spaces, no simple sequences, not an API key; token returned only on create; example body with `apiVersion` 3; this page says "2xx" - checked 2026-11-15
- Asaas, "Criar novo webhook" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/criar-novo-webhook.md - supports: required `name`, `url`, `email`, `interrupted`, `enabled`, `events`, `sendType`; full event enum - checked 2026-11-15
- This skill's rule: compare the token in constant time; keep the event list in code and check it with `GET /v3/webhooks` - https://docs.asaas.com/docs/sobre-os-webhooks.md - supports: the header being compared - checked 2026-11-15

## Pix Automático

- Asaas, "Pix Automático" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/pix-automatico.md - supports: Jornada 3; activation needs the payer institution's confirmation; `paymentCreationMode` - checked 2026-11-15
- Asaas, "Implementação" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/pix-automatico-implementacao.md - supports: `MANUAL` charges 2 to 10 business days before due; without `pixAutomaticAuthorizationId` the charge is ordinary Pix; REFUSED after `PAYMENT_RECEIVED` - checked 2026-11-15
- Asaas, "Pix Automático" (docs.asaas.com recipes, 2026) - https://docs.asaas.com/recipes/pix-automático.md - supports: eligibility list; 2 to 10 business days; no balance by 20:00 means `REFUSED`; manual payment by 22:00 the day before cancels the instruction; split not on the initial QR, on each `MANUAL` charge; the authorization is tied to the account that paid the QR - checked 2026-11-15
- Asaas, "FAQ do Pix Automático" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/faq-2.md - supports: paying another way cancels that cycle's instruction; split rules; eligibility event and `ineligibleReasons`; ineligibility can cancel authorizations; refused charge does not cancel authorization; FAQ 11 on `PAYMENT_RECEIVED` then `AUTHORIZATION_REFUSED` and the two ways out; only `ACTIVE` authorizations accept charges - checked 2026-11-15
- Asaas, "Processo de retentativas (Jornada 3 API)" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/pix-automático-processo-de-retentativas-jornada-3-api.md - supports: intraday vs later-date retries; 3R_7D rules; 23:59 the day before; 400 on violations; set at creation only; `purpose` and `retryAttempt`; wait for each result; retries cannot be cancelled alone; manual payment blocked 22:00 D-1 to D; final states after the last retry; overdue invoice payment fires `PAYMENT_CONFIRMED` - checked 2026-11-15
- Asaas, "Criar uma autorização" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/criar-uma-autorizacao-pix-automatico.md - supports: required fields; `frequency` values; `contractId` and `description` max 35; `contractId` described as the code of what is authorized; `minLimitValue` rule; `immediateQrCode` fields; statuses; response fields `payload`, `encodedImage`, `immediateQrCode.conciliationIdentifier` - checked 2026-11-15
- Asaas, "Fluxos de Webhook do Pix Automático" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/fluxos-de-webhook.md - supports: authorization and instruction sequences; recurring debit ends in `PAYMENT_CONFIRMED`; cancellation sequences; do not rely on order alone - checked 2026-11-15
- Asaas, "Eventos para Pix Automático" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/eventos-para-pix-automático.md - supports: the ten event names; QR expiry leads to `REFUSED`; payload shapes under `authorization` and `paymentInstruction`; `cancellationReason` and `cancellationDate`; `EXPIRED` has no reason - checked 2026-11-15
- Observed in production, not in the docs: the payer's bank app shows `description` as "Serviço" and `contractId` as "Código da cobrança"; a second instruction in the same cycle returns 400 `invalid_object`; the first payment's `pixQrCodeId` equals the authorization's `conciliationIdentifier` - https://docs.asaas.com/reference/criar-uma-autorizacao-pix-automatico.md - supports: only the field definitions - checked 2026-11-15
- This skill's rule: readable `contractId`, reconcile by authorization id and `conciliationIdentifier`; QR expiry in hours; cancel abandoned authorizations; own sweep at period end - https://docs.asaas.com/docs/eventos-para-pix-automático.md - supports: the fields and events the rules use - checked 2026-11-15
- This skill's rule: grant the first Pix Automático cycle on the first payment and count renewal as on only after `AUTHORIZATION_ACTIVATED`; link no charges before activation - https://docs.asaas.com/docs/faq-2.md - supports: FAQ 11, the first payment stays received when `AUTHORIZATION_REFUSED` follows, and only `ACTIVE` authorizations accept charges (also the callout on https://docs.asaas.com/docs/fluxos-de-webhook.md) - checked 2026-11-15

## Sandbox

- Asaas, "Sandbox" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/sandbox.md - supports: separate account and key; coverage differs; email and SMS notifications are sent, use only contacts you may use - checked 2026-11-15
- Asaas, "Adicionando saldo em uma conta Sandbox" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/como-adicionar-dinheiro-para-testes.md - supports: confirming a charge adds balance - checked 2026-11-15
- Asaas, "Testar pagamento de QRCodes Pix" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/testar-pagamento-de-qrcodes-pix.md - supports: second sandbox account with balance; `POST /v3/pix/qrCodes/pay` - checked 2026-11-15
- Asaas, "(Apenas sandbox) Confirmar o pagamento" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/confirmar-pagamento.md - supports: `POST /v3/sandbox/payment/{id}/confirm`; the sibling pages give `/overdue` and `/v3/sandbox/myAccount/approve` - checked 2026-11-15
- Asaas, "O que pode ser testado?" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/o-que-pode-ser-testado.md - supports: the coverage list to check before trusting sandbox; discounts, interest and fines on boleto or Pix not testable; WhatsApp not sent - checked 2026-11-15

## Errors, limits, pagination

- Asaas, "Códigos HTTP das respostas" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/codigos-http-das-respostas.md - supports: error body shape; 400, 401, 403, 404 (including an id that belongs to another account), 429 meanings; 25,000 requests per 12 hours; 50 concurrent `GET`; `RateLimit-*` headers - checked 2026-11-15
- Asaas, "Listagem e paginação" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/listagem-e-paginacao.md - supports: `limit` 1 to 100, `offset`, `hasMore` - checked 2026-11-15

## Subaccounts and split

- Asaas, "Subcontas" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/subcontas.md - supports: BaaS and non-BaaS models; PJ parents only - checked 2026-11-15
- Asaas, "Criação de subcontas" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/criacao-de-subcontas.md - supports: PJ only; evaluation period of 10 subaccounts, R$ 2.000 each, 60 days, and the block after it; 20 per day in sandbox; `apiKey` shown once and `walletId`; `webhooks` field on create - checked 2026-11-15
- Asaas, "Criar subconta" (docs.asaas.com, 2026) - https://docs.asaas.com/reference/criar-subconta.md - supports: `POST /v3/accounts` and its required fields - checked 2026-11-15
- Asaas, "Gerenciamento das chaves de API de subcontas" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/gerenciamento-de-chaves-de-api-de-subcontas.md - supports: `/v3/accounts/{id}/accessTokens` endpoints - checked 2026-11-15
- Asaas, "Introdução - Split de pagamento" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/split-de-pagamentos.md - supports: split blocked until enabled, `invalid_action`; computed on `netValue`; 100% and net-value caps; own `walletId` not allowed; refunds reverse splits - checked 2026-11-15
- Asaas, "Introduction - Payment Split" (docs.asaas.com, 2026-11-03) - https://docs.asaas.com/docs/payment-split-overview.md - supports: the English page exists under that slug - checked 2026-11-15
- Asaas, "Split de pagamento: habilitação obrigatória antes da primeira criação" (docs.asaas.com changelog, 2026) - https://docs.asaas.com/changelog/split-de-pagamento-habilitação-obrigatória-antes-da-primeira-criação.md - supports: enable in Integrações > Segurança with SMS or Token App; root enabling covers subaccounts - checked 2026-11-15
- Asaas, "FAQ do Split" (docs.asaas.com, 2026) - https://docs.asaas.com/docs/faq-do-split.md - supports: no recipient count limit; refunds reverse splits - checked 2026-11-15

## Integration practices

- This skill's rule: every item in `references/integration-practices.md` (token check and `401` before storing, persist before `200`, own retry sweep, `503` on missing config, state machine with chargeback suspend and restore after a status check, partial refunds summed from `refunds` against `netValue` with a sweep for `PENDING` items, intent rows with state, lease, a unique `externalReference` and an exact-match lookup before create, no lock across calls, 404 as done only for ids made with the same key, São Paulo dates, renewal alerts, offline tests, CPF/CNPJ out of logs) - https://docs.asaas.com/docs/outros-erros.md - supports: `200` means delivered and any other code is retried; the chargeback flow, `refunds` array, `externalReference` filter and the 404 meaning are cited in their own lines above - checked 2026-11-15
