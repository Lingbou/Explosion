import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Settings,
  Send,
  Square,
  Terminal,
  Search,
  Globe,
  FilePenLine,
  BookOpen,
  FolderTree,
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  MessageSquare,
  Trash2
} from 'lucide-react'
import { useAgentStore, AgentTraceStep } from '../../store/agentStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useConfigStore } from '../../store/configStore'
import { useLibraryStore } from '../../store/libraryStore'
import { stripMarkdownMarks } from '../../lib/typography'

interface RightPanelProps {
  width: number
}

export function cleanVolumeName(filename: string, bookName?: string): string {
  let name = filename.replace(/\.txt$/i, '').trim()
  if (bookName) {
    const cleanB = bookName.replace(/[《》]/g, '').trim()
    const patterns = [
      new RegExp(`^《?${cleanB}》?[_\\s-]+`, 'i'),
      new RegExp(`^《?${bookName}》?[_\\s-]+`, 'i')
    ]
    for (const pat of patterns) {
      name = name.replace(pat, '')
    }
  }
  return name.trim() || filename.replace(/\.txt$/i, '')
}

function getToolMeta(toolName: string) {
  let normalized = (toolName || '').trim()

  // If toolName has JSON or braces, resolve intent
  if (normalized.includes('{') || normalized.startsWith('{')) {
    if (normalized.includes('command')) normalized = 'exec_command'
    else if (normalized.includes('old_str')) normalized = 'edit_file'
    else if (normalized.includes('content') && normalized.includes('path')) normalized = 'write_file'
    else if (normalized.includes('query') && normalized.includes('book')) normalized = 'search_library'
    else if (normalized.includes('query')) normalized = 'web_search'
    else if (normalized.includes('url')) normalized = 'web_extract'
    else if (normalized.includes('path')) normalized = 'read_file'
    else normalized = 'read_file'
  }

  // Strip standard prefixes
  if (normalized.startsWith('functions.')) normalized = normalized.slice(10)
  if (normalized.startsWith('tools.')) normalized = normalized.slice(6)
  if (normalized.startsWith('default_api:')) normalized = normalized.slice(12)

  switch (normalized) {
    case 'search_library':
      return {
        label: '资料库 Hybrid RAG 检索',
        color: 'text-amber-800 bg-amber-50 border-amber-200',
        icon: Search
      }
    case 'exec_command':
      return {
        label: '执行终端命令',
        color: 'text-purple-600 bg-purple-50 border-purple-200',
        icon: Terminal
      }
    case 'web_search':
      return {
        label: 'AnySearch 联网搜索',
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        icon: Globe
      }
    case 'web_extract':
      return {
        label: '页面正文抓取',
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
        icon: Search
      }
    case 'write_file':
      return {
        label: '直接改写手稿/文件',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        icon: FilePenLine
      }
    case 'edit_file':
      return {
        label: '局部精准替换',
        color: 'text-teal-700 bg-teal-50 border-teal-200',
        icon: FilePenLine
      }
    case 'read_file':
      return {
        label: '读取磁盘文件',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        icon: BookOpen
      }
    case 'list_dir':
      return {
        label: '检索目录结构',
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
        icon: FolderTree
      }
    default:
      return {
        label: '读取与操作文件',
        color: 'text-stone-600 bg-stone-50 border-stone-200',
        icon: FileText
      }
  }
}

function formatTraceArgs(toolName: string, args: Record<string, unknown>): string {
  if (toolName === 'search_library' && args.query) {
    return args.book_name ? `《${args.book_name}》: "${String(args.query)}"` : `"${String(args.query)}"`
  }
  if (args && args.path) {
    return String(args.path)
  }
  if (toolName === 'exec_command' && args.command) {
    return String(args.command)
  }
  if (toolName === 'web_search' && args.query) {
    return `"${String(args.query)}"`
  }
  if (toolName === 'web_extract' && args.url) {
    return String(args.url)
  }
  if (toolName === 'list_dir') {
    return String(args.path || '默认工程与资料库')
  }
  if (args && args.command) {
    return String(args.command)
  }
  if (args && args.query) {
    return `"${String(args.query)}"`
  }
  return ''
}

