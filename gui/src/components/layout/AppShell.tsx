import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { cn } from '@src/lib/utils'
import { AppShellContext } from './AppShellContext'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  children: ReactNode
  activeConnectionId?: string
  activeConnectionName?: string
}

export function AppShell(props: AppShellProps) {
  const { children, activeConnectionId, activeConnectionName } = props

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  const contextValue = useMemo(
    () => ({ isCollapsed, toggleCollapsed, isMobileSidebarOpen, setMobileSidebarOpen }),
    [isCollapsed, toggleCollapsed, isMobileSidebarOpen],
  )

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
        {/* Mobile overlay backdrop */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* Sidebar — fixed on mobile, static on desktop */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-30 md:relative md:flex md:shrink-0',
            isMobileSidebarOpen ? 'flex' : 'hidden md:flex',
          )}
        >
          <Sidebar activeConnectionId={activeConnectionId} activeConnectionName={activeConnectionName} />
        </div>

        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AppShellContext.Provider>
  )
}
