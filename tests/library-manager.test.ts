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

  it('lists text files in the library directory including subdirectories with bookName', () => {
    fs.writeFileSync(path.join(tempLibDir, 'book1.txt'), '第一本参考书内容', 'utf-8')
    fs.writeFileSync(path.join(tempLibDir, '.hidden.txt'), '隐藏文件', 'utf-8')

    // Create a structured book folder
    const bookFolder = path.join(tempLibDir, '九州·缥缈录')
    fs.mkdirSync(bookFolder, { recursive: true })
    fs.writeFileSync(path.join(bookFolder, '《九州·缥缈录》_卷一_蛮荒.txt'), '蛮荒卷内容', 'utf-8')
    fs.writeFileSync(path.join(bookFolder, '《九州·缥缈录》_卷二_苍云古齿.txt'), '苍云古齿卷内容', 'utf-8')

    const list = manager.listLibraryFiles()
    expect(list.length).toBe(3)

    const vol1 = list.find((b) => b.filename.includes('卷一'))
    expect(vol1).toBeDefined()
    expect(vol1?.bookName).toBe('九州·缥缈录')
    expect(vol1?.relativePath).toBe(path.join('九州·缥缈录', '《九州·缥缈录》_卷一_蛮荒.txt'))
  })

  it('reads UTF-8 and GB18030 text content correctly from subdirectories', () => {
    const bookFolder = path.join(tempLibDir, '测试名著')
    fs.mkdirSync(bookFolder, { recursive: true })
    const volPath = path.join(bookFolder, '卷一.txt')
    fs.writeFileSync(volPath, '这是测试名著卷一的文学内容。', 'utf-8')

    const res = manager.readLibraryFileContent('卷一.txt')
    expect(res.content).toBe('这是测试名著卷一的文学内容。')
  })

  it('deletes library file and cleans up empty book directory', () => {
    const bookFolder = path.join(tempLibDir, '待删名著')
    fs.mkdirSync(bookFolder, { recursive: true })
    const bookPath = path.join(bookFolder, '卷一.txt')
    fs.writeFileSync(bookPath, '待删除内容', 'utf-8')

    expect(fs.existsSync(bookPath)).toBe(true)
    const success = manager.deleteLibraryFile('卷一.txt')
    expect(success).toBe(true)
    expect(fs.existsSync(bookPath)).toBe(false)
    expect(fs.existsSync(bookFolder)).toBe(false) // Cleaned up empty book directory
  })
})
