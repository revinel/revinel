import {
  buildEmbedUrl,
  DEFAULT_EMBED_HEIGHT,
  handleEmbedMessage,
  isEmbedMessage,
  type OpenAdsEmbedCheckoutEvent,
  type OpenAdsEmbedErrorEvent,
  type OpenAdsEmbedTheme,
} from "@openads/embeds"

export type OpenAdsBrowserContainer = string | Element

export type OpenAdsTierSelectorOptions = {
  workspaceId: string
  container: OpenAdsBrowserContainer
  appUrl?: string
  theme?: OpenAdsEmbedTheme
  height?: number | string
  /** Fired once the tier selector has loaded and rendered. */
  onReady?: () => void
  /** Fired when the visitor starts checkout, just before the redirect to Stripe. */
  onCheckout?: (event: OpenAdsEmbedCheckoutEvent) => void
  /** Fired when tiers fail to load or checkout creation fails. */
  onError?: (event: OpenAdsEmbedErrorEvent) => void
}

export type OpenAdsTierSelector = {
  hostElement: HTMLDivElement
  iframe: HTMLIFrameElement
  updateConfig: (options: Partial<Omit<OpenAdsTierSelectorOptions, "container">>) => void
  destroy: () => void
}

const resolveContainer = (container: OpenAdsBrowserContainer): Element => {
  if (typeof container !== "string") return container

  const element = document.querySelector(container)
  if (!element) {
    throw new Error(`OpenAds could not find a container matching "${container}".`)
  }

  return element
}

const getHeight = (height: number | string | undefined): string => {
  if (typeof height === "number") return `${height}px`
  return height ?? `${DEFAULT_EMBED_HEIGHT}px`
}

// Build the embed iframe element + its message listener. Shared by the inline
// mount and the popup. `getOptions` is read live so `updateConfig` is reflected.
const createEmbedIframe = (
  getOptions: () => Omit<OpenAdsTierSelectorOptions, "container">,
): { iframe: HTMLIFrameElement; destroy: () => void } => {
  const options = getOptions()
  const iframe = document.createElement("iframe")

  iframe.title = "Advertise with us"
  iframe.loading = "lazy"
  iframe.style.border = "0"
  iframe.style.width = "100%"
  iframe.style.height = getHeight(options.height)
  iframe.src = buildEmbedUrl(options)

  // Validate the sender, then let the shared dispatcher route the payload.
  const onMessage = (event: MessageEvent) => {
    if (!isEmbedMessage(event, iframe)) return
    const opts = getOptions()

    handleEmbedMessage(event.data, {
      onResize: height => {
        if (opts.height == null) iframe.style.height = `${height}px`
      },
      onReady: () => opts.onReady?.(),
      onCheckout: checkoutEvent => opts.onCheckout?.(checkoutEvent),
      onError: errorEvent => opts.onError?.(errorEvent),
    })
  }
  window.addEventListener("message", onMessage)

  return { iframe, destroy: () => window.removeEventListener("message", onMessage) }
}

export const mountTierSelector = (options: OpenAdsTierSelectorOptions): OpenAdsTierSelector => {
  if (typeof document === "undefined") {
    throw new Error("mountTierSelector can only run in a browser environment.")
  }

  let currentOptions = options
  const container = resolveContainer(options.container)
  const hostElement = document.createElement("div")
  hostElement.dataset.openadsTierSelector = "true"
  hostElement.style.width = "100%"

  const { iframe, destroy: destroyIframe } = createEmbedIframe(() => currentOptions)
  hostElement.appendChild(iframe)
  container.appendChild(hostElement)

  const updateConfig = (nextOptions: Partial<Omit<OpenAdsTierSelectorOptions, "container">>) => {
    currentOptions = { ...currentOptions, ...nextOptions }
    const nextSrc = buildEmbedUrl(currentOptions)
    if (iframe.src !== nextSrc) iframe.src = nextSrc
    iframe.style.height = getHeight(currentOptions.height)
  }

  const destroy = () => {
    destroyIframe()
    hostElement.remove()
  }

  return { hostElement, iframe, updateConfig, destroy }
}

export type OpenTierSelectorOptions = Omit<OpenAdsTierSelectorOptions, "container"> & {
  /** Accessible label for the modal. */
  title?: string
  /** Fired when the modal is dismissed (close button, Esc, or backdrop). */
  onClose?: () => void
}

export type OpenTierSelector = {
  /** Dismiss the modal programmatically. */
  close: () => void
}

const DIALOG_STYLE_ID = "openads-tier-selector-style"

// Injected once. The native <dialog> gives focus-trap/Esc/top-layer/inerting;
// this only adds the backdrop dim, panel chrome, and a reduced-motion-safe entry.
const ensureDialogStyles = () => {
  if (document.getElementById(DIALOG_STYLE_ID)) return

  const style = document.createElement("style")
  style.id = DIALOG_STYLE_ID
  style.textContent = [
    "dialog[data-openads-dialog]{border:0;padding:0;background:transparent;max-width:min(48rem,calc(100vw - 2rem));width:100%}",
    "dialog[data-openads-dialog]::backdrop{background:rgba(0,0,0,.5)}",
    "[data-openads-dialog-panel]{position:relative;overflow:auto;max-height:85vh;border-radius:12px}",
    "[data-openads-dialog-panel]>iframe{display:block}",
    "button[data-openads-dialog-close]{position:absolute;top:8px;right:8px;z-index:1;width:32px;height:32px;border:0;border-radius:9999px;background:rgba(0,0,0,.5);color:#fff;font-size:22px;line-height:1;cursor:pointer}",
    "@media(prefers-reduced-motion:no-preference){dialog[data-openads-dialog][open]{animation:openads-dialog-in .15s ease-out}}",
    "@keyframes openads-dialog-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
  ].join("")
  document.head.appendChild(style)
}

/**
 * Open the tier selector in a modal overlay (native `<dialog>`). Returns a handle
 * to close it; `onClose` fires on any dismissal. Publishers wire this to their own
 * button, or use the `data-openads-tier-selector` attribute (see the script embed).
 */
export const openTierSelector = (options: OpenTierSelectorOptions): OpenTierSelector => {
  if (typeof document === "undefined") {
    throw new Error("openTierSelector can only run in a browser environment.")
  }

  ensureDialogStyles()

  const dialog = document.createElement("dialog")
  dialog.dataset.openadsDialog = "true"
  dialog.setAttribute("aria-label", options.title ?? "Advertise")

  const panel = document.createElement("div")
  panel.dataset.openadsDialogPanel = "true"

  const closeButton = document.createElement("button")
  closeButton.type = "button"
  closeButton.dataset.openadsDialogClose = "true"
  closeButton.setAttribute("aria-label", "Close")
  closeButton.textContent = "×"

  const { iframe, destroy: destroyIframe } = createEmbedIframe(() => options)

  panel.append(closeButton, iframe)
  dialog.append(panel)
  document.body.appendChild(dialog)

  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = "hidden"

  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    destroyIframe()
    document.body.style.overflow = previousOverflow
    dialog.remove()
    options.onClose?.()
  }

  closeButton.addEventListener("click", () => dialog.close())
  // A click whose target is the dialog itself lands on the ::backdrop (the panel
  // fills the dialog, and cross-origin iframe clicks don't bubble here).
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close()
  })
  dialog.addEventListener("close", cleanup)

  dialog.showModal()

  return { close: () => dialog.close() }
}
