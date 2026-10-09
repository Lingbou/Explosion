import { create } from 'zustand'
import { AgentStreamEvent, AgentTaskOptions } from '../../../shared/types/ipc'
import { stripMarkdownMarks } from '../lib/typography'
import { generateSessionTitle } from '../../../shared/utils/session'

export { generateSessionTitle } from '../../../shared/utils/session'

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
  selectedText?: string
  timestamp: number
}

export interface AgentSession {
  id: string
  title: string
  messages: AgentMessage[]
  createdAt: number
  updatedAt: number
}

interface AgentState {
  sessions: AgentSession[]
  activeSessionId: string
  isRunning: boolean
  currentTaskId: string | null
  currentThinking: string
  currentDelta: string
  currentTraces: AgentTraceStep[]

  createSession: () => string
  switchSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  renameSession: (sessionId: string, title: string) => void
  clearMessages: () => void

  sendTask: (
    prompt: string,
    contextParams: {
      projectPath?: string | null
      activeChapterFilename?: string | null
      manuscriptContext?: string
      selectedText?: string | null
    }
  ) => Promise<void>
  abortTask: () => void
}

const STORAGE_KEY_SESSIONS = 'explosion:agent-sessions'
const STORAGE_KEY_ACTIVE_ID = 'explosion:agent-active-session-id'

function loadInitialSessions(): { sessions: AgentSession[]; activeSessionId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS)
    if (raw) {
      const parsed = JSON.parse(raw) as AgentSession[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out legacy empty sessions from storage
        const meaningful = parsed.filter((s) => s.messages && s.messages.length > 0)
        if (meaningful.length > 0) {
          const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID)
          const activeId = savedActiveId && meaningful.some((s) => s.id === savedActiveId)
            ? savedActiveId
            : meaningful[0].id
          return { sessions: meaningful, activeSessionId: activeId }
        }
      }
    }
  } catch {
    // ignore
  }

  const initialSession: AgentSession = {
    id: `session-${Date.now()}`,
    title: '新会话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  return { sessions: [initialSession], activeSessionId: initialSession.id }
}

function saveSessionsToStorage(sessions: AgentSession[], activeId: string): void {
  try {
    // Only persist sessions with messages, plus active session if it's currently selected
    const toSave = sessions.filter((s) => s.messages.length > 0 || s.id === activeId)
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(toSave))
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeId)
  } catch {
    // ignore
  }
}

const initialData = loadInitialSessions()

