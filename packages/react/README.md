# @revinel/react

React bindings for [Revinel](https://revinel.com) publisher integrations. Covers both
integration jobs:

1. **Render ads** on your site: `RevinelProvider` + hooks, on top of [`@revinel/sdk`](https://www.npmjs.com/package/@revinel/sdk).
2. **Acquire advertisers**: the `<TierSelector>` / `<TierSelectorDialog>` "Subscribe to advertise" widget.

## Install

```sh
npm install @revinel/react
```

`react` (>=18) is a peer dependency.

> **SSR note.** `useAd`/`useAds` fetch on the client. That's fine for client-only apps, but it
> means a layout shift and no server-rendered ad. In an SSR framework (Next.js, Remix,
> TanStack Start), fetch on the server with [`@revinel/sdk`](https://www.npmjs.com/package/@revinel/sdk)'s
> `getAd` and render the markup yourself; use `useTracking` on the client for impressions/clicks.

## Render ads

Wrap your app once, then read ads with the hooks:

```tsx
import { RevinelProvider, useAd, useTracking } from "@revinel/react"

const AdSlot = () => {
  const { data: ad } = useAd({ weight: { gte: 2.5 } }) // premium placement
  const { impressionRef, getClickProps } = useTracking(ad?.id)

  if (!ad) return null // no eligible ad, render nothing

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

`useTracking` takes the ad id (or anything carrying one, like the full ad or your own render
shape), records a viewable impression (via `IntersectionObserver`), and wires click
tracking through `getClickProps()` (which also tracks middle-click / open-in-new-tab).

> **Rendering multiple slots? Use one `useAds({ count: n })`, not `n × useAd()`.** Each
> `useAd()` sends the same request, so the shared edge cache returns the *same* ad every
> time, so you'd render duplicates and double-count impressions. `useAds({ count })` returns
> `n` distinct ads in one call; pass `excludeIds` to dedupe against ads fetched elsewhere.

Type `ad.meta` once via `@revinel/sdk`'s `RevinelMetaRegistry` (see its README) and every
hook is typed with no per-call generic. If `impressionRef` can't sit on your ad element
(e.g. a Slot/`asChild` wrapper that swallows refs), put it on a wrapping element or an
absolutely-positioned sentinel inside the ad.

## Tier selector (acquire advertisers)

`workspaceId` (and optional `appUrl`) are inherited from `RevinelProvider`, so inside one
the widget takes no config props (`theme` defaults to `"auto"`):

```tsx
import { TierSelector } from "@revinel/react"

;<TierSelector onCheckout={e => {}} />
```

Or as a controlled modal:

```tsx
import { TierSelectorDialog } from "@revinel/react"

const [open, setOpen] = useState(false)
;<TierSelectorDialog open={open} onClose={() => setOpen(false)} />
```

Outside a provider, pass `workspaceId` (and `appUrl` for self-hosted) directly:
`<TierSelector workspaceId="your-workspace-id" />`.

Build your own pricing UI instead with `useTiers()` + `useCheckout()`:

```tsx
import { parseTierFeature, useCheckout, useTiers } from "@revinel/react"

const { data: tiers } = useTiers()
const { redirectToCheckout, isPending } = useCheckout()
// tiers[].features → parseTierFeature(line) → { type, label }
// redirectToCheckout({ tierPriceId }) creates the session and navigates to Stripe
```

## Exports

- **Provider:** `RevinelProvider`, `useRevinelClient`, `useRevinelConfig`
- **Ads:** `useAd`, `useAds`, `useTracking`
- **Tiers/checkout:** `useTiers`, `useCheckout`, `parseTierFeature`
- **Widgets:** `TierSelector`, `TierSelectorDialog`

Every hook's option and return types are exported (`RevinelAdOptions`, `RevinelQueryState`, …)
so you can type wrappers around them.

## API reference

Full reference and guides: **[revinel.com/docs](https://revinel.com/docs)**. The OpenAPI
spec is served at `/v1/openapi.json` on the Revinel API.
