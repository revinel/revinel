# @openads/sdk

Universal headless SDK for fetching and tracking [OpenAds](https://openads.co) publisher
ads. Zero dependencies; runs in any JS runtime with `fetch` (browser, Node, edge, workers).

## Install

```sh
npm install @openads/sdk
```

## Usage

```ts
import { createOpenAdsClient } from "@openads/sdk"

const openads = createOpenAdsClient({
  workspaceId: "your-workspace-id",
  // apiUrl defaults to the OpenAds production API
})

// Fetch the single ad currently serving for a placement.
const ad = await openads.getAd({ weightGte: 2.5 })

// Fetch several ads for a grid (rotation-aware; pass excludeIds to dedupe).
const ads = await openads.getAds({ count: 5, excludeIds: ad ? [ad.id] : [] })

// Record events.
if (ad) {
  await openads.recordImpression(ad.id)
  await openads.recordClick(ad.id)
}
```

`getAd` resolves to `OpenAdsAd | null`; `getAds` to `OpenAdsAd[]` (empty when nothing
is eligible — the SDK never throws on "no ads").

### Typed creative (`meta`)

`ad.meta` is keyed by each custom field's **stable machine slug** (set when the publisher
creates the field, e.g. `bannerImage` for a "Banner image" field — visible in the OpenAds
dashboard). Pass your own interface for typesafe access:

```ts
interface AdMeta {
  tagline?: string
  description?: string
  bannerImage?: string
  ctaLabel?: string
}

const ad = await openads.getAd<AdMeta>({ weightGte: 2.5 })
ad?.meta.bannerImage // string | undefined — fully typed, no casting
```

The slug is immutable, so renaming a field's display label never breaks your code. Each
entry is also available in `ad.fields` as `{ key, name, type, value }` if you need the
human label.

### Next.js

Pass `request.next` for App Router caching:

```ts
const ad = await openads.getAd({ request: { next: { revalidate: 60 } } })
```

## Errors

Non-2xx responses throw `OpenAdsApiError` (`{ status, body }`). The `body` is the
OpenAds API error envelope:

```jsonc
{ "defined": false, "code": "NOT_FOUND", "status": 404, "message": "Workspace not found." }
```

Input-validation failures use HTTP **422** with `code: "INPUT_VALIDATION_FAILED"` and a
`data.fieldErrors` / `data.formErrors` map.

## API reference

OpenAPI spec and interactive docs are served at `/v1/openapi.json` and `/v1/docs` on the
OpenAds API. For React bindings see [`@openads/react`](https://www.npmjs.com/package/@openads/react).
