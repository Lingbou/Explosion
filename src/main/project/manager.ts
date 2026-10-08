import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow, dialog } from 'electron'
import { IPC_CHANNELS, ProjectChapterFile, ProjectData, ProjectFileChangedPayload } from '../../shared/types/ipc'
import { ConfigStore, globalConfigStore } from '../config/store'

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
      this.activeWatcher = fs.watch(manuscriptDir, (_eventType, filename) => {
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
            filename,
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
      // ignore watch failures on some file systems
    }
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

    // Read chapters from manuscript/
    const files = fs.readdirSync(manuscriptDir)
    const txtFiles = files
      .filter((f) => f.endsWith('.txt') && !f.startsWith('.'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    const chapters: ProjectChapterFile[] = []

    if (txtFiles.length === 0) {
      // Initialize with first blank chapter
      const defaultFilename = '001-第一章.txt'
      const defaultFilePath = path.join(manuscriptDir, defaultFilename)
      fs.writeFileSync(defaultFilePath, '', 'utf-8')

      chapters.push({
        id: 'ch-1',
        title: '第一章',
        content: '',
        filename: defaultFilename,
        updatedAt: Date.now()
      })
    } else {
      txtFiles.forEach((file, index) => {
        const filePath = path.join(manuscriptDir, file)
        let content = ''
        try {
          content = fs.readFileSync(filePath, 'utf-8')
        } catch {
          // Fallback if encoding issues
          content = ''
        }

        const stat = fs.statSync(filePath)
        // Clean title from filename (strip "001-" or extension)
        let cleanTitle = path.basename(file, '.txt')
        const match = cleanTitle.match(/^\d+-(.+)$/)
        if (match) {
          cleanTitle = match[1]
        }

        chapters.push({
          id: `ch-${index + 1}`,
          title: cleanTitle,
          content,
          filename: file,
          updatedAt: stat.mtimeMs
        })
      })
    }

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
      activeChapterId: activeChapterId || chapters[0].id
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
    if (!fs.existsSync(manuscriptDir)) {
      fs.mkdirSync(manuscriptDir, { recursive: true })
    }

    const filePath = path.join(manuscriptDir, chapter.filename)
    fs.writeFileSync(filePath, chapter.content || '', 'utf-8')
    return true
  }

  public renameProjectChapter(
    projectPath: string,
    chapterId: string,
    oldFilename: string,
    newTitle: string
  ): { success: boolean; newFilename: string } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    const oldPath = path.join(manuscriptDir, oldFilename)

    // Preserve number prefix if existing filename has "001-"
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
}

export const globalProjectManager = new ProjectManager()
