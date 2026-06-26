import { describe, expect, it } from "bun:test"
import { createRevinelClient, RevinelApiError } from "./index"

const sampleAd = {
  id: "ad_123",
  name: "Acme",
  websiteUrl: "https://acme.test",
  faviconUrl: "https://cdn.acme.test/workspaces/ws_revinel/ads/ad_123/favicon.png",
  weight: 2.5,
  meta: { description: "Modern hosting" },
  fields: [
    {
      id: "field_description",
      name: "description",
      type: "Textarea" as const,
      value: "Modern hosting",
    },
  ],
}

describe("createRevinelClient", () => {
  it("fetches one ad with placement query parameters", async () => {
    const calls: { url: string; options?: RequestInit }[] = []
    // oxlint-disable-next-line func-style -- fetch stub typed via `typeof fetch`
    const fetcher: typeof fetch = async (url, options) => {
      calls.push({ url: String(url), options })
      return Response.json({ ads: [sampleAd] })
    }

    const client = createRevinelClient({
      workspaceId: "ws_openalternative",
      apiUrl: "https://api.revinel.test/",
      fetch: fetcher,
    })

    const ad = await client.getAd({
      weightGte: 2.5,
      excludeIds: ["ad_old"],
      request: { cache: "no-store" },
    })

    expect(ad).toEqual(sampleAd)
    expect(calls).toEqual([
      {
        url: "https://api.revinel.test/v1/workspaces/ws_openalternative/ads/current?weightGte=2.5&excludeIds=ad_old&count=1",
        options: { cache: "no-store", headers: {} },
      },
    ])
  })

  it("fetches multiple ads for sponsor grids", async () => {
    const calls: string[] = []
    // oxlint-disable-next-line func-style -- fetch stub typed via `typeof fetch`
    const fetcher: typeof fetch = async url => {
      calls.push(String(url))
      return Response.json({ ads: [sampleAd] })
    }

    const client = createRevinelClient({
      workspaceId: "ws_openalternative",
      apiUrl: "https://api.revinel.test",
      fetch: fetcher,
    })

    const ads = await client.getAds({ count: 5, weightGte: 2.5 })

    expect(ads).toEqual([sampleAd])
    expect(calls[0]).toBe(
      "https://api.revinel.test/v1/workspaces/ws_openalternative/ads/current?weightGte=2.5&count=5",
    )
  })

  it("records impressions and clicks", async () => {
    const calls: { url: string; method?: string }[] = []
    // oxlint-disable-next-line func-style -- fetch stub typed via `typeof fetch`
    const fetcher: typeof fetch = async (url, options) => {
      calls.push({ url: String(url), method: options?.method })
      return Response.json({ success: true })
    }

    const client = createRevinelClient({
      workspaceId: "ws_openalternative",
      apiUrl: "https://api.revinel.test",
      fetch: fetcher,
    })

    await client.recordImpression("ad_123")
    await client.recordClick("ad_123")

    expect(calls).toEqual([
      { url: "https://api.revinel.test/v1/ads/ad_123/impression", method: "POST" },
      { url: "https://api.revinel.test/v1/ads/ad_123/click", method: "POST" },
    ])
  })

  it("throws typed API errors for failed requests", async () => {
    // oxlint-disable-next-line func-style -- fetch stub typed via `typeof fetch`
    const fetcher: typeof fetch = async () => {
      // Public API errors use the same envelope as the OpenAPI surface.
      return Response.json(
        { defined: false, code: "NOT_FOUND", status: 404, message: "Workspace not found." },
        { status: 404 },
      )
    }

    const client = createRevinelClient({
      workspaceId: "ws_missing",
      apiUrl: "https://api.revinel.test",
      fetch: fetcher,
    })

    await expect(client.getAd()).rejects.toBeInstanceOf(RevinelApiError)
  })
})
