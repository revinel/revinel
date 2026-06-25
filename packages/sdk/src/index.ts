const DEFAULT_API_URL = "https://api.openads.co"

// Mirrors the Prisma `FieldType` enum (packages/db/prisma/models/field.prisma).
// Kept as a standalone literal union because the SDK is published with zero
// deps and cannot import `@openads/db`; the server tightens its `/v1` schema to
// the same enum, so any drift surfaces in `/v1/openapi.json`.
export type OpenAdsFieldType = "Text" | "Textarea" | "Url" | "Number" | "Switch" | "Image"

export type OpenAdsFieldValue = {
  id: string
  key: string
  name: string
  type: OpenAdsFieldType
  value: unknown
}

/**
 * `meta` is keyed by each field's stable machine slug. Pass your own interface
 * as `TMeta` (e.g. `getAd<{ bannerImage?: string }>()`) for typesafe access.
 */
export type OpenAdsAd<TMeta = Record<string, unknown>> = {
  id: string
  name: string
  websiteUrl: string
  faviconUrl: string
  weight: number
  meta: TMeta
  fields: Array<OpenAdsFieldValue>
}

export type OpenAdsBillingInterval = "Day" | "Week" | "Month" | "Year"

export type OpenAdsTierPrice = {
  id: string
  interval: OpenAdsBillingInterval
  intervalCount: number
  /** Amount in the smallest currency unit (cents). */
  amount: number
  currency: string
}

export type OpenAdsTier = {
  id: string
  name: string
  description: string
  weight: number
  order: number
  /** Raw feature strings; parse with `parseTierFeature`. */
  features: Array<string>
  prices: Array<OpenAdsTierPrice>
}

export type OpenAdsTierFeatureType = "positive" | "neutral" | "negative"

export type OpenAdsTierFeature = {
  type: OpenAdsTierFeatureType
  label: string
}

export type OpenAdsCheckoutOptions = {
  tierPriceId: string
  /** Pre-fills the email on the Stripe Checkout page. */
  email?: string
  /** Where Stripe returns the visitor on cancel. Success always stays on OpenAds. */
  cancelUrl?: string
}

export type OpenAdsCheckoutSession = {
  url: string
  sessionId: string
}

// Feature strings are stored with a leading glyph that encodes intent.
const TIER_FEATURE_PREFIXES: Record<OpenAdsTierFeatureType, string> = {
  positive: "✓ ",
  neutral: "• ",
  negative: "✗ ",
}

/**
 * Splits a tier feature string into its intent (`positive`/`neutral`/`negative`)
 * and display label. Unprefixed strings are treated as neutral.
 */
export const parseTierFeature = (raw: string): OpenAdsTierFeature => {
  for (const type of ["positive", "neutral", "negative"] as const) {
    const prefix = TIER_FEATURE_PREFIXES[type]
    if (raw.startsWith(prefix)) {
      return { type, label: raw.slice(prefix.length) }
    }
  }
  return { type: "neutral", label: raw }
}

/** Extra `fetch` options merged into every request. */
export type OpenAdsRequestOptions = RequestInit & {
  /** Next.js `fetch` extension (App Router caching). Ignored by other runtimes. */
  next?: { revalidate?: number | false; tags?: Array<string> }
}

/**
 * The JSON-serializable subset of `OpenAdsRequestOptions`. The React bindings
 * memoize the client and hook fetches on `JSON.stringify(request)`, so they
 * accept only this shape — `Headers` instances, `AbortSignal`, streams, and
 * other non-serializable `RequestInit` values would silently never invalidate
 * the memo.
 */
export type OpenAdsSerializableRequestOptions = {
  method?: string
  headers?: Record<string, string>
  cache?: RequestCache
  credentials?: RequestCredentials
  mode?: RequestMode
  keepalive?: boolean
  referrerPolicy?: ReferrerPolicy
  next?: { revalidate?: number | false; tags?: Array<string> }
}

export type OpenAdsClientOptions = {
  workspaceId: string
  apiUrl?: string
  fetch?: typeof fetch
  request?: OpenAdsRequestOptions
}

export type OpenAdsPlacementOptions = {
  weightGte?: number
  excludeIds?: Array<string>
  request?: OpenAdsRequestOptions
}

