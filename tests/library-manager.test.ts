import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn()
  },
  shell: {
    openPath: vi.fn()
  },
  BrowserWindow: vi.fn()
}))

import { LibraryManager } from '../src/main/library/manager'
import { ConfigStore } from '../src/main/config/store'

describe('LibraryManager', () => {
  let tempLibDir: string
  let tempConfigDir: string
  let testConfigStore: ConfigStore
  let manager: LibraryManager

  beforeEach(() => {
    tempLibDir = path.join(os.tmpdir(), `explosion-lib-test-${Date.now()}-${Math.random()}`)
    tempConfigDir = path.join(os.tmpdir(), `explosion-cfg-test-${Date.now()}-${Math.random()}`)
    fs.mkdirSync(tempLibDir, { recursive: true })

    testConfigStore = new ConfigStore(tempConfigDir)
    const config = testConfigStore.getConfig()
    config.workspace.libraryPath = tempLibDir
    testConfigStore.saveConfig(config)

    manager = new LibraryManager(testConfigStore)
  })

  afterEach(() => {
    if (fs.existsSync(tempLibDir)) {
      fs.rmSync(tempLibDir, { recursive: true, force: true })
    }
    if (fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })

  it('lists text files in the library directory', () => {
    fs.writeFileSync(path.join(tempLibDir, 'book1.txt'), '第一本参考书内容', 'utf-8')
    fs.writeFileSync(path.join(tempLibDir, 'book2.txt'), '第二本参考书内容', 'utf-8')
    fs.writeFileSync(path.join(tempLibDir, '.hidden.txt'), '隐藏文件', 'utf-8')

    const list = manager.listLibraryFiles()
    expect(list.length).toBe(2)
    expect(list.map((b) => b.filename)).toContain('book1.txt')
    expect(list.map((b) => b.filename)).toContain('book2.txt')
  })

  it('reads UTF-8 and GB18030 text content correctly', () => {
    const utf8Path = path.join(tempLibDir, 'utf8.txt')
    fs.writeFileSync(utf8Path, '这是UTF-8编码的文学书籍。', 'utf-8')

    const res = manager.readLibraryFileContent('utf8.txt')
    expect(res.content).toBe('这是UTF-8编码的文学书籍。')
  })

  it('deletes library file', () => {
    const bookPath = path.join(tempLibDir, 'to-delete.txt')
    fs.writeFileSync(bookPath, '待删除内容', 'utf-8')

    expect(fs.existsSync(bookPath)).toBe(true)
    const success = manager.deleteLibraryFile('to-delete.txt')
    expect(success).toBe(true)
    expect(fs.existsSync(bookPath)).toBe(false)
  })
})
