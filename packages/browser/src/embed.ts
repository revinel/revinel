// Script bootstrap for the zero-build `<script src=".../embed.js">` integration.
// Built to an IIFE and synced to `apps/app/public/embed.js` (see tsdown.config
// + scripts/sync-embed.ts). The mount/iframe logic lives ONLY in
// `mountTierSelector` (./index) — this file just adds the `window.OpenAds`
// queue/singleton wrapper that the script snippet depends on.
import type { OpenAdsEmbedTheme } from "@openads/embeds"
import {
  mountTierSelector,
  type OpenAdsTierSelector,
  type OpenAdsTierSelectorOptions,
  openTierSelector,
  type OpenTierSelector,
  type OpenTierSelectorOptions,
} from "./index"

type QueueItem = { method: "init" | "updateConfig" | "destroy" | "open"; args: Array<unknown> }

type OpenAdsGlobal = {
  q?: Array<QueueItem>
  init: (options?: Partial<OpenAdsTierSelectorOptions>) => OpenAdsTierSelector | undefined
  updateConfig: (options?: Partial<Omit<OpenAdsTierSelectorOptions, "container">>) => void
  destroy: () => void
  open: (options?: Partial<OpenTierSelectorOptions>) => OpenTierSelector | undefined
}

declare global {
  interface Window {
    OpenAds?: OpenAdsGlobal
  }
}

;(window => {
  const document = window.document
  const currentScript = document.currentScript as HTMLScriptElement | null
  const appUrl = currentScript?.src ? new URL(currentScript.src).origin : window.location.origin

  const existing = window.OpenAds
  const queue = Array.isArray(existing?.q) ? existing.q : []

  let widget: OpenAdsTierSelector | null = null
  let pendingConfig: Partial<Omit<OpenAdsTierSelectorOptions, "container">> = {}

  const api: OpenAdsGlobal = {
    init(options = {}) {
      const { workspaceId, container, ...rest } = { ...pendingConfig, ...options }

      if (!workspaceId) {
        throw new Error("OpenAds: workspaceId is required.")
      }
      if (!container) {
        throw new Error("OpenAds: container is required.")
      }

      // Pass the script-origin appUrl explicitly so mountTierSelector never
      // falls back to the packaged DEFAULT_EMBED_APP_URL constant.
      const resolved: OpenAdsTierSelectorOptions = {
        ...rest,
        workspaceId,
        container,
        appUrl: rest.appUrl || appUrl,
      }

      if (widget) {
        widget.updateConfig(resolved)
      } else {
        widget = mountTierSelector(resolved)
      }

      pendingConfig = {}
      return widget
    },
    updateConfig(options = {}) {
      if (!widget) {
        pendingConfig = { ...pendingConfig, ...options }
        return
      }

      widget.updateConfig(options)
    },
    destroy() {
      widget?.destroy()
      widget = null
      pendingConfig = {}
    },
    open(options = {}) {
      const { workspaceId, ...rest } = { ...pendingConfig, ...options }

      if (!workspaceId) {
        throw new Error("OpenAds: workspaceId is required.")
      }

      return openTierSelector({ ...rest, workspaceId, appUrl: rest.appUrl || appUrl })
    },
  }

  window.OpenAds = api

  // No-code trigger: open the modal when an element marked
  // `data-openads-tier-selector` is clicked, configured from its `data-openads-*`.
  document.addEventListener("click", event => {
    const trigger = (event.target as Element | null)?.closest("[data-openads-tier-selector]")
    if (!(trigger instanceof HTMLElement)) return

    const { openadsWorkspaceId, openadsTheme } = trigger.dataset
    if (!openadsWorkspaceId) return

    event.preventDefault()
    api.open({
      workspaceId: openadsWorkspaceId,
      ...(openadsTheme ? { theme: openadsTheme as OpenAdsEmbedTheme } : {}),
    })
  })

  for (const item of queue) {
    const method = api[item.method]
    if (typeof method === "function") {
      ;(method as (...args: Array<unknown>) => unknown)(...item.args)
    }
  }
})(window)
