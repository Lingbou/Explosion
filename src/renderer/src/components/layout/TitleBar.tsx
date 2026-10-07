import React, { useState } from 'react'
import {
  Flame,
  Settings,
  Sparkles,
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
    <header className="h-11 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur flex items-center justify-between px-3 select-none z-30">
      {/* Left: App Brand & Project Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-stone-800">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-md shadow-orange-500/20">
            <Flame className="w-3.5 h-3.5 text-stone-950 stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-sm tracking-wide bg-gradient-to-r from-stone-100 to-stone-400 bg-clip-text text-transparent">
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
              className="bg-stone-900 border border-stone-700 rounded px-2 py-0.5 text-xs font-semibold text-stone-200 focus:outline-none"
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              className="text-xs font-semibold text-stone-300 hover:text-stone-100 cursor-pointer px-1.5 py-0.5 rounded hover:bg-stone-900 transition-colors"
              title="点击重命名作品"
            >
              {projectTitle}
            </span>
          )}
        </div>
      </div>

      {/* Center: Active Model Pill Badge */}
      <div className="flex items-center">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all border ${
            isConfigured
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20 animate-pulse'
          }`}
          title="点击切换或配置主力模型"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConfigured ? 'bg-amber-400' : 'bg-rose-400'
            }`}
          />
          <Sparkles className="w-3 h-3 opacity-80" />
          <span className="truncate max-w-[200px]">
            {isConfigured ? config.provider.activeModel || '未选模型' : '未配置 Provider'}
          </span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={applyTypography}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-900 rounded-lg transition-colors"
          title="符合中文出版规范的一键段落格式化（段首双全角空格、标点标准化）"
        >
          <AlignLeft className="w-3.5 h-3.5" />
          <span>规范排版</span>
        </button>

        <button
          onClick={handleCopyCleanText}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-all ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
          title="一键复制纯文本手稿（完全无 Markdown 标记符号污染）"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '已复制' : '纯文本复制'}</span>
        </button>

        <div className="w-[1px] h-4 bg-stone-800 mx-1" />

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-900 rounded-lg transition-colors"
          title="偏好设置与模型配置"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
