import {
  buildEmbedUrl,
  DEFAULT_EMBED_HEIGHT,
  DIALOG_STYLES,
  handleEmbedMessage,
  isEmbedMessage,
  type RevinelEmbedCheckoutEvent,
  type RevinelEmbedErrorEvent,
  type RevinelEmbedTheme,
} from "@revinel/embeds"

export type RevinelBrowserContainer = string | Element

export interface RevinelTierSelectorOptions {
  workspaceId: string
  container: RevinelBrowserContainer
  appUrl?: string
  theme?: RevinelEmbedTheme
  height?: number | string
  /** Fired once the tier selector has loaded and rendered. */
  onReady?: () => void
  /** Fired when the visitor starts checkout, just before the redirect to Stripe. */
  onCheckout?: (event: RevinelEmbedCheckoutEvent) => void
  /** Fired when tiers fail to load or checkout creation fails. */
  onError?: (event: RevinelEmbedErrorEvent) => void
}

export interface RevinelTierSelector {
  hostElement: HTMLDivElement
  iframe: HTMLIFrameElement
  updateConfig: (options: Partial<Omit<RevinelTierSelectorOptions, "container">>) => void
  destroy: () => void
}

function resolveContainer(container: RevinelBrowserContainer): Element {
  if (typeof container !== "string") return container

  const element = document.querySelector(container)
  if (!element) {
    throw new Error(`Revinel could not find a container matching "${container}".`)
  }

  return element
}

function getHeight(height: number | string | undefined): string {
  if (typeof height === "number") return `${height}px`
  return height ?? `${DEFAULT_EMBED_HEIGHT}px`
}

// Internal shape the popup adds on top of the public options: `chrome:"popup"` makes the
// embed paint its own surface + close button, and `onRequestClose` fires on `revinel:close`.
type EmbedIframeOptions = Omit<RevinelTierSelectorOptions, "container"> & {
  chrome?: "popup"
  onRequestClose?: () => void
}

// Build the embed iframe element + its message listener. Shared by the inline
// mount and the popup. `getOptions` is read live so `updateConfig` is reflected.
function createEmbedIframe(getOptions: () => EmbedIframeOptions): {
  iframe: HTMLIFrameElement
  destroy: () => void
} {
  const options = getOptions()
  const iframe = document.createElement("iframe")

  iframe.title = "Advertise with us"
  iframe.loading = "lazy"
  iframe.style.border = "0"
  iframe.style.width = "100%"
  iframe.style.height = getHeight(options.height)
  iframe.src = buildEmbedUrl(options)

  // Validate the sender, then let the shared dispatcher route the payload.
  function onMessage(event: MessageEvent) {
    if (!isEmbedMessage(event, iframe)) return
    const opts = getOptions()

    handleEmbedMessage(event.data, {
      onResize: height => {
        if (opts.height == null) iframe.style.height = `${height}px`
      },
      onReady: () => opts.onReady?.(),
      onCheckout: checkoutEvent => opts.onCheckout?.(checkoutEvent),
      onError: errorEvent => opts.onError?.(errorEvent),
      onClose: () => opts.onRequestClose?.(),
    })
  }
  window.addEventListener("message", onMessage)

  return { iframe, destroy: () => window.removeEventListener("message", onMessage) }
}

export function mountTierSelector(options: RevinelTierSelectorOptions): RevinelTierSelector {
  if (typeof document === "undefined") {
    throw new Error("mountTierSelector can only run in a browser environment.")
  }

  let currentOptions = options
  const container = resolveContainer(options.container)
  const hostElement = document.createElement("div")
  hostElement.dataset.revinelTierSelector = "true"
  hostElement.style.width = "100%"

  const { iframe, destroy: destroyIframe } = createEmbedIframe(() => currentOptions)
  hostElement.appendChild(iframe)
  container.appendChild(hostElement)

  function updateConfig(nextOptions: Partial<Omit<RevinelTierSelectorOptions, "container">>) {
    currentOptions = { ...currentOptions, ...nextOptions }
    const nextSrc = buildEmbedUrl(currentOptions)
    if (iframe.src !== nextSrc) iframe.src = nextSrc
    iframe.style.height = getHeight(currentOptions.height)
  }

  function destroy() {
    destroyIframe()
    hostElement.remove()
  }

  return { hostElement, iframe, updateConfig, destroy }
}

export type RevinelTierSelectorDialogOptions = Omit<RevinelTierSelectorOptions, "container"> & {
  /** Accessible label for the modal. */
  title?: string
  /** Fired when the modal is dismissed (close button, Esc, or backdrop). */
  onClose?: () => void
}

export interface RevinelTierSelectorDialog {
  /** Dismiss the modal programmatically. */
  close: () => void
}

const DIALOG_STYLE_ID = "revinel-tier-selector-style"

// Injected once. The native <dialog> gives focus-trap/Esc/top-layer/inerting;
// DIALOG_STYLES (shared with @revinel/react) adds the backdrop dim + panel chrome.
function ensureDialogStyles() {
  if (document.getElementById(DIALOG_STYLE_ID)) return

  const style = document.createElement("style")
  style.id = DIALOG_STYLE_ID
  style.textContent = DIALOG_STYLES
  document.head.appendChild(style)
}

/**
 * Open the tier selector in a modal overlay (native `<dialog>`). Returns a handle
 * to close it; `onClose` fires on any dismissal. Publishers wire this to their own
 * button, or use the `data-revinel-tier-selector` attribute (see the script embed).
 */
export function openTierSelector(
  options: RevinelTierSelectorDialogOptions,
): RevinelTierSelectorDialog {
  if (typeof document === "undefined") {
    throw new Error("openTierSelector can only run in a browser environment.")
  }

  ensureDialogStyles()

  const dialog = document.createElement("dialog")
  dialog.dataset.revinelDialog = "true"
  dialog.setAttribute("aria-label", options.title ?? "Advertise")

  const panel = document.createElement("div")
  panel.dataset.revinelDialogPanel = "true"

  // The embed paints its own surface + close button (chrome:"popup"); the dialog is a bare
  // shell. `onRequestClose` fires when that in-iframe close button posts `revinel:close`.
  const { iframe, destroy: destroyIframe } = createEmbedIframe(() => ({
    ...options,
    chrome: "popup",
    onRequestClose: () => dialog.close(),
  }))

  panel.append(iframe)
  dialog.append(panel)
  document.body.appendChild(dialog)

  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = "hidden"

  let cleanedUp = false
  function cleanup() {
    if (cleanedUp) return
    cleanedUp = true
    destroyIframe()
    document.body.style.overflow = previousOverflow
    dialog.remove()
    options.onClose?.()
  }

  // A click whose target is the dialog itself lands on the ::backdrop (the panel
  // fills the dialog, and cross-origin iframe clicks don't bubble here).
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close()
  })
  dialog.addEventListener("close", cleanup)

  dialog.showModal()

  return { close: () => dialog.close() }
}
