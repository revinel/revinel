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
  // apiUrl defaults to the Revinel production API
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
is eligible — the SDK never throws on "no ads").

### Typed creative (`meta`)

`ad.meta` is keyed by each custom field's **stable machine slug** (set when the publisher
creates the field, e.g. `bannerImage` for a "Banner image" field — visible in the Revinel
dashboard). Pass your own interface for typesafe access:

```ts
interface AdMeta {
  tagline?: string
  description?: string
  bannerImage?: string
  ctaLabel?: string
}

const ad = await revinel.getAd<AdMeta>({ weightGte: 2.5 })
ad?.meta.bannerImage // string | undefined — fully typed, no casting
```

The slug is immutable, so renaming a field's display label never breaks your code. Each
entry is also available in `ad.fields` as `{ key, name, type, value }` if you need the
human label.

### Next.js

Pass `request.next` for App Router caching:

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

OpenAPI spec and interactive docs are served at `/v1/openapi.json` and `/v1/docs` on the
Revinel API. For React bindings see [`@revinel/react`](https://www.npmjs.com/package/@revinel/react).
