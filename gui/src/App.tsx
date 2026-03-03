import { Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Toaster } from '@src/components/ui/sonner'
import { useActiveConnection } from '@src/contexts/ActiveConnectionContext'
import { ActiveConnectionProvider } from '@src/contexts/ActiveConnectionProvider'
import { AppShell } from './components/layout'
import { routes } from './routes'
import type { Route as RouteType } from './common/types'

function renderRoute(route: RouteType, index: number) {
  const { to: path, Component, children } = route
  if (children && children.length > 0) {
    return (
      <Route key={index} path={path} element={<Component />}>
        {children.map((childRoute, childIndex) => renderRoute(childRoute, childIndex))}
      </Route>
    )
  }
  return <Route key={index} path={path} element={<Component />} />
}

function AppInner() {
  const { activeConnection } = useActiveConnection()

  return (
    <AppShell activeConnectionId={activeConnection?.id} activeConnectionName={activeConnection?.name}>
      <Suspense>
        <Routes>
          {routes.map((route, index) => renderRoute(route, index))}
          <Route
            path="*"
            element={
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                <p className="text-xl font-semibold text-foreground">404 — Page Not Found</p>
                <p className="text-sm text-muted-foreground">
                  The page you are looking for does not exist.
                </p>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </AppShell>
  )
}

export default function App() {
  return (
    <ActiveConnectionProvider>
      <AppInner />
      <Toaster />
    </ActiveConnectionProvider>
  )
}
