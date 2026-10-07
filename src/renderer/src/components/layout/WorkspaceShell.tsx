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
      <div className="h-screen w-screen flex items-center justify-center bg-[#fbfbfa] text-stone-500 text-xs font-mono">
        加载中...
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#fbfbfa] text-stone-900 overflow-hidden font-sans">
      {/* Top Title Bar */}
      <TitleBar />

      {/* Main Three-Column Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Chapters & Library */}
        <LeftSidebar />

        {/* Center Column: Pure-Text Manuscript Editor */}
        <EditorCenter />

        {/* Right Column: Assistant Collaboration Panel */}
        <RightPanel />
      </div>

      {/* Modal Dialogs */}
      <OnboardingModal />
      <SettingsModal />
    </div>
  )
}
