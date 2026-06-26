# @revinel/react

React bindings for [Revinel](https://revinel.com) publisher integrations. Covers both
integration jobs:

1. **Render ads** on your site — `RevinelProvider` + hooks, on top of [`@revinel/sdk`](https://www.npmjs.com/package/@revinel/sdk).
2. **Acquire advertisers** — the `<TierSelector>` / `<TierSelectorDialog>` "Subscribe to advertise" widget.

## Install

```sh
npm install @revinel/react
```

`react` (>=18) is a peer dependency.

## Render ads

Wrap your app once, then read ads with the hooks:

```tsx
import { RevinelProvider, useAd, useTracking } from "@revinel/react"

const AdSlot = () => {
  const { data: ad } = useAd({ weightGte: 2.5 }) // premium placement
  const { impressionRef, getClickProps } = useTracking(ad)

  if (!ad) return null // no eligible ad — render nothing

  return (
    <a ref={impressionRef} href={ad.websiteUrl} {...getClickProps()}>
      {ad.name}
    </a>
  )
}

export const Ads = () => (
  <RevinelProvider workspaceId="your-workspace-id">
    <AdSlot />
  </RevinelProvider>
)
```

`useTracking` records a viewable impression (via `IntersectionObserver`) and wires
click tracking through `getClickProps()`. Use `useAds({ count })` for a grid.

## Tier selector (acquire advertisers)

Inline:

```tsx
import { TierSelector } from "@revinel/react"

;<TierSelector workspaceId="your-workspace-id" theme="auto" onCheckout={e => {}} />
```

Or as a controlled modal:

```tsx
import { TierSelectorDialog } from "@revinel/react"

const [open, setOpen] = useState(false)
;<TierSelectorDialog open={open} onClose={() => setOpen(false)} workspaceId="your-workspace-id" />
```

Build your own pricing UI instead with `useTiers()` + `useCheckout()`:

```tsx
import { parseTierFeature, useCheckout, useTiers } from "@revinel/react"

const { data: tiers } = useTiers()
const { redirectToCheckout, isPending } = useCheckout()
// tiers[].features → parseTierFeature(line) → { type, label }
// redirectToCheckout({ tierPriceId }) creates the session and navigates to Stripe
```

## Exports

- **Provider:** `RevinelProvider`, `useRevinelClient`
- **Ads:** `useAd`, `useAds`, `useTracking`
- **Tiers/checkout:** `useTiers`, `useCheckout`, `parseTierFeature`
- **Widgets:** `TierSelector`, `TierSelectorDialog`

Every hook's option and return types are exported (`RevinelAdOptions`, `RevinelQueryState`, …)
so you can type wrappers around them.

## API reference

OpenAPI spec and interactive docs are served at `/v1/openapi.json` and `/v1/docs` on the
Revinel API.
