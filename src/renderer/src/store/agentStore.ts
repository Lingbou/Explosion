import { create } from 'zustand'
import { LLMMessage, LLMStreamChunk } from '../../../shared/types/llm'
import { stripMarkdownMarks } from '../lib/typography'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface AgentState {
  messages: AgentMessage[]
  isStreaming: boolean
  currentRequestId: string | null
  currentDelta: string
  clearMessages: () => void
  sendMessage: (userPrompt: string, manuscriptContext: string) => Promise<void>
  abortStreaming: () => void
}

const SYSTEM_PROMPT = `你是一位严谨、克制且具备深厚文学审美的中文小说写作助手。
你的协作原则：
1. 【绝对零 Markdown 污染】：输出内容严格保持纯文本，严禁输出任何 Markdown 格式标记（绝对不使用 #、**、*、>、-、反引号或代码块）。输出小说段落时，段首保留全角双空格缩进。
2. 【文学呼吸感与克制】：注重白描、具体物理动作细节与环境微氛围，拒绝空洞煽情、心理说明与工业网文套话。
3. 【务实直接】：直接给出针对作者问题的段落生成、描写扩写或具体修改建议，不附带任何废话客套。`

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentRequestId: null,
  currentDelta: '',

  clearMessages: () => set({ messages: [] }),

  sendMessage: async (userPrompt: string, manuscriptContext: string) => {
    const { messages, isStreaming } = get()
    if (isStreaming || !userPrompt.trim()) return

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: userPrompt.trim(),
      timestamp: Date.now()
    }

    set({
      messages: [...messages, userMessage],
      isStreaming: true,
      currentDelta: ''
    })

    const llmMessages: LLMMessage[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      }
    ]

    if (manuscriptContext?.trim()) {
      llmMessages.push({
        role: 'user',
        content: `【当前手稿参考内容】：\n${manuscriptContext.slice(0, 4000)}\n\n【创作要求或修改意见】：\n${userPrompt.trim()}`
      })
    } else {
      llmMessages.push({
        role: 'user',
        content: userPrompt.trim()
      })
    }

    let accumulatedText = ''
    let streamHandle: { requestId: string; unsubscribe: () => void } | null = null

    try {
      streamHandle = window.api.generateStream(
        {
          messages: llmMessages,
          temperature: 0.7
        },
        (chunk: LLMStreamChunk) => {
          if (chunk.error) {
            set({ isStreaming: false, currentRequestId: null })
            const errorMsg: AgentMessage = {
              id: `msg-${Date.now()}-err`,
              role: 'assistant',
              content: `[请求失败]: ${chunk.error}`,
              timestamp: Date.now()
            }
            set((state) => ({ messages: [...state.messages, errorMsg] }))
            streamHandle?.unsubscribe()
            return
          }

          if (chunk.delta) {
            accumulatedText += chunk.delta
            set({ currentDelta: accumulatedText })
          }

          if (chunk.done) {
            set({
              isStreaming: false,
              currentRequestId: null,
              currentDelta: ''
            })

            const cleanContent = stripMarkdownMarks(accumulatedText)
            const assistantMsg: AgentMessage = {
              id: `msg-${Date.now()}-a`,
              role: 'assistant',
              content: cleanContent,
              timestamp: Date.now()
            }

            set((state) => ({ messages: [...state.messages, assistantMsg] }))
            streamHandle?.unsubscribe()
          }
        }
      )

      set({ currentRequestId: streamHandle.requestId })
    } catch (err) {
      set({ isStreaming: false, currentRequestId: null })
      const errorMsg: AgentMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `[调用异常]: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now()
      }
      set((state) => ({ messages: [...state.messages, errorMsg] }))
      streamHandle?.unsubscribe()
    }
  },

  abortStreaming: () => {
    const { currentRequestId, isStreaming } = get()
    if (isStreaming && currentRequestId) {
      window.api.abortStream(currentRequestId).catch(() => {})
      set({ isStreaming: false, currentRequestId: null })
    }
  }
}))
