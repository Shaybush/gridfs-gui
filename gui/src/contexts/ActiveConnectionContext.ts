import { createContext, useContext } from 'react'
import type { Connection } from '@src/types/connection'

const LS_KEY = 'gridfs_active_connection'

export function persistActiveConnection(conn: Connection | null) {
  if (conn) {
    localStorage.setItem(LS_KEY, JSON.stringify(conn))
  } else {
    localStorage.removeItem(LS_KEY)
  }
}

export function readPersistedActiveConnection(): Connection | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Connection) : null
  } catch {
    return null
  }
}

interface ActiveConnectionContextProps {
  activeConnection: Connection | null
  setActiveConnection: (conn: Connection | null) => void
}

const INITIAL: ActiveConnectionContextProps = {
  activeConnection: null,
  setActiveConnection: () => {},
}

export const ActiveConnectionContext = createContext<ActiveConnectionContextProps>(INITIAL)
export const useActiveConnection = () => useContext(ActiveConnectionContext)
