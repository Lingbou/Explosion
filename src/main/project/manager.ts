import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow, dialog } from 'electron'
import {
  IPC_CHANNELS,
  ProjectChapterFile,
  ProjectData,
  ProjectFileChangedPayload,
  StoryBibleData,
  StoryBibleFile
} from '../../shared/types/ipc'
import { ConfigStore, globalConfigStore } from '../config/store'
import { globalSnapshotManager } from './snapshot-manager'

export class ProjectManager {
  private configStore: ConfigStore
  private activeWatcher: fs.FSWatcher | null = null
  private watcherDebounceTimers = new Map<string, NodeJS.Timeout>()

  constructor(configStore?: ConfigStore) {
    this.configStore = configStore || globalConfigStore
  }

  public async openProjectDialog(window?: BrowserWindow | null): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || (undefined as any), {
      title: '打开小说工程文件夹',
      properties: ['openDirectory']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  public async createProjectDialog(window?: BrowserWindow | null): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || (undefined as any), {
      title: '新建或选择小说工程文件夹',
      properties: ['openDirectory', 'createDirectory']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  public closeWatcher(): void {
    if (this.activeWatcher) {
      try {
        this.activeWatcher.close()
      } catch {
        // ignore
      }
      this.activeWatcher = null
    }
    for (const timer of this.watcherDebounceTimers.values()) {
      clearTimeout(timer)
    }
    this.watcherDebounceTimers.clear()
  }

  private startWatchingManuscript(projectPath: string): void {
    this.closeWatcher()

    const manuscriptDir = path.join(projectPath, 'manuscript')
    if (!fs.existsSync(manuscriptDir)) return

    try {
      this.activeWatcher = fs.watch(manuscriptDir, { recursive: true }, (_eventType, filename) => {
        if (!filename || !filename.endsWith('.txt')) return

        const existingTimer = this.watcherDebounceTimers.get(filename)
        if (existingTimer) clearTimeout(existingTimer)

        const timer = setTimeout(() => {
          this.watcherDebounceTimers.delete(filename)
          const filePath = path.join(manuscriptDir, filename)
          let content = ''
          if (fs.existsSync(filePath)) {
            try {
              content = fs.readFileSync(filePath, 'utf-8')
            } catch {
              content = ''
            }
          }

          const payload: ProjectFileChangedPayload = {
            projectPath,
            filePath,
            filename: path.basename(filename),
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
            // ignore during unit tests
          }
        }, 150)

        this.watcherDebounceTimers.set(filename, timer)
      })
    } catch {
      // ignore watch failures
    }
  }

  public scanStoryBible(projectPath: string): StoryBibleData {
    const storyDir = path.join(projectPath, 'story')
    const outlinesDir = path.join(storyDir, 'outlines')
    const charactersDir = path.join(storyDir, 'characters')
    const ledgerFile = path.join(storyDir, 'ledger.txt')

    if (!fs.existsSync(outlinesDir)) fs.mkdirSync(outlinesDir, { recursive: true })
    if (!fs.existsSync(charactersDir)) fs.mkdirSync(charactersDir, { recursive: true })

    const outlines: StoryBibleFile[] = []
    const characters: StoryBibleFile[] = []

    // Read outlines
    if (fs.existsSync(outlinesDir)) {
      const files = fs.readdirSync(outlinesDir)
      for (const f of files) {
        if (f.endsWith('.txt') && !f.startsWith('.')) {
          const fullPath = path.join(outlinesDir, f)
          try {
            const stat = fs.statSync(fullPath)
            outlines.push({
              id: `outline-${f}`,
              type: 'outline',
              title: path.basename(f, '.txt'),
              filename: f,
              relativePath: path.join('story', 'outlines', f),
              content: fs.readFileSync(fullPath, 'utf-8'),
              updatedAt: stat.mtimeMs
            })
          } catch {
            // ignore
          }
        }
      }
    }

    // Read characters
    if (fs.existsSync(charactersDir)) {
      const files = fs.readdirSync(charactersDir)
      for (const f of files) {
        if (f.endsWith('.txt') && !f.startsWith('.')) {
          const fullPath = path.join(charactersDir, f)
          try {
            const stat = fs.statSync(fullPath)
            characters.push({
              id: `char-${f}`,
              type: 'character',
              title: path.basename(f, '.txt'),
              filename: f,
              relativePath: path.join('story', 'characters', f),
              content: fs.readFileSync(fullPath, 'utf-8'),
              updatedAt: stat.mtimeMs
            })
          } catch {
            // ignore
          }
        }
      }
    }

        // Read threads (暗线)
    const threadsFile = path.join(storyDir, 'threads.txt')
    const legacyLedgerFile = path.join(storyDir, 'ledger.txt')
    const targetFile = fs.existsSync(threadsFile)
      ? threadsFile
      : (fs.existsSync(legacyLedgerFile) ? legacyLedgerFile : threadsFile)

    let ledger: StoryBibleFile | null = null
    if (fs.existsSync(targetFile)) {
      try {
        const stat = fs.statSync(targetFile)
        ledger = {
          id: 'story-threads',
          type: 'ledger',
          title: '暗线',
          filename: path.basename(targetFile),
          relativePath: path.join('story', path.basename(targetFile)),
          content: fs.readFileSync(targetFile, 'utf-8'),
          updatedAt: stat.mtimeMs
        }
      } catch {
        // ignore
      }
    } else {
      // Completely blank initial content (Zero mock template)
      fs.writeFileSync(threadsFile, '', 'utf-8')
      ledger = {
        id: 'story-threads',
        type: 'ledger',
        title: '暗线',
        filename: 'threads.txt',
        relativePath: path.join('story', 'threads.txt'),
        content: '',
        updatedAt: Date.now()
      }
    }

    return { outlines, characters, ledger }
  }

  public async loadProject(projectPath: string): Promise<ProjectData> {
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true })
    }

