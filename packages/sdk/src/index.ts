const DEFAULT_API_URL = "https://api.revinel.com"

// Mirrors the Prisma `FieldType` enum (packages/db/prisma/models/field.prisma).
// Kept as a standalone literal union because the SDK is published with zero
// deps and cannot import `@revinel/db`; the server tightens its `/v1` schema to
// the same enum, so any drift surfaces in `/v1/openapi.json`.
export type RevinelFieldType = "Text" | "Textarea" | "Url" | "Number" | "Switch" | "Image"

export interface RevinelFieldValue {
  id: string
  key: string
  name: string
  type: RevinelFieldType
  value: unknown
}

/**
 * `meta` is keyed by each field's stable machine slug. Pass your own interface
 * as `TMeta` (e.g. `getAd<{ bannerImage?: string }>()`) for typesafe access.
 */
export interface RevinelAd<TMeta = Record<string, unknown>> {
  id: string
  name: string
  websiteUrl: string
  faviconUrl: string
  weight: number
  meta: TMeta
  fields: RevinelFieldValue[]
}

export type RevinelBillingInterval = "Day" | "Week" | "Month" | "Year"

export interface RevinelTierPrice {
  id: string
  interval: RevinelBillingInterval
  intervalCount: number
  /** Amount in the smallest currency unit (cents). */
  amount: number
  currency: string
}

export interface RevinelTier {
  id: string
  name: string
  description: string
  weight: number
  order: number
  /** Raw feature strings; parse with `parseTierFeature`. */
  features: string[]
  prices: RevinelTierPrice[]
}

export type RevinelTierFeatureType = "positive" | "neutral" | "negative"

export interface RevinelTierFeature {
  type: RevinelTierFeatureType
  label: string
}

export interface RevinelCheckoutOptions {
  tierPriceId: string
  /** Pre-fills the email on the Stripe Checkout page. */
  email?: string
  /** Where Stripe returns the visitor on cancel. Success always stays on Revinel. */
  cancelUrl?: string
}

export interface RevinelCheckoutSession {
  url: string
  sessionId: string
}

// Feature strings are stored with a leading glyph that encodes intent.
const TIER_FEATURE_PREFIXES: Record<RevinelTierFeatureType, string> = {
  positive: "✓ ",
  neutral: "• ",
  negative: "✗ ",
}

/**
 * Splits a tier feature string into its intent (`positive`/`neutral`/`negative`)
 * and display label. Unprefixed strings are treated as neutral.
 */
export function parseTierFeature(raw: string): RevinelTierFeature {
  for (const type of ["positive", "neutral", "negative"] as const) {
    const prefix = TIER_FEATURE_PREFIXES[type]
    if (raw.startsWith(prefix)) {
      return { type, label: raw.slice(prefix.length) }
    }
  }
  return { type: "neutral", label: raw }
}

/** Extra `fetch` options merged into every request. */
export type RevinelRequestOptions = RequestInit & {
  /** Next.js `fetch` extension (App Router caching). Ignored by other runtimes. */
  next?: { revalidate?: number | false; tags?: string[] }
}

/**
 * The JSON-serializable subset of `RevinelRequestOptions`. The React bindings
 * memoize the client and hook fetches on `JSON.stringify(request)`, so they
 * accept only this shape — `Headers` instances, `AbortSignal`, streams, and
 * other non-serializable `RequestInit` values would silently never invalidate
 * the memo.
 */
export interface RevinelSerializableRequestOptions {
  method?: string
  headers?: Record<string, string>
  cache?: RequestCache
  credentials?: RequestCredentials
  mode?: RequestMode
  keepalive?: boolean
  referrerPolicy?: ReferrerPolicy
  next?: { revalidate?: number | false; tags?: string[] }
}

export interface RevinelClientOptions {
  workspaceId: string
  apiUrl?: string
  fetch?: typeof fetch
  request?: RevinelRequestOptions
}

export interface RevinelPlacementOptions {
  weightGte?: number
  excludeIds?: string[]
  request?: RevinelRequestOptions
}

