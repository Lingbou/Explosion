import * as fs from 'fs'
import * as path from 'path'
import {
  AgentSession,
  AgentSessionIndex,
  AgentSessionSummary
} from '../../shared/types/ipc'

export class AgentSessionManager {
  public getSessionsDir(projectPath: string): string {
    const dir = path.join(projectPath, '.explosion', 'sessions')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  public getIndexFile(projectPath: string): string {
    return path.join(projectPath, '.explosion', 'sessions', 'index.json')
  }

  public getIndex(projectPath: string): AgentSessionIndex {
    const indexFile = this.getIndexFile(projectPath)
    if (fs.existsSync(indexFile)) {
      try {
        const raw = fs.readFileSync(indexFile, 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.sessions)) {
          return parsed as AgentSessionIndex
        }
      } catch {
        // ignore malformed index
      }
    }
    return { sessions: [] }
  }

  public saveIndex(projectPath: string, index: AgentSessionIndex): void {
    const dir = this.getSessionsDir(projectPath)
    const indexFile = path.join(dir, 'index.json')
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf-8')
  }

  private sanitizeSessionId(sessionId: string): string {
    return path.basename(sessionId).replace(/\.json$/, '').replace(/[\\/:*?"<>|]/g, '_')
  }

  public async listSessions(projectPath: string): Promise<AgentSession[]> {
    if (!projectPath || !fs.existsSync(projectPath)) return []

    const dir = path.join(projectPath, '.explosion', 'sessions')
    if (!fs.existsSync(dir)) return []

    let files: string[] = []
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')
    } catch {
      return []
    }

    const fileIdSet = new Set(files.map((f) => f.replace(/\.json$/, '')))
    const index = this.getIndex(projectPath)
    const result: AgentSession[] = []
    const seenIds = new Set<string>()

    // 1. First attempt to load sessions according to index order
    for (const item of index.sessions) {
      if (fileIdSet.has(item.id)) {
        const session = await this.loadSession(projectPath, item.id)
        if (session) {
          result.push(session)
          seenIds.add(session.id)
        }
      }
    }

    // 2. Scan and load any disk files that were not in index
    let unindexedFound = false
    const remainingFiles: AgentSession[] = []
    for (const f of files) {
      const id = f.replace(/\.json$/, '')
      if (!seenIds.has(id)) {
        const session = await this.loadSession(projectPath, id)
        if (session) {
          remainingFiles.push(session)
          seenIds.add(session.id)
          unindexedFound = true
        }
      }
    }

    if (remainingFiles.length > 0) {
      // Sort newly found files by updatedAt desc
      remainingFiles.sort((a, b) => b.updatedAt - a.updatedAt)
      result.push(...remainingFiles)
    }

    // 3. If index was missing or desynchronized, rebuild index
    if (unindexedFound || index.sessions.length !== result.length) {
      const updatedIndex: AgentSessionIndex = {
        activeSessionId: index.activeSessionId || (result.length > 0 ? result[0].id : undefined),
        sessions: result.map((s) => ({
          id: s.id,
          title: s.title,
          projectPath: s.projectPath || projectPath,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          messageCount: s.messages.length
        }))
      }
      this.saveIndex(projectPath, updatedIndex)
    }

    return result
  }

  public async loadSession(projectPath: string, sessionId: string): Promise<AgentSession | null> {
    if (!projectPath || !sessionId || !fs.existsSync(projectPath)) return null

    const safeId = this.sanitizeSessionId(sessionId)
    const filePath = path.join(projectPath, '.explosion', 'sessions', `${safeId}.json`)

    if (!fs.existsSync(filePath)) return null

    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as AgentSession
      if (parsed && typeof parsed.id === 'string') {
        return {
          id: parsed.id,
          title: parsed.title || '新会话',
          projectPath: parsed.projectPath || projectPath,
          messages: Array.isArray(parsed.messages) ? parsed.messages : [],
          createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now()
        }
      }
      return null
    } catch {
      return null
    }
  }

  public async saveSession(projectPath: string, session: AgentSession): Promise<boolean> {
    if (!projectPath || !session || !session.id || !fs.existsSync(projectPath)) return false

    const dir = this.getSessionsDir(projectPath)
    const safeId = this.sanitizeSessionId(session.id)
    const filePath = path.join(dir, `${safeId}.json`)

    const effectiveProjectPath = session.projectPath || projectPath
    const sessionData: AgentSession = {
      id: session.id,
      title: session.title || '新会话',
      projectPath: effectiveProjectPath,
      messages: Array.isArray(session.messages) ? session.messages : [],
      createdAt: typeof session.createdAt === 'number' ? session.createdAt : Date.now(),
      updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : Date.now()
    }

    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2), 'utf-8')

    // Update index.json
    const index = this.getIndex(projectPath)
    const existingIdx = index.sessions.findIndex((s) => s.id === session.id)
    const itemSummary: AgentSessionSummary = {
      id: sessionData.id,
      title: sessionData.title,
      projectPath: effectiveProjectPath,
      createdAt: sessionData.createdAt,
      updatedAt: sessionData.updatedAt,
      messageCount: sessionData.messages.length
    }

    if (existingIdx >= 0) {
      index.sessions.splice(existingIdx, 1)
      index.sessions.unshift(itemSummary)
    } else {
      index.sessions.unshift(itemSummary)
    }

    index.activeSessionId = sessionData.id
    this.saveIndex(projectPath, index)
    return true
  }

  public async renameSession(
    projectPath: string,
    sessionId: string,
    title: string
  ): Promise<boolean> {
    if (!projectPath || !sessionId || !fs.existsSync(projectPath)) return false

    const session = await this.loadSession(projectPath, sessionId)
    if (!session) return false

    session.title = title.trim() || '未命名会话'
    session.updatedAt = Date.now()

    return this.saveSession(projectPath, session)
  }

  public async deleteSession(projectPath: string, sessionId: string): Promise<boolean> {
    if (!projectPath || !sessionId || !fs.existsSync(projectPath)) return false

    const dir = path.join(projectPath, '.explosion', 'sessions')
    const safeId = this.sanitizeSessionId(sessionId)
    const filePath = path.join(dir, `${safeId}.json`)

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // ignore
      }
    }

    const index = this.getIndex(projectPath)
    index.sessions = index.sessions.filter((s) => s.id !== safeId && s.id !== sessionId)
    if (index.activeSessionId === sessionId || index.activeSessionId === safeId) {
      index.activeSessionId = index.sessions.length > 0 ? index.sessions[0].id : undefined
    }
    this.saveIndex(projectPath, index)
    return true
  }
}

export const globalSessionManager = new AgentSessionManager()
