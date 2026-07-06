# @revinel/browser

Browser runtime for embedding the [Revinel](https://revinel.com) **tier selector**, the
"Subscribe to advertise" widget that lets your visitors pick an advertising plan and pay
through Stripe. Renders as an auto-resizing iframe; inline or as a modal.

> Looking to **render ads** on your site? Use [`@revinel/sdk`](https://www.npmjs.com/package/@revinel/sdk)
> (headless) or [`@revinel/react`](https://www.npmjs.com/package/@revinel/react) (hooks + components).

## Install

```sh
npm install @revinel/browser
```

## Inline widget

```ts
import { mountTierSelector } from "@revinel/browser"

const widget = mountTierSelector({
  workspaceId: "your-workspace-id",
  container: "#revinel-tiers", // a CSS selector or an Element
  theme: "auto", // "auto" | "light" | "dark"
  onCheckout: ({ tierPriceId }) => console.log("checkout started", tierPriceId),
})

widget.updateConfig({ theme: "dark" }) // reconfigure in place
widget.destroy() // remove + detach listeners
```

## Popup (modal)

Opens the selector in a native `<dialog>` (focus-trap, Esc, and backdrop handled for you):

```ts
import { openTierSelector } from "@revinel/browser"

document.querySelector("#revinel-tiers-btn").addEventListener("click", () => {
  openTierSelector({ workspaceId: "your-workspace-id", onClose: () => {} })
})
```

## No-code script (hosted)

No bundler needed. Drop in the hosted script and mark any element to open the popup:

```html
<button data-revinel-tier-selector data-revinel-workspace-id="your-workspace-id">
  Advertise with us
</button>
<script async src="https://app.revinel.com/embed.js"></script>
```

The script also exposes `window.Revinel.init({ workspaceId, container })` (inline) and
`window.Revinel.open({ workspaceId })` (popup). Copy a ready-to-paste snippet with your
real workspace ID from the **Embed** page in the Revinel dashboard.

## Options

| Option | Type | Notes |
| --- | --- | --- |
| `workspaceId` | `string` | Required. |
| `container` | `string \| Element` | `mountTierSelector` only. Where to mount the iframe. |
| `theme` | `"auto" \| "light" \| "dark"` | Defaults to `"auto"` (matches the host page). |
| `appUrl` | `string` | Origin serving `/embed`. Defaults to the hosted Revinel app. |
| `height` | `number \| string` | Initial height before the embed reports its own. |
| `title` | `string` | `openTierSelector` only. The modal's accessible label. |

## Events

Pass `onReady`, `onCheckout`, `onError` (and `onClose` for the popup):

- `onReady()`: the selector has loaded and rendered.
- `onCheckout({ tierPriceId })`: fires when the visitor starts checkout, **just before** the
  redirect to Stripe.
- `onError({ message })`: tiers failed to load, or checkout creation failed.

There is no "completed" event: checkout redirects the top window to Stripe, so the embed is
gone by the time payment finishes. Subscription state is delivered to your account by webhook.

## API reference

Full reference and guides: **[revinel.com/docs](https://revinel.com/docs)**. The OpenAPI
spec is served at `/v1/openapi.json` on the Revinel API.
