import React from 'react'
import { WorkspaceShell } from './components/layout/WorkspaceShell'
import { ErrorBoundary } from './components/common/ErrorBoundary'

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <WorkspaceShell />
    </ErrorBoundary>
  )
}
