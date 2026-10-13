import React, { useState, useRef, useEffect } from "react"
import {
  Clock,
  FolderOpen,
  FolderPlus,
  PenLine,
  History,
  BookText,
  User,
  Bookmark
} from "lucide-react"
import { useWorkspaceStore } from "../../store/workspaceStore"
import { useConfigStore } from "../../store/configStore"
import {
  countTextStats,
  ensureParagraphIndent,
  formatPastedText
} from "../../lib/typography"
import { calculateTypewriterScrollTop, shouldUpdateScroll } from "../../lib/typewriter"
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT
} from "../../../../shared/constants/config"
import { SnapshotDrawer } from "../SnapshotDrawer"

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

function getMirrorDiv(textarea: HTMLTextAreaElement): HTMLDivElement {
  if (typeof document === "undefined") {
    return {} as HTMLDivElement
  }

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
  mirrorDiv.style.height = "auto"

  return mirrorDiv
}

function computeTextareaHeight(textarea: HTMLTextAreaElement): number {
  if (typeof document === "undefined") return 300
  const mirror = getMirrorDiv(textarea)
  mirror.textContent = textarea.value + "\n\u200b"
  return Math.max(300, mirror.scrollHeight)
}

function measureCaretTop(textarea: HTMLTextAreaElement, position: number): number {
  if (typeof document === "undefined") return 0

  const mirror = getMirrorDiv(textarea)
  const text = textarea.value.substring(0, Math.max(0, position))
  mirror.textContent = text

  const span = document.createElement("span")
  span.textContent = "\u200b"
  mirror.appendChild(span)

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
  scrollContainer: HTMLDivElement,
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

    const containerRect = scrollContainer.getBoundingClientRect()
    const textareaRect = textarea.getBoundingClientRect()
    const caretTop =
      textareaRect.top - containerRect.top + scrollContainer.scrollTop + measureCaretTop(textarea, caretPos)
    const lineHeight = getComputedLineHeight(textarea)
    const viewportHeight = scrollContainer.clientHeight
    const currentScrollTop = scrollContainer.scrollTop
    const scrollHeight = scrollContainer.scrollHeight

    const targetScrollTop = calculateTypewriterScrollTop({
      caretTop,
      lineHeight,
      viewportHeight,
      targetRatio: options?.targetRatio ?? 0.5,
      scrollHeight
    })

    if (shouldUpdateScroll(currentScrollTop, targetScrollTop)) {
      if (options?.smooth) {
        scrollContainer.scrollTo({ top: targetScrollTop, behavior: "smooth" })
      } else {
        scrollContainer.scrollTop = targetScrollTop
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
    isDirty,
    saveActiveDocument,
    openProject,
    createProject,
    addChapter,
    selectedText,
    setSelection,
    clearSelection
  } = useWorkspaceStore()

  const { config } = useConfigStore()
  const fontSize = config.ui.fontSize || DEFAULT_FONT_SIZE
  const lineHeight = config.ui.lineHeight || DEFAULT_LINE_HEIGHT
  const typewriterMode = config.ui.typewriterMode ?? true

  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false)

  const activeChapter = chapters.find((ch) => ch.id === activeChapterId)

  // Current active document details
  const isStoryDoc = activeDocumentType === "story" && activeStoryFile
  const currentTitle = isStoryDoc ? activeStoryFile.title : activeChapter?.title || ""
  const currentContent = isStoryDoc ? activeStoryFile.content : activeChapter?.content || ""
  const currentFilename = isStoryDoc ? activeStoryFile.filename : activeChapter?.filename
  const currentFilePath = isStoryDoc ? activeStoryFile.relativePath : activeChapter?.relativePath

  const stats = countTextStats(currentContent)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentWrapperRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)

  // Local title state: isolates typing from async disk renames, preventing IME corruption & screen flicker
  const [titleInput, setTitleInput] = useState(currentTitle)

  useEffect(() => {
    setTitleInput(currentTitle)
  }, [currentTitle, activeChapterId, activeStoryFile?.relativePath])

  const handleCommitTitle = () => {
    if (!activeChapter) return
    const trimmed = titleInput.trim()
    if (trimmed && trimmed !== currentTitle) {
      updateChapterTitle(activeChapter.id, trimmed)
    } else if (!trimmed && currentTitle) {
      setTitleInput(currentTitle)
    }
  }

  // Adjust textarea height dynamically to prevent scroll collapse (fast & lightweight)
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    const nextHeight = Math.max(300, textarea.scrollHeight)
    textarea.style.height = `${nextHeight}px`
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [currentContent, fontSize, lineHeight, activeChapterId])

  useEffect(() => {
    const handleResize = () => adjustTextareaHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Reset scroll to top on chapter switch
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [activeChapterId, activeStoryFile?.relativePath])

  const handleSelectionChange = () => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (typeof start === "number" && typeof end === "number" && end > start) {
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

  // Auto-save debounce effect with paragraph indent normalization (saves cleanly without destroying textarea DOM undo stack)
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      if (currentContent) {
        const formatted = ensureParagraphIndent(currentContent)
        if (formatted !== currentContent) {
          updateContent(formatted)
        }
      }
      saveActiveDocument()
    }, 2000)
    return () => clearTimeout(timer)
  }, [currentContent, isDirty, saveActiveDocument, updateContent])

  // Typewriter scroll trigger helper
  const triggerTypewriterScroll = (options?: { smooth?: boolean }) => {
    if (!typewriterMode) return
    if (isComposingRef.current) return
    const el = textareaRef.current
    const container = scrollContainerRef.current
    if (!el || !container) return
    scrollToTypewriterCenter(el, container, options)
  }

  // KeyDown: intercept Enter to automatically insert publication-grade Chinese paragraph indent
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
      return
    }

    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      document.execCommand?.("insertText", false, "\u3000\u3000")
      return
    }

    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const insertText = "\n\u3000\u3000"
      const isInserted = document.execCommand?.("insertText", false, insertText)

      if (!isInserted) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const current = textarea.value
        const next = current.substring(0, start) + insertText + current.substring(end)
        const newPos = start + insertText.length
        textarea.value = next
        textarea.setSelectionRange(newPos, newPos)
        updateContent(next)
      } else {
        updateContent(textarea.value)
      }

      adjustTextareaHeight()
      triggerTypewriterScroll({ smooth: false })
    }
  }

  // Paste: automatically clean Markdown pollution and apply \u3000\u3000 indent to all paragraphs
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text")
    if (!pasted) return

    e.preventDefault()
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const fullText = textarea.value

    const beforeCursor = fullText.substring(0, start)
    const lineStart = beforeCursor.lastIndexOf("\n") + 1
    const currentLinePrefix = beforeCursor.substring(lineStart)

    const formatted = formatPastedText(pasted, currentLinePrefix)

    const isInserted = document.execCommand?.("insertText", false, formatted)
    if (!isInserted) {
      const afterCursor = fullText.substring(end)
      const nextVal = beforeCursor + formatted + afterCursor
      const newPos = start + formatted.length
      textarea.value = nextVal
      textarea.setSelectionRange(newPos, newPos)
      updateContent(nextVal)
    } else {
      updateContent(textarea.value)
    }

    adjustTextareaHeight()
    triggerTypewriterScroll({ smooth: false })
  }

  // Pure handleChange: strictly preserves browser native Undo/Redo history stack (Ctrl+Z / Cmd+Z)
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value
    updateContent(nextVal)
    adjustTextareaHeight()
    if (!isComposingRef.current) {
      triggerTypewriterScroll({ smooth: false })
    }
  }

  // CompositionEnd: IME finished composition, adjust height and typewriter scroll safely without DOM value corruption
  const handleCompositionEnd = () => {
    isComposingRef.current = false
    adjustTextareaHeight()
    triggerTypewriterScroll({ smooth: false })
  }

  // Blur: ensure all paragraphs conform to \u3000\u3000 indentation upon losing focus
  const handleBlur = () => {
    const textarea = textareaRef.current
    if (textarea && textarea.value.trim()) {
      const formatted = ensureParagraphIndent(textarea.value)
      if (formatted !== textarea.value) {
        textarea.value = formatted
        updateContent(formatted)
      }
    }
    saveActiveDocument()
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

  // State 3: Active Chapter or Story Document Loaded (Pure, Immersive Notion/Typora Architecture)
  return (
    <main className="flex-1 flex flex-col bg-[#fbfbfa] dark:bg-[#141413] relative overflow-hidden">
      {/* Editor Content Area (Seamless Unified Scroll Flow for Title and Body) */}
      <div
        ref={scrollContainerRef}
        onClick={(e) => {
          if (e.target === scrollContainerRef.current || e.target === contentWrapperRef.current) {
            textareaRef.current?.focus()
          }
        }}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-[#fbfbfa] dark:bg-[#141413] relative select-text"
      >
        <div
          ref={contentWrapperRef}
          className="max-w-4xl mx-auto px-8 md:px-12 pt-10 flex flex-col"
          style={{
            minHeight: "100%",
            paddingBottom: typewriterMode ? "max(8rem, 50vh)" : "8rem"
          }}
        >
          {/* Document Badge & Title Section (Notion / Typora style) */}
          <div className="mb-6 shrink-0">
            {isStoryDoc ? (
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mb-2">
                {activeStoryFile.type === "outline" && (
                  <BookText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                )}
                {activeStoryFile.type === "character" && (
                  <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                )}
                {activeStoryFile.type === "ledger" && (
                  <Bookmark className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                )}
                <span>
                  {activeStoryFile.type === "outline" && "大纲规划"}
                  {activeStoryFile.type === "character" && "人物档案"}
                  {activeStoryFile.type === "ledger" && "暗线"}
                </span>
              </div>
            ) : activeChapter?.volume ? (
              <div className="text-xs font-medium text-stone-400 dark:text-stone-500 mb-2">
                {activeChapter.volume}
              </div>
            ) : null}

            {isStoryDoc ? (
              <h1 className="w-full font-serif text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight py-1">
                {currentTitle}
              </h1>
            ) : (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleCommitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && (e as any).keyCode !== 229) {
                    e.preventDefault()
                    handleCommitTitle()
                    textareaRef.current?.focus()
                  }
                }}
                placeholder="未命名章节"
                className="w-full bg-transparent font-serif text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 placeholder-stone-300 dark:placeholder-stone-700 focus:outline-none border-none tracking-tight py-1 block"
              />
            )}
          </div>

          {/* Textarea (Shares vertical scroll with title) */}
          <textarea
            ref={textareaRef}
            value={currentContent}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={handleBlur}
            onSelect={handleSelectionChange}
            onMouseUp={() => {
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
            onKeyUp={() => {
              handleSelectionChange()
              if (!isComposingRef.current) {
                triggerTypewriterScroll({ smooth: false })
              }
            }}
            onCompositionStart={() => {
              isComposingRef.current = true
            }}
            onCompositionEnd={handleCompositionEnd}
            placeholder="在此开始写作..."
            spellCheck={false}
            className="w-full bg-transparent resize-none overflow-hidden border-none focus:outline-none text-stone-900 dark:text-stone-100 placeholder-stone-300 dark:placeholder-stone-600 font-serif tracking-wide select-text block"
            style={{
              fontFamily:
                "\"Source Han Serif SC\", \"Noto Serif CJK SC\", \"Songti SC\", \"SimSun\", \"Times New Roman\", serif",
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight
            }}
          />
        </div>
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

          <div className="w-[1px] h-3 bg-stone-200 dark:bg-stone-800" />

          {/* Time Machine Quick Button in Bottom Status Bar */}
          <button
            onClick={() => setIsSnapshotOpen(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/80 transition-colors cursor-pointer"
            title="查看与回滚历史修改版本（本地时光机防丢稿）"
          >
            <History className="w-3 h-3 text-stone-400 dark:text-stone-500" />
            <span>时光机</span>
          </button>
        </div>

        <div className="text-stone-400 dark:text-stone-500 text-[10px]">
          {isStoryDoc ? "本作设定文档" : "纯文本手稿"}
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
