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
  BrowserWindow: {
    fromWebContents: vi.fn(),
    getAllWindows: vi.fn(() => [])
  }
}))

import { ProjectManager } from '../src/main/project/manager'
import { ConfigStore } from '../src/main/config/store'

describe('Volume & Chapter Tree - Multi-Volume & DnD Reordering Sandbox Tests', () => {
  let tempProjectDir: string
  let tempConfigDir: string
  let manager: ProjectManager
  let testConfigStore: ConfigStore

  beforeEach(() => {
    tempProjectDir = path.join(os.tmpdir(), `explosion-volume-tree-test-${Date.now()}-${Math.random()}`)
    tempConfigDir = path.join(os.tmpdir(), `explosion-volume-config-test-${Date.now()}-${Math.random()}`)
    testConfigStore = new ConfigStore(tempConfigDir)
    manager = new ProjectManager(testConfigStore)
  })

  afterEach(() => {
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    }
    if (fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })

  it('maintains 100% backward compatibility for flat manuscript projects without volumes', async () => {
    // Setup a legacy project with flat chapter files in manuscript/
    const manuscriptDir = path.join(tempProjectDir, 'manuscript')
    fs.mkdirSync(manuscriptDir, { recursive: true })

    fs.writeFileSync(path.join(manuscriptDir, '001-开端.txt'), '第一章正文', 'utf-8')
    fs.writeFileSync(path.join(manuscriptDir, '002-暗涌.txt'), '第二章正文', 'utf-8')
    fs.writeFileSync(path.join(manuscriptDir, '003-逆旅.txt'), '第三章正文', 'utf-8')

    const data = await manager.loadProject(tempProjectDir)

    // Volumes must be an empty array
    expect(data.volumes).toEqual([])
    expect(data.chapters.length).toBe(3)
    expect(data.chapters[0].title).toBe('开端')
    expect(data.chapters[0].volume).toBeUndefined()
    expect(data.chapters[0].relativePath).toBe(path.join('manuscript', '001-开端.txt'))
    expect(data.chapters[1].title).toBe('暗涌')
    expect(data.chapters[2].title).toBe('逆旅')
  })

  it('supports volume lifecycle: create, rename, and content-protected deletion', async () => {
    await manager.loadProject(tempProjectDir)

    // 1. Create volumes
    const vol1 = manager.createVolume(tempProjectDir, '第一卷 塞外')
    expect(vol1.success).toBe(true)
    expect(vol1.volumeName).toBe('第一卷 塞外')
    expect(fs.existsSync(path.join(tempProjectDir, 'manuscript', '第一卷 塞外'))).toBe(true)

    // Handle special characters
    const vol2 = manager.createVolume(tempProjectDir, '第二卷:南淮/古城')
    expect(vol2.success).toBe(true)
    expect(vol2.volumeName).toBe('第二卷_南淮_古城')

    // Handle duplicate names
    const volDup = manager.createVolume(tempProjectDir, '第一卷 塞外')
    expect(volDup.success).toBe(true)
    expect(volDup.volumeName).toBe('第一卷 塞外 (1)')

    // 2. Rename volume
    const renameRes = manager.renameVolume(tempProjectDir, '第一卷 塞外 (1)', '第三卷 天启')
    expect(renameRes.success).toBe(true)
    expect(renameRes.newVolumeName).toBe('第三卷 天启')
    expect(fs.existsSync(path.join(tempProjectDir, 'manuscript', '第三卷 天启'))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, 'manuscript', '第一卷 塞外 (1)'))).toBe(false)

    // 3. Delete volume with content protection (keepChapters = true)
    const vol1Dir = path.join(tempProjectDir, 'manuscript', '第一卷 塞外')
    fs.writeFileSync(path.join(vol1Dir, '001-大漠孤烟.txt'), '长河落日圆', 'utf-8')
    fs.writeFileSync(path.join(vol1Dir, '002-风雪关山.txt'), '铁骑夜行', 'utf-8')

    const deleteWithProtection = manager.deleteVolume(tempProjectDir, '第一卷 塞外', true)
    expect(deleteWithProtection.success).toBe(true)
    expect(fs.existsSync(vol1Dir)).toBe(false)

    // Chapters must be safely rescued to manuscript/ root
    const rootFiles = fs.readdirSync(path.join(tempProjectDir, 'manuscript')).filter((f) => f.endsWith('.txt'))
    expect(rootFiles.length).toBeGreaterThanOrEqual(2)
    const titles = rootFiles.map((f) => f.replace(/^\d+-/, '').replace('.txt', ''))
    expect(titles).toContain('大漠孤烟')
    expect(titles).toContain('风雪关山')

    // 4. Delete volume permanently without keeping chapters (keepChapters = false)
    const vol3Dir = path.join(tempProjectDir, 'manuscript', '第三卷 天启')
    fs.writeFileSync(path.join(vol3Dir, '001-帝都风华.txt'), '天街小雨', 'utf-8')
    const deletePermanent = manager.deleteVolume(tempProjectDir, '第三卷 天启', false)
    expect(deletePermanent.success).toBe(true)
    expect(fs.existsSync(vol3Dir)).toBe(false)
  })

  it('renames and deletes chapters inside volumes and keeps numbering contiguous', async () => {
    const volDir = path.join(tempProjectDir, 'manuscript', '卷一')
    fs.mkdirSync(volDir, { recursive: true })
    fs.writeFileSync(path.join(volDir, '001-起风.txt'), '起风了', 'utf-8')
    fs.writeFileSync(path.join(volDir, '002-落雨.txt'), '落雨了', 'utf-8')
    fs.writeFileSync(path.join(volDir, '003-放晴.txt'), '放晴了', 'utf-8')

    await manager.loadProject(tempProjectDir)

    // Rename chapter inside volume
    const renameRes = manager.renameProjectChapter(
      tempProjectDir,
      'ch-1',
      '001-起风.txt',
      '大风起兮',
      '卷一'
    )
    expect(renameRes.success).toBe(true)
    expect(renameRes.newFilename).toBe('001-大风起兮.txt')
    expect(fs.existsSync(path.join(volDir, '001-大风起兮.txt'))).toBe(true)
    expect(fs.existsSync(path.join(volDir, '001-起风.txt'))).toBe(false)

    // Delete middle chapter '002-落雨.txt'
    manager.deleteProjectChapter(tempProjectDir, '002-落雨.txt', '卷一')
    expect(fs.existsSync(path.join(volDir, '002-落雨.txt'))).toBe(false)

    // Remaining chapters must be automatically renumbered with no gaps: 001 and 002
    const remaining = fs.readdirSync(volDir).filter((f) => f.endsWith('.txt')).sort()
    expect(remaining).toEqual(['001-大风起兮.txt', '002-放晴.txt'])
  })

  it('reorders chapters within a volume and produces continuous numbering without holes', async () => {
    const volDir = path.join(tempProjectDir, 'manuscript', '卷一')
    fs.mkdirSync(volDir, { recursive: true })
    fs.writeFileSync(path.join(volDir, '001-第一章.txt'), 'c1', 'utf-8')
    fs.writeFileSync(path.join(volDir, '002-第二章.txt'), 'c2', 'utf-8')
    fs.writeFileSync(path.join(volDir, '003-第三章.txt'), 'c3', 'utf-8')

    await manager.loadProject(tempProjectDir)

    // Reorder: 3, 1, 2
    const reordered = ['003-第三章.txt', '001-第一章.txt', '002-第二章.txt']
    const res = manager.reorderProjectChapters(tempProjectDir, '卷一', reordered)

    expect(res.success).toBe(true)
    const files = fs.readdirSync(volDir).filter((f) => f.endsWith('.txt')).sort()
    expect(files).toEqual(['001-第三章.txt', '002-第一章.txt', '003-第二章.txt'])

    // Content verification
    expect(fs.readFileSync(path.join(volDir, '001-第三章.txt'), 'utf-8')).toBe('c3')
    expect(fs.readFileSync(path.join(volDir, '002-第一章.txt'), 'utf-8')).toBe('c1')
    expect(fs.readFileSync(path.join(volDir, '003-第二章.txt'), 'utf-8')).toBe('c2')
  })

  it('moves chapter across volumes, ensuring contiguous numbering in both source and target volumes', async () => {
    const vol1Dir = path.join(tempProjectDir, 'manuscript', '卷一')
    const vol2Dir = path.join(tempProjectDir, 'manuscript', '卷二')
    fs.mkdirSync(vol1Dir, { recursive: true })
    fs.mkdirSync(vol2Dir, { recursive: true })

    fs.writeFileSync(path.join(vol1Dir, '001-塞上行.txt'), 'v1c1', 'utf-8')
    fs.writeFileSync(path.join(vol1Dir, '002-雪夜渡.txt'), 'v1c2', 'utf-8')
    fs.writeFileSync(path.join(vol1Dir, '003-破军阵.txt'), 'v1c3', 'utf-8')

    fs.writeFileSync(path.join(vol2Dir, '001-江南春.txt'), 'v2c1', 'utf-8')
    fs.writeFileSync(path.join(vol2Dir, '002-雨巷逢.txt'), 'v2c2', 'utf-8')

    await manager.loadProject(tempProjectDir)

    // Move '002-雪夜渡.txt' from 卷一 to 卷二 at targetIndex 1 (between 001 and 002)
    const moveRes = manager.moveProjectChapter(tempProjectDir, {
      filename: '002-雪夜渡.txt',
      sourceVolume: '卷一',
      targetVolume: '卷二',
      targetIndex: 1
    })

    expect(moveRes.success).toBe(true)

    // Source volume (卷一) remaining must be 001-塞上行.txt and 002-破军阵.txt (no gap!)
    const vol1Files = fs.readdirSync(vol1Dir).filter((f) => f.endsWith('.txt')).sort()
    expect(vol1Files).toEqual(['001-塞上行.txt', '002-破军阵.txt'])
    expect(fs.readFileSync(path.join(vol1Dir, '002-破军阵.txt'), 'utf-8')).toBe('v1c3')

    // Target volume (卷二) must have 3 chapters in order: 江南春, 雪夜渡, 雨巷逢
    const vol2Files = fs.readdirSync(vol2Dir).filter((f) => f.endsWith('.txt')).sort()
    expect(vol2Files).toEqual(['001-江南春.txt', '002-雪夜渡.txt', '003-雨巷逢.txt'])
    expect(fs.readFileSync(path.join(vol2Dir, '002-雪夜渡.txt'), 'utf-8')).toBe('v1c2')
    expect(fs.readFileSync(path.join(vol2Dir, '003-雨巷逢.txt'), 'utf-8')).toBe('v2c2')
  })

  it('moves chapter from volume to flat root and from flat root to volume', async () => {
    const manuscriptDir = path.join(tempProjectDir, 'manuscript')
    const volDir = path.join(manuscriptDir, '第一卷')
    fs.mkdirSync(volDir, { recursive: true })

    fs.writeFileSync(path.join(manuscriptDir, '001-序幕.txt'), '序幕内容', 'utf-8')
    fs.writeFileSync(path.join(volDir, '001-正章一.txt'), '正章内容', 'utf-8')

    await manager.loadProject(tempProjectDir)

    // Move '001-序幕.txt' from root (undefined) to '第一卷' at index 0
    manager.moveProjectChapter(tempProjectDir, {
      filename: '001-序幕.txt',
      sourceVolume: undefined,
      targetVolume: '第一卷',
      targetIndex: 0
    })

    const volFiles = fs.readdirSync(volDir).filter((f) => f.endsWith('.txt')).sort()
    expect(volFiles).toEqual(['001-序幕.txt', '002-正章一.txt'])
    expect(fs.readFileSync(path.join(volDir, '001-序幕.txt'), 'utf-8')).toBe('序幕内容')

    // Root should now be empty of chapters
    const rootFiles = fs.readdirSync(manuscriptDir).filter((f) => f.endsWith('.txt'))
    expect(rootFiles.length).toBe(0)
  })
})
