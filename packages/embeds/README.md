# @openads/embeds

The shared [OpenAds](https://openads.co) embed protocol — the `postMessage` contract between
the embed iframe (`/embed`) and its host wrappers. Zero dependencies.

> **Most integrations don't install this directly.** Use
> [`@openads/browser`](https://www.npmjs.com/package/@openads/browser) (vanilla) or
> [`@openads/react`](https://www.npmjs.com/package/@openads/react) (React) — they depend on
> this package and expose a friendlier API. Reach for `@openads/embeds` only when building a
> custom host integration.

## Install

```sh
npm install @openads/embeds
```

## What's in it

- `OpenAdsEmbedMessage` — the typed union of messages the embed posts
  (`openads:resize` / `ready` / `checkout` / `error`).
- `isEmbedMessage(event, iframe)` — trust guard: `true` only when a `MessageEvent` came from
  `iframe`'s own window **and** origin. Call this before trusting any inbound message.
- `handleEmbedMessage(data, handlers)` — parse a validated payload and dispatch it to
  `onResize` / `onReady` / `onCheckout` / `onError`.
- `buildEmbedUrl({ appUrl, workspaceId, theme })` — build the `/embed` iframe URL.
- `EMBED_THEMES` / `OpenAdsEmbedTheme`, `DEFAULT_EMBED_APP_URL`, `DEFAULT_EMBED_HEIGHT`.

## Custom host listener

```ts
import { buildEmbedUrl, handleEmbedMessage, isEmbedMessage } from "@openads/embeds"

const iframe = document.createElement("iframe")
iframe.src = buildEmbedUrl({ workspaceId: "your-workspace-id", theme: "auto" })
document.body.append(iframe)

window.addEventListener("message", event => {
  if (!isEmbedMessage(event, iframe)) return
  handleEmbedMessage(event.data, {
    onResize: height => (iframe.style.height = `${height}px`),
    onCheckout: ({ tierPriceId }) => {},
  })
})
```
