import React, { useEffect, useRef, useState } from 'react'
import {
  AlignLeft,
  Check,
  Copy,
  Clock,
  CheckCircle2,
  FileEdit,
  FolderOpen,
  FolderPlus,
  PenLine,
  History,
  BookText,
  User,
  Bookmark
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { countTextStats } from '../../lib/typography'
import { SnapshotDrawer } from '../SnapshotDrawer'

export const EditorCenter: React.FC = () => {
  const {
    projectPath,
    chapters,
    activeChapterId,
    activeDocumentType,
    activeStoryFile,
    updateContent,
    updateChapterTitle,
    applyTypography,
    isDirty,
    saveActiveDocument,
    openProject,
    createProject,
    addChapter
  } = useWorkspaceStore()

  const [copied, setCopied] = useState(false)
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false)

  const activeChapter = chapters.find((ch) => ch.id === activeChapterId)

  // Current active document details
  const isStoryDoc = activeDocumentType === 'story' && activeStoryFile
  const currentTitle = isStoryDoc ? activeStoryFile.title : activeChapter?.title || ''
  const currentContent = isStoryDoc ? activeStoryFile.content : activeChapter?.content || ''
  const currentFilename = isStoryDoc ? activeStoryFile.filename : activeChapter?.filename
  const currentFilePath = isStoryDoc ? activeStoryFile.relativePath : activeChapter?.relativePath

  const stats = countTextStats(currentContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea so it expands with content and NEVER displays internal scrollbars
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(650, textareaRef.current.scrollHeight)}px`
    }
  }, [currentContent])

  // Auto-save debounce effect
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      saveActiveDocument()
    }, 2000)
    return () => clearTimeout(timer)
  }, [currentContent, isDirty, saveActiveDocument])

  const handleCopyCleanText = async () => {
    if (!currentContent) return
    const ok = await window.api.copyText(currentContent)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // State 1: No project opened (True Empty Project Slate)
  if (!projectPath) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-[#fbfbfa] p-8 select-none text-center animate-in fade-in duration-200">
        <div className="max-w-md w-full flex flex-col items-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center">
            <PenLine className="w-6 h-6 text-stone-700 stroke-[1.75]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Explosion 创作工作台
            </h1>
            <p className="text-xs text-stone-500 leading-relaxed max-w-sm">
              尚未打开小说工程，请新建或选择本地文件夹作为工程目录，直接读写本地手稿。
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={createProject}
              className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-all shadow-xs flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              <span>新建小说工程</span>
            </button>

            <button
              onClick={openProject}
              className="px-4 py-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 hover:text-stone-900 text-xs font-medium transition-all shadow-2xs flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4 text-stone-500" />
              <span>打开已有工程</span>
            </button>
          </div>
        </div>
      </main>
    )
  }

  // State 2: Project opened, but no chapters exist yet
  if (!isStoryDoc && (chapters.length === 0 || !activeChapter)) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-[#fbfbfa] p-8 text-center text-stone-500 text-xs">
        <div className="space-y-3">
          <div>当前小说工程暂无手稿章节</div>
          <button
            onClick={() => addChapter()}
            className="px-3.5 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors"
          >
            + 新建第一章
          </button>
        </div>
      </main>
    )
  }

  // State 3: Active document editor (manuscript or story bible)
  return (
    <main className="flex-1 flex flex-col bg-[#fbfbfa] relative overflow-hidden">
      {/* Editor Sub-header Bar */}
      <div className="h-11 border-b border-stone-200/80 px-8 flex items-center justify-between bg-white/70 backdrop-blur-xs select-none shrink-0">
        <div className="flex items-center gap-2.5 flex-1 mr-4">
          {/* Document Type Badge */}
          {isStoryDoc ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 shrink-0">
              {activeStoryFile.type === 'outline' && <BookText className="w-3 h-3 text-amber-700" />}
              {activeStoryFile.type === 'character' && <User className="w-3 h-3 text-blue-700" />}
              {activeStoryFile.type === 'ledger' && <Bookmark className="w-3 h-3 text-purple-700" />}
              <span>
                {activeStoryFile.type === 'outline' && '大纲规划'}
                {activeStoryFile.type === 'character' && '人物档案'}
                {activeStoryFile.type === 'ledger' && '暗线'}
              </span>
            </span>
          ) : activeChapter?.volume ? (
            <span className="text-[10px] text-stone-400 font-medium px-1.5 py-0.5 rounded bg-stone-100 shrink-0">
              {activeChapter.volume}
            </span>
          ) : null}

          {/* Title Editor / Display */}
          {isStoryDoc ? (
            <span className="font-semibold text-sm text-stone-900 truncate">
              {currentTitle}
            </span>
          ) : (
            <input
              type="text"
              value={currentTitle}
              onChange={(e) => activeChapter && updateChapterTitle(activeChapter.id, e.target.value)}
              placeholder="章节标题..."
              className="bg-transparent font-semibold text-sm text-stone-900 placeholder-stone-400 focus:outline-none px-1.5 py-0.5 rounded transition-colors w-full max-w-sm"
            />
          )}
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Save Status */}
          <div className="flex items-center gap-1 text-xs text-stone-400">
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

          {/* Time Machine Button */}
          <button
            onClick={() => setIsSnapshotOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
            title="查看与回滚历史修改版本（本地时光机防丢稿）"
          >
            <History className="w-3.5 h-3.5 text-stone-500" />
            <span>时光机</span>
          </button>

          {/* Quick Format & Copy */}
          <button
            onClick={applyTypography}
            className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
            title="应用中文出版排版规范（全角双空格缩进、标点统一）"
          >
            <AlignLeft className="w-3.5 h-3.5 text-stone-500" />
            <span>规范排版</span>
          </button>

          <button
            onClick={handleCopyCleanText}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
            title="复制无 Markdown 污染的出版级纯文本"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
            <span>{copied ? '已复制' : '复制纯文本'}</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area (Spacious Typography Paper Style, Scrollbar strictly attached to rightmost edge, Wheel Scrollable) */}
      <div
        ref={scrollContainerRef}
        onClick={() => textareaRef.current?.focus()}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-8 py-10 sm:px-14 lg:px-20 cursor-text flex justify-center"
      >
        <div className="w-full max-w-4xl flex flex-col">
          <textarea
            ref={textareaRef}
            value={currentContent}
            onChange={(e) => updateContent(e.target.value)}
            onWheel={(e) => {
              // Ensure mouse wheel on textarea forwards scroll to outer scroll container smoothly
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop += e.deltaY
              }
            }}
            placeholder="在此开始写作...（纯文本无污染，静候文字流淌）"
            spellCheck={false}
            className="w-full bg-transparent resize-none overflow-hidden border-none focus:outline-none text-stone-900 placeholder-stone-300 text-base leading-[2.1] font-serif tracking-wide"
            style={{
              fontFamily:
                '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", "Times New Roman", serif'
            }}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-stone-200 bg-white/80 px-8 flex items-center justify-between text-[11px] text-stone-500 font-mono select-none shrink-0">
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
          {isStoryDoc ? '本作设定文档' : '纯文本手稿'}
        </div>
      </footer>

      {/* Time Machine Snapshot Drawer */}
      <SnapshotDrawer
        isOpen={isSnapshotOpen}
        onClose={() => setIsSnapshotOpen(false)}
        currentFilename={currentFilename}
        currentFilePath={currentFilePath}
      />
    </main>
  )
}
