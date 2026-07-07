# Homologation and Publication

## Official References

- Homologation overview: https://dev.nuvemshop.com.br/docs/homologation/overview
- Homologation process: https://dev.nuvemshop.com.br/docs/homologation/assync
- Homologation requirements: https://dev.nuvemshop.com.br/docs/homologation/requirements
- Homologation best practices: https://dev.nuvemshop.com.br/docs/homologation/guidelines
- Design checklist: https://dev.nuvemshop.com.br/docs/homologation/checklist
- Publication overview: https://dev.nuvemshop.com.br/docs/publication/overview
- Publication requirements: https://dev.nuvemshop.com.br/docs/publication/requirements
- Publication app: https://dev.nuvemshop.com.br/docs/publication/publications

## Homologation Flow

1. In the Partner Portal app page, click `Solicitar homologação`.
2. Nuvemshop sends next steps and artifact requests.
3. Send all required artifacts.
4. Nuvemshop validates artifacts, installation, setup, UX, API practices, security, and performance.
5. If approved, the app proceeds to publication.
6. If there are issues, Nuvemshop sends a list/action plan. Fix each item and return evidence through the same channel.

Non-sensitive apps are usually tested asynchronously by Nuvemshop. ERP, Payments, Shipping, and sensitive-data apps may require demonstrative videos or synchronous/live validation.

## Required Homologation Artifacts

Required artifacts include:

- Sequence diagram.
- Demo video.
- Demo/test account access, especially if signup, plan approval, or restricted access could block reviewers.
- FAQ document.
- Support contacts.
- Any category-specific checklist/evidence requested by Nuvemshop.

## Sequence Diagram

The sequence diagram should show:

- How the app interacts with Nuvemshop APIs.
- Which backend actions are triggered by user/API interactions.
- What happens during each transaction.
- Outputs/results.
- Auth flow and technical interaction.
- Scopes used by the app.

Reviewers use it to detect:

- unnecessary continuous GETs where webhooks should be used.
- unnecessary entity modifications.
- inefficient flows.
- security issues.
- mismatch between required scopes and merchant consent.

## Demo Video

The demo video should cover:

- Installation from Nuvemshop, not from the app panel.
- Install URL: `https://www.tiendanube.com/apps/{app_id}/authorize`.
- Signup for a merchant/user without an existing account.
- Login for an already registered user.
- Reinstall flow after app removal.
- Every sequence-diagram scenario.
- Main app functionality and merchant journey.
- Important interactions needed for review.
- Any technical configuration merchants must perform.

Incomplete videos can return the homologation process.

## Demo Accounts and Restrictions

If the app has subscriptions, plan approval delays, manual account activation, sales contact, or other gates, provide a demo account already released from those restrictions. Inform Nuvemshop beforehand about any unavoidable delays or approval steps.

## Homologation Best Practices

- Read the API docs before development.
- Use pagination for large merchant datasets.
- Include app name and email in `User-Agent`.
- Use webhooks to avoid repeated polling.
- Request only required scopes.
- Align app language with the selected publication geographies.
- Respect rate limits and use response headers.

## Design Checklist

Design requirements are categorized by urgency and obligation.

High-priority requirements:

- NubeSDK usage where required.
- No direct DOM/jQuery/window/document for SDK-required apps.
- Nimbus templates for embedded/admin apps.
- Empty state and initial page.
- Error page.
- Component and pattern usage.
- Customization limits.

Medium/low-priority requirements still matter and can pause homologation:

- action/content prioritization.
- status signaling and feedback messages.
- loading and processing states.
- table organization.
- responsive alignment.
- form organization/signaling.
- app/screen naming.
- UX writing fundamentals.
- Nuvemshop tone of voice.
- text patterns.

## Publication Flow

Publication has two parallel tracks:

1. Send artifacts after requesting homologation.
2. Fill all required Partner Portal fields in `Dados de Publicação`.

Homologation and publication only start after the complete artifact package is received.

An app can be available in the public App Store only after:

- all artifacts and publication items are sent.
- app images and icon are uploaded in requested dimensions.
- short and long descriptions are filled.
- required URLs/contact data/app handle are complete.
- homologation is approved.

## Publication Assets

Images:

- Download/upload from `Imagens do aplicativo`.
- Dimensions must match the Partner Portal requirements.
- Separate package per country/market, such as Brazil, Mexico, Argentina.
- Images should show real app screens and core features.

Icon:

- JPEG or PNG.
- GIF is not supported.
- Use exact requested dimensions.

Billing:

- Free / partner-owned billing, optionally with in-app sales.
- One-time Nuvemshop billing.
- Monthly Nuvemshop billing.

FAQ:

- Mandatory in homologation artifacts.
- Use the category-specific model where applicable.
- Include support contacts, account availability, and common merchant questions.

## App Description Structure

Use the official 8-part structure:

1. Introduction: value proposition and differentiation.
2. What is the app: clear explanation of what it does.
3. How it works: concise steps or bullets.
4. Features: bullet list of core capabilities.
5. Benefits: bullet list of merchant outcomes.
6. Plans and pricing: plans, trial, and Nuvemshop-specific offers.
7. How to integrate: install, accept permissions, create/link account, and start using.
8. Support: channels, SLA, and service hours.

## Landing Page

Use a landing page when post-install flow requires onboarding, partner account creation, sales/support handoff, or next-step education. Avoid sending new merchants straight to a login screen when they may not have credentials yet.
