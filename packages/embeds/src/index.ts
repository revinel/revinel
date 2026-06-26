/**
 * The Revinel embed protocol: the `postMessage` contract between the embed iframe
 * (`/embed`) and its host wrappers — `@revinel/browser` `mountTierSelector`,
 * `@revinel/react` `<TierSelector>`, and the dashboard preview.
 *
 * Single source of truth: the emitter and every listener share this union, so a
 * typo or a wrong payload is a compile error, and new events stay type-safe.
 */
export type RevinelEmbedMessage =
  | { type: "revinel:resize"; height: number }
  | { type: "revinel:ready" }
  | { type: "revinel:checkout"; tierPriceId: string }
  | { type: "revinel:error"; message: string }
  // Popup chrome only: the embed's own close button asks the host to dismiss the dialog.
  | { type: "revinel:close" }

/** Payloads delivered to host callbacks — a message minus its `type` discriminant. */
export type RevinelEmbedCheckoutEvent = Omit<
  Extract<RevinelEmbedMessage, { type: "revinel:checkout" }>,
  "type"
>
export type RevinelEmbedErrorEvent = Omit<
  Extract<RevinelEmbedMessage, { type: "revinel:error" }>,
  "type"
>

/** Host-supplied handlers for the embed's lifecycle messages. */
export interface EmbedMessageHandlers {
  onResize?: (height: number) => void
  onReady?: () => void
  onCheckout?: (event: RevinelEmbedCheckoutEvent) => void
  onError?: (event: RevinelEmbedErrorEvent) => void
  /** Popup chrome only: the embed asked the host to dismiss the dialog. */
  onClose?: () => void
}

/**
 * Trust guard for inbound embed messages: true only when `event` came from
 * `iframe`'s own window AND its origin. Centralized so every host validates the
 * same way — call it before `handleEmbedMessage`. (Security check; don't inline.)
 */
export function isEmbedMessage(
  event: MessageEvent,
  iframe: HTMLIFrameElement | null | undefined,
): boolean {
  return (
    !!iframe && event.source === iframe.contentWindow && event.origin === new URL(iframe.src).origin
  )
}

/**
 * Parse an untrusted `postMessage` payload and dispatch it to the matching
 * handler. Shared by every host listener; callers validate the sender with
 * `isEmbedMessage` first.
 */
export function handleEmbedMessage(data: unknown, handlers: EmbedMessageHandlers): void {
  const message = data as RevinelEmbedMessage | undefined
  if (!message || typeof message.type !== "string") return

  switch (message.type) {
    case "revinel:resize":
      handlers.onResize?.(message.height)
      return
    case "revinel:ready":
      handlers.onReady?.()
      return
    case "revinel:checkout":
      handlers.onCheckout?.({ tierPriceId: message.tierPriceId })
      return
    case "revinel:error":
      handlers.onError?.({ message: message.message })
      return
    case "revinel:close":
      handlers.onClose?.()
      return
  }
}

/** Theme the embed accepts via its `?theme=` param. */
export const EMBED_THEMES = ["auto", "light", "dark"] as const
export type RevinelEmbedTheme = (typeof EMBED_THEMES)[number]

/** Default origin of the Revinel app that serves `/embed`. */
export const DEFAULT_EMBED_APP_URL = "https://app.revinel.com"

/** Fallback iframe height (px) shown until the embed reports its real content height. */
export const DEFAULT_EMBED_HEIGHT = 640

/**
 * Chrome for the popup tier selector's native `<dialog>` — shared by `@revinel/browser`'s
 * `openTierSelector` and `@revinel/react`'s `<TierSelectorDialog>` so the two can't drift.
 * The `<dialog>` supplies focus-trap/Esc/top-layer/inerting; this adds only the backdrop
 * dim, panel sizing, and a reduced-motion-safe entry. Scoped by data attributes so it can't
 * leak onto the host page.
 *
 * The panel is intentionally transparent and unstyled beyond layout: the embed renders its
 * own padded, rounded, themed surface (and close button) via `?chrome=popup`, so the popup
 * has a single source of theme truth and the host never has to guess light/dark.
 */
export const DIALOG_STYLES = [
  "dialog[data-revinel-dialog]{border:0;padding:0;background:transparent;max-width:min(64rem,calc(100vw - 2rem));width:100%}",
  "dialog[data-revinel-dialog]::backdrop{background:rgba(0,0,0,.5)}",
  "[data-revinel-dialog-panel]{overflow:auto;max-height:90vh}",
  "[data-revinel-dialog-panel]>iframe{display:block}",
  "@media(prefers-reduced-motion:no-preference){dialog[data-revinel-dialog][open]{animation:revinel-dialog-in .15s ease-out}}",
  "@keyframes revinel-dialog-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
].join("")

/** Build the `/embed` iframe URL — shared by every host wrapper and the snippet. */
export function buildEmbedUrl({
  appUrl = DEFAULT_EMBED_APP_URL,
  workspaceId,
  theme = "auto",
  chrome,
}: {
  appUrl?: string
  workspaceId: string
  theme?: RevinelEmbedTheme
  /** `"popup"` makes the embed render its own padded, rounded surface + close button. */
  chrome?: "popup"
}): string {
  const url = new URL(`/embed/${encodeURIComponent(workspaceId)}`, appUrl)
  url.searchParams.set("theme", theme)
  if (chrome) url.searchParams.set("chrome", chrome)
  return url.toString()
}
