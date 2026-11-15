# Subaccounts and payment split

How a marketplace charges on behalf of sellers and splits the money. Read this before you create a subaccount or send `split`. Every claim is traced in `references/sources.md`, checked 2026-11-15. Lines marked "this skill's rule" are advice, not vendor facts. Lines marked "inference" follow from a doc line, but no page states them outright.

## The model

Each seller gets a subaccount (subconta) under your root account (conta-pai). A subaccount has its own customers, charges, transfers, balance and settings. Split moves part of a charge's net value to other Asaas accounts, named by `walletId`. The charge stays in the account that issued it, and whatever the split does not hand out stays there too.

Split pays only Asaas accounts. Each recipient needs one, so a seller you pay by split needs a subaccount or an Asaas account of their own. The seller's share lands in that account's Asaas balance (`INTERNAL_TRANSFER_CREDIT`, type `SPLIT`); moving it to a bank is a separate transfer from that account.

## 1. Create the subaccount

Only a PJ (CNPJ) root account can create subaccounts. A CPF account cannot.

Pick the model first. The API call is the same; onboarding differs.

| | Non-BaaS | BaaS (formerly "White Label") |
| --- | --- | --- |
| Seller's access | Logs in to Asaas after setting a password | Uses your product; never sees the Asaas dashboard |
| Documents | Seller sends them in the Asaas interface | Your product sends them, by `onboardingUrl` or the API |
| Asaas emails the seller | Yes, an activation email | No |
| Setup | None | Your account manager must enable BaaS first; creating accounts without it does not make them BaaS |

Under the new rules, every screen, receipt, onboarding step and contract you show the seller must carry Asaas's brand, links and liability text. The approval-flow page states this for both models, inside the evaluation-period notice; Asaas sends a playbook.

### Request

`POST /v3/accounts`, with the root key.

| Field | Notes |
| --- | --- |
| `name`, `email`, `cpfCnpj`, `mobilePhone`, `incomeValue`, `address`, `addressNumber`, `province`, `postalCode` | Required by the reference |
| `incomeValue` | Monthly income (PF) or revenue (PJ). Required; the guides stress it |
| `birthDate` | PF seller only |
| `companyType` | PJ seller only: `MEI`, `LIMITED`, `INDIVIDUAL`, `ASSOCIATION` |
| `taxRegime` | PJ seller only, optional: `MEI`, `NATIONAL_SIMPLE`, `NORMAL_REGIME`, `UNKNOWN` |
| `postalCode` | Must be a real CEP. Asaas looks up the city from it and returns `400` when it cannot |
| `loginEmail` | Optional; defaults to `email` |
| `phone`, `complement`, `site` | Optional |
| `webhooks` | Optional array of webhook configs, created with the account. See section 4 |

The guide's PJ example:

```json
{
  "name": "Subconta criada via API",
  "email": "emaildaempresa@gmail.com",
  "cpfCnpj": "66625514000140",
  "incomeValue": 25000,
  "companyType": "MEI",
  "taxRegime": "MEI",
  "phone": "11 32300606",
  "mobilePhone": "11 993367861",
  "address": "Av. Rolf Wiest",
  "addressNumber": "277",
  "complement": "Sala 502",
  "province": "Bom Retiro",
  "postalCode": "89223005"
}
```

The recipe's example sends `birthDate` together with `companyType: MEI`, which the guide says not to do. Follow the guide: `birthDate` for a PF seller, `companyType` for a PJ seller.

### Response

The response carries the subaccount `id`, its `walletId`, `accountNumber` (`agency`, `account`, `accountDigit`), `personType` (`FISICA` or `JURIDICA`), `commercialInfoExpiration` and the API key.

Where the key sits is unclear. The guides, and the prose of the reference page itself, say the response has `apiKey`. The same reference page's schema has no top-level `apiKey`; it puts the key at `accessToken.apiKey`, beside `accessToken.id`, `enabled`, `expirationDate` and `disabledReason`. This skill's rule: read both paths, fail loudly when neither holds a value, and test against sandbox before you rely on one.

