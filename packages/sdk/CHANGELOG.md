# @revinel/sdk

## 0.9.0

## 0.8.0

## 0.7.0

### Minor Changes

- [#277](https://github.com/revinel/platform/pull/277) [`a63d4e9`](https://github.com/revinel/platform/commit/a63d4e93ff6a6a13487d7527dc88bdbe8768a649) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - `getTiers()` now calls `GET /v1/workspaces/{id}/tiers/serving` (moved from `/tiers`). The bare `/tiers` path is now the authenticated tier-management endpoint. Rebuild against a Revinel API that serves the new path.

### Patch Changes

- [#281](https://github.com/revinel/platform/pull/281) [`184d608`](https://github.com/revinel/platform/commit/184d60815c00ee9f0d7391ac99450272bc28e6b2) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Tier features are now structured objects instead of prefixed strings. `RevinelTier.features` is `RevinelTierFeature[]` (`{ label, type }`, where `type` is `positive | neutral | negative`) rather than `string[]`, and the `parseTierFeature` helper is removed. Read `feature.label` and `feature.type` directly.

## 0.6.0

### Minor Changes

- [#271](https://github.com/revinel/platform/pull/271) [`b9e8b23`](https://github.com/revinel/platform/commit/b9e8b23523b6137c9c244a5252e5eaa8dfee47f4) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Normalize the public REST API paths the SDK targets. Ad serving is now `GET /v1/workspaces/{id}/ads/serving` (was `.../ads/current`), tracking uses plural sub-collections `POST /v1/ads/{adId}/impressions` and `.../clicks` (were `/impression` and `/click`), and checkout is workspace-scoped at `POST /v1/workspaces/{id}/checkout-sessions` (was `POST /v1/checkout`). The SDK's public method signatures are unchanged; only the endpoints called under the hood moved, so the client must be paired with an API on the matching version.

## 0.5.1

### Patch Changes

- [#265](https://github.com/revinel/platform/pull/265) [`75b1c42`](https://github.com/revinel/platform/commit/75b1c426c66b845dc4f46bec7356aab51984be3c) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Type `createRevinelClient` with an explicit `RevinelClient` interface so `getAd`/`getAds` keep their `TMeta = RevinelMeta` default in the emitted `.d.ts`.

  Previously the client's return type was inferred (`ReturnType<typeof createRevinelClient>`), and TypeScript resolves a generic's conditional-type default when it synthesizes an inferred return type — against the SDK's own empty `RevinelMetaRegistry` at build time — so the shipped types collapsed to `<TMeta = Record<string, unknown>>`. A publisher's `ad.meta` augmentation therefore didn't flow through `client.getAd()` / `getAds()` (or `useRevinelClient()`) without a per-call generic. Declaring the return type explicitly emits the default verbatim, so `ad.meta` is typed from the augmented registry with no annotation.

  Also exports `TrackResponse` and enables `isolatedDeclarations` for the package, which enforces explicit types on every export so this class of inference-driven type drift can't recur.

## 0.5.0

### Minor Changes

- [#261](https://github.com/revinel/platform/pull/261) [`68df90b`](https://github.com/revinel/platform/commit/68df90bc402536f810c291fe40979e220b7b3031) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Replace the one-sided `weightGte` placement option with a full range filter `weight: { gte?, gt?, lte?, lt? }` on `getAd`/`getAds` (and the `useAd`/`useAds` hooks). Publishers can now target a weight band — e.g. `{ gte: 2.5 }` for premium, `{ lt: 2.5 }` for regular cards, or `{ gte: 2.5, lt: 5 }` for a range. **Breaking:** `weightGte: n` becomes `weight: { gte: n }`.

  Let `tierId` accept a single id **or an array** of tier ids, so a fixed slot can be backed by a set of tiers (served as a Prisma `in` filter). `tierId: "t1"` is unchanged; `tierId: ["t1", "t2"]` is new.

  On the `/v1` REST surface the range filter is expressed with bracket notation (`?weight[gte]=2.5&weight[lt]=5`) and a tier set is comma-joined (`?tierId=t1,t2`), keeping the SDK, hooks, and raw API consistent.

### Patch Changes

- [`a23de4f`](https://github.com/revinel/platform/commit/a23de4f585e6221b9bd1de491614a5940d506957) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Remove the redundant `fields` array (and `RevinelFieldValue` / `RevinelFieldType` types) from `RevinelAd`. Every creative value is already on `ad.meta` keyed by field slug; the array was duplicate data on the wire with no consumer.

## 0.4.0

### Minor Changes

- [#255](https://github.com/revinel/platform/pull/255) [`ef327c3`](https://github.com/revinel/platform/commit/ef327c3258b8d956846f9464d0b5f2d0fcc24b98) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Add a `tierId` placement option to `getAd`/`getAds` (and the `useAd`/`useAds` hooks) for serving a fixed slot backed by one specific tier — the deterministic complement to `weightGte`.

  Raise the ads-per-request cap to 50; an over-cap `count` is now clamped by the API instead of rejected with a 422 (which a publisher fail-safe would turn into an empty grid).

  Enrich `RevinelApiError` with the server's error message and add `isClientError` / `isServerError` getters, so a fail-safe can rethrow 4xx caller bugs while still degrading gracefully on 5xx / network failures.

## 0.3.0

### Minor Changes

- [#219](https://github.com/revinel/platform/pull/219) [`05cb02f`](https://github.com/revinel/platform/commit/05cb02fdb4601a7e4a6ffe36c68238dd6e0b4182) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Default ad requests (`getAd`/`getAds`) to `next: { revalidate: 60 }` instead of `cache: "no-store"`. An explicit no-store fetch marks Next.js App Router routes dynamic and 500s statically-generated pages at runtime (`DYNAMIC_SERVER_USAGE`); a 60s revalidate keeps rotation fresh without freezing an ad forever and stays cacheable so static pages can prerender (the API edge-caches ~5s anyway, so per-request rotation was always approximate). Non-Next runtimes ignore the `next` key; server fetches (Node/edge) stay uncached, while browsers now honor the response `Cache-Control` (`max-age=5`), the same ~5s reuse the API's edge cache already imposes. Any caller-set `cache` or `next.revalidate` still replaces the default — pass `request: { cache: "no-store" }` for true per-request rotation on dynamic pages. `getTiers` keeps its `no-store` default so a stale tier list never sends a checkout to an archived price.

### Patch Changes

- [#170](https://github.com/revinel/platform/pull/170) [`e2cd94b`](https://github.com/revinel/platform/commit/e2cd94b4f498b899f861a05ff1a920900c95a76e) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Default `getTiers` to `cache: "no-store"` (matching `getAd`/`getAds`) unless the caller sets `cache` or `next.revalidate`, so framework fetch caches (e.g. Next.js App Router) never freeze the tier list and send checkouts to an archived `tierPriceId`.

- [#183](https://github.com/revinel/platform/pull/183) [`b2f590c`](https://github.com/revinel/platform/commit/b2f590c27c58c1a9e1b5e777d86863bcbcb4ee79) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Abort SDK requests after 10 seconds by default (via `AbortSignal.timeout`), so a hung connection rejects instead of leaving callers — e.g. `useAd`'s `isLoading` — stuck forever. Override or disable with the new `timeoutMs` client option (`number | false`, forwarded by `RevinelProvider`); a request that carries its own `signal` is left untouched.

- [#211](https://github.com/revinel/platform/pull/211) [`14a15db`](https://github.com/revinel/platform/commit/14a15dba58cb56459abf8e38aab25b3fa1125171) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Docs: warn against `n × getAd()` / `n × useAd()` for multi-slot pages (use one `getAds`/`useAds({ count })` to avoid rendering the same cached ad and double-counting impressions), correct the ad-serving cache note to the actual `Cache-Control` (`max-age=5, s-maxage=15, stale-while-revalidate=60`), and note that `getClickProps` also tracks middle-click / open-in-new-tab. README-only.

- [#202](https://github.com/revinel/platform/pull/202) [`2981a8e`](https://github.com/revinel/platform/commit/2981a8ef2543ecac6369aa7ee1f106b11109ba03) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Robustness fixes across the public SDK surface:

  - `@revinel/browser`: the `embed.js` queue replay now wraps each queued call in try/catch (logging via `console.error`), so one malformed queued `init` no longer aborts the remaining queued calls.
  - `@revinel/react`: `<TierSelector>` renders `null` instead of throwing when no `workspaceId` resolves, and the missing-id guard no longer sits between hooks — an error-boundary re-render can't change the component's hook count.
  - `@revinel/sdk`: `createCheckout` now merges caller-passed `options.headers` with the JSON `content-type` header instead of letting the options spread clobber it.

## 0.2.0

### Minor Changes

- [#85](https://github.com/revinel/platform/pull/85) [`2ad4dec`](https://github.com/revinel/platform/commit/2ad4dec32fc86b2a14dd2dd55e9b406e7cde1ce4) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Integration DX pass (from the first publisher integration). Breaking changes, pre-1.0 — no compat shims.

  - **`RevinelMetaRegistry`** (`@revinel/sdk`): type `ad.meta` globally via declaration merging — `declare module "@revinel/sdk" { interface RevinelMetaRegistry { … } }` — and every `getAd`/`getAds`/`useAd`/`useAds` is typed with no per-call generic. `RevinelAd<TMeta = RevinelMeta>` keeps the generic as a one-off override.
  - **Fresh rotation by default** (`@revinel/sdk`): `getAd`/`getAds` default the fetch to `cache: "no-store"` unless the caller sets `cache` or `next.revalidate`. No more hand-written `request: { cache: "no-store" }`.
  - **`RevinelAd.faviconUrl` is now `string | null`** (was `string`) — `null` when no favicon was found.
  - **`RevinelProvider` accepts `appUrl`** and exposes `{ workspaceId, appUrl }` via the new `useRevinelConfig`. `<TierSelector>` / `<TierSelectorDialog>` inherit `workspaceId`/`appUrl` from the provider, so inside one they take no config props (still work standalone with explicit props).
  - **`useTracking(adId)`**: now takes the ad id directly (or anything with `.id`); the `<TMeta>` generic is gone. Removes the `as RevinelAd` cast when tracking a reduced render shape.
