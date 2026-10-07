import React, { useEffect, useRef } from 'react'
import {
  AlignLeft,
  Check,
  Copy,
  Clock,
  CheckCircle2,
  FileEdit
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { countTextStats } from '../../lib/typography'

export const EditorCenter: React.FC = () => {
  const {
    chapters,
    activeChapterId,
    updateContent,
    updateChapterTitle,
    applyTypography,
    isDirty,
    saveActiveChapter
  } = useWorkspaceStore()

  const [copied, setCopied] = React.useState(false)
  const activeChapter = chapters.find((ch) => ch.id === activeChapterId)
  const content = activeChapter ? activeChapter.content : ''
  const stats = countTextStats(content)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-save debounce effect
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      saveActiveChapter()
    }, 2000)
    return () => clearTimeout(timer)
  }, [content, isDirty, saveActiveChapter])

  const handleCopyCleanText = async () => {
    if (!content) return
    const ok = await window.api.copyText(content)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!activeChapter) {
    return (
      <main className="flex-1 flex items-center justify-center bg-stone-900 text-stone-500 text-sm">
        请选择或创建手稿章节
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col bg-stone-900/40 relative overflow-hidden">
      {/* Editor Sub-header Bar */}
      <div className="h-12 border-b border-stone-800/80 px-6 flex items-center justify-between bg-stone-950/40 select-none">
        <div className="flex items-center gap-3 flex-1 mr-4">
          <input
            type="text"
            value={activeChapter.title}
            onChange={(e) => updateChapterTitle(activeChapter.id, e.target.value)}
            placeholder="输入章节标题..."
            className="bg-transparent font-bold text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:bg-stone-900/60 px-2 py-1 rounded transition-colors w-full max-w-md"
          />
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Save Status */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            {isDirty ? (
              <>
                <FileEdit className="w-3.5 h-3.5 text-amber-500/80 animate-pulse" />
                <span>编辑中...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />
                <span>已保存到本地</span>
              </>
            )}
          </div>

          <div className="w-[1px] h-3.5 bg-stone-800" />

          {/* Quick Format & Copy */}
          <button
            onClick={applyTypography}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-300 hover:text-stone-100 hover:bg-stone-800/80 rounded transition-colors"
            title="应用中文出版排版规范（全角双空格缩进、标点统一）"
          >
            <AlignLeft className="w-3.5 h-3.5 text-amber-400/80" />
            <span>排版规范化</span>
          </button>

          <button
            onClick={handleCopyCleanText}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-all ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-stone-300 hover:text-stone-100 hover:bg-stone-800/80'
            }`}
            title="复制无 Markdown 污染的出版级纯文本"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制纯文本' : '复制纯文本'}</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-8 sm:px-16 flex justify-center scrollbar-thin">
        <div className="w-full max-w-3xl flex flex-col">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            placeholder="在此开始沉浸式纯文本小说创作...（无需输入任何 Markdown 符号）"
            spellCheck={false}
            className="w-full flex-1 bg-transparent resize-none border-none focus:outline-none text-stone-200 placeholder-stone-600 text-base leading-[1.85] font-serif tracking-wide min-h-[500px]"
            style={{
              fontFamily:
                '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", serif'
            }}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-stone-800/80 bg-stone-950/80 px-6 flex items-center justify-between text-[11px] text-stone-500 font-mono select-none">
        <div className="flex items-center gap-4">
          <span>
            中文汉字: <strong className="text-stone-300 font-normal">{stats.chineseChars}</strong>
          </span>
          <span>
            总字符数: <strong className="text-stone-300 font-normal">{stats.totalChars}</strong>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-stone-600" />
            预计阅读: <strong className="text-stone-300 font-normal">{stats.readingMinutes} 分钟</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>纯文本无污染容器 (Pure Text First)</span>
        </div>
      </footer>
    </main>
  )
}