The key is shown once and cannot be fetched later.

### Storing what comes back

- Store `id`, `walletId` and the key at once, tied to the seller's row in your database. The guides ask for a secrets store and no key in logs or admin screens.
- This skill's rule: write the seller row with a pending state before the call, then fill in the ids. After a timeout, look the seller up with `GET /v3/accounts?cpfCnpj=…` (it also filters by `email`, `name` and `walletId`) before you retry; creating twice probably gives the seller two accounts (inference: the docs name no duplicate check). The lookup returns `id` and `walletId` but no key, so a key lost in a crash can only be replaced through key management (section 3), which the docs frame as a BaaS feature.
- Subaccount creation can carry a fee; see Configurações de Conta > Taxas. A non-BaaS subaccount closed within 48 hours of creation, that never logged in, is closed without that fee (`DELETE /v3/accounts/{id}`, root key). After 48 hours that path is gone. The call needs the IP allowlist on with your server's IP, and "Validação de encerramento de subcontas pela API" enabled in Integrações > Segurança, confirmed with a token. Closing is irreversible.

## 2. Onboarding and approval

### Non-BaaS

Asaas emails the seller an activation link. The seller sets a password and sends documents (usually an ID and a selfie) in the Asaas interface. `POST /v3/accounts/{id}/resendActivationLink` resends the email.

### BaaS

1. Wait at least 15 seconds after creation. Asaas is still checking the CNPJ/CPF with Receita Federal; ask sooner and it lists documents that are not needed.
2. `GET /v3/myAccount/documents` lists the document groups: `id`, `status`, `type`, `description`, `onboardingUrl`, `documents`. The `myAccount` endpoints act on the account that owns the key, and the recipe lists the subaccount `apiKey` as a prerequisite, so call them with the subaccount's key (inference).
3. A group with `onboardingUrl`: send the seller to that link. It takes the documents and, when needed, the selfie. Never upload that group through the API; Asaas rejects it. A rejected document gets a new link.
4. A group without `onboardingUrl`: `POST /v3/myAccount/documents/{id}` with the group `id`. One valid file per group; a new upload replaces and expires the old one. The upload returns a file `id` for `GET|POST|DELETE /v3/myAccount/documents/files/{id}`.
5. Asaas may open extra groups with `type: CUSTOM` and a `description`. Associations can need more documents, such as the election minutes.
6. Analysis takes up to 48 hours.

### Tracking approval

`GET /v3/myAccount/status` returns four dimensions: `commercialInfo`, `bankAccountInfo`, `documentation`, `general`. The account is fully approved when `general` is `APPROVED`. Prefer the account-status webhooks (section 4) to polling.

To fix rejected commercial data, `POST /v3/myAccount/commercialInfo` with every field again; `incomeValue` is required and some changes start a new analysis.

### What works before approval

The docs do not give one list of what is blocked before `general` is `APPROVED`. What they do say:

- In link onboarding, proof of life is the selfie. The account starts out able to create charges and make transfers, and about 90% of selfies are approved within 5 minutes.
- Pending registration items can bring temporary blocks, limits on money movement and `403` on financial endpoints.
- A Pix key needs the account fully approved with proof of life done (see `SKILL.md`), and a charge's QR code falls back to a partner institution without one.
- Asaas runs checks when a split settles. A changelog adds the cancellation reasons `BANK_ACCOUNT_AWAITING_AUTHORIZATION`, `BANK_ACCOUNT_PENDING`, `BANK_ACCOUNT_REJECTED`, `CUSTOMER_DOCUMENTS_PENDING`, `CUSTOMER_DOCUMENTS_REJECTED` and `CHECKOUT_VALIDATION_FAILED` for failures found in those checks, beside the existing `WALLET_UNABLE_TO_RECEIVE`. They can arrive in `PAYMENT_SPLIT_CANCELLED`, and integrations must accept them by 2026-11-25. The changelog does not say whose bank account or documents are checked; the names suggest a split to a seller with pending registration can be cancelled at settlement. Subscription splits are not affected.

