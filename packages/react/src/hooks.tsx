"use client"

import {
  type RevinelAd,
  type RevinelCheckoutOptions,
  type RevinelCheckoutSession,
  type RevinelMeta,
  type RevinelPlacementListOptions,
  type RevinelPlacementOptions,
  type RevinelTier,
} from "@revinel/sdk"
import {
  type HTMLAttributes,
  type MouseEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  getError,
  type RevinelQueryState,
  type SerializableRequest,
  useRevinelClient,
  useRevinelQuery,
} from "./provider"

export type RevinelAdOptions = Omit<RevinelPlacementOptions, "request"> &
  SerializableRequest & {
    enabled?: boolean
  }

export type RevinelAdsOptions = Omit<RevinelPlacementListOptions, "request"> &
  SerializableRequest & {
    enabled?: boolean
  }

export interface RevinelTrackingOptions {
  disabled?: boolean
  threshold?: number
  viewabilityDurationMs?: number
}

export interface RevinelTrackingResult {
  impressionRef: RefCallback<HTMLElement>
  trackClick: () => void
  getClickProps: <TElement extends HTMLElement>(
    props?: HTMLAttributes<TElement>,
  ) => HTMLAttributes<TElement>
}

export function useAd<TMeta = RevinelMeta>({
  enabled = true,
  weightGte,
  excludeIds,
  request,
}: RevinelAdOptions = {}): RevinelQueryState<RevinelAd<TMeta> | null> {
  const client = useRevinelClient()
  const excludeKey = excludeIds?.join(",") ?? ""
  // Same trick as excludeKey: key on content, not identity, so inline objects
  // don't refetch every render but real request changes do.
  const requestKey = JSON.stringify(request)

  const getData = useCallback(
    () => client.getAd<TMeta>({ weightGte, excludeIds, request }),
    [client, excludeKey, requestKey, weightGte],
  )

  return useRevinelQuery<RevinelAd<TMeta> | null>(enabled, null, getData)
}

export function useAds<TMeta = RevinelMeta>({
  enabled = true,
  weightGte,
  excludeIds,
  count,
  request,
}: RevinelAdsOptions = {}): RevinelQueryState<RevinelAd<TMeta>[]> {
  const client = useRevinelClient()
  const excludeKey = excludeIds?.join(",") ?? ""
  const requestKey = JSON.stringify(request)

  const getData = useCallback(
    () => client.getAds<TMeta>({ weightGte, excludeIds, count, request }),
    [client, count, excludeKey, requestKey, weightGte],
  )

  return useRevinelQuery<RevinelAd<TMeta>[]>(enabled, [], getData)
}

export function useTracking(
  // Only the id is read, so accept the id directly or anything carrying one (the
  // full ad, or a reduced render shape of your own).
  ad: { id: string } | string | null | undefined,
  { disabled = false, threshold = 0.5, viewabilityDurationMs = 500 }: RevinelTrackingOptions = {},
): RevinelTrackingResult {
  const client = useRevinelClient()
  const [element, setElement] = useState<HTMLElement | null>(null)
  const trackedAdId = useRef<string | null>(null)
  const adId = (typeof ad === "string" ? ad : ad?.id) ?? null

  const impressionRef = useCallback<RefCallback<HTMLElement>>(node => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (disabled || !adId || !element || typeof IntersectionObserver === "undefined") return
    if (trackedAdId.current === adId) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer = setTimeout(() => {
            if (trackedAdId.current === adId) return
            trackedAdId.current = adId
            client.recordImpression(adId).catch(() => {})
          }, viewabilityDurationMs)
          return
        }

        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      },
      { threshold },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [adId, client, disabled, element, threshold, viewabilityDurationMs])

  const trackClick = useCallback(() => {
    if (disabled || !adId) return
    client.recordClick(adId).catch(() => {})
  }, [adId, client, disabled])

  const getClickProps = useCallback(
    <TElement extends HTMLElement>(
      props: HTMLAttributes<TElement> = {},
    ): HTMLAttributes<TElement> => {
      return {
        ...props,
        onClick: (event: MouseEvent<TElement>) => {
          trackClick()
          props.onClick?.(event)
        },
        // Middle-click / open-in-new-tab fire `auxclick`, not `click`, so wire
        // it too — filtered to the middle button (right-click opens the context
        // menu, not an ad click). The keepalive recording survives the
        // resulting navigation.
        onAuxClick: (event: MouseEvent<TElement>) => {
          if (event.button === 1) trackClick()
          props.onAuxClick?.(event)
        },
      }
    },
    [trackClick],
  )

  return { impressionRef, trackClick, getClickProps }
}

export type RevinelTiersOptions = SerializableRequest & { enabled?: boolean }

export function useTiers({ enabled = true, request }: RevinelTiersOptions = {}): RevinelQueryState<
  RevinelTier[]
> {
  const client = useRevinelClient()
  const requestKey = JSON.stringify(request)

  const getData = useCallback(() => client.getTiers(request), [client, requestKey])

  return useRevinelQuery<RevinelTier[]>(enabled, [], getData)
}

export interface RevinelCheckoutResult {
  createCheckout: (options: RevinelCheckoutOptions) => Promise<RevinelCheckoutSession>
  redirectToCheckout: (options: RevinelCheckoutOptions) => Promise<void>
  isPending: boolean
  error: Error | null
}

export function useCheckout(): RevinelCheckoutResult {
  const client = useRevinelClient()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createCheckout = useCallback(
    async (options: RevinelCheckoutOptions) => {
      setIsPending(true)
      setError(null)

      try {
        return await client.createCheckout(options)
      } catch (caught) {
        const nextError = getError(caught)
        setError(nextError)
        throw nextError
      } finally {
        setIsPending(false)
      }
    },
    [client],
  )

  const redirectToCheckout = useCallback(
    async (options: RevinelCheckoutOptions) => {
      const { url } = await createCheckout(options)
      // Break out of any embedding iframe so Stripe Checkout loads at top level
      // (same as self when not framed).
      const target = window.top ?? window
      target.location.href = url
    },
    [createCheckout],
  )

  return { createCheckout, redirectToCheckout, isPending, error }
}
