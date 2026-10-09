import React, { useEffect, useState, useCallback, useRef } from 'react'
import { AppTitleBar } from './AppTitleBar'
import { LeftSidebar } from './LeftSidebar'
import { EditorCenter } from './EditorCenter'
import { RightPanel } from './RightPanel'
import { OnboardingModal } from '../OnboardingModal'
import { SettingsModal } from '../SettingsModal'
import { LibraryPreviewModal } from '../LibraryPreviewModal'
import { useConfigStore } from '../../store/configStore'
import { useWorkspaceStore } from '../../store/workspaceStore'

export const WorkspaceShell: React.FC = () => {
  const { loadConfig, isLoading } = useConfigStore()
  const { initWorkspace } = useWorkspaceStore()

  // Left sidebar width (180px - 420px, default 240px)
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('explosion:left-width')
    const parsed = saved ? parseInt(saved, 10) : 240
    return !isNaN(parsed) && parsed >= 180 && parsed <= 420 ? parsed : 240
  })

  // Right panel width (240px - 550px, default 340px)
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = localStorage.getItem('explosion:right-width')
    const parsed = saved ? parseInt(saved, 10) : 340
    return !isNaN(parsed) && parsed >= 240 && parsed <= 550 ? parsed : 340
  })

  const isDraggingLeft = useRef(false)
  const isDraggingRight = useRef(false)

  useEffect(() => {
    loadConfig().then(() => {
      const cfg = useConfigStore.getState().config
      if (cfg?.workspace?.lastProjectPath) {
        initWorkspace(cfg.workspace.lastProjectPath)
      }
    })
  }, [loadConfig, initWorkspace])

  // Left resizer mouse drag handlers
  const handleLeftMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingLeft.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingLeft.current) return
      const newWidth = Math.max(180, Math.min(420, moveEvent.clientX))
      setLeftWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (isDraggingLeft.current) {
        isDraggingLeft.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setLeftWidth((w) => {
          localStorage.setItem('explosion:left-width', String(w))
          return w
        })
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  // Right resizer mouse drag handlers
  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRight.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRight.current) return
      const newWidth = Math.max(240, Math.min(550, window.innerWidth - moveEvent.clientX))
      setRightWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (isDraggingRight.current) {
        isDraggingRight.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setRightWidth((w) => {
          localStorage.setItem('explosion:right-width', String(w))
          return w
        })
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#fbfbfa] text-stone-500 text-xs font-mono">
        加载中...
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#fbfbfa] text-stone-900 overflow-hidden font-sans relative">
      {/* Frameless Integrated Custom Titlebar (Replaces OS Titlebar) */}
      <AppTitleBar />

      {/* Main Three-Column Workspace with Draggable Splitters */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column: Chapters, Project Switcher & Material Library */}
        <LeftSidebar width={leftWidth} />

        {/* Resizer Handle: Left to Center */}
        <div
          onMouseDown={handleLeftMouseDown}
          className="w-1 -ml-0.5 z-20 hover:w-1.5 hover:bg-stone-400 active:bg-stone-600 transition-colors cursor-col-resize bg-transparent shrink-0"
          title="拖拽调整左侧栏宽度"
        />

        {/* Center Column: Pure-Text Manuscript Editor */}
        <EditorCenter />

        {/* Resizer Handle: Center to Right */}
        <div
          onMouseDown={handleRightMouseDown}
          className="w-1 -mr-0.5 z-20 hover:w-1.5 hover:bg-stone-400 active:bg-stone-600 transition-colors cursor-col-resize bg-transparent shrink-0"
          title="拖拽调整助手栏宽度"
        />

        {/* Right Column: Assistant Collaboration Panel */}
        <RightPanel width={rightWidth} />
      </div>

      {/* Modal Dialogs */}
      <LibraryPreviewModal />
      <OnboardingModal />
      <SettingsModal />
    </div>
  )
}
