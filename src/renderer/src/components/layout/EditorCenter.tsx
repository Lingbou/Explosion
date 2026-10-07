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
      <main className="flex-1 flex items-center justify-center bg-[#fbfbfa] text-stone-400 text-sm font-sans">
        请选择或创建手稿章节
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col bg-[#fbfbfa] relative overflow-hidden">
      {/* Editor Sub-header Bar */}
      <div className="h-11 border-b border-stone-200/80 px-8 flex items-center justify-between bg-white/70 backdrop-blur-xs select-none">
        <div className="flex items-center gap-3 flex-1 mr-4">
          <input
            type="text"
            value={activeChapter.title}
            onChange={(e) => updateChapterTitle(activeChapter.id, e.target.value)}
            placeholder="章节标题..."
            className="bg-transparent font-semibold text-sm text-stone-900 placeholder-stone-400 focus:outline-none px-1.5 py-0.5 rounded transition-colors w-full max-w-sm"
          />
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Save Status */}
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            {isDirty ? (
              <>
                <FileEdit className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>编辑中</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>已保存</span>
              </>
            )}
          </div>

          <div className="w-[1px] h-3.5 bg-stone-200" />

          {/* Quick Format & Copy */}
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
            title="复制无 Markdown 污染的出版级纯文本"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制纯文本'}</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area (Typora / iA Writer Paper Style) */}
      <div className="flex-1 overflow-y-auto px-8 py-10 sm:px-20 flex justify-center scrollbar-thin">
        <div className="w-full max-w-2xl flex flex-col">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            placeholder="在此开始写作...（纯文本无污染，静候文字流淌）"
            spellCheck={false}
            className="w-full flex-1 bg-transparent resize-none border-none focus:outline-none text-stone-900 placeholder-stone-300 text-base leading-[2.1] font-serif tracking-wide min-h-[550px]"
            style={{
              fontFamily:
                '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", "Times New Roman", serif'
            }}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-stone-200 bg-white/80 px-8 flex items-center justify-between text-[11px] text-stone-500 font-mono select-none">
        <div className="flex items-center gap-4">
          <span>
            汉字: <strong className="text-stone-800 font-normal">{stats.chineseChars}</strong>
          </span>
          <span>
            总字数: <strong className="text-stone-800 font-normal">{stats.totalChars}</strong>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-stone-400" />
            预计阅读: <strong className="text-stone-800 font-normal">{stats.readingMinutes} 分钟</strong>
          </span>
        </div>

        <div className="text-stone-400 text-[10px]">
          纯文本手稿
        </div>
      </footer>
    </main>
  )
}