export const useAgentStore = create<AgentState>((set, get) => ({
  sessions: initialData.sessions,
  activeSessionId: initialData.activeSessionId,
  isRunning: false,
  currentTaskId: null,
  currentThinking: '',
  currentDelta: '',
  currentTraces: [],

  createSession: () => {
    const { sessions, activeSessionId } = get()
    const current = sessions.find((s) => s.id === activeSessionId)

    // Prohibit duplicate empty sessions: if current session has 0 messages, ensure its title resets to '新会话'
    if (current && current.messages.length === 0) {
      if (current.title !== '新会话') {
        const updated = sessions.map((s) => (s.id === current.id ? { ...s, title: '新会话' } : s))
        set({
          sessions: updated,
          activeSessionId: current.id,
          currentThinking: '',
          currentDelta: '',
          currentTraces: []
        })
        saveSessionsToStorage(updated, current.id)
      }
      return current.id
    }

    const newSession: AgentSession = {
      id: `session-${Date.now()}`,
      title: '新会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Clean up any other idle empty sessions from list
    const filteredSessions = sessions.filter((s) => s.messages.length > 0)
    const updatedSessions = [newSession, ...filteredSessions]

    set({
      sessions: updatedSessions,
      activeSessionId: newSession.id,
      currentThinking: '',
      currentDelta: '',
      currentTraces: []
    })
    saveSessionsToStorage(updatedSessions, newSession.id)
    return newSession.id
  },

  switchSession: (sessionId: string) => {
    const { sessions, activeSessionId } = get()
    const target = sessions.find((s) => s.id === sessionId)
    if (!target) return

    // Clean up current active session if it had 0 messages when switching away
    const cleaned = sessions.filter(
      (s) => s.id === sessionId || s.messages.length > 0
    )

    set({
      sessions: cleaned,
      activeSessionId: sessionId,
      currentThinking: '',
      currentDelta: '',
      currentTraces: []
    })
    saveSessionsToStorage(cleaned, sessionId)
  },

  deleteSession: (sessionId: string) => {
    const { sessions, activeSessionId } = get()
    const remaining = sessions.filter((s) => s.id !== sessionId)

    if (remaining.length === 0) {
      const freshSession: AgentSession = {
        id: `session-${Date.now()}`,
        title: '新会话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      set({
        sessions: [freshSession],
        activeSessionId: freshSession.id,
        currentThinking: '',
        currentDelta: '',
        currentTraces: []
      })
      saveSessionsToStorage([freshSession], freshSession.id)
      return
    }

    let nextActiveId = activeSessionId
    if (activeSessionId === sessionId) {
      nextActiveId = remaining[0].id
    }

    set({
      sessions: remaining,
      activeSessionId: nextActiveId,
      currentThinking: '',
      currentDelta: '',
      currentTraces: []
    })
    saveSessionsToStorage(remaining, nextActiveId)
  },

  renameSession: (sessionId: string, title: string) => {
    const updated = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, title: title.trim() || '未命名会话', updatedAt: Date.now() } : s
    )
    set({ sessions: updated })
    saveSessionsToStorage(updated, get().activeSessionId)
  },

  clearMessages: () => {
    const { sessions, activeSessionId } = get()
    const updated = sessions.map((s) =>
      s.id === activeSessionId
        ? { ...s, title: '新会话', messages: [], updatedAt: Date.now() }
        : s
    )
    set({
      sessions: updated,
      currentThinking: '',
      currentDelta: '',
      currentTraces: []
    })
    saveSessionsToStorage(updated, activeSessionId)
  },

  sendTask: async (prompt: string, contextParams) => {
    const { sessions, activeSessionId, isRunning } = get()
    if (isRunning || !prompt.trim()) return

    let currentSession = sessions.find((s) => s.id === activeSessionId)
    if (!currentSession) {
      const newId = get().createSession()
      currentSession = get().sessions.find((s) => s.id === newId)!
    }

    // Auto generate title on first user message
    let sessionTitle = currentSession.title
    if (currentSession.messages.length === 0 || currentSession.title === '新会话') {
      sessionTitle = generateSessionTitle(prompt)
    }

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: prompt.trim(),
      selectedText: contextParams.selectedText?.trim() || undefined,
      timestamp: Date.now()
    }

    const updatedMessagesWithUser = [...currentSession.messages, userMessage]
    const updatedSessionsWithUser = get().sessions.map((s) =>
      s.id === currentSession!.id
        ? { ...s, title: sessionTitle, messages: updatedMessagesWithUser, updatedAt: Date.now() }
        : s
    )

    set({
      sessions: updatedSessionsWithUser,
      isRunning: true,
      currentThinking: '',
      currentDelta: '',
      currentTraces: []
    })
    saveSessionsToStorage(updatedSessionsWithUser, currentSession.id)

    const taskOptions: AgentTaskOptions = {
      userPrompt: prompt.trim(),
      projectPath: contextParams.projectPath,
      activeChapterFilename: contextParams.activeChapterFilename,
      manuscriptContext: contextParams.manuscriptContext,
      selectedText: contextParams.selectedText
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
          // Strictly sanitize markdown symbols out of content!
          const cleanOutput = stripMarkdownMarks(accumulatedDelta)

          const assistantMsg: AgentMessage = {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content: cleanOutput || (tracesList.length > 0 ? '已完成所有自主工具调用调度。' : '完成。'),
            thinking: accumulatedThinking || undefined,
            traces: tracesList.length > 0 ? tracesList : undefined,
            timestamp: Date.now()
          }

          const finalizedSessions = get().sessions.map((s) =>
            s.id === currentSession!.id
              ? { ...s, messages: [...s.messages, assistantMsg], updatedAt: Date.now() }
              : s
          )

          set({
            sessions: finalizedSessions,
            isRunning: false,
            currentTaskId: null,
            currentThinking: '',
            currentDelta: '',
            currentTraces: []
          })
          saveSessionsToStorage(finalizedSessions, currentSession.id)
          handle.unsubscribe()
        } else if (event.type === 'error') {
          const errorMsg: AgentMessage = {
            id: `msg-${Date.now()}-err`,
            role: 'assistant',
            content: `[执行异常]: ${event.error || '任务执行失败'}`,
            traces: tracesList.length > 0 ? tracesList : undefined,
            timestamp: Date.now()
          }

          const finalizedSessions = get().sessions.map((s) =>
            s.id === currentSession!.id
              ? { ...s, messages: [...s.messages, errorMsg], updatedAt: Date.now() }
              : s
          )

          set({
            sessions: finalizedSessions,
            isRunning: false,
            currentTaskId: null,
            currentThinking: '',
            currentDelta: '',
            currentTraces: []
          })
          saveSessionsToStorage(finalizedSessions, currentSession.id)
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

      const finalizedSessions = get().sessions.map((s) =>
        s.id === currentSession!.id
          ? { ...s, messages: [...s.messages, errorMsg], updatedAt: Date.now() }
          : s
      )

      set({
        sessions: finalizedSessions,
        isRunning: false,
        currentTaskId: null,
        currentThinking: '',
        currentDelta: '',
        currentTraces: []
      })
      saveSessionsToStorage(finalizedSessions, currentSession.id)
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
