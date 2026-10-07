import React, { useEffect } from 'react'
import { TitleBar } from './TitleBar'
import { LeftSidebar } from './LeftSidebar'
import { EditorCenter } from './EditorCenter'
import { RightPanel } from './RightPanel'
import { OnboardingModal } from '../OnboardingModal'
import { SettingsModal } from '../SettingsModal'
import { useConfigStore } from '../../store/configStore'

export const WorkspaceShell: React.FC = () => {
  const { loadConfig, isLoading } = useConfigStore()

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-950 text-stone-400 text-xs font-mono">
        正在装载 Explosion 创作工作台...
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-stone-950 text-stone-100 overflow-hidden font-sans">
      {/* Top Title Bar */}
      <TitleBar />

      {/* Main Three-Column Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Chapters Tree & Story Outlines & Library */}
        <LeftSidebar />

        {/* Center Column: Pure-Text Manuscript Editor */}
        <EditorCenter />

        {/* Right Column: Multi-Agent Collaboration Panel */}
        <RightPanel />
      </div>

      {/* Modal Dialogs */}
      <OnboardingModal />
      <SettingsModal />
    </div>
  )
}