    const manuscriptDir = path.join(projectPath, 'manuscript')
    const storyDir = path.join(projectPath, 'story')
    const metaDir = path.join(projectPath, '.explosion')

    if (!fs.existsSync(manuscriptDir)) fs.mkdirSync(manuscriptDir, { recursive: true })
    if (!fs.existsSync(storyDir)) fs.mkdirSync(storyDir, { recursive: true })
    if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true })

    const metaFile = path.join(metaDir, 'project.json')
    let title = path.basename(projectPath)
    let activeChapterId: string | undefined

    if (fs.existsSync(metaFile)) {
      try {
        const raw = fs.readFileSync(metaFile, 'utf-8')
        const meta = JSON.parse(raw)
        if (meta.title) title = meta.title
        if (meta.activeChapterId) activeChapterId = meta.activeChapterId
      } catch {
        // ignore json error
      }
    } else {
      fs.writeFileSync(metaFile, JSON.stringify({ title, createdAt: Date.now() }, null, 2), 'utf-8')
    }

    // Read chapters from manuscript/ with multi-volume support
    const chapters: ProjectChapterFile[] = []
    const rootEntries = fs.readdirSync(manuscriptDir, { withFileTypes: true })

    // Check for volume subdirectories or flat txt files
    for (const entry of rootEntries) {
      if (entry.name.startsWith('.')) continue

      if (entry.isDirectory()) {
        const volumeName = entry.name
        const volumeDir = path.join(manuscriptDir, volumeName)
        const volFiles = fs
          .readdirSync(volumeDir)
          .filter((f) => f.endsWith('.txt') && !f.startsWith('.'))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

        for (const file of volFiles) {
          const filePath = path.join(volumeDir, file)
          let content = ''
          try {
            content = fs.readFileSync(filePath, 'utf-8')
          } catch {
            content = ''
          }

          const stat = fs.statSync(filePath)
          let cleanTitle = path.basename(file, '.txt')
          const match = cleanTitle.match(/^\d+-(.+)$/)
          if (match) cleanTitle = match[1]

          chapters.push({
            id: `ch-${volumeName}-${file}`,
            title: cleanTitle,
            content,
            filename: file,
            volume: volumeName,
            relativePath: path.join('manuscript', volumeName, file),
            updatedAt: stat.mtimeMs
          })
        }
      } else if (entry.isFile() && entry.name.endsWith('.txt')) {
        const filePath = path.join(manuscriptDir, entry.name)
        let content = ''
        try {
          content = fs.readFileSync(filePath, 'utf-8')
        } catch {
          content = ''
        }

        const stat = fs.statSync(filePath)
        let cleanTitle = path.basename(entry.name, '.txt')
        const match = cleanTitle.match(/^\d+-(.+)$/)
        if (match) cleanTitle = match[1]

        chapters.push({
          id: `ch-root-${entry.name}`,
          title: cleanTitle,
          content,
          filename: entry.name,
          relativePath: path.join('manuscript', entry.name),
          updatedAt: stat.mtimeMs
        })
      }
    }

    // Sort root chapters numerically
    chapters.sort((a, b) => {
      if (a.volume && b.volume && a.volume !== b.volume) {
        return a.volume.localeCompare(b.volume, undefined, { numeric: true, sensitivity: 'base' })
      }
      return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' })
    })

    if (chapters.length === 0) {
      // Initialize with first blank chapter
      const defaultFilename = '001-第一章.txt'
      const defaultFilePath = path.join(manuscriptDir, defaultFilename)
      fs.writeFileSync(defaultFilePath, '', 'utf-8')

      chapters.push({
        id: 'ch-1',
        title: '第一章',
        content: '',
        filename: defaultFilename,
        relativePath: path.join('manuscript', defaultFilename),
        updatedAt: Date.now()
      })
    }

    // Scan Story Bible
    const storyBible = this.scanStoryBible(projectPath)

    // Persist last opened project in app config
    const currentConfig = this.configStore.getConfig()
    currentConfig.workspace.lastProjectPath = projectPath
    this.configStore.saveConfig(currentConfig)

    // Watch manuscript/ for live file sync
    this.startWatchingManuscript(projectPath)

    return {
      path: projectPath,
      title,
      chapters,
      activeChapterId: activeChapterId || chapters[0].id,
      storyBible
    }
  }

  public closeCurrentProject(): boolean {
    this.closeWatcher()
    const currentConfig = this.configStore.getConfig()
    currentConfig.workspace.lastProjectPath = null
    this.configStore.saveConfig(currentConfig)
    return true
  }

  public saveProjectChapter(
    projectPath: string,
    chapter: ProjectChapterFile
  ): boolean {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    const targetDir = chapter.volume
      ? path.join(manuscriptDir, chapter.volume)
      : manuscriptDir

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const filePath = path.join(targetDir, chapter.filename)

    // Save manual snapshot before overwrite
    if (fs.existsSync(filePath)) {
      try {
        const oldContent = fs.readFileSync(filePath, 'utf-8')
        globalSnapshotManager.createSnapshot(projectPath, filePath, oldContent, 'manual').catch(() => {})
      } catch {}
    }

    fs.writeFileSync(filePath, chapter.content || '', 'utf-8')
    return true
  }

  public renameProjectChapter(
    projectPath: string,
    _chapterId: string,
    oldFilename: string,
    newTitle: string
  ): { success: boolean; newFilename: string } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    const oldPath = path.join(manuscriptDir, oldFilename)

    const prefixMatch = oldFilename.match(/^(\d+-)/)
    const prefix = prefixMatch ? prefixMatch[1] : ''
    const safeTitle = newTitle.replace(/[\\/:*?"<>|]/g, '_')
    const newFilename = `${prefix}${safeTitle}.txt`
    const newPath = path.join(manuscriptDir, newFilename)

    if (fs.existsSync(oldPath)) {
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath)
      }
    } else {
      fs.writeFileSync(newPath, '', 'utf-8')
    }

    return { success: true, newFilename }
  }

  public deleteProjectChapter(projectPath: string, filename: string): boolean {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    const filePath = path.join(manuscriptDir, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  }

  public saveProjectMeta(projectPath: string, title: string): boolean {
    const metaDir = path.join(projectPath, '.explosion')
    if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true })
    const metaFile = path.join(metaDir, 'project.json')

    let data: Record<string, unknown> = {}
    if (fs.existsSync(metaFile)) {
      try {
        data = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
      } catch {
        // ignore
      }
    }
    data.title = title
    data.updatedAt = Date.now()
    fs.writeFileSync(metaFile, JSON.stringify(data, null, 2), 'utf-8')
    return true
  }

  // Story Bible Management
  public saveStoryFile(projectPath: string, relativePath: string, content: string): boolean {
    const targetFile = path.resolve(projectPath, relativePath)
    fs.mkdirSync(path.dirname(targetFile), { recursive: true })

    if (fs.existsSync(targetFile)) {
      try {
        const oldContent = fs.readFileSync(targetFile, 'utf-8')
        globalSnapshotManager.createSnapshot(projectPath, targetFile, oldContent, 'manual').catch(() => {})
      } catch {}
    }

    fs.writeFileSync(targetFile, content, 'utf-8')
    return true
  }

  public createStoryFile(
    projectPath: string,
    type: 'outline' | 'character',
    title: string
  ): StoryBibleFile {
    const folder = type === 'outline' ? 'outlines' : 'characters'
    const targetDir = path.join(projectPath, 'story', folder)
    fs.mkdirSync(targetDir, { recursive: true })

    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim() || (type === 'outline' ? '新大纲' : '新人物')
    const filename = `${safeTitle}.txt`
    const filePath = path.join(targetDir, filename)

    const initialContent = ''

    fs.writeFileSync(filePath, initialContent, 'utf-8')

    return {
      id: `${type}-${filename}`,
      type,
      title: safeTitle,
      filename,
      relativePath: path.join('story', folder, filename),
      content: initialContent,
      updatedAt: Date.now()
    }
  }

  public deleteStoryFile(projectPath: string, relativePath: string): boolean {
    const targetFile = path.resolve(projectPath, relativePath)
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile)
      return true
    }
    return false
  }
}

export const globalProjectManager = new ProjectManager()
