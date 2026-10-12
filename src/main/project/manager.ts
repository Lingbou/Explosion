import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow, dialog } from 'electron'
import {
  IPC_CHANNELS,
  ProjectChapterFile,
  ProjectData,
  ProjectFileChangedPayload,
  StoryBibleData,
  StoryBibleFile,
  ManuscriptExportResult
} from '../../shared/types/ipc'
import { exportManuscriptToFile } from './exporter'
import { ConfigStore, globalConfigStore } from '../config/store'
import { globalSnapshotManager } from './snapshot-manager'

function extractCleanTitle(filename: string): string {
  let name = path.basename(filename, '.txt')
  name = name.replace(/^\.moving-\d+-/, '')
  const match = name.match(/^\d+-(.+)$/)
  if (match) {
    name = match[1]
  }
  return name.trim() || '未命名章节'
}

function formatChapterFilename(orderIndex: number, cleanTitle: string): string {
  const pad = String(orderIndex).padStart(3, '0')
  const safeTitle = cleanTitle.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名章节'
  return `${pad}-${safeTitle}.txt`
}

function renumberDirectoryFiles(dir: string, orderedFilenames: string[]): void {
  if (!fs.existsSync(dir)) return

  const renames: { oldName: string; newName: string; oldPath: string; newPath: string }[] = []

  orderedFilenames.forEach((filename, idx) => {
    const cleanTitle = extractCleanTitle(filename)
    const newFilename = formatChapterFilename(idx + 1, cleanTitle)
    renames.push({
      oldName: filename,
      newName: newFilename,
      oldPath: path.join(dir, filename),
      newPath: path.join(dir, newFilename)
    })
  })

  // Phase 1: Rename files that change name to unique temporary names
  const temps: { tempPath: string; newPath: string }[] = []
  const timestamp = Date.now()
  for (let i = 0; i < renames.length; i++) {
    const item = renames[i]
    if (item.oldName === item.newName) continue
    if (fs.existsSync(item.oldPath)) {
      const tempPath = path.join(
        dir,
        `.tmp-${timestamp}-${i}-${Math.random().toString(36).substring(2, 6)}.tmp`
      )
      fs.renameSync(item.oldPath, tempPath)
      temps.push({ tempPath, newPath: item.newPath })
    }
  }

  // Phase 2: Rename temporary files to their final names
  for (const item of temps) {
    fs.renameSync(item.tempPath, item.newPath)
  }
}

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
    const threadsFile = path.join(storyDir, 'threads.txt')
    const legacyLedgerFile = path.join(storyDir, 'ledger.txt')

    if (!fs.existsSync(outlinesDir)) fs.mkdirSync(outlinesDir, { recursive: true })
    if (!fs.existsSync(charactersDir)) fs.mkdirSync(charactersDir, { recursive: true })

    const outlines: StoryBibleFile[] = []
    const characters: StoryBibleFile[] = []

    // Helper to sanitize and purge legacy mock boilerplate
    const sanitizeStoryContent = (filePath: string, raw: string): string => {
      if (
        raw.includes('古老指环') ||
        raw.includes('主角的隐秘身世') ||
        raw.includes('本作伏笔账本') ||
        raw.includes('【本作伏笔账本】') ||
        raw.includes('本卷核心主线矛盾与剧情推演脉络') ||
        raw.includes('性格特征与行事逻辑')
      ) {
        fs.writeFileSync(filePath, '', 'utf-8')
        return ''
      }
      return raw
    }

    // Read outlines
    if (fs.existsSync(outlinesDir)) {
      const files = fs.readdirSync(outlinesDir)
      for (const f of files) {
        if (f.endsWith('.txt') && !f.startsWith('.')) {
          const fullPath = path.join(outlinesDir, f)
          try {
            const stat = fs.statSync(fullPath)
            const rawContent = fs.readFileSync(fullPath, 'utf-8')
            const content = sanitizeStoryContent(fullPath, rawContent)
            outlines.push({
              id: `outline-${f}`,
              type: 'outline',
              title: path.basename(f, '.txt'),
              filename: f,
              relativePath: path.join('story', 'outlines', f),
              content,
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
            const rawContent = fs.readFileSync(fullPath, 'utf-8')
            const content = sanitizeStoryContent(fullPath, rawContent)
            characters.push({
              id: `char-${f}`,
              type: 'character',
              title: path.basename(f, '.txt'),
              filename: f,
              relativePath: path.join('story', 'characters', f),
              content,
              updatedAt: stat.mtimeMs
            })
          } catch {
            // ignore
          }
        }
      }
    }

    // Read threads (暗线) - Clean migration & mock purge
    if (fs.existsSync(legacyLedgerFile) && !fs.existsSync(threadsFile)) {
      try {
        fs.renameSync(legacyLedgerFile, threadsFile)
      } catch {
        // ignore
      }
    } else if (fs.existsSync(legacyLedgerFile) && fs.existsSync(threadsFile)) {
      try {
        fs.unlinkSync(legacyLedgerFile)
      } catch {}
    }

    const targetThreadsFile = fs.existsSync(threadsFile)
      ? threadsFile
      : (fs.existsSync(legacyLedgerFile) ? legacyLedgerFile : threadsFile)

    let ledger: StoryBibleFile | null = null
    if (fs.existsSync(targetThreadsFile)) {
      try {
        const rawContent = fs.readFileSync(targetThreadsFile, 'utf-8')
        const content = sanitizeStoryContent(targetThreadsFile, rawContent)
        const stat = fs.statSync(targetThreadsFile)
        ledger = {
          id: 'story-threads',
          type: 'ledger',
          title: '暗线',
          filename: path.basename(targetThreadsFile),
          relativePath: path.join('story', path.basename(targetThreadsFile)),
          content,
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

  public scanManuscript(projectPath: string): { chapters: ProjectChapterFile[]; volumes: string[] } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    if (!fs.existsSync(manuscriptDir)) {
      fs.mkdirSync(manuscriptDir, { recursive: true })
    }

    const volumes: string[] = []
    const chapters: ProjectChapterFile[] = []

    const rootEntries = fs.readdirSync(manuscriptDir, { withFileTypes: true })

    for (const entry of rootEntries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) {
        volumes.push(entry.name)
      }
    }
    volumes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    // Flat chapters in root
    const rootFiles = rootEntries
      .filter((e) => e.isFile() && e.name.endsWith('.txt') && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    for (const file of rootFiles) {
      const filePath = path.join(manuscriptDir, file)
      let content = ''
      try {
        content = fs.readFileSync(filePath, 'utf-8')
      } catch {
        content = ''
      }
      const stat = fs.statSync(filePath)
      const cleanTitle = extractCleanTitle(file)
      chapters.push({
        id: `ch-root-${file}`,
        title: cleanTitle,
        content,
        filename: file,
        relativePath: path.join('manuscript', file),
        updatedAt: stat.mtimeMs
      })
    }

    // Chapters in volumes
    for (const volumeName of volumes) {
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
        const cleanTitle = extractCleanTitle(file)
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
    }

    return { chapters, volumes }
  }

  public listVolumes(projectPath: string): string[] {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    if (!fs.existsSync(manuscriptDir)) return []
    const entries = fs.readdirSync(manuscriptDir, { withFileTypes: true })
    const volumes = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    return volumes
  }

  public createVolume(
    projectPath: string,
    volumeName: string
  ): { success: boolean; volumeName: string } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    if (!fs.existsSync(manuscriptDir)) {
      fs.mkdirSync(manuscriptDir, { recursive: true })
    }

    let safeName = volumeName.replace(/[\\/:*?"<>|]/g, '_').trim()
    if (!safeName) {
      const existing = this.listVolumes(projectPath)
      safeName = `第${existing.length + 1}卷`
    }

    let targetDir = path.join(manuscriptDir, safeName)
    let counter = 1
    const baseSafeName = safeName
    while (fs.existsSync(targetDir)) {
      safeName = `${baseSafeName} (${counter++})`
      targetDir = path.join(manuscriptDir, safeName)
    }

    fs.mkdirSync(targetDir, { recursive: true })
    return { success: true, volumeName: safeName }
  }

  public renameVolume(
    projectPath: string,
    oldVolumeName: string,
    newVolumeName: string
  ): { success: boolean; newVolumeName: string } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    const oldPath = path.join(manuscriptDir, oldVolumeName)
    if (!fs.existsSync(oldPath)) {
      return { success: false, newVolumeName: oldVolumeName }
    }

    const safeName = newVolumeName.replace(/[\\/:*?"<>|]/g, '_').trim()
    if (!safeName) {
      return { success: false, newVolumeName: oldVolumeName }
    }

    const newPath = path.join(manuscriptDir, safeName)
    if (oldPath !== newPath) {
      if (fs.existsSync(newPath)) {
        return { success: false, newVolumeName: oldVolumeName }
      }
      fs.renameSync(oldPath, newPath)
    }

    return { success: true, newVolumeName: safeName }
  }

  public deleteVolume(
    projectPath: string,
    volumeName: string,
    keepChapters: boolean = true
  ): { success: boolean } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    const volPath = path.join(manuscriptDir, volumeName)
    if (!fs.existsSync(volPath)) {
      return { success: true }
    }

    if (keepChapters) {
      // Content protection: move all chapters to manuscript/ root
      const files = fs
        .readdirSync(volPath)
        .filter((f) => f.endsWith('.txt') && !f.startsWith('.'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

      const rootExisting = fs
        .readdirSync(manuscriptDir)
        .filter((f) => f.endsWith('.txt') && !f.startsWith('.'))

      const allFiles = [...rootExisting]
      for (const f of files) {
        const srcFile = path.join(volPath, f)
        let destFilename = f
        let counter = 1
        while (fs.existsSync(path.join(manuscriptDir, destFilename))) {
          const clean = extractCleanTitle(f)
          destFilename = `${String(allFiles.length + counter).padStart(3, '0')}-${clean}.txt`
          counter++
        }
        const destFile = path.join(manuscriptDir, destFilename)
        fs.renameSync(srcFile, destFile)
        allFiles.push(destFilename)
      }

      renumberDirectoryFiles(manuscriptDir, allFiles)
      try {
        fs.rmSync(volPath, { recursive: true, force: true })
      } catch {}
    } else {
      // Create snapshots before deleting for ultimate safety
      try {
        const files = fs.readdirSync(volPath).filter((f) => f.endsWith('.txt'))
        for (const f of files) {
          const filePath = path.join(volPath, f)
          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            globalSnapshotManager.createSnapshot(projectPath, filePath, content, 'manual').catch(() => {})
          } catch {}
        }
      } catch {}

      fs.rmSync(volPath, { recursive: true, force: true })
    }

    return { success: true }
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

    // Read chapters & volumes from manuscript/ with multi-volume support
    const scanned = this.scanManuscript(projectPath)
    const chapters = scanned.chapters
    const volumes = scanned.volumes

    if (volumes.length === 0 && chapters.length === 0) {
      const defaultFilename = '001-第一章.txt'
      const defaultFilePath = path.join(manuscriptDir, defaultFilename)
      fs.writeFileSync(defaultFilePath, '', 'utf-8')

      chapters.push({
        id: 'ch-root-001-第一章.txt',
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
      volumes,
      activeChapterId: activeChapterId || (chapters.length > 0 ? chapters[0].id : undefined),
      storyBible
    }
  }

  public async exportManuscript(
    projectPath: string,
    targetPath?: string,
    window?: BrowserWindow | null
  ): Promise<ManuscriptExportResult> {
    return exportManuscriptToFile(projectPath, targetPath, window)
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
    newTitle: string,
    volume?: string
  ): { success: boolean; newFilename: string } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    let targetDir = volume ? path.join(manuscriptDir, volume) : manuscriptDir
    let oldPath = path.join(targetDir, oldFilename)

    if (!fs.existsSync(oldPath) && !volume) {
      const volumes = this.listVolumes(projectPath)
      for (const vol of volumes) {
        const possiblePath = path.join(manuscriptDir, vol, oldFilename)
        if (fs.existsSync(possiblePath)) {
          targetDir = path.join(manuscriptDir, vol)
          oldPath = possiblePath
          break
        }
      }
    }

    const prefixMatch = oldFilename.match(/^(\d+-)/)
    const prefix = prefixMatch ? prefixMatch[1] : ''
    const safeTitle = newTitle.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名章节'
    const newFilename = `${prefix}${safeTitle}.txt`
    const newPath = path.join(targetDir, newFilename)

    if (fs.existsSync(oldPath)) {
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath)
      }
    } else {
      fs.writeFileSync(newPath, '', 'utf-8')
    }

    return { success: true, newFilename }
  }

  public deleteProjectChapter(
    projectPath: string,
    filename: string,
    volume?: string
  ): boolean {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    let targetDir = volume ? path.join(manuscriptDir, volume) : manuscriptDir
    let filePath = path.join(targetDir, filename)

    if (!fs.existsSync(filePath) && !volume) {
      const volumes = this.listVolumes(projectPath)
      for (const vol of volumes) {
        const possible = path.join(manuscriptDir, vol, filename)
        if (fs.existsSync(possible)) {
          targetDir = path.join(manuscriptDir, vol)
          filePath = possible
          break
        }
      }
    }

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        globalSnapshotManager.createSnapshot(projectPath, filePath, content, 'manual').catch(() => {})
      } catch {}
      fs.unlinkSync(filePath)
    }

    // Renumber remaining chapters in targetDir to ensure continuous numbering with no holes
    if (fs.existsSync(targetDir)) {
      const remainingFiles = fs
        .readdirSync(targetDir)
        .filter((f) => f.endsWith('.txt') && !f.startsWith('.'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      renumberDirectoryFiles(targetDir, remainingFiles)
    }

    return true
  }

  public reorderProjectChapters(
    projectPath: string,
    volume: string | undefined,
    orderedFilenames: string[]
  ): { success: boolean; chapters: ProjectChapterFile[] } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    const dir = volume ? path.join(manuscriptDir, volume) : manuscriptDir

    if (fs.existsSync(dir)) {
      renumberDirectoryFiles(dir, orderedFilenames)
    }

    const scanned = this.scanManuscript(projectPath)
    return { success: true, chapters: scanned.chapters }
  }

  public moveProjectChapter(
    projectPath: string,
    params: {
      chapterId?: string
      filename: string
      sourceVolume?: string
      targetVolume?: string
      targetIndex: number
    }
  ): { success: boolean; chapters: ProjectChapterFile[] } {
    const manuscriptDir = path.join(projectPath, 'manuscript')
    const srcDir = params.sourceVolume ? path.join(manuscriptDir, params.sourceVolume) : manuscriptDir
    const dstDir = params.targetVolume ? path.join(manuscriptDir, params.targetVolume) : manuscriptDir
    const srcFile = path.join(srcDir, params.filename)

    if (!fs.existsSync(srcFile)) {
      const scanned = this.scanManuscript(projectPath)
      return { success: false, chapters: scanned.chapters }
    }

    if (srcDir === dstDir) {
      // Reordering within the same volume / flat list
      const existing = fs
        .readdirSync(srcDir)
        .filter((f) => f.endsWith('.txt') && !f.startsWith('.'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

      const filtered = existing.filter((f) => f !== params.filename)
      const targetIndex = Math.max(0, Math.min(params.targetIndex, filtered.length))
      filtered.splice(targetIndex, 0, params.filename)

      renumberDirectoryFiles(srcDir, filtered)
    } else {
      // Cross-volume move
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true })
      }

      // 1. Remove from source and renumber remaining source chapters
      const srcRemaining = fs
        .readdirSync(srcDir)
        .filter((f) => f.endsWith('.txt') && !f.startsWith('.') && f !== params.filename)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

      // 2. Move file to target with temporary name
      const tempDestName = `.moving-${Date.now()}-${params.filename}`
      const tempDestPath = path.join(dstDir, tempDestName)
      fs.renameSync(srcFile, tempDestPath)

      renumberDirectoryFiles(srcDir, srcRemaining)

      // 3. Insert into target list and renumber target directory
      const dstExisting = fs
        .readdirSync(dstDir)
        .filter((f) => f.endsWith('.txt') && !f.startsWith('.') && f !== tempDestName)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

      const targetIndex = Math.max(0, Math.min(params.targetIndex, dstExisting.length))
      dstExisting.splice(targetIndex, 0, tempDestName)

      renumberDirectoryFiles(dstDir, dstExisting)
    }

    const scanned = this.scanManuscript(projectPath)
    return { success: true, chapters: scanned.chapters }
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
    title?: string
  ): StoryBibleFile {
    const folder = type === 'outline' ? 'outlines' : 'characters'
    const targetDir = path.join(projectPath, 'story', folder)
    fs.mkdirSync(targetDir, { recursive: true })

    let safeTitle = (title || '').replace(/[\\/:*?"<>|]/g, '_').trim()
    if (!safeTitle) {
      const existing = fs.readdirSync(targetDir)
      const basePrefix = type === 'outline' ? '新大纲' : '新人物'
      let counter = 1
      safeTitle = `${basePrefix} ${counter}`
      while (existing.includes(`${safeTitle}.txt`)) {
        counter++
        safeTitle = `${basePrefix} ${counter}`
      }
    }

    const filename = `${safeTitle}.txt`
    const filePath = path.join(targetDir, filename)

    // Strictly blank initial content (zero mock template)
    fs.writeFileSync(filePath, '', 'utf-8')

    return {
      id: `${type}-${filename}`,
      type,
      title: safeTitle,
      filename,
      relativePath: path.join('story', folder, filename),
      content: '',
      updatedAt: Date.now()
    }
  }

  public renameStoryFile(
    projectPath: string,
    relativePath: string,
    newTitle: string
  ): { success: boolean; newRelativePath: string; newFilename: string } {
    const oldPath = path.resolve(projectPath, relativePath)
    const folder = path.dirname(oldPath)
    const safeTitle = newTitle.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名'
    const newFilename = `${safeTitle}.txt`
    const newPath = path.join(folder, newFilename)

    if (fs.existsSync(oldPath)) {
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath)
      }
    } else {
      fs.writeFileSync(newPath, '', 'utf-8')
    }

    const newRelativePath = path.relative(projectPath, newPath)
    return { success: true, newRelativePath, newFilename }
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
