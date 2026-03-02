import { createContext, useContext } from 'react'

type AppShellContextProps = {
  isCollapsed: boolean
  toggleCollapsed: () => void
  isMobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
}

const INITIAL_STATE = {} as AppShellContextProps

export const AppShellContext = createContext<AppShellContextProps>(INITIAL_STATE)
export const useAppShell = () => useContext(AppShellContext)
