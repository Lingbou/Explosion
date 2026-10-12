import { create } from 'zustand'
import {
  AgentMessage,
  AgentSession,
  AgentStreamEvent,
  AgentTaskOptions,
  AgentTraceStep,
  SubAgentTaskInfo
} from '../../../shared/types/ipc'
import { stripMarkdownMarks } from '../lib/typography'
import { generateSessionTitle } from '../../../shared/utils/session'
import { migrateLocalStorageSessions } from '../lib/session-migration'

export { generateSessionTitle } from '../../../shared/utils/session'
export { migrateLocalStorageSessions } from '../lib/session-migration'
export type { AgentTraceStep, AgentMessage, AgentSession }

interface AgentState {
  sessions: AgentSession[]
  activeSessionId: string
  isRunning: boolean
  currentTaskId: string | null
  currentThinking: string
  currentDelta: string
  currentTraces: AgentTraceStep[]
  currentSubagents: SubAgentTaskInfo[]
  currentProjectPath: string | null

  initProjectSessions: (projectPath: string | null) => Promise<void>
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

function createInitialBlankSession(projectPath?: string | null): AgentSession {
  return {
    id: `session-${Date.now()}`,
    title: '新会话',
    projectPath: projectPath || undefined,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

const initialSession = createInitialBlankSession()

export const useAgentStore = create<AgentState>((set, get) => ({
  sessions: [initialSession],
  activeSessionId: initialSession.id,
  isRunning: false,
  currentTaskId: null,
  currentThinking: '',
  currentDelta: '',
  currentTraces: [],
  currentSubagents: [],
  currentProjectPath: null,

  initProjectSessions: async (projectPath: string | null) => {
    set({ currentProjectPath: projectPath })

    if (!projectPath) {
      const initial = createInitialBlankSession(null)
      set({
        sessions: [initial],
        activeSessionId: initial.id,
        currentThinking: '',
        currentDelta: '',
        currentTraces: [],
        currentSubagents: []
      })
      return
    }

    try {
      let diskSessions: AgentSession[] = []
      if (window?.api?.listAgentSessions) {
        diskSessions = await window.api.listAgentSessions({ projectPath })
      }

      const migrated = await migrateLocalStorageSessions(projectPath, diskSessions)
      if (migrated.length > 0) {
        if (window?.api?.listAgentSessions) {
          diskSessions = await window.api.listAgentSessions({ projectPath })
        } else {
          const existingIds = new Set(diskSessions.map((s) => s.id))
          for (const m of migrated) {
            if (!existingIds.has(m.id)) {
              diskSessions.push(m)
            }
          }
        }
      }

      const meaningful = diskSessions.filter((s) => s.messages && s.messages.length > 0)

      if (meaningful.length > 0) {
        set({
          sessions: meaningful,
          activeSessionId: meaningful[0].id,
          currentThinking: '',
          currentDelta: '',
          currentTraces: [],
          currentSubagents: []
        })
      } else {
        const fresh = createInitialBlankSession(projectPath)
        set({
          sessions: [fresh],
          activeSessionId: fresh.id,
          currentThinking: '',
          currentDelta: '',
          currentTraces: [],
          currentSubagents: []
        })
      }
    } catch (err) {
      console.error('Failed to init project agent sessions:', err)
    }
  },

  createSession: () => {
    const { sessions, activeSessionId, currentProjectPath } = get()
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
          currentTraces: [],
          currentSubagents: []
        })
        if (currentProjectPath && window?.api?.renameAgentSession) {
          window.api.renameAgentSession({
            projectPath: currentProjectPath,
            sessionId: current.id,
            title: '新会话'
          }).catch(() => {})
        }
      }
      return current.id
    }

    const newSession: AgentSession = {
      id: `session-${Date.now()}`,
      title: '新会话',
      projectPath: currentProjectPath || undefined,
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
      currentTraces: [],
      currentSubagents: []
    })
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
  },

  deleteSession: (sessionId: string) => {
    const { sessions, activeSessionId, currentProjectPath } = get()
    const remaining = sessions.filter((s) => s.id !== sessionId)

    if (currentProjectPath && window?.api?.deleteAgentSession) {
      window.api.deleteAgentSession({
        projectPath: currentProjectPath,
        sessionId
      }).catch(() => {})
    }

    if (remaining.length === 0) {
      const freshSession = createInitialBlankSession(currentProjectPath)
      set({
        sessions: [freshSession],
        activeSessionId: freshSession.id,
        currentThinking: '',
        currentDelta: '',
        currentTraces: [],
        currentSubagents: []
      })
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
  },

  renameSession: (sessionId: string, title: string) => {
    const trimmedTitle = title.trim() || '未命名会话'
    const updated = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, title: trimmedTitle, updatedAt: Date.now() } : s
    )
    set({ sessions: updated })

