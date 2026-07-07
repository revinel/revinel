const DEFAULT_API_URL = "https://api.revinel.com"
const DEFAULT_TIMEOUT_MS = 10_000

// Mirrors the Prisma `FieldType` enum (packages/db/prisma/models/field.prisma).
// Kept as a standalone literal union because the SDK is published with zero
// deps and cannot import `@revinel/db`; the server tightens its `/v1` schema to
// the same enum, so any drift surfaces in `/v1/openapi.json`.
export type RevinelFieldType = "Text" | "Textarea" | "Url" | "Number" | "Switch" | "Image" | "Color"

/**
 * A `Color` field's served value: the picked color as ready-to-use CSS strings.
 * No alpha is stored — add opacity on your side with `color-mix()` or relative
 * color syntax, e.g. `oklch(from <value.oklch> l c h / 0.8)`.
 */
export interface RevinelColorValue {
  hex: string
  rgb: string
  hsl: string
  oklch: string
}

export interface RevinelFieldValue {
  id: string
  key: string
  name: string
  type: RevinelFieldType
  value: unknown
}

/**
 * Augmentation anchor for typing `ad.meta` globally — no per-call generic. Each
 * key is a custom field's stable machine slug (shown in the Revinel dashboard):
 *
 * ```ts
 * declare module "@revinel/sdk" {
 *   interface RevinelMetaRegistry {
 *     tagline?: string
 *     bannerImage?: string
 *     // A `Color` field's value is a `RevinelColorValue` object, not a string.
 *     brandColor?: RevinelColorValue
 *   }
 * }
 * ```
 *
 * Left empty, `RevinelMeta` falls back to `Record<string, unknown>`.
 */
export interface RevinelMetaRegistry {}

export type RevinelMeta = keyof RevinelMetaRegistry extends never
  ? Record<string, unknown>
  : RevinelMetaRegistry

/**
 * `meta` is keyed by each field's stable machine slug. Augment `RevinelMetaRegistry`
 * (see above) to type it globally, or pass `TMeta` per call as a one-off override.
 */
export interface RevinelAd<TMeta = RevinelMeta> {
  id: string
  name: string
  websiteUrl: string
  faviconUrl: string | null
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
  /**
   * Milliseconds before a request aborts (via `AbortSignal.timeout`), so a
   * hung connection can never stall a caller forever. Pass `false` to disable.
   * Ignored for a request that carries its own `signal`.
   * @default 10000
   */
  timeoutMs?: number | false
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

// Default the fetch to `no-store` so a framework cache (e.g. Next's default
// fetch caching) never freezes the response. The caller opts back into caching
// with `cache` or `next.revalidate`.
function withNoStoreDefault(options: RevinelRequestOptions): RevinelRequestOptions {
  return options.cache === undefined && options.next?.revalidate === undefined
    ? { ...options, cache: "no-store" }
    : options
}

// Default ad fetches to a 60s revalidate instead of `no-store`: an explicit
// no-store marks a Next.js App Router route dynamic and 500s statically-
// generated pages at runtime (DYNAMIC_SERVER_USAGE). 60s keeps rotation fresh
// without freezing an ad forever AND stays cacheable so static pages can
// prerender — the API edge-caches ~5s anyway, so per-request rotation was
// always approximate. Non-Next runtimes ignore the `next` key; server fetches
// (Node/edge) stay uncached, while browsers now honor the response
// Cache-Control (max-age=5), the same ~5s reuse the API's edge cache already
// imposes. Skipped when the caller sets `cache` or `next.revalidate`.
function withRevalidateDefault(options: RevinelRequestOptions): RevinelRequestOptions {
  return options.cache === undefined && options.next?.revalidate === undefined
    ? { ...options, next: { ...options.next, revalidate: 60 } }
    : options
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
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RevinelClientOptions) {
  const baseUrl = trimTrailingSlash(apiUrl)
  const fetcher = getFetch(customFetch)

  // Default every request to an abort-on-timeout signal so a black-holed
  // connection rejects instead of hanging forever. Skipped when the caller
  // provides a `signal` (incl. an explicit `null`), when timeouts are disabled
  // via `timeoutMs: false`, or on runtimes without `AbortSignal.timeout`.
  function withTimeoutDefault(options: RevinelRequestOptions): RevinelRequestOptions {
    if (timeoutMs === false || options.signal !== undefined) return options
    if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
      return options
    }

    return { ...options, signal: AbortSignal.timeout(timeoutMs) }
  }

  async function fetchJson<T>(path: string, options?: RevinelRequestOptions): Promise<T> {
    const response = await fetcher(
      `${baseUrl}${path}`,
      withTimeoutDefault(mergeRequestOptions(request, options)),
    )

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

  async function getAds<TMeta = RevinelMeta>({
    request: placementRequest,
    ...options
  }: RevinelPlacementListOptions = {}): Promise<RevinelAd<TMeta>[]> {
    // Ads rotate, but a 60s revalidate is fresh enough (the API edge-caches
    // ~5s anyway) and keeps the fetch cacheable so Next static pages can
    // prerender — see withRevalidateDefault.
    const effective = withTimeoutDefault(
      withRevalidateDefault(mergeRequestOptions(request, placementRequest)),
    )

    const response = await fetcher(`${baseUrl}${buildCurrentAdsPath(options)}`, effective)

    return (await readJson<{ ads: RevinelAd<TMeta>[] }>(response)).ads
  }

  async function getAd<TMeta = RevinelMeta>(
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
    // Prices change (archive + create new) — serve fresh by default so a stale
    // tier list never sends a checkout to an archived `tierPriceId`.
    const effective = withTimeoutDefault(withNoStoreDefault(mergeRequestOptions(request, options)))

    const response = await fetcher(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/tiers`,
      effective,
    )

    return (await readJson<{ tiers: RevinelTier[] }>(response)).tiers
  }

  function createCheckout(
    { tierPriceId, email, cancelUrl }: RevinelCheckoutOptions,
    options: RevinelRequestOptions = {},
  ): Promise<RevinelCheckoutSession> {
    return fetchJson<RevinelCheckoutSession>(
      "/v1/checkout",
      // Merge caller options so their `headers` extend (not replace) the JSON
      // content-type; explicit `method`/`body` still win over any caller value.
      mergeRequestOptions(
        { headers: { "content-type": "application/json" } },
        {
          ...options,
          method: "POST",
          body: JSON.stringify({ tierPriceId, email, cancelUrl }),
        },
      ),
    )
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
