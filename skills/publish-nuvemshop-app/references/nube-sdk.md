# NubeSDK

## Official References

- Overview: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/overview
- Getting started: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/getting-started
- Migration guide: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/migration-guide
- Script structure: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/script-structure
- Browser APIs: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/browser-apis
- Components: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/components/overview
- Slots overview: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/slots/overview
- Checkout slots: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/slots/checkout-slots
- Storefront slots: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/slots/storefront-slots
- Events: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/events/overview
- State: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/state/overview
- Styling: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/styling/overview
- Examples: https://dev.nuvemshop.com.br/docs/applications/nube-sdk/examples/overview

## 2026 Requirements

- 2026-06-05: NubeSDK is mandatory for approval of new apps in homologation.
- 2026-08-30: apps not built with NubeSDK cannot receive new installations; existing installations are not affected by that date.
- 2026-10-30: private apps that inject scripts are progressively enforced/removed if still legacy.

Re-check official docs before final advice because rollout language can change.

## Model

NubeSDK apps run inside browser Web Workers. They cannot directly access `document`, `window`, DOM APIs, jQuery, React DOM, Vue DOM, Angular DOM, or synchronous browser storage.

Use:

- `nube.on(...)` to listen to commerce/location/state events.
- `nube.send(...)` to dispatch actions or modify allowed state.
- `nube.getState()` to read immutable state.
- `nube.render(slot, component)` to render UI into predefined slots.
- `nube.clearSlot(slot)` to remove slot content.
- `nube.getBrowserAPIs()` for async storage, navigation, iframe messaging, and form helpers.

Main entry:

```ts
import type { NubeSDK } from '@tiendanube/nube-sdk-types';

export function App(nube: NubeSDK) {
  // app code
}
```

## Migration Rules

Replace legacy patterns:

- `DOMContentLoaded`, IIFEs, globals -> exported `App(nube)`.
- `window.location`/`popstate` -> `location:updated`, `checkout:ready`, or other events.
- DOM click listeners -> data-change events such as `cart:update`, `shipping:update`, `payment:update`, `customer:update`.
- `document.createElement`, `innerHTML`, direct insertion -> `nube.render(slot, component)`.
- DOM reads for cart/customer/order -> `nube.getState()` and state/event payloads.
- `localStorage`/`sessionStorage` -> async storage through `nube.getBrowserAPIs()`.
- `window.location.href` -> `browser.navigate(...)` for same-domain navigation.
- direct checkout blocking -> `config:set` plus validation events such as `cart:validate`.

Migration checklist:

- All UI is rendered through `nube.render()`.
- No `document`, `window`, jQuery, `innerHTML`, DOM query, or DOM insertion.
- All logic uses `nube.on`, `nube.send`, and `nube.getState`.
- Browser storage uses async browser APIs.
- Slot choices are explicit and supported on the intended page/theme.

## Script Structure

`NubeSDK` exposes:

- `on(event, listener)`
- `off(event, listener)`
- `send(event, modifier?)`
- `getState()`
- `getBrowserAPIs()`
- `render(slot, component | component[] | state => component)`
- `clearSlot(slot)`

Configuration event:

- `config:set`
- `has_cart_validation`: tell NubeSDK the app validates cart contents.
- `disable_shipping_more_options`: disable alternative shipping option selection.

## Slots

Slots are predefined containers for UI. They are the replacement for DOM injection.

Slot families:

- Checkout slots: checkout start/payment/success pages.
- Storefront slots: home, product, category, search, cart, register.
- Fixed slots: `corner_top_left`, `corner_top_right`, `corner_bottom_left`, `corner_bottom_right`, `edge_top_center`, `edge_bottom_center`, `edge_left_center`, `edge_right_center`, `modal_content`.

Checkout examples:

- `before_main_content`, `after_main_content`, `after_header`
- `before_line_items`, `after_line_items`, `after_line_items_price`
- `before_contact_form`, `after_contact_form`
- `before_address_form`, `after_address_form`
- `before_shipping_form`, `after_shipping_form`, `after_shipping_description`
- `before_payment_options`, `after_payment_options`
- success page: `before_order_number`, `after_order_number`, `before_order_summary`, `after_order_summary`

Storefront examples:

- `before_main_content`, `after_header`, `drawer_left`, `drawer_right`
- product grid card slots around name, price, and image corners
- product detail slots around name, price, payment options, shipping options, add-to-cart, and description
- cart slots: `before_line_items`, `before_line_item`, `after_cart_summary`, `after_go_to_checkout`, shipping option slots
- home section slots around sale/new/featured/newsletter sections
- register form slots

Slot caveats:

- Some storefront slots depend on theme and section presence.
- Patagonia transparent header can hide `after_header`.
- Use stable `key` props for rendered components.
- Clear slot content when no longer valid.
- `modal_content` opens a dialog and dispatches `custom:modal:close` on close.

## Events and State

Use the docs for exact event names and payloads. Important event/state areas:

- Cart
- Coupon
- Customer and payment
- Order
- Page and lifecycle
- Shipping
- UI and custom events
- Store/device/config

Common examples:

- Listen to `cart:update` to react to cart changes.
- Send `cart:validate` after enabling `has_cart_validation`.
- Listen to shipping/payment/customer/order update events instead of DOM reads or click handlers.

## Browser APIs

Because NubeSDK runs in Web Workers, browser APIs are bridged asynchronously through `nube.getBrowserAPIs()`.

Use these for:

- async local/session storage, optionally with TTL.
- navigation within the current domain.
- iframe messaging when using the NubeSDK `Iframe` component.
- form helpers such as submit/reset where documented.

External navigation is not supported by the same-domain `navigate` helper.

## Components and Styling

NubeSDK includes JSX and declarative component APIs. Use NubeSDK components and theme-aware styling rather than custom DOM/CSS injection.

Relevant component groups include layout, text, buttons, fields/forms, checkbox/select/textarea, images/SVG/icons, links, progress, popovers, accordions, toasts, markdown, iframe, rows/columns/boxes/fragments.

Styling docs cover `styled()`, `StyleSheet`, theme tokens, best practices, and complete examples.
