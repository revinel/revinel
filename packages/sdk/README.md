# @revinel/sdk

Universal headless SDK for fetching and tracking [Revinel](https://revinel.com) publisher
ads. Zero dependencies; runs in any JS runtime with `fetch` (browser, Node, edge, workers).

## Install

```sh
npm install @revinel/sdk
```

## Usage

```ts
import { createRevinelClient } from "@revinel/sdk"

const revinel = createRevinelClient({
  workspaceId: "your-workspace-id",
  // apiUrl is optional — it defaults to the Revinel production API. Only set it
  // to point at a local/staging API in development.
})

// Fetch the single ad currently serving for a placement.
const ad = await revinel.getAd({ weightGte: 2.5 })

// Fetch several ads for a grid (rotation-aware; pass excludeIds to dedupe).
const ads = await revinel.getAds({ count: 5, excludeIds: ad ? [ad.id] : [] })

// Record events.
if (ad) {
  await revinel.recordImpression(ad.id)
  await revinel.recordClick(ad.id)
}
```

`getAd` resolves to `RevinelAd | null`; `getAds` to `RevinelAd[]` (empty when nothing
is eligible — the SDK never throws on "no ads"). `ad.faviconUrl` is `string | null`.

> **Fetch on the server.** Ad fetching belongs in your server/edge code (RSC, loader,
> route handler) so the ad is server-rendered — no layout shift, no client waterfall.
> Reach for [`@revinel/react`](https://www.npmjs.com/package/@revinel/react)'s `useAd`
> only in client-only apps.

### Typed creative (`meta`)

`ad.meta` is keyed by each custom field's **stable machine slug** (set when the publisher
creates the field, e.g. `bannerImage` for a "Banner image" field — visible in the Revinel
dashboard). Register your creative shape **once** and every call is typed — no per-call
generic, no cast:

```ts
// revinel.d.ts (or anywhere in your app)
declare module "@revinel/sdk" {
  interface RevinelMetaRegistry {
    tagline?: string
    description?: string
    bannerImage?: string
    ctaLabel?: string
  }
}
```

```ts
const ad = await revinel.getAd({ weightGte: 2.5 })
ad?.meta.bannerImage // string | undefined — fully typed
```

The slug is immutable, so renaming a field's display label never breaks your code. Each
entry is also available in `ad.fields` as `{ key, name, type, value }` if you need the
human label. For a one-off shape (e.g. a multi-workspace app) you can still pass a generic:
`revinel.getAd<{ bannerImage?: string }>()`.

### Next.js / caching

Ad fetches default to `cache: "no-store"` so the weighted rotation stays fresh per request
(Revinel edge-caches the response for 5s on its side). Opt into caching when you want it:

```ts
const ad = await revinel.getAd({ request: { next: { revalidate: 60 } } })
```

## Errors

Non-2xx responses throw `RevinelApiError` (`{ status, body }`). The `body` is the
Revinel API error envelope:

```jsonc
{ "defined": false, "code": "NOT_FOUND", "status": 404, "message": "Workspace not found." }
```

Input-validation failures use HTTP **422** with `code: "INPUT_VALIDATION_FAILED"` and a
`data.fieldErrors` / `data.formErrors` map.

## API reference

Full reference and guides: **[revinel.com/docs](https://revinel.com/docs)**. The OpenAPI
spec is served at `/v1/openapi.json` on the Revinel API. For React bindings see
[`@revinel/react`](https://www.npmjs.com/package/@revinel/react).
