# @revinel/browser

## 0.6.0

### Patch Changes

- Updated dependencies []:
  - @revinel/embeds@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies []:
  - @revinel/embeds@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @revinel/embeds@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @revinel/embeds@0.4.0

## 0.3.0

### Patch Changes

- [#202](https://github.com/revinel/platform/pull/202) [`2981a8e`](https://github.com/revinel/platform/commit/2981a8ef2543ecac6369aa7ee1f106b11109ba03) Thanks [@piotrkulpinski](https://github.com/piotrkulpinski)! - Robustness fixes across the public SDK surface:

  - `@revinel/browser`: the `embed.js` queue replay now wraps each queued call in try/catch (logging via `console.error`), so one malformed queued `init` no longer aborts the remaining queued calls.
  - `@revinel/react`: `<TierSelector>` renders `null` instead of throwing when no `workspaceId` resolves, and the missing-id guard no longer sits between hooks — an error-boundary re-render can't change the component's hook count.
  - `@revinel/sdk`: `createCheckout` now merges caller-passed `options.headers` with the JSON `content-type` header instead of letting the options spread clobber it.

- Updated dependencies []:
  - @revinel/embeds@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies []:
  - @revinel/embeds@0.2.0
