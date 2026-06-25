/**
 * The OpenAds embed protocol: the `postMessage` contract between the embed iframe
 * (`/embed`) and its host wrappers — `@openads/browser` `mountTierSelector`,
 * `@openads/react` `<TierSelector>`, and the dashboard preview.
 *
 * Single source of truth: the emitter and every listener share this union, so a
 * typo or a wrong payload is a compile error, and new events stay type-safe.
 */
export type OpenAdsEmbedMessage =
  | { type: "openads:resize"; height: number }
  | { type: "openads:ready" }
  | { type: "openads:checkout"; tierPriceId: string }
  | { type: "openads:error"; message: string }

/** Payloads delivered to host callbacks — a message minus its `type` discriminant. */
export type OpenAdsEmbedCheckoutEvent = Omit<
  Extract<OpenAdsEmbedMessage, { type: "openads:checkout" }>,
  "type"
>
export type OpenAdsEmbedErrorEvent = Omit<
  Extract<OpenAdsEmbedMessage, { type: "openads:error" }>,
  "type"
>

/** Host-supplied handlers for the embed's lifecycle messages. */
export type EmbedMessageHandlers = {
  onResize?: (height: number) => void
  onReady?: () => void
  onCheckout?: (event: OpenAdsEmbedCheckoutEvent) => void
  onError?: (event: OpenAdsEmbedErrorEvent) => void
}

/**
 * Trust guard for inbound embed messages: true only when `event` came from
 * `iframe`'s own window AND its origin. Centralized so every host validates the
 * same way — call it before `handleEmbedMessage`. (Security check; don't inline.)
 */
export const isEmbedMessage = (
  event: MessageEvent,
  iframe: HTMLIFrameElement | null | undefined,
): boolean =>
  !!iframe && event.source === iframe.contentWindow && event.origin === new URL(iframe.src).origin

/**
 * Parse an untrusted `postMessage` payload and dispatch it to the matching
 * handler. Shared by every host listener; callers validate the sender with
 * `isEmbedMessage` first.
 */
export const handleEmbedMessage = (data: unknown, handlers: EmbedMessageHandlers): void => {
  const message = data as OpenAdsEmbedMessage | undefined
  if (!message || typeof message.type !== "string") return

  switch (message.type) {
    case "openads:resize":
      handlers.onResize?.(message.height)
      return
    case "openads:ready":
      handlers.onReady?.()
      return
    case "openads:checkout":
      handlers.onCheckout?.({ tierPriceId: message.tierPriceId })
      return
    case "openads:error":
      handlers.onError?.({ message: message.message })
      return
  }
}

/** Theme the embed accepts via its `?theme=` param. */
export const EMBED_THEMES = ["auto", "light", "dark"] as const
export type OpenAdsEmbedTheme = (typeof EMBED_THEMES)[number]

/** Default origin of the OpenAds app that serves `/embed`. */
export const DEFAULT_EMBED_APP_URL = "https://app.openads.co"

/** Fallback iframe height (px) shown until the embed reports its real content height. */
export const DEFAULT_EMBED_HEIGHT = 640

/** Build the `/embed` iframe URL — shared by every host wrapper and the snippet. */
export const buildEmbedUrl = ({
  appUrl = DEFAULT_EMBED_APP_URL,
  workspaceId,
  theme = "auto",
}: {
  appUrl?: string
  workspaceId: string
  theme?: OpenAdsEmbedTheme
}): string => {
  const url = new URL(`/embed/${encodeURIComponent(workspaceId)}`, appUrl)
  url.searchParams.set("theme", theme)
  return url.toString()
}
