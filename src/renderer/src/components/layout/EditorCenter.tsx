import React, { useState, useRef, useEffect } from 'react'
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
  Bookmark,
  Target,
  Sun,
  Moon,
  SlidersHorizontal,
  RotateCcw,
  Download
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useConfigStore } from '../../store/configStore'
import { countTextStats } from '../../lib/typography'
import { calculateTypewriterScrollTop, shouldUpdateScroll } from '../../lib/typewriter'
import { clampFontSize, clampLineHeight } from '../../../../shared/utils/uiConfig'
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_LINE_HEIGHT,
  MAX_LINE_HEIGHT
} from '../../../../shared/constants/config'
import { SnapshotDrawer } from '../SnapshotDrawer'

let mirrorDiv: HTMLDivElement | null = null

const PROPERTIES_TO_COPY = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "whiteSpace",
  "wordBreak",
  "wordWrap"
] as const

function measureCaretTop(textarea: HTMLTextAreaElement, position: number): number {
  if (typeof document === "undefined") return 0

  if (!mirrorDiv) {
    mirrorDiv = document.createElement("div")
    mirrorDiv.id = "__typewriter_mirror__"
    mirrorDiv.style.position = "absolute"
    mirrorDiv.style.visibility = "hidden"
    mirrorDiv.style.pointerEvents = "none"
    mirrorDiv.style.top = "-9999px"
    mirrorDiv.style.left = "-9999px"
    mirrorDiv.style.overflow = "hidden"
    document.body.appendChild(mirrorDiv)
  }

  const computed = window.getComputedStyle(textarea)

  for (const prop of PROPERTIES_TO_COPY) {
    mirrorDiv.style[prop as any] = computed[prop as any]
  }

  mirrorDiv.style.position = "absolute"
  mirrorDiv.style.top = "-9999px"
  mirrorDiv.style.left = "-9999px"
  mirrorDiv.style.visibility = "hidden"
  mirrorDiv.style.pointerEvents = "none"
  mirrorDiv.style.overflow = "hidden"
  mirrorDiv.style.width = `${textarea.clientWidth}px`

  const text = textarea.value.substring(0, Math.max(0, position))
  mirrorDiv.textContent = text

  const span = document.createElement("span")
  span.textContent = "\u200b"
  mirrorDiv.appendChild(span)

  const top = span.offsetTop
  return top
}

function getComputedLineHeight(textarea: HTMLTextAreaElement, fallbackLineHeight = 1.85): number {
  if (typeof window === "undefined") return 16 * fallbackLineHeight
  const computed = window.getComputedStyle(textarea)
  const lh = parseFloat(computed.lineHeight)
  if (!isNaN(lh) && lh > 0) return lh
  const fs = parseFloat(computed.fontSize) || 16
  return fs * fallbackLineHeight
}

let activeRaf: number | null = null