export type OpenAdsPlacementListOptions = OpenAdsPlacementOptions & {
  count?: number
}

export type OpenAdsTrackOptions = {
  request?: OpenAdsRequestOptions
}

type TrackResponse = {
  success: boolean
}

export class OpenAdsApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(`OpenAds API request failed with status ${status}`)
    this.name = "OpenAdsApiError"
    this.status = status
    this.body = body
  }
}

const trimTrailingSlash = (value: string): string => {
  return value.replace(/\/+$/, "")
}

const getFetch = (customFetch?: typeof fetch): typeof fetch => {
  if (customFetch) return customFetch

  if (!globalThis.fetch) {
    throw new Error("OpenAds SDK requires a fetch implementation.")
  }

  return globalThis.fetch.bind(globalThis)
}

const mergeRequestOptions = (
  base: OpenAdsRequestOptions | undefined,
  next: OpenAdsRequestOptions | undefined,
): OpenAdsRequestOptions => {
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

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new OpenAdsApiError(response.status, body)
  }

  return (await response.json()) as T
}

export const createOpenAdsClient = ({
  workspaceId,
  apiUrl = DEFAULT_API_URL,
  fetch: customFetch,
  request,
}: OpenAdsClientOptions) => {
  const baseUrl = trimTrailingSlash(apiUrl)
  const fetcher = getFetch(customFetch)

  const fetchJson = async <T>(path: string, options?: OpenAdsRequestOptions): Promise<T> => {
    const response = await fetcher(`${baseUrl}${path}`, mergeRequestOptions(request, options))

    return await readJson<T>(response)
  }

  const buildCurrentAdsPath = ({
    weightGte,
    excludeIds,
    count,
  }: OpenAdsPlacementListOptions = {}): string => {
    const params = new URLSearchParams()
    if (weightGte !== undefined) params.set("weightGte", String(weightGte))
    if (excludeIds?.length) params.set("excludeIds", excludeIds.join(","))
    if (count !== undefined) params.set("count", String(count))

    const query = params.toString()
    const path = `/v1/workspaces/${encodeURIComponent(workspaceId)}/ads/current`
    return query ? `${path}?${query}` : path
  }

  const getAds = async <TMeta = Record<string, unknown>>({
    request: placementRequest,
    ...options
  }: OpenAdsPlacementListOptions = {}): Promise<Array<OpenAdsAd<TMeta>>> => {
    const response = await fetchJson<{ ads: Array<OpenAdsAd<TMeta>> }>(
      buildCurrentAdsPath(options),
      placementRequest,
    )

    return response.ads
  }

  const getAd = async <TMeta = Record<string, unknown>>(
    options: OpenAdsPlacementOptions = {},
  ): Promise<OpenAdsAd<TMeta> | null> => {
    const ads = await getAds<TMeta>({ ...options, count: 1 })
    return ads[0] ?? null
  }

  const recordEvent =
    (kind: "impression" | "click") =>
    (adId: string, options: OpenAdsTrackOptions = {}): Promise<TrackResponse> =>
      fetchJson<TrackResponse>(`/v1/ads/${encodeURIComponent(adId)}/${kind}`, {
        method: "POST",
        keepalive: true,
        ...options.request,
      })

  const recordImpression = recordEvent("impression")
  const recordClick = recordEvent("click")

  const getTiers = async (options: OpenAdsRequestOptions = {}): Promise<Array<OpenAdsTier>> => {
    const response = await fetchJson<{ tiers: Array<OpenAdsTier> }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/tiers`,
      options,
    )

    return response.tiers
  }

  const createCheckout = (
    { tierPriceId, email, cancelUrl }: OpenAdsCheckoutOptions,
    options: OpenAdsRequestOptions = {},
  ): Promise<OpenAdsCheckoutSession> =>
    fetchJson<OpenAdsCheckoutSession>("/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tierPriceId, email, cancelUrl }),
      ...options,
    })

  return {
    getAd,
    getAds,
    recordImpression,
    recordClick,
    getTiers,
    createCheckout,
  }
}

export type OpenAdsClient = ReturnType<typeof createOpenAdsClient>
