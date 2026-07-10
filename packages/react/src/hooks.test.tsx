import { afterEach, describe, expect, it, mock } from "bun:test"
import { act, cleanup, render } from "@testing-library/react"
import type { ReactNode, Ref } from "react"
import { applyRef, useTracking, type RevinelTrackingOptions } from "./hooks"
import { RevinelProvider } from "./provider"
import { fireIntersect } from "./test-setup"

afterEach(cleanup)

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function Slot({ options }: { options?: RevinelTrackingOptions }) {
  const { impressionRef, getClickProps } = useTracking("ad_1", options)
  return (
    <a ref={impressionRef} href="https://example.test" {...getClickProps()}>
      ad
    </a>
  )
}

function countImpressions(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter(([url]) => String(url).endsWith("/impressions")).length
}

function renderSlot(options?: RevinelTrackingOptions) {
  const fetchSpy = mock(async () => Response.json({ success: true }))
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <RevinelProvider workspaceId="ws_test" apiUrl="https://api.revinel.test" fetch={fetchSpy}>
        {children}
      </RevinelProvider>
    )
  }
  const view = render(<Slot options={options} />, { wrapper })
  return { ...view, impressions: () => countImpressions(fetchSpy) }
}

describe("applyRef", () => {
  it("assigns and clears an object ref", () => {
    const ref: { current: string | null } = { current: null }
    const cleanup = applyRef(ref, "node")
    expect(ref.current).toBe("node")
    cleanup?.()
    expect(ref.current).toBeNull()
  })

  it("synthesizes a null detach for a callback ref without cleanup", () => {
    const calls: (string | null)[] = []
    const cleanup = applyRef((value: string | null) => {
      calls.push(value)
    }, "node")
    expect(calls).toEqual(["node"])
    cleanup?.()
    expect(calls).toEqual(["node", null])
  })

  it("honors a callback ref's returned cleanup (React 19) and never calls it with null", () => {
    const calls: (string | null)[] = []
    const userCleanup = mock(() => {})
    const cleanup = applyRef((value: string | null) => {
      calls.push(value)
      return userCleanup
    }, "node")
    cleanup?.()
    expect(userCleanup).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(["node"]) // never re-invoked with null
  })

  it("returns undefined for a missing ref", () => {
    expect(applyRef(undefined, "node")).toBeUndefined()
  })
})

describe("useTracking ref composition", () => {
  it("composes an object ref: set on mount, nulled on unmount", () => {
    const ref: Ref<HTMLElement> = { current: null }
    const { unmount } = renderSlot({ ref })
    expect(ref.current).toBeInstanceOf(HTMLAnchorElement)
    unmount()
    expect(ref.current).toBeNull()
  })

  it("composes a callback ref: called with node then null on unmount", () => {
    const calls: (HTMLElement | null)[] = []
    const { unmount } = renderSlot({
      ref: node => {
        calls.push(node)
      },
    })
    expect(calls.at(-1)).toBeInstanceOf(HTMLAnchorElement)
    unmount()
    expect(calls.at(-1)).toBeNull()
  })

  it("records one impression once viewable (no ref passed)", async () => {
    const view = renderSlot({ viewabilityDurationMs: 10 })
    await act(async () => {
      fireIntersect(true)
      await wait(30)
    })
    expect(view.impressions()).toBe(1)
  })

  it("swaps external refs on identity change without breaking tracking", async () => {
    const first: Ref<HTMLElement> = { current: null }
    const second: Ref<HTMLElement> = { current: null }
    const fetchSpy = mock(async () => Response.json({ success: true }))
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <RevinelProvider workspaceId="ws_test" apiUrl="https://api.revinel.test" fetch={fetchSpy}>
          {children}
        </RevinelProvider>
      )
    }
    const { rerender } = render(<Slot options={{ ref: first, viewabilityDurationMs: 10 }} />, {
      wrapper,
    })
    expect(first.current).toBeInstanceOf(HTMLAnchorElement)

    rerender(<Slot options={{ ref: second, viewabilityDurationMs: 10 }} />)
    expect(first.current).toBeNull()
    expect(second.current).toBeInstanceOf(HTMLAnchorElement)

    await act(async () => {
      fireIntersect(true)
      await wait(30)
    })
    expect(countImpressions(fetchSpy)).toBe(1)
  })

  it("applies the external ref even when disabled, without recording", async () => {
    const ref: Ref<HTMLElement> = { current: null }
    const view = renderSlot({ ref, disabled: true, viewabilityDurationMs: 10 })
    expect(ref.current).toBeInstanceOf(HTMLAnchorElement)
    await act(async () => {
      fireIntersect(true)
      await wait(30)
    })
    expect(view.impressions()).toBe(0)
    view.unmount()
    expect(ref.current).toBeNull()
  })
})