    const { currentProjectPath } = get()
    if (currentProjectPath && window?.api?.renameAgentSession) {
      window.api.renameAgentSession({
        projectPath: currentProjectPath,
        sessionId,
        title: trimmedTitle
      }).catch(() => {})
    }
  },

  clearMessages: () => {
    const { sessions, activeSessionId, currentProjectPath } = get()
    const updated = sessions.map((s) =>
      s.id === activeSessionId
        ? { ...s, title: '新会话', messages: [], updatedAt: Date.now() }
        : s
    )
    set({
      sessions: updated,
      currentThinking: '',
      currentDelta: '',
      currentTraces: [],
      currentSubagents: []
    })

    const clearedSession = updated.find((s) => s.id === activeSessionId)
    if (currentProjectPath && clearedSession && window?.api?.saveAgentSession) {
      window.api.saveAgentSession({
        projectPath: currentProjectPath,
        session: clearedSession
      }).catch(() => {})
    }
  },

  sendTask: async (prompt: string, contextParams) => {
    const { sessions, activeSessionId, isRunning, currentProjectPath } = get()
    if (isRunning || !prompt.trim()) return

    const effectiveProjectPath = contextParams.projectPath || currentProjectPath
    if (effectiveProjectPath && effectiveProjectPath !== currentProjectPath) {
      set({ currentProjectPath: effectiveProjectPath })
    }

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
    const updatedSessionWithUser: AgentSession = {
      ...currentSession,
      title: sessionTitle,
      projectPath: effectiveProjectPath || undefined,
      messages: updatedMessagesWithUser,
      updatedAt: Date.now()
    }

    const updatedSessionsWithUser = get().sessions.map((s) =>
      s.id === currentSession!.id ? updatedSessionWithUser : s
    )

    set({
      sessions: updatedSessionsWithUser,
      isRunning: true,
      currentThinking: '',
      currentDelta: '',
      currentTraces: [],
      currentSubagents: []
    })

    if (effectiveProjectPath && window?.api?.saveAgentSession) {
      window.api.saveAgentSession({
        projectPath: effectiveProjectPath,
        session: updatedSessionWithUser
      }).catch(() => {})
    }

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
    let subagentsList: SubAgentTaskInfo[] = []

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
        } else if (event.type === 'subagent_update' && event.subagent) {
          const sub = event.subagent
          const existingIdx = subagentsList.findIndex((s) => s.id === sub.id)
          if (existingIdx >= 0) {
            subagentsList = subagentsList.map((s, idx) => (idx === existingIdx ? sub : s))
          } else {
            subagentsList = [...subagentsList, sub]
          }
          set({ currentSubagents: subagentsList })
        } else if (event.type === 'done') {
          // Strictly sanitize markdown symbols out of content!
          const cleanOutput = stripMarkdownMarks(accumulatedDelta)

          const assistantMsg: AgentMessage = {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content:
              cleanOutput ||
              (tracesList.length > 0 || subagentsList.length > 0
                ? '已完成所有自主工具调用调度。'
                : '完成。'),
            thinking: accumulatedThinking || undefined,
            traces: tracesList.length > 0 ? tracesList : undefined,
            subagents: subagentsList.length > 0 ? subagentsList : undefined,
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
            currentTraces: [],
            currentSubagents: []
          })

          const targetSession = finalizedSessions.find((s) => s.id === currentSession!.id)
          if (effectiveProjectPath && targetSession && window?.api?.saveAgentSession) {
            window.api.saveAgentSession({
              projectPath: effectiveProjectPath,
              session: targetSession
            }).catch(() => {})
          }
          handle.unsubscribe()
        } else if (event.type === 'error') {
          const errorMsg: AgentMessage = {
            id: `msg-${Date.now()}-err`,
            role: 'assistant',
            content: `[执行异常]: ${event.error || '任务执行失败'}`,
            traces: tracesList.length > 0 ? tracesList : undefined,
            subagents: subagentsList.length > 0 ? subagentsList : undefined,
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
            currentTraces: [],
            currentSubagents: []
          })

          const targetSession = finalizedSessions.find((s) => s.id === currentSession!.id)
          if (effectiveProjectPath && targetSession && window?.api?.saveAgentSession) {
            window.api.saveAgentSession({
              projectPath: effectiveProjectPath,
              session: targetSession
            }).catch(() => {})
          }
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
        currentTraces: [],
        currentSubagents: []
      })

      const targetSession = finalizedSessions.find((s) => s.id === currentSession!.id)
      if (effectiveProjectPath && targetSession && window?.api?.saveAgentSession) {
        window.api.saveAgentSession({
          projectPath: effectiveProjectPath,
          session: targetSession
        }).catch(() => {})
      }
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
        currentTraces: [],
        currentSubagents: []
      })
    }
  }
}))
