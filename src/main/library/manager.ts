import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow, dialog, shell } from 'electron'
import { LibraryBook, LibraryBookContent } from '../../shared/types/ipc'
import { globalConfigStore } from '../config/store'

export class LibraryManager {
  private getLibraryPath(): string {
    const config = globalConfigStore.getConfig()
    const libPath = config.workspace.libraryPath
    if (!fs.existsSync(libPath)) {
      fs.mkdirSync(libPath, { recursive: true })
    }
    return libPath
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
            updatedAt: stat.mtimeMs
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
    const res = await dialog.showOpenDialog(window || undefined as any, {
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
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      importedCount,
      books: this.listLibraryFiles()
    }
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

    // Decode: detect whether it is UTF-8 or GB18030
    let content = ''
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
      content = utf8Decoder.decode(buf)
    } catch {
      // Fallback to GB18030
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
      return true
    }
    return false
  }
}

export const globalLibraryManager = new LibraryManager()
