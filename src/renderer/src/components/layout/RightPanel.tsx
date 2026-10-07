import React, { useState, useRef, useEffect } from 'react'
import {
  Send,
  Square,
  Check,
  PlusCircle,
  Copy
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { useConfigStore } from '../../store/configStore'
import { useWorkspaceStore } from '../../store/workspaceStore'

interface RightPanelProps {
  width: number
}

export const RightPanel: React.FC<RightPanelProps> = ({ width }) => {
  const {
    messages,
    isStreaming,
    currentDelta,
    sendMessage,
    abortStreaming,
    clearMessages
  } = useAgentStore()

  const { config, isConfigured } = useConfigStore()
  const { chapters, activeChapterId, insertText } = useWorkspaceStore()

  const [inputPrompt, setInputPrompt] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const activeChapter = chapters.find((ch) => ch.id === activeChapterId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentDelta])

  const handleSend = () => {
    if (!inputPrompt.trim() || isStreaming) return
    const prompt = inputPrompt
    setInputPrompt('')
    sendMessage(prompt, activeChapter?.content || '')
  }

  const handleCopyText = async (id: string, text: string) => {
    const ok = await window.api.copyText(text)
    if (ok) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }

  return (
    <aside
      style={{ width: `${width}px` }}
      className="border-l border-stone-200 bg-white flex flex-col justify-between select-none shrink-0 overflow-hidden"
    >
      {/* Top Header: Quiet Assistant Label & Model */}
      <div className="h-10 px-4 border-b border-stone-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-stone-800">写作助手</span>
          <span className="text-[10px] font-mono text-stone-400 truncate max-w-[140px]">
            {isConfigured ? config.provider.activeModel : '未就绪'}
          </span>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-[10px] text-stone-400 hover:text-stone-700 transition-colors"
          >
            清空
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
        {messages.length === 0 && !isStreaming && (
          <div className="h-full flex items-center justify-center text-center p-6 text-stone-400 text-xs leading-relaxed">
            输入构思指令、润色要求或情节推进，助手将提供纯文本参考。
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-1 text-xs">
            <div className="text-[10px] text-stone-400 font-medium">
              {msg.role === 'user' ? '作者' : '助手'}
            </div>

            <div
              className={`p-3 rounded-lg leading-relaxed select-text ${
                msg.role === 'user'
                  ? 'bg-stone-100 text-stone-800'
                  : 'bg-white border border-stone-200 text-stone-900 font-serif shadow-2xs'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.role === 'assistant' && (
                <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-end gap-2 text-[11px] font-sans">
                  <button
                    onClick={() => handleCopyText(msg.id, msg.content)}
                    className="flex items-center gap-1 text-stone-500 hover:text-stone-800 transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === msg.id ? '已复制' : '复制'}</span>
                  </button>
                  <button
                    onClick={() => insertText(msg.content)}
                    className="flex items-center gap-1 text-stone-800 hover:text-stone-950 font-medium transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>采纳插入</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Streaming Delta */}
        {isStreaming && (
          <div className="space-y-1 text-xs">
            <div className="text-[10px] text-stone-400 font-medium">助手思考中</div>
            <div className="p-3 rounded-lg border border-stone-200 bg-stone-50/50 text-stone-900 font-serif leading-relaxed whitespace-pre-wrap">
              {currentDelta || '...'}
              <span className="inline-block w-1.5 h-3 ml-1 bg-stone-700 animate-pulse" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-stone-200 bg-white">
        <div className="relative flex items-end bg-stone-50 border border-stone-200 rounded-lg p-1.5 focus-within:border-stone-400 focus-within:bg-white transition-all">
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="输入创作指令 (Enter 发送)..."
            rows={2}
            className="w-full bg-transparent resize-none border-none focus:outline-none text-xs text-stone-900 placeholder-stone-400 px-2 py-1 leading-relaxed max-h-24 scrollbar-thin"
          />

          <div className="flex items-center gap-1 ml-1 pb-1">
            {isStreaming ? (
              <button
                type="button"
                onClick={abortStreaming}
                className="p-1.5 rounded-md bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors"
                title="中断"
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
