---
name: nuvemshop-sdk
description: >-
  Covers building, auditing, homologating and publishing Nuvemshop/Tiendanube apps: OAuth and scopes, webhook signature checks, embedded Nexo apps, NubeSDK storefront and checkout scripts, and App Store homologation and publication. Use when you build or review a Nuvemshop app, receive its webhooks, migrate a script to NubeSDK, or prepare homologation artifacts, publication data and the app description.
---

# Nuvemshop SDK

The vendor's docs change often (NubeSDK dates moved in 2026). Read the current page before you give homologation or publication advice. Every claim below is traced in `references/sources.md`.

## Official agent tooling

Use these before this skill's references.

- Docs as text. Use https://nuvemshop.dev/en-US/llms.txt (Portuguese: https://nuvemshop.dev/llms.txt, Spanish: https://tiendanube.dev/llms.txt). Add `.md` to any docs URL, or send `Accept: text/markdown`. For one area at a time use `https://nuvemshop.dev/en-US/llms-full/apps.txt` (also `api`, `themes`, `storefront-api`, `ai-agents`).
- Admin MCP: acts on one store after the merchant signs in with OAuth. It covers catalog, categories, stock, prices, orders, customers, coupons, promotions and sectionable theme drafts. Its write tools change real data and its delete tools are irreversible. It does not read docs or build apps. Tools and connector URLs: https://nuvemshop.dev/en-US/ai-agents/admin-mcp.md.
- Storefront MCP: takes the shopping actions a customer can take (search products, cart, promotions, shipping, payment methods, order tracking) at `https://<store-domain>/api/mcp`, with no OAuth. See https://nuvemshop.dev/en-US/ai-agents/storefront-mcp.md.
- Official theme skills: `nuvemshop skills install` (from the Nuvemshop CLI) installs 7 theme skills for editing theme code with the CLI: `nuvemshop-theme-use-cases`, `nuvemshop-theme-fork-workflow`, `nuvemshop-theme-ftp-workflow`, `nuvemshop-fork-and-push-rules`, `nuvemshop-ipanema-architecture`, `nuvemshop-ipanema-schema-reference` and `nuvemshop-classic-theme-architecture`. They cover themes only. Use the `nuvemshop-theme-use-cases` skill if it is installed, otherwise https://nuvemshop.dev/en-US/themes/developer-tools/cli/agent-skills.md.
- Apps, NubeSDK and homologation have no official skill. This skill covers them.

## Workflow

1. Classify the app: public App Store or private ("For Your Customers"); embedded admin app, external app, storefront/checkout NubeSDK script, ERP, Payments or Shipping; new build, migration or audit.
2. Load only the reference you need:
   - OAuth, API headers, rate limits, webhooks, Nexo, Nimbus, embedded-app failures: read `references/app-development.md`.
   - Storefront or checkout script, DOM injection, themes and slots: read `references/nube-sdk.md`.
   - Homologation, artifacts, publication data, app description: read `references/homologation-publication.md`.
3. Audit readiness:
   - The Partner Portal app exists with the right distribution type.
   - Install works from `https://www.tiendanube.com/apps/{app_id}/authorize` on a demo store, and the production redirect URL replaced the generated test one.
   - `user_id` is saved as the store id, and a scope change triggers a reinstall and a new token.
   - Every webhook registered through the API is verified (next section). Confirm the header arrives on the privacy webhooks before enforcing it there.
   - API calls send `Authorization` and `User-Agent`, paginate, handle `429`, and use webhooks instead of polling.
   - Embedded apps use Nexo, Nimbus, route sync, session tokens and `ErrorBoundary`.
   - Script-injecting apps use NubeSDK and no DOM APIs.
   - Homologation artifacts, publication assets, support contacts and FAQ are complete.
4. Deliver. Audits lead with blockers and evidence. Implementation gives exact steps for the app type. Publication prep gives a checklist plus missing artifacts. Descriptions follow the official 8-part structure.

## Verify webhooks (do this first)

An endpoint that skips this accepts forged events from anyone who knows the URL.

- Header: `x-linkedstore-hmac-sha256`. Some frameworks rename it `HTTP_X_LINKEDSTORE_HMAC_SHA256`.
- Value: HMAC-SHA256 of the original request body, keyed with the app's `client_secret`, as lowercase hex. The store's `access_token` is not the key. Keep the secret on your server.
- Hash the raw bytes before you parse or modify the body. A re-serialized JSON body breaks the match.
- Compare in constant time. The vendor's PHP example uses `==`; constant time is this skill's rule.
- Reject a missing or wrong signature before any other work. The docs promise the signature only for webhooks created through the API. The three required privacy webhooks (store redact, customer redact, customers data request) are set in the Partners Portal, and the docs never say they are signed. Check that the header arrives on them before you return 401 there, so you do not reject mandatory LGPD requests.
- Answer with a 2xx within 3 seconds. Queue the work and return.
- Retries: if no 2xx arrives, the first 4 retries come right after the timeout and at about 5, 10 and 15 minutes. Then the wait grows by 1.4 times per attempt for up to 48 hours (up to 16 attempts). A 2xx stops them.
- Order and duplicates: events can arrive out of order and more than once, so make handlers idempotent. The vendor's rules: identical bodies are separate messages, so do not drop a body just because you saw it before. Messages that differ only in retry data are duplicates.
- Webhook URLs must be HTTPS and cannot be localhost or a Nuvemshop domain.

Copy `templates/webhook-verify.ts` for `verifyWebhook` and a Fetch-API `handleWebhook`.

## NubeSDK in brief

Every app that injects scripts into the storefront or checkout needs NubeSDK. API-only and Admin-only apps do not. Dates, per the current docs: 2026-06-05, new homologation requests need NubeSDK validation. 2026-09-30, non-migrated apps are removed from the App Store (the deadline moved from 2026-08-30). 2026-10-30, progressive uninstall starts. Private apps that inject scripts skip homologation, and the requirement is enforced in the front end.

Scaffold with `npm create nube-app@latest`. Details, themes and slots: read `references/nube-sdk.md`.

## Pitfalls

- Do not call an app publishable before you check NubeSDK, scopes, privacy webhooks, webhook signatures, API usage, the sequence diagram, demo video, FAQ and support contacts, publication assets and publication fields.
- Do not ask for broad scopes. Unneeded permissions can fail homologation.
- Do not poll when a webhook covers the event.
- Do not ignore rate limits. The bucket holds 40 requests and leaks 2 per second, per store and app.
- Do not use `document`, `window`, jQuery or `innerHTML` in NubeSDK apps.
- Do not tell a partner that storefront apps run only on some themes. Official themes ship every slot. Check activation per app and store, and check stores whose FTP opened before 2026-05-11.
- Do not bypass homologation for public App Store apps. Private distribution is a separate path.
- Do not put `client_secret` or an `access_token` in a browser bundle, a log or a URL.

## Files

- `templates/webhook-verify.ts`: copy when you receive Nuvemshop webhooks in a TypeScript backend.
- `references/app-development.md`: read when you set up OAuth, call the API, register webhooks or build an embedded app with Nexo and Nimbus.
- `references/nube-sdk.md`: read when a storefront or checkout script, a NubeSDK migration, theme or slot coverage is in play.
- `references/homologation-publication.md`: read when you prepare homologation, publication data or the app description.
- `references/sources.md`: read when you need the page behind a claim or want to recheck one.
- `agents/openai.yaml`: display metadata for OpenAI-style hosts; no need to read it.

## Related skills

No other skill in this repo covers Nuvemshop. For theme work see the official theme skills above.
