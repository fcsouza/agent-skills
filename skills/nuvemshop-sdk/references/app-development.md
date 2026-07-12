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

## Embedded App Production Pitfalls (hard-won)

The admin shows a single generic error for almost every embedded failure:
"Ocorreu um erro com o aplicativo" / "Não foi possível carregar o aplicativo neste momento".
It is a **symptom, not a cause**. It fires whenever the app either never calls
`iAmReady`, or throws a render error caught by the Nexo `ErrorBoundary` (which
dispatches `ACTION_LOG_ERROR`). It does NOT specifically mean CORS, config, or the
handshake failed. Do not guess from the overlay: diagnose with the two techniques
at the end of this section.

1. **`clientId` must be baked at BUILD time.** `nexo.create({ clientId })` reads a
   build-time constant (e.g. Vite `import.meta.env.VITE_CLIENT_ID`). A runtime-only
   env is not enough: the bundle ships `clientId: undefined`, the admin can't
   identify the app during the handshake, and you get the generic error. In
   containerized builds pass the (public) app id as a Docker **build ARG**, not just
   a runtime env. Verify by grepping the built bundle: `clientId` must contain the
   id, not `void 0`. Symptom of this bug: "it worked once then broke after a
   rebuild" (the first image was built with the arg set manually).

2. **Never gate `iAmReady` behind an awaited call.** The correct order is
   `connect(nexo).then(() => { setReady(true); iAmReady(nexo); })`, then fetch
   `getStoreInfo`/anything else AFTER, best-effort. `connect` + `iAmReady` are the
   ready pair; store info is extra. If an awaited call sits between `connect` and
   `iAmReady` and it throws, `iAmReady` never fires and the admin keeps its error
   overlay even though the app mounted and its API calls return 200. On `connect`
   failure, keep the loading skeleton in prod (do NOT render the app anyway, that
   only makes sense in local dev where there is no admin parent).

3. **Nuvemshop API fields are localized objects, not strings.** Product `name` (and
   other localizable fields) come back as `{ pt: "...", es: "..." }`. Rendering one
   directly as a React child throws **React error #31** ("Objects are not valid as a
   React child, found: object with keys {pt}"), which the ErrorBoundary surfaces as
   the generic overlay. Flatten localized fields to a plain string on the **backend**
   (map the raw API shape to the frontend's contract, e.g. `name: string`,
   `imageUrl: string | null`) before the SPA renders them. This bug is invisible on
   an empty store and only appears once there is data to render.

4. **The embedded SPA calls your backend cross-origin.** It runs on your app's origin
   inside the admin iframe and calls your API host directly (Nexo JWT in the
   `Authorization` header), so that origin must be in the backend's **credentialed
   CORS allowlist**.

5. **Map internal status vocabularies to the SPA's.** If the backend tracks its own
   lifecycle statuses (e.g. `pending | pushed | failed`), map them to whatever the
   SPA polls for (e.g. `done`) and include the result URL, or the progress screen
   never advances even though the pipeline succeeded.

### Diagnosing the generic overlay (do this instead of guessing)

- **Backend request logging**: confirm the app's API calls actually reach the
  backend and return 200. If they do, the handshake/CORS/auth are fine and the
  problem is a client-side render error (pitfall 3) or a missing `iAmReady`
  (pitfall 2). (Verify the logger's lifecycle hooks are globally scoped, or you get
  no per-request logs at all.)
- **Capture the iframe postMessages**: install a `window.addEventListener('message', ...)`
  on the admin page and reload the app. You will see the real handshake:
  `app/connected` → `app/ready` → `app/store/info` → `app/auth/sessionToken` →
  `app/navigate/sync`, and crucially any `app/log/error` whose payload carries the
  actual error message and stack. This is the single fastest way to find the true
  cause. The app iframe is cross-origin, so the parent cannot read its console
  directly, so the postMessage stream is the channel.

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
