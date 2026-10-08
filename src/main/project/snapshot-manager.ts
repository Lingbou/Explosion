import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow } from 'electron'
import { IPC_CHANNELS, ProjectFileChangedPayload, ProjectSnapshot } from '../../shared/types/ipc'

export class SnapshotManager {
  private getSnapshotsDir(projectPath: string): string {
    const dir = path.join(projectPath, '.explosion', 'snapshots')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  private getIndexFile(projectPath: string): string {
    return path.join(this.getSnapshotsDir(projectPath), 'index.json')
  }

  private readIndex(projectPath: string): ProjectSnapshot[] {
    const file = this.getIndexFile(projectPath)
    if (!fs.existsSync(file)) return []
    try {
      const raw = fs.readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private writeIndex(projectPath: string, list: ProjectSnapshot[]): void {
    const file = this.getIndexFile(projectPath)
    fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf-8')
  }

  public async createSnapshot(
    projectPath: string,
    targetPath: string,
    content: string,
    source: 'agent' | 'manual' | 'autosave' | 'rollback'
  ): Promise<ProjectSnapshot | null> {
    if (!projectPath || !fs.existsSync(projectPath)) return null

    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(projectPath, targetPath)

    const relativePath = path.relative(projectPath, resolvedTarget)
    const filename = path.basename(resolvedTarget)

    const snapshotsDir = this.getSnapshotsDir(projectPath)
    const index = this.readIndex(projectPath)

    // Check recent snapshot for this file: avoid duplicates if content is identical
    const fileSnapshots = index.filter((s) => s.filePath === relativePath)
    if (fileSnapshots.length > 0) {
      const latest = fileSnapshots[fileSnapshots.length - 1]
      const latestContentFile = path.join(snapshotsDir, `${latest.id}.txt`)
      if (fs.existsSync(latestContentFile)) {
        try {
          const latestContent = fs.readFileSync(latestContentFile, 'utf-8')
          if (latestContent === content) {
            return null // identical content, skip duplicate snapshot
          }
        } catch {
          // ignore
        }
      }
    }

    const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const contentFile = path.join(snapshotsDir, `${snapshotId}.txt`)

    fs.writeFileSync(contentFile, content, 'utf-8')

    const newSnapshot: ProjectSnapshot = {
      id: snapshotId,
      filePath: relativePath,
      filename,
      timestamp: Date.now(),
      source,
      charCount: content.length
    }

    const updatedIndex = [...index, newSnapshot]

    // Keep at most 60 snapshots per project to avoid infinite disk usage
    if (updatedIndex.length > 60) {
      const removed = updatedIndex.splice(0, updatedIndex.length - 60)
      for (const r of removed) {
        const oldFile = path.join(snapshotsDir, `${r.id}.txt`)
        if (fs.existsSync(oldFile)) {
          try {
            fs.unlinkSync(oldFile)
          } catch {
            // ignore
          }
        }
      }
    }

    this.writeIndex(projectPath, updatedIndex)
    return newSnapshot
  }

  public async listSnapshots(projectPath: string, filename?: string): Promise<ProjectSnapshot[]> {
    if (!projectPath || !fs.existsSync(projectPath)) return []
    const index = this.readIndex(projectPath)

    const filtered = filename
      ? index.filter((s) => s.filename === filename || s.filePath.endsWith(filename))
      : index

    return filtered.sort((a, b) => b.timestamp - a.timestamp)
  }

  public async getSnapshotContent(projectPath: string, snapshotId: string): Promise<string> {
    if (!projectPath || !snapshotId) return ''
    const contentFile = path.join(this.getSnapshotsDir(projectPath), `${snapshotId}.txt`)
    if (!fs.existsSync(contentFile)) return ''
    try {
      return fs.readFileSync(contentFile, 'utf-8')
    } catch {
      return ''
    }
  }

  public async restoreSnapshot(
    projectPath: string,
    snapshotId: string
  ): Promise<{ success: boolean; filePath: string; filename: string; content: string }> {
    const index = this.readIndex(projectPath)
    const snapshot = index.find((s) => s.id === snapshotId)
    if (!snapshot) {
      throw new Error(`未找到快照: ${snapshotId}`)
    }

    const content = await this.getSnapshotContent(projectPath, snapshotId)
    const targetFile = path.resolve(projectPath, snapshot.filePath)

    // Save backup of current content before rollback
    if (fs.existsSync(targetFile)) {
      try {
        const currentContent = fs.readFileSync(targetFile, 'utf-8')
        await this.createSnapshot(projectPath, targetFile, currentContent, 'rollback')
      } catch {
        // ignore
      }
    }

    fs.mkdirSync(path.dirname(targetFile), { recursive: true })
    fs.writeFileSync(targetFile, content, 'utf-8')

    // Broadcast file change to renderer
    const payload: ProjectFileChangedPayload = {
      projectPath,
      filePath: targetFile,
      filename: snapshot.filename,
      content
    }

    try {
      const wins = (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function')
        ? BrowserWindow.getAllWindows()
        : []
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.PROJECT_FILE_CHANGED, payload)
        }
      }
    } catch {
      // ignore
    }

    return {
      success: true,
      filePath: snapshot.filePath,
      filename: snapshot.filename,
      content
    }
  }
}

export const globalSnapshotManager = new SnapshotManager()
