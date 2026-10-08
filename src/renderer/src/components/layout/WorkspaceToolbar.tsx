import React, { useState } from 'react'
import {
  FolderOpen,
  FolderPlus,
  Settings,
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
    closeProject
  } = useWorkspaceStore()

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)

  return (
    <div className="h-10 border-b border-stone-200 bg-white flex items-center justify-between px-3.5 select-none z-30 shrink-0">
      {/* Left: Project Selector & Actions */}
      <div className="flex items-center gap-2 relative">
        <div className="relative">
          <button
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-stone-800 hover:bg-stone-100 transition-colors"
            title="小说工程菜单"
          >
            <FolderOpen className="w-3.5 h-3.5 text-stone-500" />
            <span className="truncate max-w-[180px] font-semibold text-stone-900">
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

      {/* Right Controls: Minimal Global Settings Button */}
      <div className="flex items-center">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium"
          title="打开全局配置"
        >
          <Settings className="w-3.5 h-3.5 text-stone-500" />
          <span>设置</span>
        </button>
      </div>
    </div>
  )
}
