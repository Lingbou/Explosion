import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

import { SnapshotManager } from '../src/main/project/snapshot-manager'

describe('SnapshotManager', () => {
  let tempProjectDir: string
  let manager: SnapshotManager

  beforeEach(() => {
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-snapshot-test-'))
    manager = new SnapshotManager()
  })

  afterEach(() => {
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    }
  })

  it('creates snapshot and reads it back', async () => {
    const chapterFile = path.join(tempProjectDir, 'manuscript', '001-第一章.txt')
    fs.mkdirSync(path.dirname(chapterFile), { recursive: true })
    fs.writeFileSync(chapterFile, '初始正文内容', 'utf-8')

    const snap = await manager.createSnapshot(tempProjectDir, chapterFile, '初始正文内容', 'agent')
    expect(snap).toBeDefined()
    expect(snap?.filename).toBe('001-第一章.txt')
    expect(snap?.source).toBe('agent')

    const list = await manager.listSnapshots(tempProjectDir, '001-第一章.txt')
    expect(list.length).toBe(1)
    expect(list[0].id).toBe(snap?.id)

    const content = await manager.getSnapshotContent(tempProjectDir, snap!.id)
    expect(content).toBe('初始正文内容')
  })

  it('restores snapshot back to original file on disk', async () => {
    const chapterFile = path.join(tempProjectDir, 'manuscript', '001-第一章.txt')
    fs.mkdirSync(path.dirname(chapterFile), { recursive: true })
    fs.writeFileSync(chapterFile, '旧版本正文', 'utf-8')

    const snap = await manager.createSnapshot(tempProjectDir, chapterFile, '旧版本正文', 'agent')

    // Modify file
    fs.writeFileSync(chapterFile, '被修改后的新正文', 'utf-8')

    // Restore
    const res = await manager.restoreSnapshot(tempProjectDir, snap!.id)
    expect(res.success).toBe(true)

    // Verify file on disk is restored
    const restored = fs.readFileSync(chapterFile, 'utf-8')
    expect(restored).toBe('旧版本正文')
  })
})
