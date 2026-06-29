"use client"

import {
  createRevinelClient,
  type RevinelClient,
  type RevinelClientOptions,
  type RevinelSerializableRequestOptions,
} from "@revinel/sdk"
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

// The provider and hooks memoize on `JSON.stringify(request)`, so they accept
// only the serializable subset — a `signal` or `Headers` instance would
// stringify to a constant and never invalidate the memo.
export interface SerializableRequest {
  request?: RevinelSerializableRequestOptions
}

export interface RevinelQueryState<TData> {
  data: TData
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<TData>
}

export type RevinelProviderProps = PropsWithChildren<
  Omit<RevinelClientOptions, "request"> &
    SerializableRequest & {
      /** Origin of the Revinel app serving `/embed`, inherited by `<TierSelector>`. */
      appUrl?: string
    }
>

interface RevinelContextValue {
  client: RevinelClient
  workspaceId: string
  appUrl?: string
}

const RevinelContext = createContext<RevinelContextValue | null>(null)

export function RevinelProvider({
  children,
  workspaceId,
  apiUrl,
  appUrl,
  fetch,
  request,
}: RevinelProviderProps) {
  const requestKey = JSON.stringify(request)

  const value = useMemo<RevinelContextValue>(() => {
    return {
      client: createRevinelClient({ workspaceId, apiUrl, fetch, request }),
      workspaceId,
      appUrl,
    }
  }, [apiUrl, appUrl, fetch, requestKey, workspaceId])

  return <RevinelContext.Provider value={value}>{children}</RevinelContext.Provider>
}

export function useRevinelClient(): RevinelClient {
  const context = useContext(RevinelContext)

  if (!context) {
    throw new Error("useRevinelClient must be used within RevinelProvider.")
  }

  return context.client
}

/**
 * Reads `workspaceId` / `appUrl` from the nearest provider, or `{}` when used
 * outside one. Non-throwing on purpose — lets `<TierSelector>` inherit provider
 * config while still working standalone with explicit props.
 */
export function useRevinelConfig(): { workspaceId?: string; appUrl?: string } {
  const context = useContext(RevinelContext)
  return { workspaceId: context?.workspaceId, appUrl: context?.appUrl }
}

export function getError(value: unknown): Error {
  if (value instanceof Error) return value
  return new Error("Revinel request failed.", { cause: value })
}

export function useRevinelQuery<TData>(
  enabled: boolean,
  initialData: TData,
  getData: () => Promise<TData>,
): RevinelQueryState<TData> {
  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)
  const latestRequestId = useRef(0)

  const refetch = useCallback(async () => {
    const requestId = ++latestRequestId.current
    setIsLoading(true)
    setError(null)

    try {
      const nextData = await getData()
      if (requestId === latestRequestId.current) setData(nextData)
      return nextData
    } catch (caught) {
      const nextError = getError(caught)
      if (requestId === latestRequestId.current) setError(nextError)
      throw nextError
    } finally {
      if (requestId === latestRequestId.current) setIsLoading(false)
    }
  }, [getData])

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    refetch().catch(() => {})
  }, [enabled, refetch])

  return { data, isLoading, error, refetch }
}
