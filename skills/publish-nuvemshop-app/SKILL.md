---
name: publish-nuvemshop-app
description: Prepare, audit, implement, homologate, and publish Nuvemshop/Tiendanube apps. Use when the user needs help with Nuvemshop Partner Portal app creation, public App Store publication, private client distribution, OAuth, scopes, webhooks, API usage, NubeSDK migration or development, Nexo embedded admin apps, Nimbus/design requirements, homologation artifacts, demo videos, FAQ/support docs, billing/publication data, app descriptions, or approval checklists.
---

# Publish Nuvemshop App

## Core Rule

Verify the current official DevHub docs before final homologation or publication advice. Nuvemshop requirements changed in 2026 around NubeSDK, and publication approval depends on current Partner Portal rules.

## Reference Routing

Read only the relevant reference files:

- `references/docs-index.md`: source coverage, canonical URLs, and what each docs section contains.
- `references/app-development.md`: app types, Partner Portal setup, OAuth, Nexo, Nimbus, templates, API headers, scopes, webhooks, rate limits, and pagination.
- `references/public-api.md`: public API versioning, base URLs, request rules, errors, rate limits, pagination, scopes, and core resources/endpoints.
- `references/nimbus-design-system.md`: Nimbus components, patterns, templates, tokens, resources, and UI construction guidance.
- `references/nube-sdk.md`: NubeSDK deadlines, migration rules, Web Worker constraints, script structure, events/state/slots/components, browser APIs, and implementation checks.
- `references/homologation-publication.md`: homologation flow, required artifacts, sequence diagram, demo video, support/FAQ, design checklist, publication assets, billing, app description, and submission readiness.

## Workflow

1. Classify the app:
   - Public App Store (`Loja de Aplicativos`) or private distribution (`Para seus clientes`).
   - Embedded admin app, external app, storefront/checkout NubeSDK app, ERP, Payments, Shipping, or sensitive-data integration.
   - New build, migration from legacy script, or already-built app audit.

2. Load the relevant references:
   - OAuth/API/webhooks/scopes: read `app-development.md`.
   - Public API endpoints/resources: read `public-api.md`.
   - Nimbus UI, patterns, tokens, or templates: read `nimbus-design-system.md`.
   - Storefront/checkout script or DOM injection: read `nube-sdk.md`.
   - Homologation/publication readiness: read `homologation-publication.md`.
   - Unclear docs scope or URLs: read `docs-index.md`.

3. Audit readiness:
   - Partner Portal app exists and distribution type is correct.
   - Demo store installation works from `https://www.tiendanube.com/apps/{app_id}/authorize`.
   - Production redirect URL is configured; generated test redirect URL is not used in production.
   - OAuth/token exchange works, `user_id` is stored as store id, and updated scopes trigger reinstall/new token flow.
   - API calls include `Authorization`, `User-Agent`, pagination, rate-limit handling, and webhook-driven updates where appropriate.
   - Embedded apps use Nexo, Nimbus, route sync, session token handling, and `ErrorBoundary`.
   - NubeSDK-required apps use `App(nube)`, events/state/slots/components/browser APIs, and do not use direct DOM APIs.
   - Homologation artifacts, publication assets, support contacts, FAQ, and publication data are complete.

4. Produce the requested deliverable:
   - For audits, lead with blockers and evidence.
   - For implementation, give exact code/task steps scoped to the app type.
   - For publication prep, produce a checklist plus missing artifacts.
   - For descriptions, use the official 8-part publication description structure.

## Audit Output

```markdown
## Status
Ready / Blocked / Needs fixes

## Blocking Items
- ...

## Technical Readiness
- ...

## Homologation Artifacts
- ...

## Publication Assets
- ...

## Official Docs Checked
- ...
```

## Hard Pitfalls

- Do not say an app is publishable without checking NubeSDK, scopes, LGPD/webhooks, API usage, sequence diagram, demo video, FAQ/support contacts, publication assets, and publication fields.
- Do not recommend broad scopes. Unnecessary permissions can fail homologation.
- Do not recommend polling when webhooks cover the event.
- Do not ignore rate limits: default bucket is 40 requests with 2 requests/second leak rate per store/app.
- Do not use `document`, `window`, jQuery, `innerHTML`, or DOM injection in NubeSDK-required apps.
- Do not bypass homologation for public App Store apps. Private distribution is a different path.
