const DEFAULT_API_URL = "https://api.revinel.com"
const DEFAULT_TIMEOUT_MS = 10_000

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

// Feature strings carry a leading keyboard-typeable prefix that encodes intent.
const TIER_FEATURE_PREFIXES: Record<RevinelTierFeatureType, string> = {
  positive: "+ ",
  neutral: "~ ",
  negative: "- ",
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

/**
 * Range filter for tier weight (placement targeting). Any subset of the
 * standard numeric bounds; `{ gte: 2.5 }` = premium, `{ lt: 2.5 }` = regular,
 * `{ gte: 2.5, lt: 5 }` = a band. Mirrors Prisma's number filter.
 */
export interface RevinelWeightFilter {
  gte?: number
  gt?: number
  lte?: number
  lt?: number
}

export interface RevinelPlacementOptions {
  weight?: RevinelWeightFilter
  /**
   * Serve only from this tier, or any tier in a set — a fixed slot backed by
   * specific tiers (e.g. a dedicated "hosting" placement). The deterministic
   * complement to `weight`.
   */
  tierId?: string | string[]
  excludeIds?: string[]
  request?: RevinelRequestOptions
}

export type RevinelPlacementListOptions = RevinelPlacementOptions & {
  count?: number
}

export interface RevinelTrackOptions {
  request?: RevinelRequestOptions
}

export interface TrackResponse {
  success: boolean
}

/**
 * Thrown when the API returns a non-2xx response. `isClientError` (4xx) means
 * the request was malformed — a bug in the caller — and should fail loud; a
 * publisher fail-safe should rethrow it rather than swallow it as an outage:
 *
 * ```ts
 * try {
 *   return await client.getAds({ weight: { gte: 2.5 } })
 * } catch (error) {
 *   if (error instanceof RevinelApiError && error.isClientError) throw error
 *   return [] // 5xx / network — Revinel is down, degrade gracefully
 * }
 * ```
 */
export class RevinelApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(RevinelApiError.formatMessage(status, body))
    this.name = "RevinelApiError"
    this.status = status
    this.body = body
  }

  /** 4xx — the request was malformed (a caller bug); fail loud, don't fall back. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500
  }

  /** 5xx — Revinel is unavailable; safe to fall back to an empty/no-ad state. */
  get isServerError(): boolean {
    return this.status >= 500
  }

  // Surface the server's error envelope (`{ code, message }`) in the thrown
  // message so a logged error is actionable, not just a bare status code.
  private static formatMessage(status: number, body: unknown): string {
    const envelope = body as { code?: unknown; message?: unknown } | null
    const code = typeof envelope?.code === "string" ? envelope.code : null
    const message = typeof envelope?.message === "string" ? envelope.message : null
    if (!message) return `Revinel API request failed with status ${status}`
    return `Revinel API request failed with status ${status}: ${code ? `${code} — ` : ""}${message}`
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

/**
 * The client returned by `createRevinelClient`. Declared explicitly rather than
 * inferred so `getAd` / `getAds` keep their `TMeta = RevinelMeta` default in the
 * emitted `.d.ts`. An inferred return type resolves that conditional against the
 * SDK's own (empty) `RevinelMetaRegistry` at build time and bakes in
 * `Record<string, unknown>`, which would defeat a publisher's `ad.meta`
 * augmentation and force a per-call generic.
 */
export interface RevinelClient {
  /** Fetch the single served ad for a placement, or null when none is eligible. */
  getAd: <TMeta = RevinelMeta>(
    options?: RevinelPlacementOptions,
  ) => Promise<RevinelAd<TMeta> | null>
  /** Fetch up to `count` distinct served ads for a placement. */
  getAds: <TMeta = RevinelMeta>(
    options?: RevinelPlacementListOptions,
  ) => Promise<RevinelAd<TMeta>[]>
  /** Record an impression for an ad. */
  recordImpression: (adId: string, options?: RevinelTrackOptions) => Promise<TrackResponse>
  /** Record a click for an ad. */
  recordClick: (adId: string, options?: RevinelTrackOptions) => Promise<TrackResponse>
  /** List the workspace's advertising tiers. */
  getTiers: (options?: RevinelRequestOptions) => Promise<RevinelTier[]>
  /** Create a Stripe Checkout session for a tier price. */
  createCheckout: (
    options: RevinelCheckoutOptions,
    requestOptions?: RevinelRequestOptions,
  ) => Promise<RevinelCheckoutSession>
}

export function createRevinelClient({
  workspaceId,
  apiUrl = DEFAULT_API_URL,
  fetch: customFetch,
  request,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RevinelClientOptions): RevinelClient {
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

  function buildServingAdsPath({
    weight,
    tierId,
    excludeIds,
    count,
  }: RevinelPlacementListOptions = {}): string {
    const params = new URLSearchParams()
    // Bracket notation the OpenAPI handler deserializes into `{ weight: {...} }`.
    for (const bound of ["gte", "gt", "lte", "lt"] as const) {
      const value = weight?.[bound]
      if (value !== undefined) params.set(`weight[${bound}]`, String(value))
    }
    // A set is comma-joined, matching `excludeIds`; a single id is sent as-is.
    const tierIds = Array.isArray(tierId) ? tierId : tierId ? [tierId] : []
    if (tierIds.length) params.set("tierId", tierIds.join(","))
    if (excludeIds?.length) params.set("excludeIds", excludeIds.join(","))
    if (count !== undefined) params.set("count", String(count))

    const query = params.toString()
    const path = `/v1/workspaces/${encodeURIComponent(workspaceId)}/ads/serving`
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

    const response = await fetcher(`${baseUrl}${buildServingAdsPath(options)}`, effective)

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
      fetchJson<TrackResponse>(`/v1/ads/${encodeURIComponent(adId)}/${kind}s`, {
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
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/checkout-sessions`,
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
