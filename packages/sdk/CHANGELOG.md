# @revinel/sdk

## 0.2.0

### Minor Changes

- [#85](https://github.com/revinel/platform/pull/85) [`2ad4dec`](https://github.com/revinel/platform/commit/2ad4dec32fc86b2a14dd2dd55e9b406e7cde1ce4) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Integration DX pass (from the first publisher integration). Breaking changes, pre-1.0 — no compat shims.

  - **`RevinelMetaRegistry`** (`@revinel/sdk`): type `ad.meta` globally via declaration merging — `declare module "@revinel/sdk" { interface RevinelMetaRegistry { … } }` — and every `getAd`/`getAds`/`useAd`/`useAds` is typed with no per-call generic. `RevinelAd<TMeta = RevinelMeta>` keeps the generic as a one-off override.
  - **Fresh rotation by default** (`@revinel/sdk`): `getAd`/`getAds` default the fetch to `cache: "no-store"` unless the caller sets `cache` or `next.revalidate`. No more hand-written `request: { cache: "no-store" }`.
  - **`RevinelAd.faviconUrl` is now `string | null`** (was `string`) — `null` when no favicon was found.
  - **`RevinelProvider` accepts `appUrl`** and exposes `{ workspaceId, appUrl }` via the new `useRevinelConfig`. `<TierSelector>` / `<TierSelectorDialog>` inherit `workspaceId`/`appUrl` from the provider, so inside one they take no config props (still work standalone with explicit props).
  - **`useTracking(adId)`**: now takes the ad id directly (or anything with `.id`); the `<TMeta>` generic is gone. Removes the `as RevinelAd` cast when tracking a reduced render shape.
