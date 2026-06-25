import { describe, expect, it } from "bun:test"
import { buildEmbedUrl, handleEmbedMessage, isEmbedMessage } from "./index"

describe("buildEmbedUrl", () => {
  it("builds the embed URL with the theme query param", () => {
    expect(
      buildEmbedUrl({ appUrl: "https://app.openads.co", workspaceId: "ws_1", theme: "dark" }),
    ).toBe("https://app.openads.co/embed/ws_1?theme=dark")
  })

  it("tolerates a trailing slash on appUrl and defaults theme to auto", () => {
    expect(buildEmbedUrl({ appUrl: "https://app.openads.co/", workspaceId: "ws_1" })).toBe(
      "https://app.openads.co/embed/ws_1?theme=auto",
    )
  })
})

describe("handleEmbedMessage", () => {
  it("dispatches each message type to its handler with the right payload", () => {
    const calls: string[] = []
    const handlers = {
      onResize: (height: number) => calls.push(`resize:${height}`),
      onReady: () => calls.push("ready"),
      onCheckout: (e: { tierPriceId: string }) => calls.push(`checkout:${e.tierPriceId}`),
      onError: (e: { message: string }) => calls.push(`error:${e.message}`),
    }

    handleEmbedMessage({ type: "openads:resize", height: 412 }, handlers)
    handleEmbedMessage({ type: "openads:ready" }, handlers)
    handleEmbedMessage({ type: "openads:checkout", tierPriceId: "tp_1" }, handlers)
    handleEmbedMessage({ type: "openads:error", message: "boom" }, handlers)

    expect(calls).toEqual(["resize:412", "ready", "checkout:tp_1", "error:boom"])
  })

  it("ignores malformed or unknown payloads", () => {
    let touched = false
    const handlers = { onReady: () => (touched = true) }

    handleEmbedMessage(null, handlers)
    handleEmbedMessage("nope", handlers)
    handleEmbedMessage({ type: "other:event" }, handlers)

    expect(touched).toBe(false)
  })
})

describe("isEmbedMessage", () => {
  const win = {} as Window
  // Minimal stand-ins — isEmbedMessage only reads source/origin and contentWindow/src.
  const iframe = { contentWindow: win, src: "https://app.openads.co/embed/ws_1?theme=auto" }
  const event = (source: unknown, origin: string) => ({ source, origin }) as unknown as MessageEvent

  it("accepts a message from the iframe's window and origin", () => {
    expect(isEmbedMessage(event(win, "https://app.openads.co"), iframe as HTMLIFrameElement)).toBe(
      true,
    )
  })

  it("rejects a wrong source, a wrong origin, or no iframe", () => {
    expect(isEmbedMessage(event({}, "https://app.openads.co"), iframe as HTMLIFrameElement)).toBe(
      false,
    )
    expect(isEmbedMessage(event(win, "https://evil.example"), iframe as HTMLIFrameElement)).toBe(
      false,
    )
    expect(isEmbedMessage(event(win, "https://app.openads.co"), null)).toBe(false)
  })
})
