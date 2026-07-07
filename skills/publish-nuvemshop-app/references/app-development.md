# Nuvemshop App Development

## Official References

- App overview: https://dev.nuvemshop.com.br/docs/applications/overview
- Authentication: https://dev.nuvemshop.com.br/docs/applications/authentication
- Embedded apps: https://dev.nuvemshop.com.br/docs/applications/native
- External apps: https://dev.nuvemshop.com.br/docs/applications/standalone
- Publication guidelines: https://dev.nuvemshop.com.br/docs/applications/guidelines
- HTTP status standards: https://dev.nuvemshop.com.br/docs/applications/http-status
- Landing page: https://dev.nuvemshop.com.br/docs/applications/landing-page
- Nexo: https://dev.nuvemshop.com.br/docs/developer-tools/nexo
- Nimbus: https://dev.nuvemshop.com.br/docs/developer-tools/nimbus
- API Nuvemshop: https://dev.nuvemshop.com.br/docs/developer-tools/nuvemshop-api
- API usage/rate limits: https://dev.nuvemshop.com.br/docs/developer-tools/erp-guide/api-usage
- Webhooks example: https://dev.nuvemshop.com.br/docs/developer-tools/erp-guide/orders/webhooks

## App Types

- Embedded/admin apps run inside the merchant admin through an iframe and use Nexo for communication with the admin. Nimbus and design requirements are expected.
- External apps run outside the merchant admin and use OAuth 2 authorization-code flow.
- Storefront/checkout scripts should be treated as NubeSDK apps where current requirements apply.
- ERP, Payments, Shipping, and sensitive-data apps get stricter homologation and may require videos or live validation.

## Partner Portal Setup

- Create the app from `Aplicativos > Criar Aplicativo`.
- Distribution options:
  - `Loja de Aplicativos`: public App Store listing after homologation.
  - `Para seus clientes`: private availability for selected merchants; not the same public homologation path.
- Use a demo store for development and installation testing.
- In `Dados Básicos`, replace the generated test redirect URL with the production redirect URL before production.
- Enable only required scopes. Extra scopes can cause homologation rejection.
- Brazil apps must configure privacy/LGPD webhooks where required.
- If scopes change later, uninstall/reinstall the app and repeat authentication to get a new token with updated permissions.

## OAuth

- External apps use a restricted OAuth 2 authorization-code flow.
- Install/authorize URL: `https://www.tiendanube.com/apps/{app_id}/authorize`.
- Token URL: `https://www.tiendanube.com/apps/authorize/token`.
- The generated `code` is short-lived and should be exchanged promptly.
- Token response includes `access_token`, `token_type`, `scope`, and `user_id`.
- `access_token` does not expire by time; it is invalidated when a new token is obtained or the app is uninstalled.
- `user_id` is the store id for API URLs.

## API Usage

Send:

- `Authorization: Bearer {{access_token}}`
- `User-Agent: App Name (email or app_id)`
- `Content-Type: application/json`

Use the minimum needed scopes. API scopes are selected at app creation/configuration and determine merchant consent.

## Rate Limit and Pagination

- API rate limiting uses a leaky bucket.
- Default bucket capacity: 40 requests.
- Default leak rate: 2 requests per second.
- Limit applies per store and app.
- Next/Evolution or higher plans multiply the limit by 10.
- Rate-limit headers:
  - `x-rate-limit-limit`
  - `x-rate-limit-remaining`
  - `x-rate-limit-reset`
- List endpoints do not enable pagination beyond the first page automatically.
- Use `page` for additional pages.
- Use `per_page` up to 200.
- Page numbering starts at 1.
- `x-total-count` returns total result count.
- `Link` header provides navigation URLs.

## Webhooks

Prefer webhooks over polling. Homologation docs explicitly call out repeated GETs as a problem when a webhook could be used.

Webhook API:

- `POST /webhooks`: register.
- `GET /webhooks`: list.
- `PUT /webhooks/{webhook_id}`: update URL/headers.
- `DELETE /webhooks/{webhook_id}`: delete.

Webhook payload includes:

- `store_id`
- `event`
- `id`

Receiver requirements:

- Validate payload shape and source as much as possible.
- Process idempotently.
- Fetch the changed entity when needed using the payload id.
- Return `200 OK` for accepted notifications.
- Avoid expensive synchronous work in the webhook response path.

## Embedded Apps With Nexo

Nexo connects an embedded app and the merchant admin through observer-style messages.

Embedded app expectations:

- Public app URL is loaded in the admin iframe.
- Nexo is installed/configured.
- App calls `connect(nexo)` and `iAmReady(nexo)`.
- After `iAmReady`, the app must listen to `ACTION_NAVIGATE_SYNC` because the admin sends the initial route.
- Route sync should keep app route and browser/admin URL aligned.
- Use `getSessionToken(nexo)` to obtain a JWT signed with the app client secret for backend authentication.
- Put `ErrorBoundary` at the top of the React tree. It dispatches `ACTION_LOG_ERROR` and shows an admin-integrated fallback. This is mandatory for App Store publication.

Common Nexo actions/helpers:

- Actions: `ACTION_NAVIGATE_SYNC`, `ACTION_NAVIGATE_GOTO`, `ACTION_NAVIGATE_PATHNAME`, `ACTION_AUTH_SESSION_TOKEN`, `ACTION_STORE_INFO`, `ACTION_LOG_ERROR`, `ACTION_STORE_FEATURE`, `ACTION_STORE_UPSELL`.
- Helpers: `connect`, `iAmReady`, `getSessionToken`, `syncPathname`, `getStoreInfo`, `goTo`, `navigateExit`, `navigateHeader`, `getFeatureStatus`, `runWithUpsell`.

## Nimbus

Nimbus is the Nuvemshop design system and is strongly expected for embedded admin apps.

Relevant packages:

- `@nimbus-ds/styles`
- `@nimbus-ds/components`
- `@nimbus-ds/patterns`
- `@nimbus-ds/tokens`
- `@nimbus-ds/icons`

Common Nimbus templates/patterns include settings pages, confirmation modals, forms, basic pages, login, simple lists, and product lists.

## Templates

Nuvemshop provides React + Node.js templates for both embedded and external apps. Embedded templates include Nexo-related setup; templates also include authentication logic. Prefer the official templates for new apps unless the user's existing architecture makes that impractical.
