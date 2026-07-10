# @revinel/react

## 0.8.0

### Minor Changes

- [#291](https://github.com/revinel/platform/pull/291) [`add3fb1`](https://github.com/revinel/platform/commit/add3fb1b19731a2aa1587c974ee5fa19a73365c2) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - `useTracking` accepts a `resetKey` option. Impressions fire once per ad id for the component's lifetime; pass a `resetKey` that changes per page view (e.g. the current pathname) to re-arm tracking for a layout-persistent ad that never remounts on client-side navigation, restoring one impression per page view.

### Patch Changes

- Updated dependencies []:
  - @revinel/embeds@0.8.0
  - @revinel/sdk@0.8.0

## 0.7.0

### Patch Changes

- [#281](https://github.com/revinel/platform/pull/281) [`184d608`](https://github.com/revinel/platform/commit/184d60815c00ee9f0d7391ac99450272bc28e6b2) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Tier features are now structured objects instead of prefixed strings. `RevinelTier.features` is `RevinelTierFeature[]` (`{ label, type }`, where `type` is `positive | neutral | negative`) rather than `string[]`, and the `parseTierFeature` helper is removed. Read `feature.label` and `feature.type` directly.

- Updated dependencies [[`a63d4e9`](https://github.com/revinel/platform/commit/a63d4e93ff6a6a13487d7527dc88bdbe8768a649), [`184d608`](https://github.com/revinel/platform/commit/184d60815c00ee9f0d7391ac99450272bc28e6b2)]:
  - @revinel/sdk@0.7.0
  - @revinel/embeds@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`b9e8b23`](https://github.com/revinel/platform/commit/b9e8b23523b6137c9c244a5252e5eaa8dfee47f4)]:
  - @revinel/sdk@0.6.0
  - @revinel/embeds@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [[`75b1c42`](https://github.com/revinel/platform/commit/75b1c426c66b845dc4f46bec7356aab51984be3c)]:
  - @revinel/sdk@0.5.1
  - @revinel/embeds@0.5.1

## 0.5.0

### Minor Changes

- [#261](https://github.com/revinel/platform/pull/261) [`68df90b`](https://github.com/revinel/platform/commit/68df90bc402536f810c291fe40979e220b7b3031) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Replace the one-sided `weightGte` placement option with a full range filter `weight: { gte?, gt?, lte?, lt? }` on `getAd`/`getAds` (and the `useAd`/`useAds` hooks). Publishers can now target a weight band — e.g. `{ gte: 2.5 }` for premium, `{ lt: 2.5 }` for regular cards, or `{ gte: 2.5, lt: 5 }` for a range. **Breaking:** `weightGte: n` becomes `weight: { gte: n }`.

  Let `tierId` accept a single id **or an array** of tier ids, so a fixed slot can be backed by a set of tiers (served as a Prisma `in` filter). `tierId: "t1"` is unchanged; `tierId: ["t1", "t2"]` is new.

  On the `/v1` REST surface the range filter is expressed with bracket notation (`?weight[gte]=2.5&weight[lt]=5`) and a tier set is comma-joined (`?tierId=t1,t2`), keeping the SDK, hooks, and raw API consistent.

### Patch Changes

- Updated dependencies [[`a23de4f`](https://github.com/revinel/platform/commit/a23de4f585e6221b9bd1de491614a5940d506957), [`68df90b`](https://github.com/revinel/platform/commit/68df90bc402536f810c291fe40979e220b7b3031)]:
  - @revinel/sdk@0.5.0
  - @revinel/embeds@0.5.0

## 0.4.0

### Minor Changes

- [#255](https://github.com/revinel/platform/pull/255) [`ef327c3`](https://github.com/revinel/platform/commit/ef327c3258b8d956846f9464d0b5f2d0fcc24b98) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Add a `tierId` placement option to `getAd`/`getAds` (and the `useAd`/`useAds` hooks) for serving a fixed slot backed by one specific tier — the deterministic complement to `weightGte`.

  Raise the ads-per-request cap to 50; an over-cap `count` is now clamped by the API instead of rejected with a 422 (which a publisher fail-safe would turn into an empty grid).

  Enrich `RevinelApiError` with the server's error message and add `isClientError` / `isServerError` getters, so a fail-safe can rethrow 4xx caller bugs while still degrading gracefully on 5xx / network failures.

### Patch Changes

- Updated dependencies [[`ef327c3`](https://github.com/revinel/platform/commit/ef327c3258b8d956846f9464d0b5f2d0fcc24b98)]:
  - @revinel/sdk@0.4.0
  - @revinel/embeds@0.4.0

## 0.3.0

### Patch Changes

- [#183](https://github.com/revinel/platform/pull/183) [`b2f590c`](https://github.com/revinel/platform/commit/b2f590c27c58c1a9e1b5e777d86863bcbcb4ee79) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Abort SDK requests after 10 seconds by default (via `AbortSignal.timeout`), so a hung connection rejects instead of leaving callers — e.g. `useAd`'s `isLoading` — stuck forever. Override or disable with the new `timeoutMs` client option (`number | false`, forwarded by `RevinelProvider`); a request that carries its own `signal` is left untouched.

- [#211](https://github.com/revinel/platform/pull/211) [`14a15db`](https://github.com/revinel/platform/commit/14a15dba58cb56459abf8e38aab25b3fa1125171) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Docs: warn against `n × getAd()` / `n × useAd()` for multi-slot pages (use one `getAds`/`useAds({ count })` to avoid rendering the same cached ad and double-counting impressions), correct the ad-serving cache note to the actual `Cache-Control` (`max-age=5, s-maxage=15, stale-while-revalidate=60`), and note that `getClickProps` also tracks middle-click / open-in-new-tab. README-only.

- [#202](https://github.com/revinel/platform/pull/202) [`2981a8e`](https://github.com/revinel/platform/commit/2981a8ef2543ecac6369aa7ee1f106b11109ba03) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Robustness fixes across the public SDK surface:

  - `@revinel/browser`: the `embed.js` queue replay now wraps each queued call in try/catch (logging via `console.error`), so one malformed queued `init` no longer aborts the remaining queued calls.
  - `@revinel/react`: `<TierSelector>` renders `null` instead of throwing when no `workspaceId` resolves, and the missing-id guard no longer sits between hooks — an error-boundary re-render can't change the component's hook count.
  - `@revinel/sdk`: `createCheckout` now merges caller-passed `options.headers` with the JSON `content-type` header instead of letting the options spread clobber it.

- [#186](https://github.com/revinel/platform/pull/186) [`86091ff`](https://github.com/revinel/platform/commit/86091ff420670e1f484a7a57b44a9958aab62f67) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Track middle-clicks and open-in-new-tab as ad clicks. `useTracking`'s `getClickProps` now also wires `onAuxClick` (filtered to the middle mouse button), so clicks that navigate via `auxclick` instead of `click` are recorded. Previously these were silently dropped, making publisher CTR read artificially low.

- Updated dependencies [[`e2cd94b`](https://github.com/revinel/platform/commit/e2cd94b4f498b899f861a05ff1a920900c95a76e), [`05cb02f`](https://github.com/revinel/platform/commit/05cb02fdb4601a7e4a6ffe36c68238dd6e0b4182), [`b2f590c`](https://github.com/revinel/platform/commit/b2f590c27c58c1a9e1b5e777d86863bcbcb4ee79), [`14a15db`](https://github.com/revinel/platform/commit/14a15dba58cb56459abf8e38aab25b3fa1125171), [`2981a8e`](https://github.com/revinel/platform/commit/2981a8ef2543ecac6369aa7ee1f106b11109ba03)]:
  - @revinel/sdk@0.3.0
  - @revinel/embeds@0.3.0

## 0.2.0

### Minor Changes

- [#85](https://github.com/revinel/platform/pull/85) [`2ad4dec`](https://github.com/revinel/platform/commit/2ad4dec32fc86b2a14dd2dd55e9b406e7cde1ce4) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Integration DX pass (from the first publisher integration). Breaking changes, pre-1.0 — no compat shims.

  - **`RevinelMetaRegistry`** (`@revinel/sdk`): type `ad.meta` globally via declaration merging — `declare module "@revinel/sdk" { interface RevinelMetaRegistry { … } }` — and every `getAd`/`getAds`/`useAd`/`useAds` is typed with no per-call generic. `RevinelAd<TMeta = RevinelMeta>` keeps the generic as a one-off override.
  - **Fresh rotation by default** (`@revinel/sdk`): `getAd`/`getAds` default the fetch to `cache: "no-store"` unless the caller sets `cache` or `next.revalidate`. No more hand-written `request: { cache: "no-store" }`.
  - **`RevinelAd.faviconUrl` is now `string | null`** (was `string`) — `null` when no favicon was found.
  - **`RevinelProvider` accepts `appUrl`** and exposes `{ workspaceId, appUrl }` via the new `useRevinelConfig`. `<TierSelector>` / `<TierSelectorDialog>` inherit `workspaceId`/`appUrl` from the provider, so inside one they take no config props (still work standalone with explicit props).
  - **`useTracking(adId)`**: now takes the ad id directly (or anything with `.id`); the `<TMeta>` generic is gone. Removes the `as RevinelAd` cast when tracking a reduced render shape.

### Patch Changes

- Updated dependencies [[`2ad4dec`](https://github.com/revinel/platform/commit/2ad4dec32fc86b2a14dd2dd55e9b406e7cde1ce4)]:
  - @revinel/sdk@0.2.0
  - @revinel/embeds@0.2.0
