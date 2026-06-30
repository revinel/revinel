# Revinel JS

Official client libraries for integrating [Revinel](https://revinel.com) — fetch and
render ads on your site, and drop in the "Subscribe to advertise" tier selector.

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
