"use client"

import {
  buildEmbedUrl,
  DEFAULT_EMBED_APP_URL,
  DEFAULT_EMBED_HEIGHT,
  handleEmbedMessage,
  isEmbedMessage,
  type OpenAdsEmbedCheckoutEvent,
  type OpenAdsEmbedErrorEvent,
  type OpenAdsEmbedTheme,
} from "@openads/embeds"
import { type CSSProperties, useEffect, useRef, useState } from "react"

export type TierSelectorProps = {
  workspaceId: string
  /** Origin of the OpenAds app serving `/embed`. Defaults to the hosted app. */
  appUrl?: string
  theme?: OpenAdsEmbedTheme
  /** Height (px) shown until the embed reports its real content height. */
  height?: number
  className?: string
  title?: string
  /** Fired once the tier selector has loaded and rendered. */
  onReady?: () => void
  /** Fired when the visitor starts checkout, just before the redirect to Stripe. */
  onCheckout?: (event: OpenAdsEmbedCheckoutEvent) => void
  /** Fired when tiers fail to load or checkout creation fails. */
  onError?: (event: OpenAdsEmbedErrorEvent) => void
}

type EmbedIframeProps = TierSelectorProps & { style?: CSSProperties }

/**
 * The embed iframe plus its `openads:*` message handling (auto-resize + lifecycle
 * callbacks). Shared by the inline `<TierSelector>` and the popup `<TierSelectorDialog>`.
 */
const EmbedIframe = ({
  workspaceId,
  appUrl = DEFAULT_EMBED_APP_URL,
  theme = "auto",
  height = DEFAULT_EMBED_HEIGHT,
  className,
  style,
  title = "Advertise with us",
  onReady,
  onCheckout,
  onError,
}: EmbedIframeProps) => {
  const ref = useRef<HTMLIFrameElement>(null)
  const [resolvedHeight, setResolvedHeight] = useState(height)

  // Keep the latest callbacks in a ref so the listener doesn't re-subscribe when
  // inline handlers change identity each render.
  const handlersRef = useRef({ onReady, onCheckout, onError })
  handlersRef.current = { onReady, onCheckout, onError }

  const src = buildEmbedUrl({ appUrl, workspaceId, theme })

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isEmbedMessage(event, ref.current)) return

      handleEmbedMessage(event.data, {
        onResize: setResolvedHeight,
        onReady: () => handlersRef.current.onReady?.(),
        onCheckout: checkoutEvent => handlersRef.current.onCheckout?.(checkoutEvent),
        onError: errorEvent => handlersRef.current.onError?.(errorEvent),
      })
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [src])

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      loading="lazy"
      className={className}
      style={{
        border: 0,
        width: "100%",
        height: resolvedHeight,
        transition: "height 150ms",
        ...style,
      }}
    />
  )
}

/**
 * The "Subscribe to advertise" tier selector, rendered inline as an iframe that
 * auto-sizes to its content. SSR-friendly: the iframe shell renders on the
 * server; height settles after the embed posts `openads:resize` on the client.
 */
export const TierSelector = (props: TierSelectorProps) => <EmbedIframe {...props} />

export type TierSelectorDialogProps = TierSelectorProps & {
  /** Whether the modal is open (controlled by the host). */
  open: boolean
  /** Called when the modal is dismissed (close button, Esc, or backdrop click). */
  onClose: () => void
}

// Native <dialog> gives focus-trap/Esc/top-layer/inerting; this only adds the
// backdrop dim + panel chrome. Scoped by data attributes so it can't leak.
const DIALOG_CSS = `
dialog[data-openads-dialog]{border:0;padding:0;background:transparent;max-width:min(48rem,calc(100vw - 2rem));width:100%}
dialog[data-openads-dialog]::backdrop{background:rgba(0,0,0,.5)}
[data-openads-dialog-panel]{position:relative;overflow:auto;max-height:85vh;border-radius:12px}
button[data-openads-dialog-close]{position:absolute;top:8px;right:8px;z-index:1;width:32px;height:32px;border:0;border-radius:9999px;background:rgba(0,0,0,.5);color:#fff;font-size:22px;line-height:1;cursor:pointer}
@media(prefers-reduced-motion:no-preference){dialog[data-openads-dialog][open]{animation:openads-dialog-in .15s ease-out}}
@keyframes openads-dialog-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`

/**
 * The tier selector in a modal overlay (native `<dialog>`). Controlled via `open`;
 * `onClose` fires on the close button, Esc, or a backdrop click. The iframe mounts
 * only while open.
 */
export const TierSelectorDialog = ({ open, onClose, ...props }: TierSelectorDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // All dismissals (×, Esc, backdrop) funnel through the native `close` event, so
  // `onClose` fires once. Listeners on the element avoid jsx-a11y handler warnings.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => onCloseRef.current()
    const handleClick = (event: Event) => {
      if (event.target === dialog) dialog.close()
    }

    dialog.addEventListener("close", handleClose)
    dialog.addEventListener("click", handleClick)
    return () => {
      dialog.removeEventListener("close", handleClose)
      dialog.removeEventListener("click", handleClick)
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <dialog ref={dialogRef} data-openads-dialog="true" aria-label={props.title ?? "Advertise"}>
      <style>{DIALOG_CSS}</style>
      <div data-openads-dialog-panel="true">
        <button
          type="button"
          data-openads-dialog-close="true"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
        {open ? <EmbedIframe {...props} /> : null}
      </div>
    </dialog>
  )
}