This skill's rule: do not route money to a seller until `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED` arrives, and do not create a seller's Pix key or QR codes before it.

### Annual confirmation

Subaccounts must confirm or update their commercial data every year.

- `ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON` arrives 40 days before `scheduledDate` (in `additionalInfo.scheduledDate`).
- Confirm with `GET` then `POST /v3/myAccount/commercialInfo/`, using the subaccount's key and sending every field. A new `scheduledDate` one year out comes back.
- Past the date, `ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED` fires and every endpoint but those two returns `403` for that subaccount.
- `commercialInfo` and `general` can stay `APPROVED` while the data is expired. Watch the event and `commercialInfoExpiration.isExpired`, not only `general`.

## 3. Subaccount API keys

Each subaccount key acts in that subaccount's name. Operations on the seller's own charges, customers and documents use it.

In BaaS operations, the root account can manage subaccount keys without logging in to each one. The key-management page and the Subcontas page frame these endpoints as BaaS features:

| Need | Request (root key) |
| --- | --- |
| List keys (ids and settings, never the secret) | `GET /v3/accounts/{id}/accessTokens` |
| Create a key (name, expiration date) | `POST /v3/accounts/{id}/accessTokens` |
| Rename, enable or disable (`enabled: false`), change expiration | `PUT /v3/accounts/{id}/accessTokens/{accessTokenId}` |
| Delete for good | `DELETE /v3/accounts/{id}/accessTokens/{accessTokenId}` |

- The endpoints are off by default. Turn them on in Integrações > Chaves de API > Gerenciamento de Chaves de API de Subcontas > Habilitar acesso. Access lasts 2 hours, then closes itself.
- They also need the IP allowlist (Whitelist de IPs) on, with your server's outbound IP in it. A `403` means the 2-hour window closed or the IP is not listed.
- A new key's value comes back once. Lost or expired keys cannot be recovered; create a new one.
- Rotate by creating the new key, switching your code, checking calls succeed, then disabling the old one.
- BaaS subaccount keys are not disabled after 3 months unused, but still expire for good after 6 months unused. Watch `ACCESS_TOKEN_EXPIRED`. `ACCESS_TOKEN_EXPIRING_SOON` warns of expiry from inactivity, but is not sent for keys created with a manual expiration date.
- `accessToken.disabledReason` can read `LACK_OF_USE`, `MANUAL` or `ACCOUNT_OWNER_ARRANGEMENT_TYPE_CHANGED_TO_INDICATION_PARTNER`.

The limit that matters most: during the evaluation period, creation returns the subaccount's key. After it, the operation must be BaaS, or the subaccounts must be branches sharing the root's CNPJ prefix. The two pages word this differently. The creation guide ties the condition to "key management"; the key-management page ties it to "using the subaccounts' keys". Neither says what happens to a key issued during the evaluation once it ends. A non-BaaS marketplace that plans to issue charges with seller keys should confirm this with Asaas before building on it.

## 4. Webhooks for subaccounts

- Each account, root or subaccount, has its own webhooks, up to 10 each. Configure them per subaccount: in the `webhooks` array of `POST /v3/accounts`, or later with `POST /v3/webhooks` and the subaccount's key. The guides prefer doing it at creation, so no event is missed.
- Events show in the interface of the account that configured the webhook, and the root account can filter its subaccounts' events in its own interface. No page says a root webhook receives events for charges a subaccount issued. Inference: charges issued with the root key send events to the root's webhooks; charges issued with a subaccount key send them to that subaccount's webhooks.
- Tell the seller apart by `account.id` in the payload. `account.ownerId` holds the root account id when it applies. Webhook config items take the same fields as `POST /v3/webhooks` (`name`, `url`, `email`, `enabled`, `interrupted`, `sendType`, `events`, `authToken`, `apiVersion`).
- This skill's rule: point every subaccount's webhooks at one URL, give each its own `authToken`, look the seller up by `account.id`, and check the token against that seller's stored value.

