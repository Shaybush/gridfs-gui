import { useCallback, useEffect, useState } from 'react'
import { httpClient } from '@src/lib/HttpClient/HttpClient'

interface UseDatabasesReturn {
  databases: string[]
  isLoading: boolean
  error: string | null
  fetchDatabases: () => Promise<void>
}

export function useDatabases(connId: string | undefined): UseDatabasesReturn {
  const [databases, setDatabases] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDatabases = useCallback(async () => {
    if (!connId) {
      setDatabases([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { promise } = httpClient.get<{ databases: string[] }>(`/api/v1/connections/${connId}/databases`)
      const data = await promise
      setDatabases(data.databases)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch databases')
      setDatabases([])
    } finally {
      setIsLoading(false)
    }
  }, [connId])

  useEffect(() => {
    fetchDatabases()
  }, [fetchDatabases])

  return {
    databases,
    isLoading,
    error,
    fetchDatabases,
  }
}
