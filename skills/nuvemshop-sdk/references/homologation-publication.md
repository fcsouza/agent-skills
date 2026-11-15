# Homologation and publication

No official agent skill covers this. Re-read the pages below before you give final advice. The process has changed in 2026.

- Homologation overview: https://nuvemshop.dev/en-US/apps/publish/homologation/overview.md
- Homologation process: https://nuvemshop.dev/en-US/apps/publish/homologation/async.md
- Requirements (artifacts): https://nuvemshop.dev/en-US/apps/publish/homologation/requirements.md
- Best practices: https://nuvemshop.dev/en-US/apps/publish/homologation/guidelines.md
- Design checklist: https://nuvemshop.dev/en-US/apps/publish/homologation/checklist.md
- NubeSDK re-homologation (published apps): https://nuvemshop.dev/en-US/apps/publish/homologation/nube-sdk-rehomologation.md
- Publication guidelines (prohibited apps, install flow): https://nuvemshop.dev/en-US/apps/publish/guidelines.md
- Publication overview and requirements: https://nuvemshop.dev/en-US/apps/publish/app-publication/overview.md and https://nuvemshop.dev/en-US/apps/publish/app-publication/requirements.md
- Pricing and billing: https://nuvemshop.dev/en-US/apps/publish/pricing-billing.md
- Publish FAQ: https://nuvemshop.dev/en-US/apps/publish/faq.md

## Which path

| App | Path |
| --- | --- |
| Public, external panel | Homologation. Give access to its registration and login flow. |
| Public, embedded in the Admin | Homologation. Show opening the app from the demo store's Admin and give access to reproduce it. |
| Private ("For Your Customers") | No homologation. Follow app creation and installation. |
| Injects storefront or checkout scripts | NubeSDK required, private apps included. |
| ERP, Payments, Shipping | Longer path: a demonstration script, a checklist, and an action plan tab. |

## Request flow

1. In the Partners Portal, open the app. In Basic data, enable "App Store". (pt-BR: "Dados básicos", "Loja de Aplicativos".)
2. Click "Request homologation". (pt-BR: "Solicitar homologação".) The platform sends next steps.
3. When the team replies, send the artifacts below.
4. In parallel, fill the required fields in "Publication Data" ("Dados de publicação").
5. The team has up to 30 business days to answer, counted from the day you submit the artifacts. Feedback comes in the same request. Fix each item and return evidence there. The cycle repeats until every item passes.
6. For ERP, Payments and Shipping, the team sends a script to demonstrate. Open items go in the "Action Plan" tab of the checklist. Send a new demonstration video for each fix.

Homologation and publication start only after the full artifact package arrives. Configure the required privacy webhooks in the Partners Portal as well.

## Artifacts

- Sequence diagram. It shows how the app uses the Admin API, what the back end does, what each transaction returns, the auth flow and the scopes. Reviewers look for polling where a webhook fits, needless entity changes (for example setting stock to 0 and back), security gaps, and scopes that differ from what the merchant consents to.
- Demo video with: install from the install URL `https://www.tiendanube.com/apps/(app_id)/authorize` and not from the app panel; sign-up of a new user; login of an existing user; reinstall after removal; every scenario in the diagram; the main features; any setup the merchant must do. An incomplete video sends the request back.
- Demo account access. If a plan, approval wait or manual activation could block review, provide an account already past it, and warn the team about delays in advance.
- FAQ document, from the category template (ERP, Payments, Shipping, or Marketing and others). Include support contacts (level 1, level 2, technical, commercial) and test-account availability.
- If the app has no separate login screen (embedded apps), put the app domain in the login URL field, say it opens inside the Admin, and add the demo store URL and the steps.

## Best practices the reviewers check

- Paginate large lists. Send a `User-Agent` with app name and email.
- Use webhooks instead of repeated GETs. Request only needed scopes.
- Match the app language to the publication countries.
- Respect the rate limit and read its headers.
- Do not build apps the guidelines prohibit: apps that do not use the public APIs, apps that process payments outside the checkout, duplicate apps, apps that mainly share merchant data. Do not ask the merchant to type the store URL at install, and do not use pop-ups for OAuth.
- After install, consume the `code` in the back end and show the app's sign-up or login screen. If you need a handoff step, use a clear landing page.

## Design checklist

Priority and obligation come from the checklist page, not from this file. In short:

- High: NubeSDK where required, with no DOM, `document`, `window` or jQuery; Nimbus templates (empty and initial state page, error page, template customization limits are mandatory); component and pattern use (atomic and composite components and customization limits are mandatory).
- Medium: UX concepts (action prioritization and responsiveness are mandatory; status, feedback, loading, tables and forms are recommended). Failing these can pause homologation.
- Low: UX writing (naming, fundamentals, tone of voice, text patterns, all mandatory).

## Publication data

The app goes live only when all artifacts and publication items are sent, images and icon are uploaded in the requested sizes, the short and long descriptions are filled, and homologation is approved.

- Images: one package per country. They show real app screens and the main features.
- Icon: JPEG or PNG, no GIF, exact requested size.
- Billing model: Free (your own billing, optionally with in-app sales), one-time fee (Nuvemshop billing) or monthly fee (Nuvemshop billing). Set per country. Prices and countries lock while the app is "In approval". Ask partner support to return it to "In development" to change them.
- Update the app name while it is in development, before review.

## App description (official 8-part structure)

Short description first, then the long description:

1. Introduction: value proposition and differentiator.
2. What the app is.
3. How it works: short steps or bullets.
4. Features: bullets.
5. Benefits: bullets.
6. Plans and prices, with Nuvemshop-specific offers.
7. How to integrate: install, accept permissions, create or link the account.
8. Merchant support: channels, response time, hours.

## After publication

Join the Partners Program for support and co-marketing: https://www.tiendanube.com/partners. A merchant rates an app from its three-dot menu in the Admin's Applications list.
