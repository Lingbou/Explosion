import { AgentSession } from '../../../shared/types/ipc'

export const STORAGE_KEY_SESSIONS = 'explosion:agent-sessions'
export const STORAGE_KEY_ACTIVE_ID = 'explosion:agent-active-session-id'

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type SaveSessionFn = (params: {
  projectPath: string
  session: AgentSession
}) => Promise<boolean>

export async function migrateLocalStorageSessions(
  projectPath: string,
  diskSessions: AgentSession[],
  storage?: StorageLike,
  saveSessionFn?: SaveSessionFn
): Promise<AgentSession[]> {
  const migrated: AgentSession[] = []
  const targetStorage: StorageLike | undefined =
    storage || (typeof globalThis !== 'undefined' ? (globalThis as Record<string, any>).localStorage : undefined)

  if (!targetStorage || !projectPath) return migrated

  try {
    const raw = targetStorage.getItem(STORAGE_KEY_SESSIONS)
    if (!raw) return migrated

    const parsed = JSON.parse(raw) as AgentSession[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      targetStorage.removeItem(STORAGE_KEY_SESSIONS)
      targetStorage.removeItem(STORAGE_KEY_ACTIVE_ID)
      return migrated
    }

    const diskSessionIds = new Set(diskSessions.map((s) => s.id))
    const remainingInStorage: AgentSession[] = []

    for (const s of parsed) {
      if (!s || !s.id) continue

      const belongsToProject = s.projectPath === projectPath || !s.projectPath

      if (belongsToProject) {
        if (s.messages && s.messages.length > 0) {
          const sessionWithProject: AgentSession = {
            ...s,
            projectPath
          }
          if (!diskSessionIds.has(s.id)) {
            if (saveSessionFn) {
              await saveSessionFn({
                projectPath,
                session: sessionWithProject
              })
            } else {
              const globalWin = typeof globalThis !== 'undefined' ? (globalThis as Record<string, any>).window : undefined
              if (globalWin?.api?.saveAgentSession) {
                await globalWin.api.saveAgentSession({
                  projectPath,
                  session: sessionWithProject
                })
              }
            }
          }
          migrated.push(sessionWithProject)
        }
      } else {
        remainingInStorage.push(s)
      }
    }

    if (remainingInStorage.length > 0) {
      targetStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(remainingInStorage))
    } else {
      targetStorage.removeItem(STORAGE_KEY_SESSIONS)
      targetStorage.removeItem(STORAGE_KEY_ACTIVE_ID)
    }
  } catch (err) {
    console.error('Failed to migrate legacy sessions from localStorage:', err)
  }

  return migrated
}
