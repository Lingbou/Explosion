import React, { useState, useRef, useEffect } from 'react'
import {
  Send,
  Square,
  Sparkles,
  Bot,
  User,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  PlusCircle,
  Copy
} from 'lucide-react'
import { SubAgentRole, useAgentStore } from '../../store/agentStore'
import { useConfigStore } from '../../store/configStore'
import { useWorkspaceStore } from '../../store/workspaceStore'

const SUB_AGENTS: Array<{ id: SubAgentRole; label: string; desc: string }> = [
  { id: 'draft', label: '创作主笔', desc: '推进叙事与场景扩写' },
  { id: 'style', label: '文风审校', desc: '文学呼吸感与白描质感' },
  { id: 'consistency', label: '设定核对', desc: '伏笔与吃书核对' },
  { id: 'de_ai', label: '去 AI 味', desc: '击碎工业糖精套话' }
]

const QUICK_PROMPTS: Record<SubAgentRole, string[]> = {
  draft: ['细化当前场景的环境白描与微氛围', '以克制舒缓的语调推进下半段对话', '补充少年时期的细微心理动作'],
  style: ['评审当前段落的文学呼吸感与留白', '指出是否存在假大空的高潮煽情', '给出冷峻白描风格的改写示范'],
  consistency: ['核对本章人物动机与前后逻辑硬伤', '排查随身物品与伤势状态是否矛盾', '梳理潜在的未填伏笔'],
  de_ai: ['精准抓取文中的 AI 味黑名单陈词滥调', '将心理说明改写为具象物理动作', '消除空洞抽象的排比与抒情']
}

