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
    const files = fs.readdirSync(libPath)

    const books: LibraryBook[] = []
    for (const file of files) {
      if (file.startsWith('.')) continue
      const fullPath = path.join(libPath, file)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isFile() && file.endsWith('.txt')) {
          books.push({
            filename: file,
            path: fullPath,
            size: stat.size,
            updatedAt: stat.mtimeMs,
            isProcessing: this.processingFilenames.has(file)
          })
        }
      } catch {
        // ignore
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
    const filePath = path.join(libPath, filename)

    if (!fs.existsSync(filePath)) {
      return false
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
    const filePath = path.join(libPath, filename)

    if (!fs.existsSync(filePath)) {
      throw new Error(`藏书文件不存在: ${filename}`)
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
      filename,
      content,
      size: buf.length
    }
  }

  public deleteLibraryFile(filename: string): boolean {
    const libPath = this.getLibraryPath()
    const filePath = path.join(libPath, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      this.broadcastBooksUpdated()
      return true
    }
    return false
  }
}

export const globalLibraryManager = new LibraryManager()
