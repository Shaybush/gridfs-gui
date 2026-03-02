import { useCallback, useEffect, useState } from 'react'
import { httpClient } from '@src/lib/HttpClient/HttpClient'
import type { BucketInfo, BucketStats } from '@src/types/bucket'

interface UseBucketsReturn {
  buckets: BucketInfo[]
  isLoading: boolean
  error: string | null
  fetchBuckets: () => Promise<void>
  createBucket: (name: string) => Promise<void>
  getBucketStats: (name: string) => Promise<BucketStats>
}

export function useBuckets(connId: string | undefined, dbName: string | undefined): UseBucketsReturn {
  const [buckets, setBuckets] = useState<BucketInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBuckets = useCallback(async () => {
    if (!connId || !dbName) {
      setBuckets([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { promise } = httpClient.get<BucketInfo[]>(
        `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets`,
      )
      const data = await promise
      setBuckets(data)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch buckets')
      setBuckets([])
    } finally {
      setIsLoading(false)
    }
  }, [connId, dbName])

  const createBucket = useCallback(
    async (name: string): Promise<void> => {
      if (!connId || !dbName) return

      const { promise } = httpClient.post(
        `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets`,
        { body: { name } },
      )
      await promise
      await fetchBuckets()
    },
    [connId, dbName, fetchBuckets],
  )

  const getBucketStats = useCallback(
    async (name: string): Promise<BucketStats> => {
      if (!connId || !dbName) throw new Error('No connection or database selected')

      const { promise } = httpClient.get<BucketStats>(
        `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets/${encodeURIComponent(name)}/stats`,
      )
      return promise
    },
    [connId, dbName],
  )

  useEffect(() => {
    fetchBuckets()
  }, [fetchBuckets])

  return {
    buckets,
    isLoading,
    error,
    fetchBuckets,
    createBucket,
    getBucketStats,
  }
}
