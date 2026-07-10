"use client"

import {
  buildEmbedUrl,
  DEFAULT_EMBED_APP_URL,
  DEFAULT_EMBED_HEIGHT,
  DIALOG_STYLES,
  handleEmbedMessage,
  isEmbedMessage,
  type RevinelEmbedCheckoutEvent,
  type RevinelEmbedErrorEvent,
  type RevinelEmbedTheme,
} from "@revinel/embeds"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { useRevinelConfig } from "./provider"

export interface RevinelTierSelectorProps {
  /** Falls back to the `RevinelProvider`'s `workspaceId` when omitted. */
  workspaceId?: string
  /** Origin of the Revinel app serving `/embed`. Falls back to the provider, then the hosted app. */
  appUrl?: string
  theme?: RevinelEmbedTheme
  /** Height shown until the embed reports its real content height (px number, or any CSS length string). */
  height?: number | string
  className?: string
  title?: string
  /** Fired once the tier selector has loaded and rendered. */
  onReady?: () => void
  /** Fired when the visitor starts checkout, just before the redirect to Stripe. */
  onCheckout?: (event: RevinelEmbedCheckoutEvent) => void
  /** Fired when tiers fail to load or checkout creation fails. */
  onError?: (event: RevinelEmbedErrorEvent) => void
}

type EmbedIframeProps = RevinelTierSelectorProps & {
  style?: CSSProperties
  /** `"popup"` makes the embed render its own surface + close button. */
  chrome?: "popup"
  /** Fired when the embed's in-iframe close button posts `revinel:close`. */
  onRequestClose?: () => void
}

/**
 * The embed iframe plus its `revinel:*` message handling (auto-resize + lifecycle
 * callbacks). Shared by the inline `<TierSelector>` and the popup `<TierSelectorDialog>`.
 */
function EmbedIframe({
  workspaceId,
  appUrl,
  theme = "auto",
  height = DEFAULT_EMBED_HEIGHT,
  className,
  style,
  title = "Advertise with us",
  chrome,
  onReady,
  onCheckout,
  onError,
  onRequestClose,
}: EmbedIframeProps) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [resolvedHeight, setResolvedHeight] = useState(height)
  const config = useRevinelConfig()

  // Keep the latest callbacks in a ref so the listener doesn't re-subscribe when
  // inline handlers change identity each render.
  const handlersRef = useRef({ onReady, onCheckout, onError, onRequestClose })
  handlersRef.current = { onReady, onCheckout, onError, onRequestClose }

  const resolvedWorkspaceId = workspaceId ?? config.workspaceId
  const src = resolvedWorkspaceId
    ? buildEmbedUrl({
        appUrl: appUrl ?? config.appUrl ?? DEFAULT_EMBED_APP_URL,
        workspaceId: resolvedWorkspaceId,
        theme,
        chrome,
      })
    : null

  useEffect(() => {
    if (!src) return
    function onMessage(event: MessageEvent) {
      if (!isEmbedMessage(event, ref.current)) return

      handleEmbedMessage(event.data, {
        onResize: setResolvedHeight,
        onReady: () => handlersRef.current.onReady?.(),
        onCheckout: checkoutEvent => handlersRef.current.onCheckout?.(checkoutEvent),
        onError: errorEvent => handlersRef.current.onError?.(errorEvent),
        onClose: () => handlersRef.current.onRequestClose?.(),
      })
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [src])

  // Render nothing (rather than throw) when no workspaceId resolves, so an
  // error boundary re-render can't change this component's hook count.
  if (!src) return null

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
 * server; height settles after the embed posts `revinel:resize` on the client.
 */
export function TierSelector(props: RevinelTierSelectorProps) {
  return <EmbedIframe {...props} />
}

export type RevinelTierSelectorDialogProps = RevinelTierSelectorProps & {
  /** Whether the modal is open (controlled by the host). */
  open: boolean
  /** Called when the modal is dismissed (close button, Esc, or backdrop click). */
  onClose: () => void
}

/**
 * The tier selector in a modal overlay (native `<dialog>`). Controlled via `open`;
 * `onClose` fires on the close button, Esc, or a backdrop click. The iframe mounts
 * only while open.
 */
export function TierSelectorDialog({ open, onClose, ...props }: RevinelTierSelectorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // All dismissals (×, Esc, backdrop) funnel through the native `close` event, so
  // `onClose` fires once. Listeners on the element avoid jsx-a11y handler warnings.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleClose() {
      return onCloseRef.current()
    }
    function handleClick(event: Event) {
      if (event.target === dialog) dialog?.close()
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
    <dialog ref={dialogRef} data-revinel-dialog="true" aria-label={props.title ?? "Advertise"}>
      <style>{DIALOG_STYLES}</style>
      {/* The embed paints its own surface + close button (chrome="popup"); the dialog is a
          bare shell. The in-iframe close button posts revinel:close → onRequestClose. */}
      <div data-revinel-dialog-panel="true">
        {open ? (
          <EmbedIframe
            {...props}
            chrome="popup"
            onRequestClose={() => dialogRef.current?.close()}
          />
        ) : null}
      </div>
    </dialog>
  )
}
