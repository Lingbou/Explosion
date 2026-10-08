import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { BrowserWindow, dialog, shell } from 'electron'
import { IPC_CHANNELS, LibraryBook, LibraryBookContent } from '../../shared/types/ipc'
import { ConfigStore, globalConfigStore } from '../config/store'

export class LibraryManager {
  private configStore: ConfigStore
  private processingFilenames = new Set<string>()

  constructor(configStore?: ConfigStore) {
    this.configStore = configStore || globalConfigStore
  }

  private getLibraryPath(): string {
    const config = this.configStore.getConfig()
    const libPath = config.workspace.libraryPath
    if (!fs.existsSync(libPath)) {
      fs.mkdirSync(libPath, { recursive: true })
    }
    return libPath
  }

  public getProcessingFilenames(): string[] {
    return Array.from(this.processingFilenames)
  }

  private broadcastProcessingStatus(): void {
    const filenames = this.getProcessingFilenames()
    try {
      const wins = (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function')
        ? BrowserWindow.getAllWindows()
        : []
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.LIBRARY_PROCESSING_STATUS, {
            processingFilenames: filenames
          })
        }
      }
    } catch {
      // ignore
    }
  }

  private broadcastBooksUpdated(): void {
    const books = this.listLibraryFiles()
    try {
      const wins = (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function')
        ? BrowserWindow.getAllWindows()
        : []
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.LIBRARY_BOOKS_UPDATED, books)
        }
      }
    } catch {
      // ignore
    }
  }

  public listLibraryFiles(): LibraryBook[] {
    const libPath = this.getLibraryPath()
    if (!fs.existsSync(libPath)) return []

    const entries = fs.readdirSync(libPath, { withFileTypes: true })
    const books: LibraryBook[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      if (entry.isDirectory()) {
        const bookName = entry.name
        const bookDir = path.join(libPath, bookName)
        try {
          const files = fs.readdirSync(bookDir)
          for (const file of files) {
            if (file.startsWith('.') || !file.endsWith('.txt')) continue
            const fullPath = path.join(bookDir, file)
            const stat = fs.statSync(fullPath)
            books.push({
              filename: file,
              path: fullPath,
              relativePath: path.join(bookName, file),
              bookName,
              size: stat.size,
              updatedAt: stat.mtimeMs,
              isProcessing: this.processingFilenames.has(file) || this.processingFilenames.has(bookName)
            })
          }
        } catch {
          // ignore
        }
      } else if (entry.isFile() && entry.name.endsWith('.txt')) {
        const fullPath = path.join(libPath, entry.name)
        try {
          const stat = fs.statSync(fullPath)
          books.push({
            filename: entry.name,
            path: fullPath,
            relativePath: entry.name,
            size: stat.size,
            updatedAt: stat.mtimeMs,
            isProcessing: this.processingFilenames.has(entry.name)
          })
        } catch {
          // ignore
        }
      }
    }

    return books.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  public async importLibraryFiles(
    window?: BrowserWindow | null
  ): Promise<{ success: boolean; importedCount: number; books: LibraryBook[] }> {
    const res = await dialog.showOpenDialog((window || undefined) as any, {
      title: '导入长篇小说/参考资料 TXT',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '纯文本文件 (*.txt)', extensions: ['txt'] }]
    })

    if (res.canceled || res.filePaths.length === 0) {
      return { success: false, importedCount: 0, books: this.listLibraryFiles() }
    }

    const libPath = this.getLibraryPath()
    let importedCount = 0

    for (const srcPath of res.filePaths) {
      const filename = path.basename(srcPath)
      const destPath = path.join(libPath, filename)
      try {
        fs.copyFileSync(srcPath, destPath)
        importedCount++
        // Auto-launch background splitting worker for imported books
        this.processLibraryFile(filename).catch(() => {})
      } catch {
        // ignore
      }
    }

    this.broadcastBooksUpdated()

    return {
      success: true,
      importedCount,
      books: this.listLibraryFiles()
    }
  }

  public async processLibraryFile(filename: string): Promise<boolean> {
    const libPath = this.getLibraryPath()
    let filePath = path.join(libPath, filename)

    if (!fs.existsSync(filePath)) {
      const all = this.listLibraryFiles()
      const match = all.find((b) => b.filename === filename || b.relativePath === filename)
      if (match) filePath = match.path
      else return false
    }

    this.processingFilenames.add(filename)
    this.broadcastProcessingStatus()

    // Find script: check ~/.explosion/scripts/organize_library.py or bundled
    const pythonScript = path.join(this.configStore.getPaths().scriptsDir, 'organize_library.py')
    const candidates = [
      pythonScript,
      path.resolve(__dirname, 'organize_library.py'),
      path.resolve(__dirname, '../library/organize_library.py'),
      path.resolve(process.cwd(), 'src/main/library/organize_library.py')
    ]

    let scriptPath = ''
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        scriptPath = cand
        break
      }
    }

    if (!scriptPath) {
      this.processingFilenames.delete(filename)
      this.broadcastProcessingStatus()
      return false
    }

    return new Promise<boolean>((resolve) => {
      exec(`python3 "${scriptPath}" "${filePath}" --output-dir "${libPath}"`, (_err) => {
        this.processingFilenames.delete(filename)
        this.broadcastProcessingStatus()
        this.broadcastBooksUpdated()
        resolve(true)
      })
    })
  }

  public async openLibraryFolder(): Promise<boolean> {
    const libPath = this.getLibraryPath()
    await shell.openPath(libPath)
    return true
  }

  public readLibraryFileContent(filename: string): LibraryBookContent {
    const libPath = this.getLibraryPath()
    let filePath = path.join(libPath, filename)

    if (!fs.existsSync(filePath)) {
      const all = this.listLibraryFiles()
      const found = all.find((b) => b.filename === filename || b.relativePath === filename)
      if (found) {
        filePath = found.path
      } else {
        throw new Error(`藏书文件不存在: ${filename}`)
      }
    }

    const buf = fs.readFileSync(filePath)

    let content = ''
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
      content = utf8Decoder.decode(buf)
    } catch {
      try {
        const gbkDecoder = new TextDecoder('gb18030')
        content = gbkDecoder.decode(buf)
      } catch {
        content = buf.toString('utf-8')
      }
    }

    return {
      filename: path.basename(filePath),
      content,
      size: buf.length
    }
  }

  public deleteLibraryFile(filename: string): boolean {
    const libPath = this.getLibraryPath()
    let filePath = path.join(libPath, filename)

    if (!fs.existsSync(filePath)) {
      const all = this.listLibraryFiles()
      const found = all.find((b) => b.filename === filename || b.relativePath === filename)
      if (found) {
        filePath = found.path
      } else {
        return false
      }
    }

    fs.unlinkSync(filePath)

    // Clean up empty folder and its .cache if needed
    const parentDir = path.dirname(filePath)
    if (parentDir !== libPath && fs.existsSync(parentDir)) {
      const remainingTxt = fs.readdirSync(parentDir).filter((f) => f.endsWith('.txt') && !f.startsWith('.'))
      if (remainingTxt.length === 0) {
        try {
          const symlink = path.join(parentDir, '.cache')
          try {
            const stat = fs.lstatSync(symlink)
            if (stat.isSymbolicLink() || stat.isFile()) {
              fs.unlinkSync(symlink)
            }
          } catch {}
          fs.rmdirSync(parentDir)
        } catch {}
      }
    }

    this.broadcastBooksUpdated()
    return true
  }
}

export const globalLibraryManager = new LibraryManager()
