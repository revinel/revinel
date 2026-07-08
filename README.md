# Revinel JS

Official JavaScript SDKs for [Revinel](https://revinel.com) — the self-serve ad platform
that lets you **sell ad space on your website directly to advertisers** and turn it into
recurring monthly revenue. No ad network in the middle: advertisers subscribe to your ad
tiers through Stripe, you approve their creative, and you render their ads however you
want with these libraries.

It works anywhere you publish — blogs, newsletters with a web home, directory websites,
docs, and niche content sites that want to monetize with direct sponsorships instead of
programmatic ads.

## How it works

1. **Create ad tiers** in the Revinel dashboard — your pricing, your creative fields
   (logo, tagline, banner image, discount code, anything).
2. **Drop the "Subscribe to advertise" tier selector** on your site — a React component,
   a vanilla embed, or a one-line script tag. Advertisers pick a plan and pay through
   Stripe; you keep billing on your own Stripe account.
3. **Render approved ads with the SDK** — fetch the current rotation, render it in your
   own markup, and let the SDK record viewable impressions and clicks.

## Quick start (React)

```sh
npm install @revinel/react
```

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

No build step? The hosted script mounts the tier selector with one attribute:

```html
<button data-revinel-tier-selector data-revinel-workspace-id="your-workspace-id">
  Advertise with us
</button>
<script async src="https://app.revinel.com/embed.js"></script>
```

## Packages

| Package | What it does |
| --- | --- |
| [`@revinel/sdk`](packages/sdk) | Headless SDK: fetch ads, record impressions/clicks. |
| [`@revinel/react`](packages/react) | React provider, hooks, and the tier-selector components. |
| [`@revinel/browser`](packages/browser) | Vanilla embed runtime (inline + popup tier selector). |
| [`@revinel/embeds`](packages/embeds) | Shared embed `postMessage` protocol (low-level). |

All four are MIT-licensed. See each package's README for install + usage.

## Feedback & contributions

Found a bug or have a request? **Open an issue — we read every one.** This repository is
published from the Revinel release pipeline, so accepted fixes are applied on our side and
land here on the next release (a pull request may be closed in favor of the equivalent change).

## API reference

Full reference and guides: **[revinel.com/docs](https://revinel.com/docs)**. The OpenAPI
spec is served at `/v1/openapi.json` on the Revinel API.