const TraceCard: React.FC<{ trace: AgentTraceStep }> = ({ trace }) => {
  const [isOpen, setIsOpen] = useState(false)
  const meta = getToolMeta(trace.toolName)
  const Icon = meta.icon

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-2xs text-[11px] font-sans">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-stone-50 transition-colors select-none"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`p-1 rounded border ${meta.color} shrink-0`}>
            <Icon className="w-3 h-3" />
          </span>
          <span className="font-semibold text-stone-800 shrink-0">{meta.label}</span>
          <span className="text-stone-400 font-mono text-[10px] truncate max-w-[160px]">
            {formatTraceArgs(trace.toolName, trace.args)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {trace.status === 'running' && (
            <span className="flex items-center gap-1 text-amber-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px]">执行中</span>
            </span>
          )}
          {trace.status === 'success' && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />
              {trace.durationMs !== undefined && (
                <span className="text-[10px] font-mono text-stone-400">{trace.durationMs}ms</span>
              )}
            </span>
          )}
          {trace.status === 'error' && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span className="text-[10px]">失败</span>
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-stone-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-stone-400" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-stone-100 bg-stone-50/70 p-2 space-y-1.5 text-[10px] font-mono">
          <div>
            <span className="text-stone-400 block mb-0.5">参数输入 (Args):</span>
            <pre className="p-1.5 rounded bg-white border border-stone-200 overflow-x-auto whitespace-pre-wrap text-stone-800 max-h-32">
              {JSON.stringify(trace.args, null, 2)}
            </pre>
          </div>

          <div>
            <span className="text-stone-400 block mb-0.5">执行反馈 (Output):</span>
            <pre className="p-1.5 rounded bg-white border border-stone-200 overflow-x-auto whitespace-pre-wrap text-stone-800 max-h-48">
              {trace.result || trace.error || '(无返回内容)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export const RightPanel: React.FC<RightPanelProps> = ({ width }) => {
  const {
    sessions,
    activeSessionId,
    isRunning,
    currentThinking,
    currentDelta,
    currentTraces,
    sendTask,
    abortTask,
    createSession,
    switchSession,
    deleteSession,
    clearMessages
  } = useAgentStore()

  const { projectPath, chapters, activeChapterId } = useWorkspaceStore()
  const { config, isConfigured, setIsSettingsOpen } = useConfigStore()
  const { books, fetchBooks } = useLibraryStore()

  const [inputPrompt, setInputPrompt] = useState('')
  const [showThinkingMap, setShowThinkingMap] = useState<Record<string, boolean>>({})
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false)

  // @ Mention Popover states
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeChapter = chapters.find((ch) => ch.id === activeChapterId)

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0]
  const messages = currentSession?.messages || []

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentDelta, currentThinking, currentTraces])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsSessionDropdownOpen(false)
      }
    }
    if (isSessionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSessionDropdownOpen])

  // Clean candidate items for @ Mention Popover (Zero .txt extension, zero duplicate book prefixes)
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return []
    const items: Array<{ id: string; label: string; insertText: string; type: 'book' | 'volume' }> = []
    const bookNames = new Set<string>()

    for (const b of books) {
      if (b.bookName && !bookNames.has(b.bookName)) {
        bookNames.add(b.bookName)
        items.push({
          id: `book-${b.bookName}`,
          label: `《${b.bookName}》 (全书)`,
          insertText: `@${b.bookName} `,
          type: 'book'
        })
      }

      const cleanVol = cleanVolumeName(b.filename, b.bookName)
      const label = b.bookName ? `《${b.bookName}》· ${cleanVol}` : cleanVol
      const insert = b.bookName ? `@${b.bookName}/${cleanVol} ` : `@${cleanVol} `
      items.push({
        id: `vol-${b.path}`,
        label,
        insertText: insert,
        type: 'volume'
      })
    }

    const q = mentionQuery.toLowerCase()
    return items.filter(
      (item) => item.label.toLowerCase().includes(q) || item.insertText.toLowerCase().includes(q)
    )
  }, [mentionQuery, books])

  const insertMention = (insertText: string) => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const val = inputPrompt
    const cursorPos = textarea.selectionStart || val.length
    const textBeforeCursor = val.slice(0, cursorPos)
    const textAfterCursor = val.slice(cursorPos)

    const match = textBeforeCursor.match(/@([^\s@]*)$/)
    if (match) {
      const atStart = textBeforeCursor.length - match[0].length
      const newVal = textBeforeCursor.slice(0, atStart) + insertText + textAfterCursor
      setInputPrompt(newVal)
      setMentionQuery(null)

      setTimeout(() => {
        textarea.focus()
        const newCursor = atStart + insertText.length
        textarea.setSelectionRange(newCursor, newCursor)
      }, 10)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputPrompt(val)

    const cursorPos = e.target.selectionStart || val.length
    const textBeforeCursor = val.slice(0, cursorPos)
    const match = textBeforeCursor.match(/@([^\s@]*)$/)

    if (match) {
      setMentionQuery(match[1])
      setMentionSelectedIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionSelectedIndex((prev) => (prev + 1) % mentionCandidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionSelectedIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const target = mentionCandidates[mentionSelectedIndex] || mentionCandidates[0]
        if (target) {
          insertMention(target.insertText)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const textToSend = inputPrompt.trim()
    if (!textToSend || isRunning) return

    setInputPrompt('')
    setMentionQuery(null)
    sendTask(textToSend, {
      projectPath,
      activeChapterFilename: activeChapter?.filename,
      manuscriptContext: activeChapter?.content
    })
  }

  return (
    <aside
      style={{ width: `${width}px` }}
      className="border-l border-stone-200 bg-white flex flex-col justify-between select-none shrink-0 overflow-hidden relative"
    >
      {/* Top Header: Column-Integrated Session Management, Model Pill & Global Settings */}
      <div className="h-11 px-3 border-b border-stone-200 flex items-center justify-between bg-white shrink-0 relative z-30">
        {/* Left: Current Session Title & History Dropdown Trigger */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-stone-100 transition-colors text-left max-w-[130px]"
            title="点击切换或查看历史会话"
          >
            <span className="font-semibold text-xs text-stone-800 truncate">
              {currentSession?.title || '新会话'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          </button>

          {/* Sessions Dropdown Menu */}
          {isSessionDropdownOpen && (
            <div className="absolute top-8 left-0 w-64 bg-white border border-stone-200 rounded-lg shadow-xl py-1.5 z-50 text-xs font-sans animate-in fade-in duration-100">
              <div className="px-3 py-1.5 text-[10px] text-stone-400 font-semibold uppercase tracking-wider border-b border-stone-100">
                <span>历史会话记录 ({sessions.length})</span>
              </div>

              <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
                {sessions.map((sess) => {
                  const isActive = sess.id === activeSessionId
                  return (
                    <div
                      key={sess.id}
                      onClick={() => {
                        switchSession(sess.id)
                        setIsSessionDropdownOpen(false)
                      }}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-stone-100 text-stone-900 font-medium'
                          : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 mr-1">
                        <MessageSquare className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate text-xs">{sess.title}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-stone-300 font-mono">
                          {sess.messages.length}条
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSession(sess.id)
                          }}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-stone-200/60 transition-colors shrink-0"
                          title="删除此会话"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Header Controls: New Session, Active Model Pill, Global Settings, Clear */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              createSession()
              setIsSessionDropdownOpen(false)
            }}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors text-xs font-medium shrink-0"
            title="开启全新会话"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建</span>
          </button>

          {/* Active Model Pill (Full model name, zero premature truncation) */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 hover:border-stone-300 transition-all shrink-0 whitespace-nowrap"
            title="点击配置主力模型与服务商"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="whitespace-nowrap">
              {isConfigured ? config.provider.activeModel || '未选模型' : '未配置'}
            </span>
          </button>

          {/* Global Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0"
            title="全局设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-[10px] text-stone-400 hover:text-stone-700 transition-colors px-1 py-0.5 shrink-0 ml-0.5"
              title="清空当前会话消息"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin">
        {messages.length === 0 && !isRunning && (
          <div className="h-full flex items-center justify-center text-center p-6 text-stone-400/80 text-xs select-none">
            在此输入指令或向助手提问，输入 @ 可引用参考资料...
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-1.5 text-xs">
            <div className="text-[10px] text-stone-400 font-medium flex items-center justify-between">
              <span className={msg.role === 'assistant' ? 'font-semibold text-stone-700' : ''}>
                {msg.role === 'user' ? '作者指令' : 'Explosion'}
              </span>
              <span className="text-[9px] text-stone-300 font-mono">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {msg.role === 'user' ? (
              <div className="p-2.5 rounded-lg bg-stone-100 text-stone-800 leading-relaxed select-text whitespace-pre-wrap">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Thinking Fold */}
                {msg.thinking && (
                  <div className="border border-stone-200 rounded-md bg-stone-50/50 overflow-hidden text-[11px]">
                    <button
                      onClick={() =>
                        setShowThinkingMap((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                      }
                      className="w-full px-2.5 py-1.5 flex items-center justify-between text-stone-500 hover:text-stone-800 text-[10px]"
                    >
                      <span>思考过程 (Reasoning)</span>
                      {showThinkingMap[msg.id] ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>
                    {showThinkingMap[msg.id] && (
                      <div className="p-2.5 border-t border-stone-200 bg-white font-mono text-[10px] text-stone-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {msg.thinking}
                      </div>
                    )}
                  </div>
                )}

                {/* Tool Traces */}
                {msg.traces && msg.traces.length > 0 && (
                  <div className="space-y-1.5">
                    {msg.traces.map((trace) => (
                      <TraceCard key={trace.id} trace={trace} />
                    ))}
                  </div>
                )}

                {/* Final Content: Clean Pure Text with Zero Markdown Pollution */}
                <div className="p-3 rounded-lg border border-stone-200 bg-white text-stone-900 font-serif leading-relaxed select-text shadow-2xs whitespace-pre-wrap">
                  {stripMarkdownMarks(msg.content)}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Live Running State */}
        {isRunning && (
          <div className="space-y-2 text-xs">
            <div className="text-[10px] text-stone-500 font-medium flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-stone-600" />
              <span>Explosion 执行中...</span>
            </div>

            {/* Live Thinking */}
            {currentThinking && (
              <div className="border border-stone-200 rounded-md bg-stone-50/70 p-2 font-mono text-[10px] text-stone-600 whitespace-pre-wrap max-h-36 overflow-y-auto">
                <span className="text-stone-400 block mb-1">思考中:</span>
                {currentThinking}
              </div>
            )}

            {/* Live Traces */}
            {currentTraces.length > 0 && (
              <div className="space-y-1.5">
                {currentTraces.map((trace) => (
                  <TraceCard key={trace.id} trace={trace} />
                ))}
              </div>
            )}

            {/* Live Delta */}
            {currentDelta && (
              <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 text-stone-900 font-serif leading-relaxed whitespace-pre-wrap">
                {stripMarkdownMarks(currentDelta)}
                <span className="inline-block w-1.5 h-3 ml-1 bg-stone-700 animate-pulse" />
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area (Clean & Pure with @Mention Popover) */}
      <div className="p-3 border-t border-stone-200 bg-white shrink-0 relative">
        {/* @ Mention Popover Menu */}
        {mentionQuery !== null && mentionCandidates.length > 0 && (
          <div className="absolute bottom-full mb-1.5 left-3 right-3 max-h-48 bg-white border border-stone-200 rounded-lg shadow-xl overflow-hidden flex flex-col z-50 text-xs font-sans animate-in fade-in duration-100">
            <div className="px-3 py-1.5 border-b border-stone-100 text-[10px] text-stone-400 font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>引用资料库 (@MENTION)</span>
              <span className="font-mono text-[9px]">↑↓ 选择 · 回车插入</span>
            </div>
            <div className="overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
              {mentionCandidates.map((cand, idx) => {
                const isSelected = idx === mentionSelectedIndex
                return (
                  <div
                    key={cand.id}
                    onClick={() => insertMention(cand.insertText)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-stone-100 text-stone-900 font-medium' : 'text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate text-xs">{cand.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="relative flex items-end bg-stone-50 border border-stone-200 rounded-lg p-1.5 focus-within:border-stone-400 focus-within:bg-white transition-all">
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入指令，输入 @ 可引用参考资料 (Enter 发送)..."
            rows={2}
            className="w-full bg-transparent resize-none border-none focus:outline-none text-xs text-stone-900 placeholder-stone-400 px-2 py-1 leading-relaxed max-h-24 scrollbar-thin"
          />

          <div className="flex items-center gap-1 ml-1 pb-1">
            {isRunning ? (
              <button
                type="button"
                onClick={abortTask}
                className="p-1.5 rounded-md bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors"
                title="终止"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputPrompt.trim()}
                className="p-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-30"
                title="发送"
              >
                <Send className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
