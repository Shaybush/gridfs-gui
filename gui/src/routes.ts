import { lazy } from 'react'
import type { Route } from './common/types'

const ConnectionsPage = lazy(() => import('./pages/Connections'))
const BrowsePage = lazy(() => import('./pages/Browse'))

export const routes: Array<Route> = [
  {
    to: '/',
    text: 'Connections',
    activeNames: ['/'],
    Component: ConnectionsPage,
  },
  {
    to: '/browse/:connId?',
    text: 'Browse',
    activeNames: ['/browse'],
    Component: BrowsePage,
    hideFromSidebar: true,
  },
]