Account-status events (each carries the full `accountStatus` object):

| Dimension | Events |
| --- | --- |
| Commercial info | `ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED`, `_AWAITING_APPROVAL`, `_PENDING`, `_REJECTED`, `_EXPIRING_SOON`, `_EXPIRED` |
| Bank account | `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED`, `_AWAITING_APPROVAL`, `_PENDING`, `_REJECTED` |
| Documents | `ACCOUNT_STATUS_DOCUMENT_APPROVED`, `_AWAITING_APPROVAL`, `_PENDING`, `_REJECTED` |
| General | `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`, `_AWAITING_APPROVAL`, `_PENDING`, `_REJECTED` |

A seller who receives a split also gets `INTERNAL_TRANSFER_CREDIT` with `internalTransferData.type: SPLIT` on their own webhooks. In sandbox, communications for subaccounts go to the root account's email.

## 5. Enable split on the root account

Split is blocked by default for accounts that never used it, counting the root and its subaccounts. Accounts that already used split are not affected.

The root account enables it in Integrações > Segurança > Habilitar Split de pagamento, confirmed with an SMS or Token App code. That covers every subaccount. Until then, a request with `split` returns `invalid_action`.

## 6. Split on a one-off charge

### Who issues the charge

The charge, its customer and its refunds belong to the account whose key created it. Where its events go is inference and an open question (section 4). Customers and charges belong to the subaccount they were made in, so a charge issued with a seller's key needs a customer created with that key (inference). Never list the issuing account's own `walletId`; the remainder stays with it by default.

Inference from those two rules: the issuing key sets the direction.

| Issued with | `split` names | Who keeps the remainder |
| --- | --- | --- |
| Root key | Seller's `walletId`, for the seller's share | Root, as commission |
| Seller's key | Root's `walletId`, for the commission | Seller |

This skill's rule: pick one direction per flow and record which key issued each charge. Refunds and lookups must use the same key, since a charge looked up with another account's key returns 404.

Get a `walletId` from the create response, or `GET /v3/wallets/` with that account's own key.

### Fields

Send `split` in `POST /v3/payments` (or `/v3/lean/payments`). Each item:

| Field | Notes |
| --- | --- |
| `walletId` | Required. The receiving account |
| `fixedValue` | Fixed amount, up to 2 decimals |
| `percentualValue` | Percent of `netValue`, up to 4 decimals |
| `totalFixedValue` | Installments only; see section 7 |
| `externalReference` | Your id for this split |
| `description` | Description of the split |

Field names differ by endpoint: `split` on `/payments` and `/subscriptions`, `splits` on `/installments`, `PUT /installments/{id}/splits` and Checkout. The payment-link reference has no split field.

### Calculation and limits

- Split is computed on `netValue`, the charge after Asaas's fees.
- Fixed and percent items can mix. Neither takes priority; the total must fit in `netValue`. With `netValue` R$ 98,00, R$ 50,00 fixed plus 50% (R$ 49,00) is R$ 99,00 and fails.
- Percent-only splits may not exceed 100%.
- No limit on the number of recipients.
- No future date: split runs when the charge is received. To control timing, use a transfer instead.
- A charge pledged as collateral in a credit operation, even at another institution, cannot split.

