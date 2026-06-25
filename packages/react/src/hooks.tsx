"use client"

import {
  type OpenAdsAd,
  type OpenAdsCheckoutOptions,
  type OpenAdsCheckoutSession,
  type OpenAdsPlacementListOptions,
  type OpenAdsPlacementOptions,
  type OpenAdsTier,
} from "@openads/sdk"
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
  type OpenAdsQueryState,
  type SerializableRequest,
  useOpenAdsClient,
  useOpenAdsQuery,
} from "./provider"

export type OpenAdsAdOptions = Omit<OpenAdsPlacementOptions, "request"> &
  SerializableRequest & {
    enabled?: boolean
  }

export type OpenAdsAdsOptions = Omit<OpenAdsPlacementListOptions, "request"> &
  SerializableRequest & {
    enabled?: boolean
  }

export type OpenAdsTrackingOptions = {
  disabled?: boolean
  threshold?: number
  viewabilityDurationMs?: number
}

export type OpenAdsTrackingResult = {
  impressionRef: RefCallback<HTMLElement>
  trackClick: () => void
  getClickProps: <TElement extends HTMLElement>(
    props?: HTMLAttributes<TElement>,
  ) => HTMLAttributes<TElement>
}

export const useOpenAdsAd = <TMeta = Record<string, unknown>,>({
  enabled = true,
  weightGte,
  excludeIds,
  request,
}: OpenAdsAdOptions = {}): OpenAdsQueryState<OpenAdsAd<TMeta> | null> => {
  const client = useOpenAdsClient()
  const excludeKey = excludeIds?.join(",") ?? ""
  // Same trick as excludeKey: key on content, not identity, so inline objects
  // don't refetch every render but real request changes do.
  const requestKey = JSON.stringify(request)

  const getData = useCallback(
    () => client.getAd<TMeta>({ weightGte, excludeIds, request }),
    [client, excludeKey, requestKey, weightGte],
  )

  return useOpenAdsQuery<OpenAdsAd<TMeta> | null>(enabled, null, getData)
}

export const useOpenAdsAds = <TMeta = Record<string, unknown>,>({
  enabled = true,
  weightGte,
  excludeIds,
  count,
  request,
}: OpenAdsAdsOptions = {}): OpenAdsQueryState<Array<OpenAdsAd<TMeta>>> => {
  const client = useOpenAdsClient()
  const excludeKey = excludeIds?.join(",") ?? ""
  const requestKey = JSON.stringify(request)

  const getData = useCallback(
    () => client.getAds<TMeta>({ weightGte, excludeIds, count, request }),
    [client, count, excludeKey, requestKey, weightGte],
  )

  return useOpenAdsQuery<Array<OpenAdsAd<TMeta>>>(enabled, [], getData)
}

export const useOpenAdsTracking = <TMeta = Record<string, unknown>,>(
  ad: OpenAdsAd<TMeta> | null | undefined,
  { disabled = false, threshold = 0.5, viewabilityDurationMs = 500 }: OpenAdsTrackingOptions = {},
): OpenAdsTrackingResult => {
  const client = useOpenAdsClient()
  const [element, setElement] = useState<HTMLElement | null>(null)
  const trackedAdId = useRef<string | null>(null)

  const impressionRef = useCallback<RefCallback<HTMLElement>>(node => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (disabled || !ad || !element || typeof IntersectionObserver === "undefined") return
    if (trackedAdId.current === ad.id) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer = setTimeout(() => {
            if (trackedAdId.current === ad.id) return
            trackedAdId.current = ad.id
            client.recordImpression(ad.id).catch(() => {})
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
  }, [ad, client, disabled, element, threshold, viewabilityDurationMs])

  const trackClick = useCallback(() => {
    if (disabled || !ad) return
    client.recordClick(ad.id).catch(() => {})
  }, [ad, client, disabled])

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
      }
    },
    [trackClick],
  )

  return { impressionRef, trackClick, getClickProps }
}

export type OpenAdsTiersOptions = SerializableRequest & { enabled?: boolean }

export const useOpenAdsTiers = ({
  enabled = true,
  request,
}: OpenAdsTiersOptions = {}): OpenAdsQueryState<Array<OpenAdsTier>> => {
  const client = useOpenAdsClient()
  const requestKey = JSON.stringify(request)

  const getData = useCallback(() => client.getTiers(request), [client, requestKey])

  return useOpenAdsQuery<Array<OpenAdsTier>>(enabled, [], getData)
}

export type OpenAdsCheckoutResult = {
  createCheckout: (options: OpenAdsCheckoutOptions) => Promise<OpenAdsCheckoutSession>
  redirectToCheckout: (options: OpenAdsCheckoutOptions) => Promise<void>
  isPending: boolean
  error: Error | null
}

export const useOpenAdsCheckout = (): OpenAdsCheckoutResult => {
  const client = useOpenAdsClient()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createCheckout = useCallback(
    async (options: OpenAdsCheckoutOptions) => {
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
    async (options: OpenAdsCheckoutOptions) => {
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
