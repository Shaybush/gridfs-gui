import { Moon, Sun, Menu } from 'lucide-react'
import { useLocation } from 'react-router'
import { Switch } from '@src/components/ui/switch'
import { Button } from '@src/components/ui/button'
import { useDarkTheme } from '@src/providers/DarkThemeProvider/DarkThemeContext'
import { useAppShell } from './AppShellContext'
import { cn } from '@src/lib/utils'

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Connections'
  if (pathname.startsWith('/browse')) return 'File Browser'
  return 'GridFS GUI'
}

interface HeaderProps {
  className?: string
}

export function Header(props: HeaderProps) {
  const { className } = props
  const location = useLocation()
  const { isDarkMode, toggleDarkMode } = useDarkTheme()
  const { setMobileSidebarOpen, isMobileSidebarOpen } = useAppShell()

  const pageTitle = getPageTitle(location.pathname)

  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4',
        className,
      )}
    >
      {/* Left: mobile hamburger + page title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger – visible only on small screens */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={() => setMobileSidebarOpen(!isMobileSidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <Menu className="size-4" />
        </Button>

        <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>

        {/* Breadcrumb placeholder for future use */}
        <nav aria-label="breadcrumb" id="header-breadcrumb-slot" />
      </div>

      {/* Right: dark mode toggle */}
      <div className="flex items-center gap-2">
        {isDarkMode ? (
          <Moon className="size-3.5 text-muted-foreground" />
        ) : (
          <Sun className="size-3.5 text-muted-foreground" />
        )}
        <Switch
          checked={isDarkMode}
          onCheckedChange={toggleDarkMode}
          aria-label="Toggle dark mode"
        />
      </div>
    </header>
  )
}