Who pays the fee: the docs say only that split uses `netValue`. Inference: the fee comes off the charge before anyone is paid, so a fixed recipient gets the full fixed amount and the issuer's remainder absorbs the fee, while percent recipients share it in proportion. Anticipation follows the same pattern: percent splits are computed on the net value after the anticipation fee, so sellers' percent shares shrink when the issuer anticipates. Fixed splits are not reduced; if they no longer fit the smaller net value, the charge is blocked for divergence (the docs' example: R$ 100,00 charge, R$ 90,00 net after anticipation, a R$ 95,00 fixed split must be adjusted). With automatic card anticipation and a fixed split set at issue, Asaas uses the highest fee for the card used.

### Example

A R$ 100,00 Pix charge issued with the root key, 85% to the seller:

```json
{
  "customer": "cus_000005219613",
  "billingType": "PIX",
  "value": 100.00,
  "dueDate": "2027-01-15",
  "externalReference": "order_123",
  "split": [
    {
      "walletId": "48548710-9baa-4ec1-a11f-9010193527c6",
      "percentualValue": 85.0,
      "externalReference": "order_123_seller",
      "description": "Seller share, order 123"
    }
  ]
}
```

The response and the payment webhooks carry the `split` array, each item with an `id` and `status`. Store the split `id`; `PAYMENT_SPLIT_DONE` names it in `additionalInfo.splitId`.

### Updating or deleting

- `PUT /v3/lean/payments/{id}` with a new `split` replaces it. Leave `split` out to keep it; `null` or `[]` turns it off.
- Updates are allowed while the charge awaits payment or is overdue. A card charge in `CONFIRMED` can change `split` when not anticipated, up to 1 business day before the expected payment date. During a divergence block, `CONFIRMED` or `RECEIVED` charges can change `split` and nothing else, anticipated or not.
- Deleting a charge removes its split. If you restore it, set the split again before it is paid, or no split happens.

## 7. Other charge types

### Installments

Each installment is its own charge with its own split.

| Field | Behavior |
| --- | --- |
| `fixedValue` | Same amount on each installment |
| `totalFixedValue` | Total to spread; Asaas divides it and puts the rounding on the last installment (R$ 100,00 over 3 is 33,33 + 33,33 + 33,34) |
| `percentualValue` | Percent of each installment's `netValue`, not of the total |

The installments guide sends `split` with `totalValue` and `installmentCount` on `POST /v3/payments`. The separate `POST /v3/installments` endpoint names the field `splits` and adds `installmentNumber`, to tie a split to one installment. `installmentNumber` cannot go with `totalFixedValue`.

### Subscriptions

`split` on `POST /v3/subscriptions` is a template copied onto each new charge.

- `PUT /v3/subscriptions/{id}` with a new `split` changes future charges only. To change a charge already created, list the subscription's charges and update that charge. Leaving `split` out keeps it; `null` or `[]` turns it off.
- When the split no longer fits a charge's net value, the subscription is blocked: split off, no new charges, `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK`. Fix the value or the split within 2 business days and Asaas unblocks it with the split kept. Past the deadline, `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED` fires and charges resume with no split. Wait for the webhook before you treat the block as over.
- `SUBSCRIPTION_SPLIT_DISABLED` fires when the subscription's split is turned off. A split disabled for `WALLET_REMOVED_FROM_OUTSIDE_ARRANGEMENT_ALLOW_LIST` shows that in `disabledReason`.

This skill's rule: on `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED`, stop treating the seller as paid by that subscription. Every later charge sends the whole net value to the issuer until you set the split again.

### Pix Automático

Split works only on charges you create in `MANUAL` mode: send `split` on each `POST /v3/payments` that carries `pixAutomaticAuthorizationId`. The initial QR code of the authorization cannot carry split. The docs say nothing on split for `SUBSCRIPTION` mode. See `references/pix-automatico.md`.

### Checkout and anticipation

- Checkout takes `splits`, run after the Checkout's charge is received.
- An anticipated charge splits on the net value after the anticipation fee too. Percent shares shrink with it, so recipients share the anticipation fee; fixed shares do not shrink, and a fixed split that no longer fits blocks the charge. Check a fixed split still fits before you anticipate; `POST /v3/anticipations/simulate` shows the figure.

## 8. Refunds, partial refunds and chargebacks

Refunding a charge with split reverses the splits too: the recipients' credits are taken back.

`POST /v3/payments/{id}/refund` (Pix or card) takes `value`, `description` and `splitRefunds` (items of `id`, the split id, and `value`):

| You send | Result |
| --- | --- |
| Nothing | Full refund |
| `splitRefunds` only | Total = sum of the split values; each comes from that recipient |
| `value` and `splitRefunds` | `value` is the total; the split values come from each recipient, the rest from the issuer |
| `value` only | Not described |

- Pix allows several partial refunds up to the charge's value. Card refunds can take 10 business days to reach the payer's statement.
- Fees are not returned. A full Pix refund right after receipt can fail with `400` because the issuer's balance cannot cover it; add balance and retry.
- The charge's `refunds` array gives each refund a `refundedSplits` list of `id`, `value`, `done`. Count a split as returned only when `done` is `true`, and the refund itself only when its `status` is `DONE`.
- The split cancellation reasons include `PAYMENT_REFUNDED`, and the split statuses include `PROCESSING_REFUND` and `REFUNDED`. No page says which one a refund before settlement produces.

What the docs do not cover: a recipient whose balance is short when Asaas takes the split back, whether a partial refund with `value` alone touches the splits, and what happens to splits during a chargeback. The chargeback page documents only `chargeback.status` and `reason`. `INTERNAL_TRANSFER_DEBIT` fires only in the Avalista-Devedor flow (`INTERNAL_LOAN`), which no page explains. Inference: a seller gets no debit event when a refund takes back their split. This skill's rule: keep each seller's pending refunds and open chargebacks in your own ledger, and hold back payouts that a reversal could hit until the charge can no longer be disputed.

## 9. Split statuses and events

Charge events (on the issuer's webhooks):

| Event | Meaning |
| --- | --- |
| `PAYMENT_SPLIT_DONE` | One split settled. Sent once per split; read `additionalInfo.splitId` |
| `PAYMENT_SPLIT_CANCELLED` | One split cancelled. Not sent when the withdrawal-validation webhook cancels it |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK` | At receipt or anticipation, the splits exceed the net value; value and split are held |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED` | The block ended. Not fixed within 2 business days means the splits were cancelled. Whether it also fires after a fix in time differs between pages |

Fix a divergence block by updating `split` on the charge within 2 business days; once it fits, the split runs.

Split `status` and reasons:

| Field | Values |
| --- | --- |
| `status` (reference enums) | `PENDING`, `PROCESSING`, `PROCESSING_REFUND`, `AWAITING_CREDIT`, `CANCELLED`, `DONE`, `REFUNDED`, `BLOCKED_BY_VALUE_DIVERGENCE` |
| `status` (guide) | `PENDING`, `AWAITING_CREDIT`, `DONE`, `CANCELLED`, `REFUSED`, `REFUNDED` |
| `cancellationReason` (issuer side: payment and paid splits) | `BANK_ACCOUNT_AWAITING_AUTHORIZATION`, `BANK_ACCOUNT_PENDING`, `BANK_ACCOUNT_REJECTED`, `CHECKOUT_VALIDATION_FAILED`, `CUSTOMER_DOCUMENTS_PENDING`, `CUSTOMER_DOCUMENTS_REJECTED`, `EXTERNAL_AUTHORIZATION_REFUSED`, `MANUAL_CANCELLATION`, `PAYMENT_DELETED`, `PAYMENT_OVERDUE`, `PAYMENT_RECEIVED_IN_CASH`, `PAYMENT_REFUNDED`, `VALUE_DIVERGENCE_BLOCK`, `WALLET_REMOVED_FROM_OUTSIDE_ARRANGEMENT_ALLOW_LIST`, `WALLET_UNABLE_TO_RECEIVE` |
| `cancellationReason` (recipient side: received splits) | `MANUAL_CANCELLATION`, `PAYMENT_DELETED`, `PAYMENT_OVERDUE`, `PAYMENT_RECEIVED_IN_CASH`, `PAYMENT_REFUNDED`, `PAYMENT_SPLIT_VALIDATION_FAILED`, `VALUE_DIVERGENCE_BLOCK`, `WALLET_UNABLE_TO_RECEIVE` |
| `refusalReason` (guide and webhook example only) | `RECEIVABLE_UNIT_AFFECTED_BY_EXTERNAL_CONTRACTUAL_EFFECT`: contract effects on the receivables stopped the split |

This skill's rule: accept any status string, store unknown ones as they come, and alert on them instead of failing.

This skill's rule: a split cancelled at settlement leaves the seller's share with the issuer. Reconcile cancelled splits daily from the split endpoints (not only from `PAYMENT_SPLIT_CANCELLED`, which a validation cancel does not send) and pay the seller another way, such as a transfer, once the cause is fixed.

Query endpoints, for reconciliation (the docs prefer webhooks for tracking):

- `GET /v3/payments/splits/paid` and `/paid/{id}`: splits your account sends. Filters `paymentId`, `status`, `paymentConfirmedDate[ge|le]`, `creditDate[ge|le]`.
- `GET /v3/payments/splits/received` and `/received/{id}`: splits your account receives.
- `GET /v3/finance/split/statistics`: split totals.
- Each split shows `originAccountId`, `destinationAccountId`, `totalValue`, `creditDate` and `payment`.

A split's `DONE` is settlement, not available balance. A recipient with Conta Escrow keeps the value under guarantee for its own `daysToExpire`, and no webhook reports the guarantee ending.

## 10. Withdrawal-validation webhook

An optional webhook that approves or refuses outgoing money before Asaas moves it. Turn it on in Integrações > Mecanismos de segurança with a URL, an error email and an optional token (sent in `asaas-access-token`).

- It covers transfers, bill payments, Pix QR code payments and phone top-ups from the API, and optionally the same from the web interface. Two independent boxes add Pix refunds and split settlement.
- The root account's setting applies to its subaccounts, BaaS or not.
- About 5 seconds after the operation (for a split, after the charge is paid and the split settles), Asaas sends a `POST` with `type` (`TRANSFER`, `BILL`, `PIX_QR_CODE`, `MOBILE_PHONE_RECHARGE`, `PIX_REFUND`, `PAYMENT_SPLIT`) and the matching object (`paymentSplit` for a split).
- Answer `{"status": "APPROVED"}` or `{"status": "REFUSED", "refuseReason": "..."}`. Anything else, or three failed calls, cancels the operation.
- A refused split is cancelled and the money returns to the issuer. The issuer sees `cancellationReason: EXTERNAL_AUTHORIZATION_REFUSED`; the recipient sees `PAYMENT_SPLIT_VALIDATION_FAILED`, a generic reason that other settlement checks also return. No `PAYMENT_SPLIT_CANCELLED` fires and your `refuseReason` is not shown.
- Asaas's checklist: record each operation before the call comes, match the received id, value and payee against your record, check the token, refuse what you do not know, and log each decision.

This skill's rule: if you turn on split validation, an endpoint that fails three times in a row, or answers without a valid status, cancels sellers' payouts with no event. Monitor it like a payment path, and have your reconciliation read `cancellationReason` from the split endpoints.

## 11. Evaluation period

New API subaccount users start a regulatory evaluation period at the first subaccount created in production.

| Limit | Rule |
| --- | --- |
| Subaccounts | Up to 10 per root account |
| Charges | Up to R$ 2.000,00 per subaccount, one-off charges and subscriptions together |
| Time | Up to 60 days from the first production subaccount |

When any limit is hit:

- no new subaccounts;
- a subaccount at R$ 2.000,00 cannot issue charges;
- no new subscriptions, and existing ones are cancelled;
- that subaccount's payment links are turned off;
- charges issued before the block can still be paid;
- split, Pix or internal transfers from the root to a blocked subaccount are refused.

Balances are not blocked, and sellers can still withdraw. Deleting an unpaid charge gives its amount back to the limit; a refunded charge does not. Ask Asaas for homologation at any time; once approved, the limits end.

## 12. Sandbox

- Up to 20 subaccounts per day; past that, creation fails.
- Subaccount emails, including the password reset of a non-BaaS subaccount, go to the root account's email.
- The evaluation period is on by default in sandbox and can be turned off in the sandbox account's settings. Sandbox subaccounts are not copied to production.
- Approve subaccounts with auto-approval in the sandbox settings, or with the sandbox approve endpoint. The guide names `POST /v3/accounts/{id}/approve`; the reference it links is `POST /v3/sandbox/myAccount/approve`, which approves the account that owns the key. Use the subaccount's key with the reference path, and check it.
- BaaS in sandbox needs support to turn it on, per the onboarding page; the BaaS creation page points to the sandbox settings instead. The onboarding link in sandbox is a fake page; nothing is really sent.
- Names with digits or `_ # ! -` can stop automatic approval and leave Pix off.
- Charges with split and the split totals work in sandbox.

## Where the docs disagree

- `apiKey` in the create response: top-level in the guides and in the prose of `reference/criar-subconta`, `accessToken.apiKey` in that same page's schema.
- `birthDate` with `companyType`: the guide says PF only; the recipe sends both.
- Split status: the guide lists `REFUSED` and `refusalReason`; the reference enums (payment, paid and received splits) have neither and add `PROCESSING`, `PROCESSING_REFUND` and `BLOCKED_BY_VALUE_DIVERGENCE`. The issuer and recipient sides list different cancellation reasons: the recipient sees only the generic `PAYMENT_SPLIT_VALIDATION_FAILED` for `EXTERNAL_AUTHORIZATION_REFUSED`, `CHECKOUT_VALIDATION_FAILED` and the bank-account and document reasons.
- Sandbox approval: `POST /v3/accounts/{id}/approve` in the guide, `POST /v3/sandbox/myAccount/approve` in the reference.
- Turning on BaaS in sandbox: ask support (onboarding page) or the sandbox settings (BaaS creation page).
- `PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED`: the split intro and the FAQ send it only when the block expires unfixed; the anticipation page says it fires whenever the block ends.
- Key access after the evaluation: "key management" (creation guide) or "the subaccounts' keys" (key-management page).

## What the docs do not answer

- Which operations a subaccount can run before `general` is `APPROVED`.
- What happens, after the evaluation period, to subaccount keys issued during it, and whether a non-BaaS operation keeps any key access.
- Whether a root webhook receives events for charges a subaccount issued.
- Whether charges the root issues with split to a subaccount count against that subaccount's R$ 2.000 evaluation limit.
- Fees: subaccount creation, split, transfers. The docs point to Configurações de Conta > Taxas.
- Who bears the Asaas fee under each split type, beyond "split uses `netValue`".
- What a partial refund with `value` alone does to the splits.
- What happens when a recipient's balance cannot cover a reversed split.
- What happens to splits during a chargeback.
- What the Avalista-Devedor (`INTERNAL_LOAN`) movement is and when it fires.
- Whether split works in Pix Automático `SUBSCRIPTION` mode.
- What the cancellation reasons `PAYMENT_OVERDUE` and `PAYMENT_RECEIVED_IN_CASH` mean. Inference: marking a charge received in cash cancels the seller's split.
- What happens to a split created before the seller hit the evaluation limit, or before their commercial data expired, that settles after.
- How long the withdrawal-validation endpoint has to answer. The docs state only that an invalid status or three consecutive failures cancel the operation.
