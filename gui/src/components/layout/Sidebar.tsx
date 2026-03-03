import { useCallback, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  Database,
  FolderOpen,
  Info,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react'
import { Badge } from '@src/components/ui/badge'
import { Button } from '@src/components/ui/button'
import { Separator } from '@src/components/ui/separator'
import { Tooltip } from '@src/components/ui/tooltip/'
import useClickAway from '@src/hooks/useClickAway'
import { cn } from '@src/lib/utils'
import { useAppShell } from './AppShellContext'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
  matchExact?: boolean
}

interface SidebarProps {
  activeConnectionId?: string
  activeConnectionName?: string
}

export function Sidebar(props: SidebarProps) {
  const { activeConnectionId, activeConnectionName } = props
  const { isCollapsed, toggleCollapsed } = useAppShell()
  const location = useLocation()
  const [infoOpen, setInfoOpen] = useState(false)
  const infoRef = useClickAway(() => setInfoOpen(false))

  const navItems: NavItem[] = [
    {
      to: '/',
      label: 'Connections',
      icon: <Database className="size-4 shrink-0" />,
      matchExact: true,
    },
    {
      to: activeConnectionId ? `/browse/${activeConnectionId}` : '/browse',
      label: 'Browse',
      icon: <FolderOpen className="size-4 shrink-0" />,
      disabled: !activeConnectionName,
    },
  ]

  const isNavItemActive = useCallback(
    (item: NavItem) => {
      if (item.matchExact) {
        return location.pathname === item.to
      }
      return location.pathname.startsWith('/browse')
    },
    [location.pathname],
  )

  return (
    <aside
        className={cn(
          'relative flex h-full flex-col border-r border-border bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-[60px]' : 'w-[260px]',
        )}
      >
        {/* Logo / App name */}
        <div
          className={cn(
            'relative flex h-14 items-center border-b border-[var(--sidebar-border)] px-3',
            isCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--sidebar-primary)]">
              <Database className="size-4 text-[var(--sidebar-primary-foreground)]" />
            </div>
            {!isCollapsed && (
              <span className="text-sm font-semibold tracking-tight">GridFS GUI</span>
            )}
          </div>
          {!isCollapsed && (
            <div className="relative" ref={infoRef}>
              <button
                type="button"
                onClick={() => setInfoOpen((prev) => !prev)}
                className="flex size-6 items-center justify-center rounded-md text-[var(--sidebar-foreground)] opacity-40 transition-opacity hover:opacity-80"
                aria-label="App info"
              >
                <Info className="size-3.5" />
              </button>
              {infoOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-lg border border-border bg-popover p-3 shadow-md">
                  <p className="text-xs font-semibold text-foreground">GridFS GUI</p>
                  <div className="mt-1.5 space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      Created by <span className="font-medium text-foreground">Shay Bushary</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      03/03/2026
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item)

            const linkContent = (
              <div
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                    : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]',
                  item.disabled && 'pointer-events-none opacity-40',
                  isCollapsed && 'justify-center px-2',
                )}
              >
                {item.icon}
                {!isCollapsed && <span>{item.label}</span>}
              </div>
            )

            const wrappedLink = item.disabled ? (
              <div key={item.to} aria-disabled className="cursor-not-allowed">
                {linkContent}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} className="block">
                {linkContent}
              </NavLink>
            )

            if (isCollapsed) {
              return (
                <Tooltip
                  key={item.to}
                  content={`${item.label}${item.disabled ? ' (no active connection)' : ''}`}
                  position="right"
                >
                  <div>{wrappedLink}</div>
                </Tooltip>
              )
            }

            return wrappedLink
          })}
        </nav>

        <Separator className="bg-[var(--sidebar-border)]" />

        {/* Active connection section */}
        <div className={cn('p-3', isCollapsed && 'flex justify-center')}>
          {isCollapsed ? (
            <Tooltip
              content={activeConnectionName ? `Connected: ${activeConnectionName}` : 'No active connection'}
              position="right"
            >
              <div
                className={cn(
                  'flex size-7 items-center justify-center rounded-full',
                  activeConnectionName
                    ? 'bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]'
                    : 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]',
                )}
              >
                <Database className="size-3.5" />
              </div>
            </Tooltip>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--sidebar-foreground)] opacity-50">
                Active Connection
              </p>
              {activeConnectionName ? (
                <Badge
                  variant="secondary"
                  className="w-full justify-start truncate bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                >
                  <Database className="mr-1.5 size-3" />
                  <span className="truncate">{activeConnectionName}</span>
                </Badge>
              ) : (
                <p className="truncate text-xs text-[var(--sidebar-foreground)] opacity-50">
                  No connection selected
                </p>
              )}

              {/* Placeholder slot for Phase 2 bucket list */}
              <div id="sidebar-bucket-list-slot" />
            </div>
          )}
        </div>

        <Separator className="bg-[var(--sidebar-border)]" />

        {/* Collapse toggle */}
        <div className={cn('p-2', isCollapsed ? 'flex justify-center' : 'flex justify-end')}>
          <Tooltip
            content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            position="right"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleCollapsed}
              className="text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <PanelLeft className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          </Tooltip>
        </div>
      </aside>
  )
}
