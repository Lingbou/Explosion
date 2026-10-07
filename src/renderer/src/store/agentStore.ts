import { create } from 'zustand'
import { LLMMessage, LLMStreamChunk } from '../../../shared/types/llm'
import { stripMarkdownMarks } from '../lib/typography'

export type SubAgentRole = 'draft' | 'style' | 'consistency' | 'de_ai'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  subAgent: SubAgentRole
  timestamp: number
}

interface AgentState {
  activeSubAgent: SubAgentRole
  messages: AgentMessage[]
  isStreaming: boolean
  currentRequestId: string | null
  currentThinking: string
  currentDelta: string
  setActiveSubAgent: (role: SubAgentRole) => void
  clearMessages: () => void
  sendMessage: (userPrompt: string, manuscriptContext: string) => Promise<void>
  abortStreaming: () => void
}

const SUB_AGENT_CONFIGS: Record<
  SubAgentRole,
  { name: string; title: string; systemPrompt: string }
> = {
  draft: {
    name: '创作主笔',
    title: '叙事推进与场景生成',
    systemPrompt: `你是一位殿堂级文学小说主笔助手。你的写作原则：
1. 【零 Markdown 格式污染】：绝对禁止使用任何 Markdown 格式标记（严禁使用 #、**、*、>、-、代码块等），只输出干净的纯文本小说正文或构思建议。
2. 【文学呼吸感与留白】：注重环境白描、市井微细节与感官氛围。严禁通篇高亢，避免把每个段落写成大招轰击的名场面；在平缓铺垫、日常交流、暗流压抑之间掌握呼吸节律。
3. 【坚决拒绝工业糖精】：避免空洞抒情与心理独白堆砌，通过具象的动作、眼神与环境反衬人物心境。段落首行使用全角双空格缩进。`
  },
  style: {
    name: '文风审校',
    title: '语言质感与文学呼吸感评审',
    systemPrompt: `你是一位挑剔严苛的文学出版主编（文风审校 Agent）。你的审查职责：
1. 【零 Markdown 标记】：输出绝对不带任何 Markdown 标记（不使用 #、**、-），只使用纯中文段落与序号描述。
2. 【呼吸感诊断】：指出当前文本是否过于紧绷或过于松散，是否存在“通篇堆砌形容词”、“动词密度失衡”或“假大空的高潮煽情”。
3. 【改写示范】：指出问题后，给出一段克制、冷峻或富有白描质感的纯文本改写示范。`
  },
  consistency: {
    name: '设定核对',
    title: '伏笔、人物逻辑与吃书核对',
    systemPrompt: `你是一位专注于小说情节逻辑与世界观严密性的设定审查员。你的审查职责：
1. 【零 Markdown 标记】：只输出纯文本，禁止一切 Markdown 符号。
2. 【吃书排查】：核对当前段落中人物的动机、性格惯性、随身物品、伤势状态以及所处环境是否存在前后矛盾或逻辑硬伤。
3. 【修补建议】：提供清晰、合理的设定修补建议。`
  },
  de_ai: {
    name: '去 AI 味门禁',
    title: '套话排查与工业网文去油',
    systemPrompt: `你是一位反 AI 写作套话的语言侦探。你的任务：
1. 【零 Markdown 标记】：只输出纯文本，禁止一切 Markdown 符号。
2. 【黑名单套话抓取】：精准锁定并抓出文本中常见的“AI 味”油腻表达，如“不由得”、“心中暗自”、“宛如断线的风筝”、“倒吸一口凉气”、“仿佛连空气都凝固了”等陈词滥调。
3. 【动作化重写（Show, Don't Tell）】：将抽象的心理说明替换为具体的生理反应、微表情与物理动作。`
  }
}

export const useAgentStore = create<AgentState>((set, get) => ({
  activeSubAgent: 'draft',
  messages: [],
  isStreaming: false,
  currentRequestId: null,
  currentThinking: '',
  currentDelta: '',

  setActiveSubAgent: (role: SubAgentRole) => set({ activeSubAgent: role }),

  clearMessages: () => set({ messages: [] }),

  sendMessage: async (userPrompt: string, manuscriptContext: string) => {
    const { activeSubAgent, messages, isStreaming } = get()
    if (isStreaming || !userPrompt.trim()) return

    const subAgentMeta = SUB_AGENT_CONFIGS[activeSubAgent]

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: userPrompt.trim(),
      subAgent: activeSubAgent,
      timestamp: Date.now()
    }

    set({
      messages: [...messages, userMessage],
      isStreaming: true,
      currentThinking: '',
      currentDelta: ''
    })

    // Construct prompt with context
    const llmMessages: LLMMessage[] = [
      {
        role: 'system',
        content: subAgentMeta.systemPrompt
      }
    ]

    if (manuscriptContext?.trim()) {
      llmMessages.push({
        role: 'user',
        content: `【当前章节参考正文手稿片段】：\n${manuscriptContext.slice(0, 4000)}\n\n【我的创作指令/审校需求】：\n${userPrompt.trim()}`
      })
    } else {
      llmMessages.push({
        role: 'user',
        content: userPrompt.trim()
      })
    }

    let accumulatedText = ''
    let accumulatedThinking = ''
    let streamHandle: { requestId: string; unsubscribe: () => void } | null = null

    try {
      streamHandle = window.api.generateStream(
        {
          messages: llmMessages,
          temperature: activeSubAgent === 'draft' ? 0.8 : 0.4
        },
        (chunk: LLMStreamChunk) => {
          if (chunk.error) {
            set({ isStreaming: false })
            const errorMsg: AgentMessage = {
              id: `msg-${Date.now()}-err`,
              role: 'assistant',
              content: `[执行异常]: ${chunk.error}`,
              subAgent: activeSubAgent,
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

          if (chunk.reasoningDelta) {
            accumulatedThinking += chunk.reasoningDelta
            set({ currentThinking: accumulatedThinking })
          }

          if (chunk.done) {
            set({
              isStreaming: false,
              currentRequestId: null,
              currentDelta: '',
              currentThinking: ''
            })

            const cleanContent = stripMarkdownMarks(accumulatedText)
            const assistantMsg: AgentMessage = {
              id: `msg-${Date.now()}-a`,
              role: 'assistant',
              content: cleanContent,
              reasoning: accumulatedThinking || undefined,
              subAgent: activeSubAgent,
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
        content: `[调用错误]: ${err instanceof Error ? err.message : String(err)}`,
        subAgent: activeSubAgent,
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
