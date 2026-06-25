# OpenAds JS

Public source for the OpenAds client packages — the libraries publishers use to
integrate [OpenAds](https://openads.co) into their site.

| Package | What it does |
| --- | --- |
| [`@openads/sdk`](packages/sdk) | Headless SDK: fetch ads, record impressions/clicks. |
| [`@openads/react`](packages/react) | React provider, hooks, and the tier-selector components. |
| [`@openads/browser`](packages/browser) | Vanilla embed runtime (inline + popup tier selector). |
| [`@openads/embeds`](packages/embeds) | Shared embed `postMessage` protocol (low-level). |

All four are MIT-licensed. See each package's README for install + usage.

## Read-only mirror

These packages are developed in a private monorepo and mirrored here for source
visibility. Pull requests opened here can't be merged directly — but **issues and
discussions are very welcome**, and reported fixes are applied upstream and synced
back. The canonical build and npm releases happen in the monorepo.

## API reference

OpenAPI spec and interactive docs are served at `/v1/openapi.json` and `/v1/docs`
on the OpenAds API.