function scrollToTypewriterCenter(
  textarea: HTMLTextAreaElement,
  options?: { smooth?: boolean; targetRatio?: number }
): void {
  if (typeof window === "undefined") return

  if (activeRaf !== null) {
    cancelAnimationFrame(activeRaf)
  }

  activeRaf = requestAnimationFrame(() => {
    activeRaf = null
    const caretPos = textarea.selectionStart
    // Do not scroll if user is actively selecting a range of text
    if (textarea.selectionEnd !== caretPos) return

    const caretTop = measureCaretTop(textarea, caretPos)
    const lineHeight = getComputedLineHeight(textarea)
    const viewportHeight = textarea.clientHeight
    const currentScrollTop = textarea.scrollTop
    const scrollHeight = textarea.scrollHeight

    const targetScrollTop = calculateTypewriterScrollTop({
      caretTop,
      lineHeight,
      viewportHeight,
      targetRatio: options?.targetRatio ?? 0.5,
      scrollHeight
    })

    if (shouldUpdateScroll(currentScrollTop, targetScrollTop)) {
      if (options?.smooth) {
        textarea.scrollTo({ top: targetScrollTop, behavior: "smooth" })
      } else {
        textarea.scrollTop = targetScrollTop
      }
    }
  })
}

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
    addChapter,
    selectedText,
    setSelection,
    clearSelection,
    exportManuscript,
    isExporting
  } = useWorkspaceStore()

  const { config, updateUiConfig } = useConfigStore()
  const fontSize = config.ui.fontSize || DEFAULT_FONT_SIZE
  const lineHeight = config.ui.lineHeight || DEFAULT_LINE_HEIGHT
  const typewriterMode = config.ui.typewriterMode ?? true
  const theme = config.ui.theme || 'dark'

  const [copied, setCopied] = useState(false)
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false)
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false)

  const activeChapter = chapters.find((ch) => ch.id === activeChapterId)

  // Current active document details
  const isStoryDoc = activeDocumentType === 'story' && activeStoryFile
  const currentTitle = isStoryDoc ? activeStoryFile.title : activeChapter?.title || ''
  const currentContent = isStoryDoc ? activeStoryFile.content : activeChapter?.content || ''
  const currentFilename = isStoryDoc ? activeStoryFile.filename : activeChapter?.filename
  const currentFilePath = isStoryDoc ? activeStoryFile.relativePath : activeChapter?.relativePath

  const stats = countTextStats(currentContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const displaySettingsRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)

  // Close display settings popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isDisplaySettingsOpen &&
        displaySettingsRef.current &&
        !displaySettingsRef.current.contains(e.target as Node)
      ) {
        setIsDisplaySettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDisplaySettingsOpen])

  const handleSelectionChange = () => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      const text = el.value.substring(start, end)
      if (text.length >= 2) {
        setSelection(text, { start, end })
        return
      }
    }
    if (useWorkspaceStore.getState().selectedText !== null) {
      clearSelection()
    }
  }

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

  // Typewriter scroll trigger helper
  const triggerTypewriterScroll = (options?: { smooth?: boolean }) => {
    if (!typewriterMode) return
    if (isComposingRef.current) return
    const el = textareaRef.current
    if (!el) return
    scrollToTypewriterCenter(el, options)
  }

  const handleToggleTypewriter = () => {
    const next = !typewriterMode
    updateUiConfig({ typewriterMode: next })
    if (next && textareaRef.current) {
      scrollToTypewriterCenter(textareaRef.current, { smooth: true })
    }
  }

  const handleToggleTheme = () => {
    updateUiConfig({ theme: theme === 'dark' ? 'light' : 'dark' })
  }

  const handleAdjustFontSize = (delta: number) => {
    const next = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSize + delta))
    updateUiConfig({ fontSize: next })
  }

  const handleAdjustLineHeight = (delta: number) => {
    const next = Math.max(MIN_LINE_HEIGHT, Math.min(MAX_LINE_HEIGHT, Math.round((lineHeight + delta) * 100) / 100))
    updateUiConfig({ lineHeight: next })
  }

  const handleResetDisplay = () => {
    updateUiConfig({ fontSize: DEFAULT_FONT_SIZE, lineHeight: DEFAULT_LINE_HEIGHT })
  }

  // State 1: No project opened (True Empty Project Slate)
  if (!projectPath) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-[#fbfbfa] dark:bg-[#141413] p-8 select-none text-center animate-in fade-in duration-200">
        <div className="max-w-md w-full flex flex-col items-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1f1e1c] border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-center">
            <PenLine className="w-6 h-6 text-stone-700 dark:text-stone-300 stroke-[1.75]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              Explosion 创作工作台
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-sm">
              尚未打开小说工程，请新建或选择本地文件夹作为工程目录，直接读写本地手稿。
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={createProject}
              className="px-4 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-medium transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>新建小说工程</span>
            </button>

            <button
              onClick={openProject}
              className="px-4 py-2 rounded-lg bg-white dark:bg-[#22211f] border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-[#2b2927] text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white text-xs font-medium transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-stone-500 dark:text-stone-400" />
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
      <main className="flex-1 flex flex-col items-center justify-center bg-[#fbfbfa] dark:bg-[#141413] p-8 text-center text-stone-500 dark:text-stone-400 text-xs">
        <div className="space-y-3">
          <div>当前小说工程暂无手稿章节</div>
          <button
            onClick={() => addChapter()}
            className="px-3.5 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-white transition-colors cursor-pointer"
          >
            + 新建第一章
          </button>
        </div>
      </main>
    )
  }

  // State 3: Active Chapter or Story Document Loaded
  return (
    <main className="flex-1 flex flex-col bg-[#fbfbfa] dark:bg-[#141413] relative overflow-hidden">
      {/* Editor Sub-header Bar */}
      <div className="h-11 border-b border-stone-200/80 dark:border-stone-800 px-6 flex items-center justify-between bg-white/70 dark:bg-[#1a1918]/80 backdrop-blur-xs select-none shrink-0 z-20">
        <div className="flex items-center gap-2.5 flex-1 mr-4">
          {/* Document Type Badge */}
          {isStoryDoc ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 shrink-0">
              {activeStoryFile.type === 'outline' && <BookText className="w-3 h-3 text-amber-700 dark:text-amber-400" />}
              {activeStoryFile.type === 'character' && <User className="w-3 h-3 text-blue-700 dark:text-blue-400" />}
              {activeStoryFile.type === 'ledger' && <Bookmark className="w-3 h-3 text-purple-700 dark:text-purple-400" />}
              <span>
                {activeStoryFile.type === 'outline' && '大纲规划'}
                {activeStoryFile.type === 'character' && '人物档案'}
                {activeStoryFile.type === 'ledger' && '暗线'}
              </span>
            </span>
          ) : activeChapter?.volume ? (
            <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 shrink-0">
              {activeChapter.volume}
            </span>
          ) : null}

          {/* Title Editor / Display */}
          {isStoryDoc ? (
            <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
              {currentTitle}
            </span>
          ) : (
            <input
              type="text"
              value={currentTitle}
              onChange={(e) => activeChapter && updateChapterTitle(activeChapter.id, e.target.value)}
              placeholder="章节标题..."
              className="bg-transparent font-semibold text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none px-1.5 py-0.5 rounded transition-colors w-full max-w-sm"
            />
          )}
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2">
          {/* Save Status */}
          <div className="flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500 mr-1">
            {isDirty ? (
              <>
                <FileEdit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 animate-pulse" />
                <span>编辑中</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                <span>已保存</span>
              </>
            )}
          </div>

          <div className="w-[1px] h-3.5 bg-stone-200 dark:bg-stone-800" />

          {/* Typewriter Scroll Focus Toggle */}
          <button
            onClick={handleToggleTypewriter}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all cursor-pointer ${
              typewriterMode
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/70 dark:border-amber-700/70 font-medium'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title={typewriterMode ? '打字机定焦模式 (已开启：光标所在行保持居中)' : '打字机定焦模式 (已关闭)'}
          >
            <Target className={`w-3.5 h-3.5 ${typewriterMode ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'}`} />
            <span>定焦</span>
          </button>

          {/* Typography Display Settings (Font Size & Line Height Popover) */}
          <div className="relative" ref={displaySettingsRef}>
            <button
              onClick={() => setIsDisplaySettingsOpen(!isDisplaySettingsOpen)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all cursor-pointer ${
                isDisplaySettingsOpen
                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              title="调整手稿字号与行距"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span>排版</span>
            </button>

            {isDisplaySettingsOpen && (
              <div className="absolute right-0 top-9 w-64 bg-white dark:bg-[#1f1e1c] border border-stone-200 dark:border-stone-750 rounded-xl shadow-xl p-3.5 z-50 text-xs font-sans space-y-3.5 animate-in fade-in duration-100 select-none">
                <div className="flex items-center justify-between pb-1.5 border-b border-stone-100 dark:border-stone-800">
                  <span className="font-semibold text-stone-800 dark:text-stone-200 text-xs">
                    编辑器排版设置
                  </span>
                  <button
                    onClick={handleResetDisplay}
                    className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                    title="重置为默认字号(16px)与行距(1.85)"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重置</span>
                  </button>
                </div>

                {/* Font Size Control */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-600 dark:text-stone-400">字号大小</span>
                    <span className="font-mono font-medium text-stone-900 dark:text-stone-100">
                      {fontSize}px
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAdjustFontSize(-1)}
                      disabled={fontSize <= MIN_FONT_SIZE}
                      className="w-7 h-7 rounded border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center font-mono text-stone-700 dark:text-stone-200 disabled:opacity-40 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={MIN_FONT_SIZE}
                      max={MAX_FONT_SIZE}
                      step={1}
                      value={fontSize}
                      onChange={(e) => updateUiConfig({ fontSize: parseInt(e.target.value, 10) })}
                      className="flex-1 accent-stone-800 dark:accent-stone-200"
                    />
                    <button
                      onClick={() => handleAdjustFontSize(1)}
                      disabled={fontSize >= MAX_FONT_SIZE}
                      className="w-7 h-7 rounded border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center font-mono text-stone-700 dark:text-stone-200 disabled:opacity-40 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Line Height Control */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-600 dark:text-stone-400">行距倍率</span>
                    <span className="font-mono font-medium text-stone-900 dark:text-stone-100">
                      {lineHeight.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAdjustLineHeight(-0.05)}
                      disabled={lineHeight <= MIN_LINE_HEIGHT}
                      className="w-7 h-7 rounded border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center font-mono text-stone-700 dark:text-stone-200 disabled:opacity-40 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={MIN_LINE_HEIGHT}
                      max={MAX_LINE_HEIGHT}
                      step={0.05}
                      value={lineHeight}
                      onChange={(e) => updateUiConfig({ lineHeight: parseFloat(e.target.value) })}
                      className="flex-1 accent-stone-800 dark:accent-stone-200"
                    />
                    <button
                      onClick={() => handleAdjustLineHeight(0.05)}
                      disabled={lineHeight >= MAX_LINE_HEIGHT}
                      className="w-7 h-7 rounded border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center font-mono text-stone-700 dark:text-stone-200 disabled:opacity-40 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Theme Quick Toggle (Sun / Moon) */}
          <button
            onClick={handleToggleTheme}
            className="flex items-center justify-center p-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors cursor-pointer"
            title={theme === 'dark' ? '切换为明亮模式' : '切换为夜间模式'}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-stone-600" />
            )}
          </button>

          <div className="w-[1px] h-3.5 bg-stone-200 dark:bg-stone-800" />

          {/* Time Machine Button */}
          <button
            onClick={() => setIsSnapshotOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors cursor-pointer"
            title="查看与回滚历史修改版本（本地时光机防丢稿）"
          >
            <History className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            <span>时光机</span>
          </button>

          {/* Quick Format & Copy */}
          <button
            onClick={applyTypography}
            className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors cursor-pointer"
            title="应用中文出版排版规范（全角双空格缩进、标点统一）"
          >
            <AlignLeft className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            <span>规范排版</span>
          </button>

          <button
            onClick={handleCopyCleanText}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title="复制无 Markdown 污染的出版级纯文本"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            )}
            <span>{copied ? '已复制' : '复制纯文本'}</span>
          </button>
          <div className="w-[1px] h-3.5 bg-stone-200" />

          <button
            onClick={() => exportManuscript()}
            disabled={isExporting}
            className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors disabled:opacity-50"
            title="交稿导出：按章节顺序合并全书并导出为出版级规范纯文本 (.txt)"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>{isExporting ? "导出中..." : "交稿导出"}</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area (Native Standard Ultra-Smooth Scroll Architecture, Scrollbar strictly attached to rightmost edge) */}
      <div className="flex-1 min-h-0 relative bg-[#fbfbfa] dark:bg-[#141413]">
        <textarea
          ref={textareaRef}
          value={currentContent}
          onChange={(e) => {
            updateContent(e.target.value)
            if (!isComposingRef.current) {
              triggerTypewriterScroll({ smooth: false })
            }
          }}
          onSelect={handleSelectionChange}
          onMouseUp={(e) => {
            handleSelectionChange()
            if (
              typewriterMode &&
              !isComposingRef.current &&
              textareaRef.current &&
              textareaRef.current.selectionStart === textareaRef.current.selectionEnd
            ) {
              triggerTypewriterScroll({ smooth: true })
            }
          }}
          onKeyUp={(e) => {
            handleSelectionChange()
            if (!isComposingRef.current) {
              triggerTypewriterScroll({ smooth: false })
            }
          }}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
            triggerTypewriterScroll({ smooth: false })
          }}
          placeholder="在此开始写作..."
          spellCheck={false}
          className="w-full h-full bg-transparent resize-none overflow-y-auto scrollbar-thin border-none focus:outline-none text-stone-900 dark:text-stone-100 placeholder-stone-300 dark:placeholder-stone-600 font-serif tracking-wide select-text block"
          style={{
            fontFamily:
              '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", "Times New Roman", serif',
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            paddingLeft: 'max(2rem, calc((100% - 56rem) / 2))',
            paddingRight: 'max(2rem, calc((100% - 56rem) / 2))',
            paddingTop: '2.5rem',
            paddingBottom: typewriterMode ? 'max(8rem, 50vh)' : '8rem'
          }}
        />
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#1a1918]/80 px-8 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 font-mono select-none shrink-0">
        <div className="flex items-center gap-4">
          <span>
            汉字: <strong className="text-stone-800 dark:text-stone-200 font-normal">{stats.chineseChars}</strong>
          </span>
          <span>
            总字数: <strong className="text-stone-800 dark:text-stone-200 font-normal">{stats.totalChars}</strong>
          </span>
          {selectedText && (
            <span className="text-amber-800 dark:text-amber-400">
              已选中: <strong className="text-amber-900 dark:text-amber-300 font-normal">{selectedText.length}</strong> 字
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-stone-400 dark:text-stone-500" />
            预计阅读: <strong className="text-stone-800 dark:text-stone-200 font-normal">{stats.readingMinutes} 分钟</strong>
          </span>
        </div>

        <div className="text-stone-400 dark:text-stone-500 text-[10px]">
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
