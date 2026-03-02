import { useCallback, useEffect, useState } from 'react'
import { httpClient } from '@src/lib/HttpClient/HttpClient'
import type { Connection, ConnectionCreate, ConnectionUpdate, TestConnectionResult } from '@src/types/connection'

const BASE = '/api/v1/connections'

interface UseConnectionsReturn {
  connections: Connection[]
  isLoading: boolean
  error: string | null
  fetchConnections: () => Promise<void>
  createConnection: (data: ConnectionCreate) => Promise<Connection>
  updateConnection: (id: string, data: ConnectionUpdate) => Promise<Connection>
  deleteConnection: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<TestConnectionResult>
}

export function useConnections(): UseConnectionsReturn {
  const [connections, setConnections] = useState<Connection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConnections = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { promise } = httpClient.get<Connection[]>(BASE)
      const data = await promise
      setConnections(data)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch connections')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createConnection = useCallback(
    async (data: ConnectionCreate): Promise<Connection> => {
      const { promise } = httpClient.post<Connection>(BASE, { body: data })
      const created = await promise
      await fetchConnections()
      return created
    },
    [fetchConnections],
  )

  const updateConnection = useCallback(
    async (id: string, data: ConnectionUpdate): Promise<Connection> => {
      const { promise } = httpClient.put<Connection>(`${BASE}/${id}`, { body: data })
      const updated = await promise
      await fetchConnections()
      return updated
    },
    [fetchConnections],
  )

  const deleteConnection = useCallback(
    async (id: string): Promise<void> => {
      const { promise } = httpClient.delete(`${BASE}/${id}`)
      await promise
      await fetchConnections()
    },
    [fetchConnections],
  )

  const testConnection = useCallback(async (id: string): Promise<TestConnectionResult> => {
    const { promise } = httpClient.post<TestConnectionResult>(`${BASE}/${id}/test`)
    return promise
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  return {
    connections,
    isLoading,
    error,
    fetchConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
  }
}
