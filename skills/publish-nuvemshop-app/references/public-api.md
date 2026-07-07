# Public API

Source extraction: Firecrawl scrape of Tiendanube/Nuvemshop public API docs on 2026-07-07. Version observed: `2025-03`.

## Base URLs and Versioning

The API is REST-style, JSON-based, OAuth 2 authenticated, and versioned.

Base URLs:

- `https://api.tiendanube.com/2025-03/{store_id}`
- `https://api.nuvemshop.com.br/2025-03/{store_id}`

Older docs or examples may use `/v1/{store_id}`. Prefer the current versioned docs when implementing new integrations and re-check before shipping.

## Required Headers

Every request should include:

- `Authorization: Bearer ACCESS_TOKEN`
- `User-Agent: App Name (contact URL or email)`

When sending a body:

- `Content-Type: application/json; charset=utf-8`

Missing `User-Agent` returns `400 Bad Request`. Missing JSON content type for POST/PUT can return `415 Unsupported Media Type`.

## JSON and Errors

- Payloads are JSON without a root element.
- Attribute keys use `snake_case`.
- Invalid JSON: `400 Bad Request`.
- Invalid fields: `422 Unprocessable Entity`.
- Server errors can include `500`, `502`, `503`, and `504`; retry later.

## Rate Limit

- Algorithm: leaky bucket.
- Default bucket size: 40 requests.
- Default leak rate: 2 requests/second.
- Applies per store and app.
- Next/Evolution or higher plans multiply the rate limit by 10.
- Headers:
  - `x-rate-limit-limit`
  - `x-rate-limit-remaining`
  - `x-rate-limit-reset`

## Pagination

- Use `page` for additional pages.
- Use `per_page` up to 200.
- Page numbering starts at 1.
- `x-total-count` exposes total results.
- `Link` header can expose pagination URLs.

## OAuth Authentication

Authorization flow:

1. Merchant installs/authorizes the app.
2. Nuvemshop redirects to the app callback with an authorization code.
3. Exchange the code with app credentials at `https://www.tiendanube.com/apps/authorize/token`.
4. Include `grant_type=authorization_code`.
5. Store the returned access token and user/store id.

Useful Partner Portal URLs/data:

- Redirect/callback URL after installation.
- App listing URL.
- OAuth redirect URLs.
- Privacy Policy URL.
- Store redact webhook URL.
- Customer redact webhook URL.
- Customers data request webhook URL.

## Scopes

Scopes control resource access and merchant consent. Request only what the app needs.

Webhooks depend on resource permissions: the app can register webhooks only for resources it is allowed to use.

Common scope/resource families:

- Products, variants, images, categories.
- Customers.
- Orders.
- Coupons/discounts.
- Locations/inventory.
- Shipping carriers.
- Payment providers/transactions.
- Store.
- Webhooks.

## Core Resources

The public API includes resources such as:

- Abandoned checkout.
- Category and category custom fields.
- Coupon.
- Customer and customer custom fields.
- Discounts.
- Draft order.
- Location.
- Metafields.
- Order and order custom fields.
- Payment option.
- Payment provider.
- Product, product image, product variant, product custom fields, variant custom fields.
- Shipping carrier.
- Store.
- Transaction.
- Webhook.

## Endpoint Families

Products:

- Product docs include product properties and CRUD/list operations.
- Variant and product-image docs cover variant/image lifecycle.
- Use pagination for large catalogs.

Orders:

- Order docs include list/read/update order workflows.
- Transactions are nested under orders.
- Payment and shipping integrations often depend on order, transaction, shipping carrier, and payment provider resources.

Customers:

- Customer docs include contact, billing/shipping, identification, and customer account fields.
- Treat customer data as sensitive and align with privacy webhooks.

Locations:

- Location docs support multi-inventory/stock-origin workflows.

Store:

- `GET /store` returns store metadata, language/currency, country, domain, theme, and contact fields.

Webhooks:

- Use webhook resources instead of polling where possible.
- Register only events covered by granted scopes.
- Pair webhook payload handling with follow-up API fetches when the payload only includes identifiers.

Transactions:

- Transactions are used for payment-provider flows.
- Core endpoints include creating transactions for an order, creating transaction events, listing transactions, and reading a transaction.

## Implementation Checks

- Use the current versioned base URL.
- Include `User-Agent` with a reachable contact.
- Handle `429` using headers.
- Paginate list endpoints.
- Use webhooks for change detection.
- Keep scopes minimal.
- Treat customer/order/payment data as sensitive.
- Retry 5xx responses with backoff.
