# OpenAds JS

Official client libraries for integrating [OpenAds](https://openads.co) — fetch and
render ads on your site, and drop in the "Subscribe to advertise" tier selector.

| Package | What it does |
| --- | --- |
| [`@openads/sdk`](packages/sdk) | Headless SDK: fetch ads, record impressions/clicks. |
| [`@openads/react`](packages/react) | React provider, hooks, and the tier-selector components. |
| [`@openads/browser`](packages/browser) | Vanilla embed runtime (inline + popup tier selector). |
| [`@openads/embeds`](packages/embeds) | Shared embed `postMessage` protocol (low-level). |

All four are MIT-licensed. See each package's README for install + usage.

## Feedback & contributions

Found a bug or have a request? **Open an issue — we read every one.** This repository is
published from the OpenAds release pipeline, so accepted fixes are applied on our side and
land here on the next release (a pull request may be closed in favor of the equivalent change).

## API reference

OpenAPI spec and interactive docs are served at `/v1/openapi.json` and `/v1/docs`
on the OpenAds API.
