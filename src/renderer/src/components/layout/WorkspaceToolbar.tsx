import React, { useState } from 'react'
import {
  FolderOpen,
  FolderPlus,
  Settings,
  AlignLeft,
  Copy,
  Check,
  ChevronDown,
  X
} from 'lucide-react'
import { useConfigStore } from '../../store/configStore'
import { useWorkspaceStore } from '../../store/workspaceStore'

export const WorkspaceToolbar: React.FC = () => {
  const { config, isConfigured, setIsSettingsOpen } = useConfigStore()
  const {
    projectTitle,
    setProjectTitle,
    projectPath,
    openProject,
    createProject,
    closeProject,
    applyTypography,
    chapters,
    activeChapterId
  } = useWorkspaceStore()

  const [copied, setCopied] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)

  const activeChapter = chapters.find((ch) => ch.id === activeChapterId)

  const handleCopyCleanText = async () => {
    if (!activeChapter) return
    const text = activeChapter.content
    const success = await window.api.copyText(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="h-10 border-b border-stone-200 bg-white flex items-center justify-between px-3.5 select-none z-30">
      {/* Left: Project Selector & Actions */}
      <div className="flex items-center gap-2 relative">
        <div className="relative">
          <button
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-stone-800 hover:bg-stone-100 transition-colors"
            title="小说工程菜单"
          >
            <FolderOpen className="w-3.5 h-3.5 text-stone-500" />
            <span className="truncate max-w-[160px] font-semibold text-stone-900">
              {projectPath ? projectTitle || '未命名作品' : '未打开工程'}
            </span>
            <ChevronDown className="w-3 h-3 text-stone-400" />
          </button>

          {isProjectMenuOpen && (
            <div
              className="absolute left-0 mt-1 w-56 bg-white border border-stone-200 rounded-lg shadow-xl py-1 text-xs z-50 animate-in fade-in duration-100"
              onMouseLeave={() => setIsProjectMenuOpen(false)}
            >
              <div className="px-3 py-1.5 border-b border-stone-100 text-[10px] text-stone-400">
                {projectPath ? `路径: ${projectPath}` : '尚未关联本地小说文件夹'}
              </div>

              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  createProject()
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-stone-50 flex items-center gap-2 text-stone-700 hover:text-stone-900 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-stone-500" />
                <span>新建小说工程文件夹...</span>
              </button>

              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  openProject()
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-stone-50 flex items-center gap-2 text-stone-700 hover:text-stone-900 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-stone-500" />
                <span>打开已有小说文件夹...</span>
              </button>

              {projectPath && (
                <>
                  <button
                    onClick={() => {
                      setIsProjectMenuOpen(false)
                      setIsEditingTitle(true)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-colors border-t border-stone-100"
                  >
                    重命名小说名称
                  </button>
                  <button
                    onClick={() => {
                      setIsProjectMenuOpen(false)
                      closeProject()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors border-t border-stone-100 flex items-center gap-2"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>关闭当前工程</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Inline Title Editor */}
        {isEditingTitle && projectPath && (
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
            autoFocus
            className="bg-stone-50 border border-stone-300 rounded px-2 py-0.5 text-xs font-semibold text-stone-900 focus:outline-none focus:border-stone-800"
          />
        )}
      </div>

      {/* Center: Active Model Pill */}
      <div className="flex items-center">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all border ${
            isConfigured
              ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 hover:border-stone-300'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
          title="点击配置或切换主力模型"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="truncate max-w-[180px]">
            {isConfigured ? config.provider.activeModel || '未选模型' : '未配置 Provider'}
          </span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={applyTypography}
          disabled={!projectPath || !activeChapter}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          title="应用中文出版排版规范（全角双空格缩进、标点统一）"
        >
          <AlignLeft className="w-3.5 h-3.5" />
          <span>规范排版</span>
        </button>

        <button
          onClick={handleCopyCleanText}
          disabled={!projectPath || !activeChapter}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all disabled:opacity-40 disabled:hover:bg-transparent ${
            copied
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
          title="一键复制纯文本手稿（完全无 Markdown 标记符号污染）"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '已复制' : '复制纯文本'}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-stone-200 mx-1" />

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
          title="设置"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
