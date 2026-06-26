// Script bootstrap for the zero-build `<script src=".../embed.js">` integration.
// Built to an IIFE and synced to `apps/app/public/embed.js` (see tsdown.config
// + scripts/sync-embed.ts). The mount/iframe logic lives ONLY in
// `mountTierSelector` (./index) — this file just adds the `window.Revinel`
// queue/singleton wrapper that the script snippet depends on.
import type { RevinelEmbedTheme } from "@revinel/embeds"
import {
  mountTierSelector,
  type RevinelTierSelector,
  type RevinelTierSelectorOptions,
  openTierSelector,
  type RevinelTierSelectorDialog,
  type RevinelTierSelectorDialogOptions,
} from "./index"

interface QueueItem {
  method: "init" | "updateConfig" | "destroy" | "open"
  args: unknown[]
}

interface RevinelGlobal {
  q?: QueueItem[]
  init: (options?: Partial<RevinelTierSelectorOptions>) => RevinelTierSelector | undefined
  updateConfig: (options?: Partial<Omit<RevinelTierSelectorOptions, "container">>) => void
  destroy: () => void
  open: (
    options?: Partial<RevinelTierSelectorDialogOptions>,
  ) => RevinelTierSelectorDialog | undefined
}

declare global {
  interface Window {
    Revinel?: RevinelGlobal
  }
}

;(window => {
  const document = window.document
  const currentScript = document.currentScript as HTMLScriptElement | null
  const appUrl = currentScript?.src ? new URL(currentScript.src).origin : window.location.origin

  const existing = window.Revinel
  const queue = Array.isArray(existing?.q) ? existing.q : []

  let widget: RevinelTierSelector | null = null
  let pendingConfig: Partial<Omit<RevinelTierSelectorOptions, "container">> = {}

  const api: RevinelGlobal = {
    init(options = {}) {
      const { workspaceId, container, ...rest } = { ...pendingConfig, ...options }

      if (!workspaceId) {
        throw new Error("Revinel: workspaceId is required.")
      }
      if (!container) {
        throw new Error("Revinel: container is required.")
      }

      // Pass the script-origin appUrl explicitly so mountTierSelector never
      // falls back to the packaged DEFAULT_EMBED_APP_URL constant.
      const resolved: RevinelTierSelectorOptions = {
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
        throw new Error("Revinel: workspaceId is required.")
      }

      return openTierSelector({ ...rest, workspaceId, appUrl: rest.appUrl || appUrl })
    },
  }

  window.Revinel = api

  // No-code trigger: open the modal when an element marked
  // `data-revinel-tier-selector` is clicked, configured from its `data-revinel-*`.
  document.addEventListener("click", event => {
    const trigger = (event.target as Element | null)?.closest("[data-revinel-tier-selector]")
    if (!(trigger instanceof HTMLElement)) return

    const { revinelWorkspaceId, revinelTheme } = trigger.dataset
    if (!revinelWorkspaceId) return

    event.preventDefault()
    api.open({
      workspaceId: revinelWorkspaceId,
      ...(revinelTheme ? { theme: revinelTheme as RevinelEmbedTheme } : {}),
    })
  })

  for (const item of queue) {
    const method = api[item.method]
    if (typeof method === "function") {
      ;(method as (...args: unknown[]) => unknown)(...item.args)
    }
  }
})(window)
