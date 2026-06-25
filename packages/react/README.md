# @openads/react

React bindings for [OpenAds](https://openads.co) publisher integrations. Covers both
integration jobs:

1. **Render ads** on your site — `OpenAdsProvider` + hooks, on top of [`@openads/sdk`](https://www.npmjs.com/package/@openads/sdk).
2. **Acquire advertisers** — the `<TierSelector>` / `<TierSelectorDialog>` "Subscribe to advertise" widget.

## Install

```sh
npm install @openads/react
```

`react` (>=18) is a peer dependency.

## Render ads

Wrap your app once, then read ads with the hooks:

```tsx
import { OpenAdsProvider, useOpenAdsAd, useOpenAdsTracking } from "@openads/react"

const AdSlot = () => {
  const { data: ad } = useOpenAdsAd({ weightGte: 2.5 }) // premium placement
  const { impressionRef, getClickProps } = useOpenAdsTracking(ad)

  if (!ad) return null // no eligible ad — render nothing

  return (
    <a ref={impressionRef} href={ad.websiteUrl} {...getClickProps()}>
      {ad.name}
    </a>
  )
}

export const Ads = () => (
  <OpenAdsProvider workspaceId="your-workspace-id">
    <AdSlot />
  </OpenAdsProvider>
)
```

`useOpenAdsTracking` records a viewable impression (via `IntersectionObserver`) and wires
click tracking through `getClickProps()`. Use `useOpenAdsAds({ count })` for a grid.

## Tier selector (acquire advertisers)

Inline:

```tsx
import { TierSelector } from "@openads/react"

;<TierSelector workspaceId="your-workspace-id" theme="auto" onCheckout={e => {}} />
```

Or as a controlled modal:

```tsx
import { TierSelectorDialog } from "@openads/react"

const [open, setOpen] = useState(false)
;<TierSelectorDialog open={open} onClose={() => setOpen(false)} workspaceId="your-workspace-id" />
```

Build your own pricing UI instead with `useOpenAdsTiers()` + `useOpenAdsCheckout()`:

```tsx
import { parseTierFeature, useOpenAdsCheckout, useOpenAdsTiers } from "@openads/react"

const { data: tiers } = useOpenAdsTiers()
const { redirectToCheckout, isPending } = useOpenAdsCheckout()
// tiers[].features → parseTierFeature(line) → { type, label }
// redirectToCheckout({ tierPriceId }) creates the session and navigates to Stripe
```

## Exports

- **Provider:** `OpenAdsProvider`, `useOpenAdsClient`
- **Ads:** `useOpenAdsAd`, `useOpenAdsAds`, `useOpenAdsTracking`
- **Tiers/checkout:** `useOpenAdsTiers`, `useOpenAdsCheckout`, `parseTierFeature`
- **Widgets:** `TierSelector`, `TierSelectorDialog`

Every hook's option and return types are exported (`OpenAdsAdOptions`, `OpenAdsQueryState`, …)
so you can type wrappers around them.

## API reference

OpenAPI spec and interactive docs are served at `/v1/openapi.json` and `/v1/docs` on the
OpenAds API.