export type RevinelPlacementListOptions = RevinelPlacementOptions & {
  count?: number
}

export interface RevinelTrackOptions {
  request?: RevinelRequestOptions
}

interface TrackResponse {
  success: boolean
}

export class RevinelApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(`Revinel API request failed with status ${status}`)
    this.name = "RevinelApiError"
    this.status = status
    this.body = body
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

function getFetch(customFetch?: typeof fetch): typeof fetch {
  if (customFetch) return customFetch

  if (!globalThis.fetch) {
    throw new Error("Revinel SDK requires a fetch implementation.")
  }

  return globalThis.fetch.bind(globalThis)
}

function mergeRequestOptions(
  base: RevinelRequestOptions | undefined,
  next: RevinelRequestOptions | undefined,
): RevinelRequestOptions {
  const headers = new Headers(base?.headers)
  new Headers(next?.headers).forEach((value, key) => {
    headers.set(key, value)
  })

  return {
    ...base,
    ...next,
    headers: Object.fromEntries(headers.entries()),
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new RevinelApiError(response.status, body)
  }

  return (await response.json()) as T
}

export function createRevinelClient({
  workspaceId,
  apiUrl = DEFAULT_API_URL,
  fetch: customFetch,
  request,
}: RevinelClientOptions) {
  const baseUrl = trimTrailingSlash(apiUrl)
  const fetcher = getFetch(customFetch)

  async function fetchJson<T>(path: string, options?: RevinelRequestOptions): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`, mergeRequestOptions(request, options))

    return await readJson<T>(response)
  }

  function buildCurrentAdsPath({
    weightGte,
    excludeIds,
    count,
  }: RevinelPlacementListOptions = {}): string {
    const params = new URLSearchParams()
    if (weightGte !== undefined) params.set("weightGte", String(weightGte))
    if (excludeIds?.length) params.set("excludeIds", excludeIds.join(","))
    if (count !== undefined) params.set("count", String(count))

    const query = params.toString()
    const path = `/v1/workspaces/${encodeURIComponent(workspaceId)}/ads/current`
    return query ? `${path}?${query}` : path
  }

  async function getAds<TMeta = Record<string, unknown>>({
    request: placementRequest,
    ...options
  }: RevinelPlacementListOptions = {}): Promise<RevinelAd<TMeta>[]> {
    const response = await fetchJson<{ ads: RevinelAd<TMeta>[] }>(
      buildCurrentAdsPath(options),
      placementRequest,
    )

    return response.ads
  }

  async function getAd<TMeta = Record<string, unknown>>(
    options: RevinelPlacementOptions = {},
  ): Promise<RevinelAd<TMeta> | null> {
    const ads = await getAds<TMeta>({ ...options, count: 1 })
    return ads[0] ?? null
  }

  function recordEvent(kind: "impression" | "click") {
    return (adId: string, options: RevinelTrackOptions = {}): Promise<TrackResponse> =>
      fetchJson<TrackResponse>(`/v1/ads/${encodeURIComponent(adId)}/${kind}`, {
        method: "POST",
        keepalive: true,
        ...options.request,
      })
  }

  const recordImpression = recordEvent("impression")
  const recordClick = recordEvent("click")

  async function getTiers(options: RevinelRequestOptions = {}): Promise<RevinelTier[]> {
    const response = await fetchJson<{ tiers: RevinelTier[] }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/tiers`,
      options,
    )

    return response.tiers
  }

  function createCheckout(
    { tierPriceId, email, cancelUrl }: RevinelCheckoutOptions,
    options: RevinelRequestOptions = {},
  ): Promise<RevinelCheckoutSession> {
    return fetchJson<RevinelCheckoutSession>("/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tierPriceId, email, cancelUrl }),
      ...options,
    })
  }

  return {
    getAd,
    getAds,
    recordImpression,
    recordClick,
    getTiers,
    createCheckout,
  }
}

export type RevinelClient = ReturnType<typeof createRevinelClient>
