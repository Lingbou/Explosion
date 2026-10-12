import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { AgentSessionManager } from '../src/main/agent/session-manager'
import { AgentSession } from '../src/shared/types/ipc'

describe('AgentSessionManager (File Persistence & Indexing)', () => {
  let tempProjectDir: string
  let manager: AgentSessionManager

  beforeEach(() => {
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-session-test-'))
    manager = new AgentSessionManager()
  })

  afterEach(() => {
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    }
  })

  it('saves session to .explosion/sessions/<id>.json with all 6 required fields', async () => {
    const session: AgentSession = {
      id: 'session-1001',
      title: '第一卷大纲拆解',
      projectPath: tempProjectDir,
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: '请根据雪花写作法拆解第1卷的主线冲突。',
          timestamp: 1728800001000
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '第1卷的核心冲突围绕主角身份暴露展开...',
          timestamp: 1728800002000
        }
      ],
      createdAt: 1728800000000,
      updatedAt: 1728800002000
    }

    const saved = await manager.saveSession(tempProjectDir, session)
    expect(saved).toBe(true)

    const sessionFilePath = path.join(
      tempProjectDir,
      '.explosion',
      'sessions',
      'session-1001.json'
    )
    expect(fs.existsSync(sessionFilePath)).toBe(true)

    const raw = fs.readFileSync(sessionFilePath, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.id).toBe('session-1001')
    expect(parsed.title).toBe('第一卷大纲拆解')
    expect(parsed.projectPath).toBe(tempProjectDir)
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.createdAt).toBe(1728800000000)
    expect(parsed.updatedAt).toBe(1728800002000)

    // Verify index.json was also updated
    const indexFilePath = path.join(tempProjectDir, '.explosion', 'sessions', 'index.json')
    expect(fs.existsSync(indexFilePath)).toBe(true)
    const index = manager.getIndex(tempProjectDir)
    expect(index.sessions).toHaveLength(1)
    expect(index.sessions[0].id).toBe('session-1001')
    expect(index.sessions[0].messageCount).toBe(2)
    expect(index.activeSessionId).toBe('session-1001')
  })

  it('loads existing session and returns null for non-existent session', async () => {
    const session: AgentSession = {
      id: 'session-2002',
      title: '人物小传梳理',
      projectPath: tempProjectDir,
      messages: [
        {
          id: 'msg-u1',
          role: 'user',
          content: '设定主角性格',
          timestamp: 1728800010000
        }
      ],
      createdAt: 1728800010000,
      updatedAt: 1728800010000
    }

    await manager.saveSession(tempProjectDir, session)

    const loaded = await manager.loadSession(tempProjectDir, 'session-2002')
    expect(loaded).not.toBeNull()
    expect(loaded?.id).toBe('session-2002')
    expect(loaded?.title).toBe('人物小传梳理')
    expect(loaded?.messages[0].content).toBe('设定主角性格')

    const nonExistent = await manager.loadSession(tempProjectDir, 'session-non-existent')
    expect(nonExistent).toBeNull()

    const invalidPath = await manager.loadSession('/path/does/not/exist', 'session-2002')
    expect(invalidPath).toBeNull()
  })

  it('lists sessions maintaining index order and recency', async () => {
    const session1: AgentSession = {
      id: 'session-a',
      title: '会话A',
      projectPath: tempProjectDir,
      messages: [{ id: 'm1', role: 'user', content: 'A', timestamp: 100 }],
      createdAt: 100,
      updatedAt: 100
    }
    const session2: AgentSession = {
      id: 'session-b',
      title: '会话B',
      projectPath: tempProjectDir,
      messages: [{ id: 'm2', role: 'user', content: 'B', timestamp: 200 }],
      createdAt: 200,
      updatedAt: 200
    }

    await manager.saveSession(tempProjectDir, session1)
    await manager.saveSession(tempProjectDir, session2)

    const list = await manager.listSessions(tempProjectDir)
    expect(list).toHaveLength(2)
    // session2 was saved last, so it is top of index
    expect(list[0].id).toBe('session-b')
    expect(list[1].id).toBe('session-a')
  })

  it('renames session in place and updates index and disk file', async () => {
    const session: AgentSession = {
      id: 'session-rename-test',
      title: '旧会话名',
      projectPath: tempProjectDir,
      messages: [{ id: 'm1', role: 'user', content: '内容', timestamp: 100 }],
      createdAt: 100,
      updatedAt: 100
    }

    await manager.saveSession(tempProjectDir, session)
    const success = await manager.renameSession(tempProjectDir, 'session-rename-test', '新会话标题')
    expect(success).toBe(true)

    const reloaded = await manager.loadSession(tempProjectDir, 'session-rename-test')
    expect(reloaded?.title).toBe('新会话标题')

    const index = manager.getIndex(tempProjectDir)
    expect(index.sessions[0].title).toBe('新会话标题')
  })

  it('deletes session file synchronously on disk and cleans index', async () => {
    const session1: AgentSession = {
      id: 'session-del-1',
      title: '会话1',
      projectPath: tempProjectDir,
      messages: [{ id: 'm1', role: 'user', content: '1', timestamp: 100 }],
      createdAt: 100,
      updatedAt: 100
    }
    const session2: AgentSession = {
      id: 'session-del-2',
      title: '会话2',
      projectPath: tempProjectDir,
      messages: [{ id: 'm2', role: 'user', content: '2', timestamp: 200 }],
      createdAt: 200,
      updatedAt: 200
    }

    await manager.saveSession(tempProjectDir, session1)
    await manager.saveSession(tempProjectDir, session2)

    const file1 = path.join(tempProjectDir, '.explosion', 'sessions', 'session-del-1.json')
    expect(fs.existsSync(file1)).toBe(true)

    // Delete session-del-1
    const delRes = await manager.deleteSession(tempProjectDir, 'session-del-1')
    expect(delRes).toBe(true)

    // File MUST be physically deleted on disk
    expect(fs.existsSync(file1)).toBe(false)

    // Index must not contain deleted session
    const list = await manager.listSessions(tempProjectDir)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('session-del-2')
  })

  it('auto-heals and scans directory if index.json is missing or corrupted', async () => {
    const session: AgentSession = {
      id: 'session-orphan',
      title: '独立扫描会话',
      projectPath: tempProjectDir,
      messages: [{ id: 'm1', role: 'user', content: '孤立文件', timestamp: 500 }],
      createdAt: 500,
      updatedAt: 500
    }

    await manager.saveSession(tempProjectDir, session)

    // Manually delete index.json
    const indexFile = path.join(tempProjectDir, '.explosion', 'sessions', 'index.json')
    fs.unlinkSync(indexFile)
    expect(fs.existsSync(indexFile)).toBe(false)

    // Calling listSessions scans files and regenerates index.json
    const list = await manager.listSessions(tempProjectDir)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('session-orphan')
    expect(list[0].title).toBe('独立扫描会话')

    expect(fs.existsSync(indexFile)).toBe(true)
  })

  it('sanitizes session id to prevent path traversal', async () => {
    const session: AgentSession = {
      id: '../../traversal-session',
      title: '路径穿越测试',
      projectPath: tempProjectDir,
      messages: [],
      createdAt: 100,
      updatedAt: 100
    }

    await manager.saveSession(tempProjectDir, session)

    // Verify it was written inside .explosion/sessions/ and not outside
    const safeFile = path.join(tempProjectDir, '.explosion', 'sessions', 'traversal-session.json')
    expect(fs.existsSync(safeFile)).toBe(true)
  })
})
