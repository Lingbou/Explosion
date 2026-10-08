import { create } from 'zustand'
import { AgentStreamEvent, AgentTaskOptions } from '../../../shared/types/ipc'

export interface AgentTraceStep {
  id: string
  type: 'tool_call'
  toolName: string
  args: Record<string, unknown>
  result?: string
  error?: string
  durationMs?: number
  status: 'running' | 'success' | 'error'
  timestamp: number
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  traces?: AgentTraceStep[]
  timestamp: number
}

interface AgentState {
  messages: AgentMessage[]
  isRunning: boolean
  currentTaskId: string | null
  currentThinking: string
  currentDelta: string
  currentTraces: AgentTraceStep[]
  clearMessages: () => void
  sendTask: (
    prompt: string,
    contextParams: {
      projectPath?: string | null
      activeChapterFilename?: string | null
      manuscriptContext?: string
    }
  ) => Promise<void>
  abortTask: () => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  isRunning: false,
  currentTaskId: null,
  currentThinking: '',
  currentDelta: '',
  currentTraces: [],

  clearMessages: () => set({ messages: [], currentThinking: '', currentDelta: '', currentTraces: [] }),

  sendTask: async (prompt: string, contextParams) => {
    const { messages, isRunning } = get()
    if (isRunning || !prompt.trim()) return

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: prompt.trim(),
      timestamp: Date.now()
    }

    set({
      messages: [...messages, userMessage],
      isRunning: true,
      currentThinking: '',
      currentDelta: '',
      currentTraces: []
    })

    const taskOptions: AgentTaskOptions = {
      userPrompt: prompt.trim(),
      projectPath: contextParams.projectPath,
      activeChapterFilename: contextParams.activeChapterFilename,
      manuscriptContext: contextParams.manuscriptContext
    }

    let accumulatedDelta = ''
    let accumulatedThinking = ''
    let tracesList: AgentTraceStep[] = []

    try {
      const handle = window.api.agentRunTask(taskOptions, (event: AgentStreamEvent) => {
        if (event.type === 'thinking' && event.thinkingDelta) {
          accumulatedThinking += event.thinkingDelta
          set({ currentThinking: accumulatedThinking })
        } else if (event.type === 'delta' && event.delta) {
          accumulatedDelta += event.delta
          set({ currentDelta: accumulatedDelta })
        } else if (event.type === 'tool_start' && event.toolCall) {
          const newTrace: AgentTraceStep = {
            id: event.toolCall.id,
            type: 'tool_call',
            toolName: event.toolCall.name,
            args: event.toolCall.args || {},
            status: 'running',
            timestamp: Date.now()
          }
          tracesList = [...tracesList, newTrace]
          set({ currentTraces: tracesList })
        } else if (event.type === 'tool_result' && event.toolResult) {
          const res = event.toolResult
          tracesList = tracesList.map((t) =>
            t.id === res.id
              ? {
                  ...t,
                  status: res.error ? 'error' : 'success',
                  result: res.result,
                  error: res.error,
                  durationMs: res.durationMs
                }
              : t
          )
          set({ currentTraces: tracesList })
        } else if (event.type === 'done') {
          const assistantMsg: AgentMessage = {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content: accumulatedDelta || (tracesList.length > 0 ? '已完成所有自主工具调用调度。' : '完成。'),
            thinking: accumulatedThinking || undefined,
            traces: tracesList.length > 0 ? tracesList : undefined,
            timestamp: Date.now()
          }

          set((state) => ({
            messages: [...state.messages, assistantMsg],
            isRunning: false,
            currentTaskId: null,
            currentThinking: '',
            currentDelta: '',
            currentTraces: []
          }))
          handle.unsubscribe()
        } else if (event.type === 'error') {
          const errorMsg: AgentMessage = {
            id: `msg-${Date.now()}-err`,
            role: 'assistant',
            content: `[执行异常]: ${event.error || '任务执行失败'}`,
            traces: tracesList.length > 0 ? tracesList : undefined,
            timestamp: Date.now()
          }

          set((state) => ({
            messages: [...state.messages, errorMsg],
            isRunning: false,
            currentTaskId: null,
            currentThinking: '',
            currentDelta: '',
            currentTraces: []
          }))
          handle.unsubscribe()
        }
      })

      set({ currentTaskId: handle.taskId })
    } catch (err) {
      const errorMsg: AgentMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `[调度异常]: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now()
      }
      set((state) => ({
        messages: [...state.messages, errorMsg],
        isRunning: false,
        currentTaskId: null,
        currentThinking: '',
        currentDelta: '',
        currentTraces: []
      }))
    }
  },

  abortTask: () => {
    const { currentTaskId, isRunning } = get()
    if (isRunning && currentTaskId) {
      window.api.agentAbortTask(currentTaskId).catch(() => {})
      set({
        isRunning: false,
        currentTaskId: null,
        currentThinking: '',
        currentDelta: '',
        currentTraces: []
      })
    }
  }
}))
