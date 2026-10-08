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

describe('ProjectManager', () => {
  let tempProjectDir: string
  let tempConfigDir: string
  let manager: ProjectManager
  let testConfigStore: ConfigStore

  beforeEach(() => {
    tempProjectDir = path.join(os.tmpdir(), `explosion-project-test-${Date.now()}-${Math.random()}`)
    tempConfigDir = path.join(os.tmpdir(), `explosion-config-test-${Date.now()}-${Math.random()}`)
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

  it('loads and initializes a new project with manuscript/, story/ and Story Bible', async () => {
    const data = await manager.loadProject(tempProjectDir)

    expect(fs.existsSync(path.join(tempProjectDir, 'manuscript'))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, 'story'))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, 'story', 'outlines'))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, 'story', 'characters'))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, 'story', 'threads.txt'))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, '.explosion'))).toBe(true)

    expect(data.chapters.length).toBe(1)
    expect(data.chapters[0].title).toBe('第一章')
    expect(data.storyBible).toBeDefined()
    expect(data.storyBible?.ledger).toBeDefined()
    expect(data.storyBible?.ledger?.content).toBe('')
    expect(testConfigStore.getConfig().workspace.lastProjectPath).toBe(tempProjectDir)
  })

  it('automatically purges any legacy mock boilerplate text from existing project files', async () => {
    const storyDir = path.join(tempProjectDir, 'story')
    fs.mkdirSync(storyDir, { recursive: true })
    const threadsPath = path.join(storyDir, 'threads.txt')
    fs.writeFileSync(
      threadsPath,
      '【本作伏笔账本】\n记录全书关键暗线、未解之谜与回收状态。\n\n[伏笔 #1] 主角的隐秘身世\n- 状态：未解开\n- 触发线索：幼年留下的古老指环\n',
      'utf-8'
    )

    const data = await manager.loadProject(tempProjectDir)
    expect(data.storyBible?.ledger?.content).toBe('')
    const onDisk = fs.readFileSync(threadsPath, 'utf-8')
    expect(onDisk).toBe('')
    expect(onDisk).not.toContain('古老指环')
  })

  it('scans multi-volume chapter subdirectories correctly', async () => {
    const vol1Dir = path.join(tempProjectDir, 'manuscript', '卷一 蛮荒')
    const vol2Dir = path.join(tempProjectDir, 'manuscript', '卷二 苍云古齿')
    fs.mkdirSync(vol1Dir, { recursive: true })
    fs.mkdirSync(vol2Dir, { recursive: true })

    fs.writeFileSync(path.join(vol1Dir, '001-蛮荒之鹰.txt'), '草原上的雄鹰。', 'utf-8')
    fs.writeFileSync(path.join(vol2Dir, '001-古齿剑鸣.txt'), '剑鞘震颤。', 'utf-8')

    const data = await manager.loadProject(tempProjectDir)
    expect(data.chapters.length).toBe(2)

    const vol1Chapter = data.chapters.find((c) => c.volume === '卷一 蛮荒')
    const vol2Chapter = data.chapters.find((c) => c.volume === '卷二 苍云古齿')

    expect(vol1Chapter).toBeDefined()
    expect(vol1Chapter?.title).toBe('蛮荒之鹰')
    expect(vol2Chapter).toBeDefined()
    expect(vol2Chapter?.title).toBe('古齿剑鸣')
  })

  it('manages Story Bible outlines and characters files including renaming and deletion', async () => {
    await manager.loadProject(tempProjectDir)

    // Create outline
    const outline = manager.createStoryFile(tempProjectDir, 'outline', '第一卷大纲')
    expect(outline.type).toBe('outline')
    expect(outline.content).toBe('')
    expect(fs.existsSync(path.join(tempProjectDir, outline.relativePath))).toBe(true)

    // Create character
    const character = manager.createStoryFile(tempProjectDir, 'character', '吕归尘')
    expect(character.type).toBe('character')
    expect(character.content).toBe('')
    expect(fs.existsSync(path.join(tempProjectDir, character.relativePath))).toBe(true)

    // Rename character
    const renameRes = manager.renameStoryFile(tempProjectDir, character.relativePath, '世子归尘')
    expect(renameRes.success).toBe(true)
    expect(renameRes.newFilename).toBe('世子归尘.txt')
    expect(fs.existsSync(path.join(tempProjectDir, renameRes.newRelativePath))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, character.relativePath))).toBe(false)

    // Save update
    manager.saveStoryFile(tempProjectDir, renameRes.newRelativePath, '吕归尘，青阳世子。')
    const updated = fs.readFileSync(path.join(tempProjectDir, renameRes.newRelativePath), 'utf-8')
    expect(updated).toBe('吕归尘，青阳世子。')

    // Delete
    manager.deleteStoryFile(tempProjectDir, outline.relativePath)
    expect(fs.existsSync(path.join(tempProjectDir, outline.relativePath))).toBe(false)
  })

  it('saves and reads chapter files directly on disk', async () => {
    await manager.loadProject(tempProjectDir)

    const chapter = {
      id: 'ch-1',
      title: '第一章',
      content: '南淮的雨夜很冷。',
      filename: '001-第一章.txt',
      updatedAt: Date.now()
    }

    manager.saveProjectChapter(tempProjectDir, chapter)

    const filePath = path.join(tempProjectDir, 'manuscript', '001-第一章.txt')
    expect(fs.existsSync(filePath)).toBe(true)
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('南淮的雨夜很冷。')
  })

  it('closes current project and sets lastProjectPath to null', async () => {
    await manager.loadProject(tempProjectDir)
    expect(testConfigStore.getConfig().workspace.lastProjectPath).toBe(tempProjectDir)

    manager.closeCurrentProject()
    expect(testConfigStore.getConfig().workspace.lastProjectPath).toBeNull()
  })
})
