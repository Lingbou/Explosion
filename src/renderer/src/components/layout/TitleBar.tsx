import React, { useState } from 'react'
import {
  PenLine,
  Settings,
  AlignLeft,
  Copy,
  Check
} from 'lucide-react'
import { useConfigStore } from '../../store/configStore'
import { useWorkspaceStore } from '../../store/workspaceStore'

export const TitleBar: React.FC = () => {
  const { config, isConfigured, setIsSettingsOpen } = useConfigStore()
  const { projectTitle, setProjectTitle, applyTypography, chapters, activeChapterId } =
    useWorkspaceStore()

  const [copied, setCopied] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)

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
    <header className="h-11 border-b border-stone-200 bg-white flex items-center justify-between px-3.5 select-none z-30">
      {/* Left: App Brand & Project Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-stone-200">
          <PenLine className="w-4 h-4 text-stone-800" />
          <span className="font-semibold text-xs tracking-wider text-stone-800">
            Explosion
          </span>
        </div>

        {/* Project Title */}
        <div className="flex items-center gap-1.5">
          {isEditingTitle ? (
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
              className="bg-stone-50 border border-stone-300 rounded px-2 py-0.5 text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-800"
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer px-1.5 py-0.5 rounded hover:bg-stone-100 transition-colors"
              title="点击重命名作品"
            >
              {projectTitle}
            </span>
          )}
        </div>
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
          title="点击切换或配置主力模型"
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
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
          title="应用中文出版排版规范（全角双空格缩进、标点统一）"
        >
          <AlignLeft className="w-3.5 h-3.5" />
          <span>规范排版</span>
        </button>

        <button
          onClick={handleCopyCleanText}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all ${
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
    </header>
  )
}