export const RightPanel: React.FC = () => {
  const {
    activeSubAgent,
    setActiveSubAgent,
    messages,
    isStreaming,
    currentDelta,
    currentThinking,
    sendMessage,
    abortStreaming,
    clearMessages
  } = useAgentStore()

  const { config, isConfigured } = useConfigStore()
  const { chapters, activeChapterId, insertText } = useWorkspaceStore()

  const [inputPrompt, setInputPrompt] = useState('')
  const [showThinking, setShowThinking] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const activeChapter = chapters.find((ch) => ch.id === activeChapterId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentDelta, currentThinking])

  const handleSend = () => {
    if (!inputPrompt.trim() || isStreaming) return
    const prompt = inputPrompt
    setInputPrompt('')
    sendMessage(prompt, activeChapter?.content || '')
  }

  const handleQuickPrompt = (qp: string) => {
    if (isStreaming) return
    sendMessage(qp, activeChapter?.content || '')
  }

  const handleCopyText = async (id: string, text: string) => {
    const ok = await window.api.copyText(text)
    if (ok) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }

  return (
    <aside className="w-88 border-l border-stone-800/80 bg-stone-950 flex flex-col justify-between select-none">
      {/* Top Bar: Active Model & AnySearch Status */}
      <div className="p-3 border-b border-stone-800/80 bg-stone-950/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-stone-300 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate max-w-[170px]">
              {isConfigured ? config.provider.activeModel : '未配置主力模型'}
            </span>
          </div>

          {/* AnySearch Status Pill */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-[10px] text-stone-400 font-mono">
            <Search className="w-2.5 h-2.5 text-emerald-400" />
            <span>AnySearch 原生直连</span>
          </div>
        </div>

        {/* Sub-Agent Tabs */}
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-stone-900 border border-stone-800/80">
          {SUB_AGENTS.map((sa) => (
            <button
              key={sa.id}
              onClick={() => setActiveSubAgent(sa.id)}
              className={`py-1 rounded text-[11px] font-medium transition-all ${
                activeSubAgent === sa.id
                  ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
              title={sa.desc}
            >
              {sa.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Stream Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 scrollbar-thin">
        {messages.length === 0 && !isStreaming && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-stone-500 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-amber-500/80">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-400">
                {SUB_AGENTS.find((s) => s.id === activeSubAgent)?.label} 就绪
              </div>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                主笔与并发审校 Agent 共享唯一的顶尖主力模型。可直接提问或使用下方快捷指令。
              </p>
            </div>
          </div>
        )}

        {/* Render Past Messages */}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
              {msg.role === 'user' ? (
                <>
                  <User className="w-3 h-3 text-stone-400" />
                  <span>创作指令</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400/90 font-medium">
                    {SUB_AGENTS.find((s) => s.id === msg.subAgent)?.label || 'Agent'}
                  </span>
                </>
              )}
            </div>

            {/* Reasoning if present */}
            {msg.reasoning && (
              <details className="rounded-lg bg-stone-900/50 border border-stone-800/70 p-2 text-[11px] text-stone-400">
                <summary className="cursor-pointer text-stone-500 flex items-center gap-1 hover:text-stone-300">
                  <BrainCircuit className="w-3 h-3 text-amber-400/70" />
                  <span>深度构思 / 审校思路</span>
                </summary>
                <div className="mt-1.5 pt-1.5 border-t border-stone-800/60 font-mono whitespace-pre-wrap text-[10px] leading-relaxed text-stone-400">
                  {msg.reasoning}
                </div>
              </details>
            )}

            {/* Message Bubble */}
            <div
              className={`p-3 rounded-xl border leading-relaxed select-text ${
                msg.role === 'user'
                  ? 'bg-stone-900/90 border-stone-800 text-stone-200'
                  : 'bg-stone-900/40 border-stone-800/80 text-stone-100 font-serif'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.role === 'assistant' && (
                <div className="mt-2.5 pt-2 border-t border-stone-800/60 flex items-center justify-end gap-2 text-[10px] font-sans">
                  <button
                    onClick={() => handleCopyText(msg.id, msg.content)}
                    className="flex items-center gap-1 text-stone-400 hover:text-stone-200 transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === msg.id ? '已复制' : '复制建议'}</span>
                  </button>
                  <button
                    onClick={() => insertText(msg.content)}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>采纳至手稿</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Streaming Indicator */}
        {isStreaming && (
          <div className="space-y-1.5 text-xs animate-in fade-in duration-100">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
              <Bot className="w-3 h-3 animate-pulse" />
              <span>{SUB_AGENTS.find((s) => s.id === activeSubAgent)?.label} 正在思考与生成...</span>
            </div>

            {/* Live Thinking */}
            {currentThinking && (
              <div className="rounded-lg bg-stone-900/60 border border-stone-800 p-2 text-[11px] text-stone-400">
                <div
                  onClick={() => setShowThinking(!showThinking)}
                  className="flex items-center justify-between cursor-pointer text-stone-500 hover:text-stone-300"
                >
                  <span className="flex items-center gap-1">
                    <BrainCircuit className="w-3 h-3 text-amber-400 animate-spin" />
                    <span>推理心流中...</span>
                  </span>
                  {showThinking ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
                {showThinking && (
                  <div className="mt-1.5 pt-1.5 border-t border-stone-800 font-mono whitespace-pre-wrap text-[10px] text-stone-400 max-h-36 overflow-y-auto">
                    {currentThinking}
                  </div>
                )}
              </div>
            )}

            {/* Live Delta */}
            {currentDelta && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-stone-900/60 text-stone-100 font-serif leading-relaxed whitespace-pre-wrap">
                {currentDelta}
                <span className="inline-block w-1.5 h-3 ml-1 bg-amber-400 animate-pulse" />
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Area: Quick Chips & Input Bar */}
      <div className="p-3 border-t border-stone-800/80 bg-stone-950/80 space-y-2">
        {/* Quick Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_PROMPTS[activeSubAgent].map((qp, i) => (
            <button
              key={i}
              onClick={() => handleQuickPrompt(qp)}
              disabled={isStreaming}
              className="shrink-0 px-2.5 py-1 rounded-full bg-stone-900 border border-stone-800 text-[10px] text-stone-400 hover:text-amber-300 hover:border-amber-500/40 transition-colors disabled:opacity-50"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="relative flex items-end bg-stone-900 border border-stone-800 rounded-xl p-1.5 focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/60 transition-all">
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={`向${SUB_AGENTS.find((s) => s.id === activeSubAgent)?.label}发送创作指令 (Enter发送)...`}
            rows={2}
            className="w-full bg-transparent resize-none border-none focus:outline-none text-xs text-stone-200 placeholder-stone-600 px-2 py-1 leading-relaxed max-h-24 scrollbar-thin"
          />

          <div className="flex items-center gap-1 ml-1 pb-1">
            {isStreaming ? (
              <button
                type="button"
                onClick={abortStreaming}
                className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                title="中断生成"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputPrompt.trim()}
                className="p-1.5 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:hover:bg-amber-500"
                title="发送"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {messages.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={clearMessages}
              className="text-[10px] text-stone-600 hover:text-stone-400 transition-colors"
            >
              清空对话历史
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
