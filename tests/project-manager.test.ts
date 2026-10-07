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

import { ProjectManager } from '../src/main/project/manager'

describe('ProjectManager', () => {
  let tempProjectDir: string
  let manager: ProjectManager

  beforeEach(() => {
    tempProjectDir = path.join(os.tmpdir(), `explosion-project-test-${Date.now()}-${Math.random()}`)
    manager = new ProjectManager()
  })

  afterEach(() => {
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    }
  })

  it('loads and initializes a new project with manuscript/ and initial chapter', async () => {
    const data = await manager.loadProject(tempProjectDir)

    expect(fs.existsSync(path.join(tempProjectDir, 'manuscript'))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, 'story'))).toBe(true)
    expect(fs.existsSync(path.join(tempProjectDir, '.explosion'))).toBe(true)
    expect(data.chapters.length).toBe(1)
    expect(data.chapters[0].title).toBe('第一章')
    expect(data.chapters[0].filename).toBe('001-第一章.txt')
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

  it('renames and deletes chapter files on disk', async () => {
    await manager.loadProject(tempProjectDir)

    const renameResult = manager.renameProjectChapter(
      tempProjectDir,
      'ch-1',
      '001-第一章.txt',
      '第一章 暴雨将至'
    )

    expect(renameResult.success).toBe(true)
    expect(renameResult.newFilename).toBe('001-第一章 暴雨将至.txt')
    expect(fs.existsSync(path.join(tempProjectDir, 'manuscript', '001-第一章 暴雨将至.txt'))).toBe(true)

    manager.deleteProjectChapter(tempProjectDir, renameResult.newFilename)
    expect(fs.existsSync(path.join(tempProjectDir, 'manuscript', renameResult.newFilename))).toBe(false)
  })
})
