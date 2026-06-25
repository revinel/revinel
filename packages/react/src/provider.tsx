"use client"

import {
  createOpenAdsClient,
  type OpenAdsClient,
  type OpenAdsClientOptions,
  type OpenAdsSerializableRequestOptions,
} from "@openads/sdk"
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
export type SerializableRequest = {
  request?: OpenAdsSerializableRequestOptions
}

export type OpenAdsQueryState<TData> = {
  data: TData
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<TData>
}

export type OpenAdsProviderProps = PropsWithChildren<
  Omit<OpenAdsClientOptions, "request"> & SerializableRequest
>

const OpenAdsContext = createContext<OpenAdsClient | null>(null)

export const OpenAdsProvider = ({
  children,
  workspaceId,
  apiUrl,
  fetch,
  request,
}: OpenAdsProviderProps) => {
  const requestKey = JSON.stringify(request)

  const client = useMemo(() => {
    return createOpenAdsClient({ workspaceId, apiUrl, fetch, request })
  }, [apiUrl, fetch, requestKey, workspaceId])

  return <OpenAdsContext.Provider value={client}>{children}</OpenAdsContext.Provider>
}

export const useOpenAdsClient = (): OpenAdsClient => {
  const client = useContext(OpenAdsContext)

  if (!client) {
    throw new Error("useOpenAdsClient must be used within OpenAdsProvider.")
  }

  return client
}

export const getError = (value: unknown): Error => {
  if (value instanceof Error) return value
  return new Error("OpenAds request failed.", { cause: value })
}

export const useOpenAdsQuery = <TData,>(
  enabled: boolean,
  initialData: TData,
  getData: () => Promise<TData>,
): OpenAdsQueryState<TData> => {
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
