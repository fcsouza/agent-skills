# Nuvemshop app development

Use the official pages for endpoint shapes, scope lists and component props. This file keeps the decisions and the failures that cost time.

- App overview and Partner Portal setup: https://nuvemshop.dev/en-US/apps/admin/overview.md
- Authentication: https://nuvemshop.dev/en-US/api/authentication.md
- Admin API getting started (headers, rate limit, pagination): https://nuvemshop.dev/en-US/api/getting-started.md
- API versions: https://nuvemshop.dev/en-US/api/versioning.md
- Webhook resource: https://nuvemshop.dev/en-US/api/resources/2025-03/webhook.md
- Embedded apps: https://nuvemshop.dev/en-US/apps/admin/integrated.md
- External apps: https://nuvemshop.dev/en-US/apps/admin/external.md
- Nexo: https://nuvemshop.dev/en-US/apps/admin/nexo.md
- App templates: https://nuvemshop.dev/en-US/apps/admin/app-templates.md
- Nimbus: https://nuvemshop.dev/en-US/documentation/overview/getting-started.md
- Design guidelines for apps: https://nuvemshop.dev/en-US/apps/admin/design-guidelines/overview.md
- ERP guide (API usage, webhooks, best practices): https://nuvemshop.dev/en-US/apps/erp-guide/overview.md
- Landing page after install: https://nuvemshop.dev/en-US/apps/publish/landing-page.md

## App types

- Embedded app: loaded in the merchant Admin through an iframe from a public URL. It uses Nexo and Nimbus.
- External app: runs outside the Admin and uses the OAuth authorization-code flow.
- Script in the storefront or checkout: a NubeSDK app. Read `nube-sdk.md`.
- ERP, Payments and Shipping apps get a longer homologation with a demonstration script and a checklist.

## Partner Portal setup

- Create the app in the Partners Portal. Distribution is "App Store" (public, after homologation) or "For Your Customers" (private, only the merchants you select, no homologation). In the pt-BR portal these read "Loja de Aplicativos" and "Para Seus Clientes".
- Test on a demo store. Install from the demo store with the install button.
- Replace the default Redirect URL with one your app controls. The default (`https://partners.tiendanube.com/applications/authentication/{app_id}`) asks for partner credentials and the flow never delivers the `code`.
- Request only the scopes the app uses. A write scope implies the read scope. Scopes cannot be requested per installation.
- After you change scopes in Basic data, reinstall the app in each store that needs them. Reinstalling issues a new token with the new scopes.
- Configure the three privacy webhook URLs (store redact, customer redact, customers data request) and the privacy policy URL.

## OAuth

- Only the authorization-code grant exists. Install URL: `https://www.tiendanube.com/apps/{app_id}/authorize`. Send a `state` value and check it on the redirect. Token URL: `https://www.tiendanube.com/apps/authorize/token` with `grant_type=authorization_code`. The `nuvemshop.com.br` domain works in place of `tiendanube.com`.
- The code expires in 5 minutes. Exchange it at once.
- Access tokens do not expire. They stop working after you get a new token for the same app and store, or after uninstall.
- `user_id` in the token response is the store id for API URLs.
- Store the token, scopes and store id on your server, keyed by app id and store id. Do not reuse a demo-store token for a client's store.
- `client_secret` stays on the server. It signs webhooks and session tokens, so a leak breaks both.

## API use

- Use version `2025-03` (stable, the default). Base URLs: `https://api.tiendanube.com/2025-03/{store_id}` and `https://api.nuvemshop.com.br/2025-03/{store_id}`.
- Send `Authorization: Bearer <access_token>` and a `User-Agent` with the app name and a contact link or email.
- Rate limit: leaky bucket, 40 requests, 2 per second, per store and app, times 10 for Next and Evolution stores. Read `x-rate-limit-limit`, `x-rate-limit-remaining` and `x-rate-limit-reset`. `429` means the bucket is full.
- Lists are paginated: `page`, and `per_page` up to 200. Most lists default to 30 items. Total in `x-total-count`.
- Localizable fields such as product `name` are objects keyed by language (`{ "pt": "..." }`), not strings. Flatten them on the backend.

## Webhooks

- Register with `POST /webhooks` (also `GET`, `PUT /webhooks/{id}`, `DELETE`). You can only register events for resources your scopes cover.
- The body carries `store_id`, `event`, and usually `id` and `event_launch_ts`. Fetch the changed entity with the id.
- Verify the signature on every request, answer 2xx within 3 seconds, and handle duplicates and reordering. Rules and code are in `SKILL.md` and `templates/webhook-verify.ts`.
- `app/uninstalled` arrives right before the vendor deletes your webhooks for that store. Clean up that installation's token and webhook records only.

## Embedded apps with Nexo

- Create the Nexo instance with the `clientId` Nuvemshop gives your app. Call `connect(nexo)`, then `iAmReady(nexo)`.
- After `iAmReady`, listen for `ACTION_NAVIGATE_SYNC`. The Admin sends the initial route there.
- `getSessionToken(nexo)` returns a JWT signed with your client secret. Verify it on your backend.
- Wrap the React tree in `ErrorBoundary`. It sends `ACTION_LOG_ERROR` and shows a fallback inside the Admin. The docs call it mandatory for App Store publication.

## Embedded app failures (this skill's field notes)

The Admin shows one generic error for almost every embedded failure. It fires when the app never calls `iAmReady` or throws a render error that `ErrorBoundary` catches. It is a symptom, not a cause. These five causes cost the most time. They come from past projects, not from vendor docs, so confirm each against your own app.

1. Bake `clientId` at build time. `nexo.create({ clientId })` reads a build-time constant. A runtime-only environment variable ships `clientId: undefined`. In a container build, pass the public app id as a build argument. Check the built bundle for the real id.
2. Never put an awaited call between `connect` and `iAmReady`. Order: `connect(nexo).then(() => { setReady(true); iAmReady(nexo); })`, then fetch store info as a best effort. If `connect` fails in production, keep the loading state.
3. Flatten localized API fields on the backend. A `{ pt: "..." }` object rendered as a React child throws React error #31, and the boundary shows the generic overlay. It only appears once the store has data.
4. The SPA calls your backend from the Admin iframe, so its origin must be in the backend's credentialed CORS allowlist.
5. Map the backend's own status names to the ones the SPA polls for, or the progress screen never advances.

To find the cause, check that the app's API calls reach the backend and return 200. If they do, look for a render error or a missing `iAmReady`. You can also log `message` events on the Admin page to see the handshake and any `app/log/error` payload.

## Nimbus

Embedded apps are expected to use the Nimbus design system. Packages: `@nimbus-ds/styles`, `@nimbus-ds/components`, `@nimbus-ds/patterns`, `@nimbus-ds/tokens`, `@nimbus-ds/icons`. Component, pattern and template lists live at https://nuvemshop.dev/en-US/documentation/atomic-components, https://nuvemshop.dev/en-US/documentation/patterns and https://nuvemshop.dev/en-US/documentation/templates.

Review checklist:

- Use Nimbus components before custom ones, and patterns for forms, tables, empty states, page shells and side modals.
- Start from a page template (settings, form, list, login, product list, confirmation modal, landing) when one fits.
- Use Nimbus tokens, not raw values.
- Build loading, empty, error, success and validation states.
- Match UI language to the publication countries.

## Templates

Official React and Node.js templates exist for embedded and external apps: https://github.com/TiendaNube/tiendanube-app-native-template-node and https://github.com/TiendaNube/tiendanube-app-standalone-template-node. Prefer them for new apps unless the existing architecture rules it out.
