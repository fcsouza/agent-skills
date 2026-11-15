# NubeSDK

Use the official pages for event names, payloads, slot ids and component props. They change faster than this file.

- Overview: https://nuvemshop.dev/en-US/apps/nube-sdk/overview.md
- Getting started: https://nuvemshop.dev/en-US/apps/nube-sdk/getting-started.md
- Migration guide: https://nuvemshop.dev/en-US/apps/nube-sdk/migration-guide.md
- FAQ: https://nuvemshop.dev/en-US/apps/nube-sdk/faq.md
- Script structure: https://nuvemshop.dev/en-US/apps/nube-sdk/script-structure.md
- Slots: https://nuvemshop.dev/en-US/apps/nube-sdk/slots/overview.md
- Available Slots API (lists the slots on the current page): https://nuvemshop.dev/en-US/apps/nube-sdk/api/available-slots.md
- Events: https://nuvemshop.dev/en-US/apps/nube-sdk/events/overview.md
- Browser APIs: https://nuvemshop.dev/en-US/apps/nube-sdk/browser-apis.md
- After migration (test store, rollout, private apps): https://nuvemshop.dev/en-US/apps/nube-sdk/after-migration.md
- Stores with open FTP: https://nuvemshop.dev/en-US/apps/nube-sdk/ftp-themes.md

## Who needs it and when

Every app that injects scripts into the storefront or checkout needs NubeSDK. Apps that only use the API (ERP, CRM, analytics backends) or run only inside the Admin do not.

| Date | What happens |
| --- | --- |
| 2026-06-05 | New homologation requests for script-injecting apps require NubeSDK validation. |
| 2026-09-30 | Apps subject to the rule that have not migrated are removed from the App Store. The deadline moved from 2026-08-30. |
| 2026-10-30 | Progressive uninstall from stores starts for those apps. |

- Checkout already requires NubeSDK for app scripts. No period lets legacy scripts run there.
- Private apps ("For Your Customers") that inject scripts also need it. They skip homologation. The rule is enforced in the front end, and legacy private apps follow the removal from 2026-10-30.
- The checkout payment-data form is isolated and does not support SDK UI.
- Published apps follow the NubeSDK re-homologation page. It asks for coexistence of the legacy and SDK scripts during rollout, so do not run the same behavior twice. Read https://nuvemshop.dev/en-US/apps/publish/homologation/nube-sdk-rehomologation.md.
- Finishing development does not turn the SDK on in production. Nuvemshop runs a staged rollout after homologation, and you propose the first stores.

## Scaffold and test

- Create the project with `npm create nube-app@latest`. The entry point is an exported `App(nube: NubeSDK)` in `src/main.ts`.
- In the Partner Portal, enable the Scripts permission in Basic data, create the script and turn on "Uses Nube SDK". Scripts that are not auto-installed are associated with a store through `POST /scripts`.
- A test store needs the SDK tag. Request it through the form linked from the overview page.
- For checks while you build, use the NubeSDK DevTools Chrome extension. Its Local Mode shows your dev server only in your own browser. Shoppers get the bundle you uploaded.

## Model

NubeSDK apps run in a Web Worker. They have no `document`, `window`, DOM, jQuery or synchronous storage. `fetch` works in the worker, and the target server must allow CORS.

```ts
import type { NubeSDK } from '@tiendanube/nube-sdk-types';

export function App(nube: NubeSDK) {
  nube.on('cart:update', ({ cart }) => {
    console.log(cart.prices.total);
  });
}
```

`nube` has `on`, `off`, `send`, `getState`, `getBrowserAPIs`, `render` and `clearSlot`. Declarative UI also exists in `@tiendanube/nube-sdk-ui` if you do not use JSX.

## Migration map

| Legacy | NubeSDK |
| --- | --- |
| IIFE, `DOMContentLoaded`, globals | exported `App(nube)` |
| `window.location`, `popstate` | page and lifecycle events; `checkout:ready` for checkout |
| DOM click listeners | data-change events such as `cart:update` and `shipping:update` |
| `document.createElement`, `innerHTML` | `nube.render(slot, component)` |
| DOM reads for cart or customer | `nube.getState()` and event payloads |
| `localStorage`, `sessionStorage` | `asyncLocalStorage`, `asyncSessionStorage` from `nube.getBrowserAPIs()` |
| `window.location.href` | `navigate` from `getBrowserAPIs()`, same domain only |
| Blocking checkout | `config:set` with `has_cart_validation`, then send `cart:validate` |

Not possible: hide arbitrary native elements (the Customization API covers listed targets only), inject JSON-LD into `head`, replace search results, run GTM in the worker (use the Analytics API). See "Known limitations" in the migration guide.

## Theme and slot coverage

This replaces the older rule that storefront apps run only on some themes.

- All official themes ship every NubeSDK slot. On a standard theme the theme is not a restriction.
- The exception is a store whose FTP was opened before 2026-05-11. Its private theme copy has no slots, so no app can render on the storefront. Check the page source for `id="nubesdk-root"`, `id="nubesdk-runtime"` and `class="js-nubesdk-slot"`, or run `grep -rn "nubesdk-slot" .` in the local theme copy. The FTP page explains how to add the slots back.
- Activation is per app and store pair. A theme with slots can still lack activation for your app. Partner support may need to activate it, including for private apps; send the full list of affected store ids.
- Slot availability depends on the page and the theme markup. Inspect the page with the Available Slots API before you pick a slot. Storefront, checkout, fixed, custom (theme-defined, `custom_` prefix) and dynamic section slots are listed on the slots pages.
- `modal_content` opens a dialog. The slots page says how it closes.
- If a script is active in the Portal but does not load, check four things: the SDK tag on the test store, "Uses Nube SDK" on the script plus the store association, an old FTP theme copy, and production activation after homologation. `POST /scripts` returning 409 means the script is already associated; use `GET /scripts` and do not repeat the POST.

## Pitfalls

- A button that never appears on a store is not proof of an unsupported theme. Check the four items above first.
- Do not keep `document` or `window` code "just in case". The worker has neither, and the app fails the SDK check.
- Do not render into a slot you have not confirmed on the current page.
