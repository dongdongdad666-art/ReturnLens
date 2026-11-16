import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RouteFallback } from '../components/RouteFallback'
import { DashboardPage } from '../features/dashboard/DashboardPage'

const IssuesPage = lazy(() => import('../features/issues/IssuesPage').then((module) => ({ default: module.IssuesPage })))
const IssueDetailPage = lazy(() => import('../features/issues/IssueDetailPage').then((module) => ({ default: module.IssueDetailPage })))
const ActionsPage = lazy(() => import('../features/actions/ActionsPage').then((module) => ({ default: module.ActionsPage })))
const ExperimentsPage = lazy(() => import('../features/experiments/ExperimentsPage').then((module) => ({ default: module.ExperimentsPage })))
const ImportPage = lazy(() => import('../features/import/ImportPage').then((module) => ({ default: module.ImportPage })))
const secondaryRoute = (page: ReactNode) => <Suspense fallback={<RouteFallback />}>{page}</Suspense>

export const routes: RouteObject[] = [{
  element: <AppShell />,
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'issues', element: secondaryRoute(<IssuesPage />) },
    { path: 'issues/:issueId', element: secondaryRoute(<IssueDetailPage />) },
    { path: 'actions', element: secondaryRoute(<ActionsPage />) },
    { path: 'experiments', element: secondaryRoute(<ExperimentsPage />) },
    { path: 'import', element: secondaryRoute(<ImportPage />) },
  ],
}]
