import { type ReactNode, useMemo, useState } from 'react'
import {
  ActiveConnectionContext,
  persistActiveConnection,
  readPersistedActiveConnection,
} from './ActiveConnectionContext'
import type { Connection } from '@src/types/connection'

interface ActiveConnectionProviderProps {
  children: ReactNode
}

export function ActiveConnectionProvider(props: ActiveConnectionProviderProps) {
  const { children } = props

  const [activeConnection, setActiveConnectionState] = useState<Connection | null>(() =>
    readPersistedActiveConnection(),
  )

  const setActiveConnection = (conn: Connection | null) => {
    persistActiveConnection(conn)
    setActiveConnectionState(conn)
  }

  const value = useMemo(
    () => ({ activeConnection, setActiveConnection }),
    [activeConnection],
  )

  return (
    <ActiveConnectionContext.Provider value={value}>
      {children}
    </ActiveConnectionContext.Provider>
  )
}
