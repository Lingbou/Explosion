import React, { useState, useEffect } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore'

export const AppTitleBar: React.FC = () => {
  const { projectTitle } = useWorkspaceStore()
  const [isMaximized, setIsMaximized] = useState(false)

  const isDarwin = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  useEffect(() => {
    if (window.api?.isWindowMaximized) {
      window.api.isWindowMaximized().then(setIsMaximized).catch(() => {})
    }
    const unsubscribe = window.api?.onWindowMaximizeChanged?.((maximized) => {
      setIsMaximized(maximized)
    })
    return () => {
      unsubscribe?.()
    }
  }, [])

  const handleMinimize = () => {
    window.api?.minimizeWindow?.().catch(() => {})
  }

  const handleToggleMaximize = async () => {
    if (!window.api?.maximizeWindow) return
    try {
      const state = await window.api.maximizeWindow()
      setIsMaximized(state)
    } catch {
      // ignore
    }
  }

  const handleClose = () => {
    window.api?.closeWindow?.().catch(() => {})
  }

  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleToggleMaximize}
      className="h-8 border-b border-stone-200/80 dark:border-stone-800 bg-[#fbfbfa] dark:bg-[#141413] flex items-center justify-between select-none shrink-0 z-50 text-xs cursor-default font-sans"
    >
      {/* Left: Starburst Icon & App Identity */}
      <div className={`flex items-center gap-2 ${isDarwin ? 'pl-20' : 'pl-3'}`}>
        {/* Explosion Radiant Starburst Icon */}
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 512 512" fill="none">
          <rect width="512" height="512" rx="108" fill="#1c1917" className="dark:fill-stone-100" />
          <path
            d="M 256 76 Q 256 256 76 256 Q 256 256 256 436 Q 256 256 436 256 Q 256 256 256 76 Z"
            fill="#ea580c"
          />
          <path
            d="M 256 156 Q 256 256 156 256 Q 256 256 256 356 Q 256 256 356 256 Q 256 256 256 156 Z"
            fill="#fef08a"
          />
          <circle cx="256" cy="256" r="6" fill="#78350f" />
        </svg>

        <div className="flex items-center gap-1.5 truncate max-w-sm">
          <span className="font-semibold text-stone-800 dark:text-stone-200 text-[11px] tracking-tight">
            Explosion
          </span>
          {projectTitle ? (
            <span className="text-stone-400 dark:text-stone-500 font-normal text-[11px] truncate">
              · {projectTitle}
            </span>
          ) : (
            <span className="text-stone-400 dark:text-stone-500 font-normal text-[11px] truncate">
              · 现代小说创作工作台
            </span>
          )}
        </div>
      </div>

      {/* Right: Frameless Window Controls (Non-Mac Platforms) */}
      {!isDarwin && (
        <div
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="flex items-center h-full"
        >
          <button
            onClick={handleMinimize}
            className="w-10 h-full flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            title="最小化"
          >
            <Minus className="w-3.5 h-3.5 stroke-[1.75]" />
          </button>

          <button
            onClick={handleToggleMaximize}
            className="w-10 h-full flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? (
              <svg className="w-3 h-3 text-stone-500 dark:text-stone-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4.5" y="1.5" width="9.5" height="9.5" rx="1" />
                <path d="M2 4.5v9a1 1 0 001 1h9" strokeLinecap="round" />
              </svg>
            ) : (
              <Square className="w-3 h-3 stroke-[1.75]" />
            )}
          </button>

          <button
            onClick={handleClose}
            className="w-10 h-full flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-white hover:bg-rose-600 transition-colors"
            title="关闭窗口"
          >
            <X className="w-3.5 h-3.5 stroke-[1.75]" />
          </button>
        </div>
      )}
    </header>
  )
}
