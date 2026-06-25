# @openads/browser

Browser runtime for embedding the [OpenAds](https://openads.co) **tier selector** — the
"Subscribe to advertise" widget that lets your visitors pick an advertising plan and pay
through Stripe. Renders as an auto-resizing iframe; inline or as a modal.

> Looking to **render ads** on your site? Use [`@openads/sdk`](https://www.npmjs.com/package/@openads/sdk)
> (headless) or [`@openads/react`](https://www.npmjs.com/package/@openads/react) (hooks + components).

## Install

```sh
npm install @openads/browser
```

## Inline widget

```ts
import { mountTierSelector } from "@openads/browser"

const widget = mountTierSelector({
  workspaceId: "your-workspace-id",
  container: "#advertise", // a CSS selector or an Element
  theme: "auto", // "auto" | "light" | "dark"
  onCheckout: ({ tierPriceId }) => console.log("checkout started", tierPriceId),
})

widget.updateConfig({ theme: "dark" }) // reconfigure in place
widget.destroy() // remove + detach listeners
```

## Popup (modal)

Opens the selector in a native `<dialog>` (focus-trap, Esc, and backdrop handled for you):

```ts
import { openTierSelector } from "@openads/browser"

document.querySelector("#advertise-btn").addEventListener("click", () => {
  openTierSelector({ workspaceId: "your-workspace-id", onClose: () => {} })
})
```

## No-code script (hosted)

No bundler needed — drop in the hosted script and mark any element to open the popup:

```html
<button data-openads-tier-selector data-openads-workspace-id="your-workspace-id">
  Advertise with us
</button>
<script async src="https://app.openads.co/embed.js"></script>
```

The script also exposes `window.OpenAds.init({ workspaceId, container })` (inline) and
`window.OpenAds.open({ workspaceId })` (popup). Copy a ready-to-paste snippet with your
real workspace ID from the **Embed** page in the OpenAds dashboard.

## Options

| Option | Type | Notes |
| --- | --- | --- |
| `workspaceId` | `string` | Required. |
| `container` | `string \| Element` | `mountTierSelector` only — where to mount the iframe. |
| `theme` | `"auto" \| "light" \| "dark"` | Defaults to `"auto"` (matches the host page). |
| `appUrl` | `string` | Origin serving `/embed`. Defaults to the hosted OpenAds app. |
| `height` | `number \| string` | Initial height before the embed reports its own. |
| `title` | `string` | `openTierSelector` only — the modal's accessible label. |

## Events

Pass `onReady`, `onCheckout`, `onError` (and `onClose` for the popup):

- `onReady()` — the selector has loaded and rendered.
- `onCheckout({ tierPriceId })` — fires when the visitor starts checkout, **just before** the
  redirect to Stripe.
- `onError({ message })` — tiers failed to load, or checkout creation failed.

There is no "completed" event: checkout redirects the top window to Stripe, so the embed is
gone by the time payment finishes — subscription state is delivered to your account by webhook.

## API reference

OpenAPI spec and interactive docs are served at `/v1/openapi.json` and `/v1/docs` on the
OpenAds API.
