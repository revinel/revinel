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
  Omit<RevinelClientOptions, "request"> & SerializableRequest
>

const RevinelContext = createContext<RevinelClient | null>(null)

export function RevinelProvider({
  children,
  workspaceId,
  apiUrl,
  fetch,
  request,
}: RevinelProviderProps) {
  const requestKey = JSON.stringify(request)

  const client = useMemo(() => {
    return createRevinelClient({ workspaceId, apiUrl, fetch, request })
  }, [apiUrl, fetch, requestKey, workspaceId])

  return <RevinelContext.Provider value={client}>{children}</RevinelContext.Provider>
}

export function useRevinelClient(): RevinelClient {
  const client = useContext(RevinelContext)

  if (!client) {
    throw new Error("useRevinelClient must be used within RevinelProvider.")
  }

  return client
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
