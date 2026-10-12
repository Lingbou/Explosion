import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  migrateLocalStorageSessions,
  STORAGE_KEY_SESSIONS,
  STORAGE_KEY_ACTIVE_ID
} from '../src/renderer/src/lib/session-migration'
import { AgentSession } from '../src/shared/types/ipc'

describe('Agent Sessions Store & Migration', () => {
  let mockStorage: Record<string, string> = {}
  let savedSessionsMock: { projectPath: string; session: AgentSession }[] = []

  const localStorageMock = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = val
    },
    removeItem: (key: string) => {
      delete mockStorage[key]
    }
  }

  const saveSessionMock = async (params: { projectPath: string; session: AgentSession }) => {
    savedSessionsMock.push(params)
    return true
  }

  beforeEach(() => {
    mockStorage = {}
    savedSessionsMock = []
  })

  it('migrates legacy sessions without projectPath into current project and clears localStorage', async () => {
    const legacySessions = [
      {
        id: 'legacy-1',
        title: '旧会话1',
        messages: [{ id: 'm1', role: 'user', content: '设定世界观', timestamp: 100 }],
        createdAt: 100,
        updatedAt: 100
      },
      {
        id: 'legacy-empty',
        title: '空会话',
        messages: [],
        createdAt: 200,
        updatedAt: 200
      }
    ]

    mockStorage[STORAGE_KEY_SESSIONS] = JSON.stringify(legacySessions)
    mockStorage[STORAGE_KEY_ACTIVE_ID] = 'legacy-1'

    const targetProject = '/home/user/novel-a'
    const diskSessions: AgentSession[] = []

    const migrated = await migrateLocalStorageSessions(
      targetProject,
      diskSessions,
      localStorageMock,
      saveSessionMock
    )

    // Only legacy-1 with messages is migrated
    expect(migrated).toHaveLength(1)
    expect(migrated[0].id).toBe('legacy-1')
    expect(migrated[0].projectPath).toBe(targetProject)

    // Verify saveSession was called
    expect(savedSessionsMock).toHaveLength(1)
    expect(savedSessionsMock[0].projectPath).toBe(targetProject)
    expect(savedSessionsMock[0].session.id).toBe('legacy-1')

    // Verify localStorage was completely cleaned up
    expect(mockStorage[STORAGE_KEY_SESSIONS]).toBeUndefined()
    expect(mockStorage[STORAGE_KEY_ACTIVE_ID]).toBeUndefined()
  })

  it('preserves sessions of other projects in localStorage while migrating current project', async () => {
    const sessions = [
      {
        id: 'session-proj-a',
        title: 'A书会话',
        projectPath: '/home/user/novel-a',
        messages: [{ id: 'ma', role: 'user', content: 'A', timestamp: 100 }],
        createdAt: 100,
        updatedAt: 100
      },
      {
        id: 'session-proj-b',
        title: 'B书会话',
        projectPath: '/home/user/novel-b',
        messages: [{ id: 'mb', role: 'user', content: 'B', timestamp: 200 }],
        createdAt: 200,
        updatedAt: 200
      }
    ]

    mockStorage[STORAGE_KEY_SESSIONS] = JSON.stringify(sessions)

    const migrated = await migrateLocalStorageSessions(
      '/home/user/novel-a',
      [],
      localStorageMock,
      saveSessionMock
    )
    expect(migrated).toHaveLength(1)
    expect(migrated[0].id).toBe('session-proj-a')

    // novel-b session MUST remain in localStorage
    expect(mockStorage[STORAGE_KEY_SESSIONS]).toBeDefined()
    const remaining = JSON.parse(mockStorage[STORAGE_KEY_SESSIONS])
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('session-proj-b')
  })

  it('skips saving to disk when session id already exists on disk but still cleans localStorage', async () => {
    const sessions = [
      {
        id: 'session-existing',
        title: '已落盘会话',
        messages: [{ id: 'm1', role: 'user', content: '测试', timestamp: 100 }],
        createdAt: 100,
        updatedAt: 100
      }
    ]

    mockStorage[STORAGE_KEY_SESSIONS] = JSON.stringify(sessions)

    const diskSessions: AgentSession[] = [
      {
        id: 'session-existing',
        title: '已落盘会话',
        projectPath: '/home/user/novel-a',
        messages: [{ id: 'm1', role: 'user', content: '测试', timestamp: 100 }],
        createdAt: 100,
        updatedAt: 100
      }
    ]

    const migrated = await migrateLocalStorageSessions(
      '/home/user/novel-a',
      diskSessions,
      localStorageMock,
      saveSessionMock
    )

    // Should return migrated item representation
    expect(migrated).toHaveLength(1)
    // Should NOT call saveSession because it already exists on disk
    expect(savedSessionsMock).toHaveLength(0)

    // Storage is cleaned up
    expect(mockStorage[STORAGE_KEY_SESSIONS]).toBeUndefined()
  })
})
