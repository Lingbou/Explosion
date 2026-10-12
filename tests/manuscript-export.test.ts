import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  },
  shell: {
    openPath: vi.fn()
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
    getAllWindows: vi.fn(() => [])
  }
}))

import { dialog } from 'electron'
import {
  formatManuscriptExport,
  stripMarkdownMarks,
  standardizeChinesePunctuation,
  countTextStats
} from '../src/shared/utils/typography'
import {
  extractSequenceNumber,
  compareManuscriptNames,
  getDefaultExportFilename,
  collectManuscriptChapters,
  exportManuscriptToFile
} from '../src/main/project/exporter'
import { ProjectManager } from '../src/main/project/manager'
import { ConfigStore } from '../src/main/config/store'

describe('Manuscript Export Typography & Formatting', () => {
  it('formats multiple chapters with flush-left titles, indented paragraphs and uniform 2 empty lines', () => {
    const chapters = [
      {
        title: '第一章 蛮荒之鹰',
        content: '草原上的雄鹰展翅高飞。\n\n朔风凛冽。'
      },
      {
        title: '第二章 苍云古齿',
        content: '南淮的雨夜很冷。\n\n街角茶肆的竹帘垂得低低的。'
      }
    ]

    const exported = formatManuscriptExport(chapters)

    // Verify title formatting: flush left (no fullwidth space)
    expect(exported).toContain('第一章 蛮荒之鹰\n\n\u3000\u3000草原上的雄鹰展翅高飞。\n\n\u3000\u3000朔风凛冽。')
    expect(exported).toContain('第二章 苍云古齿\n\n\u3000\u3000南淮的雨夜很冷。\n\n\u3000\u3000街角茶肆的竹帘垂得低低的。')

    // Verify chapter separation: uniform 2 empty lines (\n\n\n)
    const expectedSeparator = '\u3000\u3000朔风凛冽。\n\n\n第二章 苍云古齿'
    expect(exported).toContain(expectedSeparator)
  })

  it('thoroughly strips Markdown marks and normalizes Chinese punctuation in exported text', () => {
    const chapters = [
      {
        title: '第三章 试炼',
        content: '# 章节标题\n\n---\n\n**少年**拔出*利剑*，喊道:"决一死战..."随后拔刀--迎着夜色。\n\n>> 多级引用语录\n\n- 装备列表项'
      }
    ]

    const exported = formatManuscriptExport(chapters)

    expect(exported).not.toContain('#')
    expect(exported).not.toContain('**')
    expect(exported).not.toContain('*')
    expect(exported).not.toContain('>')
    expect(exported).not.toContain('- 装备')
    expect(exported).not.toContain('---')
    // Punctuation standardized
    expect(exported).toContain('“决一死战……”')
    expect(exported).toContain('——迎着夜色')
    expect(exported).toContain('\u3000\u3000少年拔出利剑')
  })

  it('deduplicates chapter title if content already starts with the title or filename title', () => {
    const chapters1 = [
      {
        title: '第一章 启程',
        filename: '001-第一章 启程.txt',
        content: '第一章 启程\n\n晨曦洒在城门上。\n\n车队缓缓启程。'
      }
    ]

    const exported1 = formatManuscriptExport(chapters1)
    const matches1 = exported1.match(/第一章 启程/g)
    expect(matches1?.length).toBe(1)
    expect(exported1.startsWith('第一章 启程\n\n\u3000\u3000晨曦洒在城门上。')).toBe(true)

    // Variant: content starts with full filename base without numeric prefix
    const chapters2 = [
      {
        title: '第二章 决战',
        filename: '002-第二章 决战.txt',
        content: '第二章 决战\n\n剑气纵横。'
      }
    ]
    const exported2 = formatManuscriptExport(chapters2)
    const matches2 = exported2.match(/第二章 决战/g)
    expect(matches2?.length).toBe(1)
  })

  it('normalizes excessive blank lines within chapters to at most 1 empty line', () => {
    const chapters = [
      {
        title: '第四章 暴风',
        content: '第一段。\n\n\n\n\n\n第二段。\n\n\n\n第三段。'
      }
    ]

    const exported = formatManuscriptExport(chapters)

    expect(exported).not.toContain('\n\n\n\n')
    expect(exported).toContain('\u3000\u3000第一段。\n\n\u3000\u3000第二段。\n\n\u3000\u3000第三段。')
  })

  it('formats volume separations correctly when volume changes', () => {
    const chapters = [
      {
        title: '第一章 雄鹰',
        volume: '01-卷一 蛮荒',
        content: '草原上的雄鹰。'
      },
      {
        title: '第二章 朔风',
        volume: '01-卷一 蛮荒',
        content: '朔风呼啸。'
      },
      {
        title: '第三章 古齿',
        volume: '02-卷二 苍云古齿',
        content: '剑鞘震颤。'
      }
    ]

    const exported = formatManuscriptExport(chapters)

    // Clean volume names stripped of numeric prefix
    expect(exported).toContain('卷一 蛮荒\n\n第一章 雄鹰')
    expect(exported).not.toContain('01-卷一')
    // Within volume 1, chapter 2 does not repeat volume title
    expect(exported).not.toContain('卷一 蛮荒\n\n第二章 朔风')
    // Volume 2 is emitted
    expect(exported).toContain('卷二 苍云古齿\n\n第三章 古齿')
  })
})

describe('Manuscript Sorting & Default Filename', () => {
  it('correctly extracts sequence numbers across Arabic and Chinese naming styles', () => {
    expect(extractSequenceNumber('序章.txt')).toBe(0)
    expect(extractSequenceNumber('引子.txt')).toBe(0)
    expect(extractSequenceNumber('010-决战.txt')).toBe(10)
    expect(extractSequenceNumber('2-试炼.txt')).toBe(2)
    expect(extractSequenceNumber('第二章.txt')).toBe(2)
    expect(extractSequenceNumber('第十章.txt')).toBe(10)
    expect(extractSequenceNumber('第一百章.txt')).toBe(100)
    expect(extractSequenceNumber('卷一')).toBe(1)
    expect(extractSequenceNumber('第一卷 塞外')).toBe(1)
    expect(extractSequenceNumber('第十卷 决战')).toBe(10)
    expect(extractSequenceNumber('尾声.txt')).toBe(999999)
  })

  it('correctly compares numeric prefixes in natural order', () => {
    expect(compareManuscriptNames('001-第一章.txt', '002-第二章.txt')).toBeLessThan(0)
    expect(compareManuscriptNames('002-第二章.txt', '010-第十章.txt')).toBeLessThan(0)
    expect(compareManuscriptNames('1-第一章.txt', '10-第十章.txt')).toBeLessThan(0)
    expect(compareManuscriptNames('2-第二章.txt', '10-第十章.txt')).toBeLessThan(0)
  })

  it('correctly compares Chinese chapter numerals', () => {
    expect(compareManuscriptNames('第一章 蛮荒.txt', '第二章 苍云.txt')).toBeLessThan(0)
    expect(compareManuscriptNames('第二章 苍云.txt', '第十章 决战.txt')).toBeLessThan(0)
    expect(compareManuscriptNames('第十章 决战.txt', '第一百章 终章.txt')).toBeLessThan(0)
  })

  it('correctly compares Chinese volume numerals', () => {
    expect(compareManuscriptNames('第一卷', '第二卷')).toBeLessThan(0)
    expect(compareManuscriptNames('第二卷', '第十卷')).toBeLessThan(0)
    expect(compareManuscriptNames('卷一 蛮荒', '卷二 苍云')).toBeLessThan(0)
    expect(compareManuscriptNames('卷二 苍云', '卷十 决战')).toBeLessThan(0)
  })

  it('eliminates ASCII order inversion in mixed Arabic and Chinese naming', () => {
    // 010- must come AFTER 2- and 第二章 (10 > 2), NEVER before due to ASCII '0' < '2' or '0' < '第'
    expect(compareManuscriptNames('2-xx.txt', '010-xx.txt')).toBeLessThan(0)
    expect(compareManuscriptNames('第二章.txt', '010-xx.txt')).toBeLessThan(0)
    expect(compareManuscriptNames('010-xx.txt', '第二章.txt')).toBeGreaterThan(0)
    expect(compareManuscriptNames('010-xx.txt', '2-xx.txt')).toBeGreaterThan(0)

    // Volume 1 must come before Chapter 2 and Chapter 10
    expect(compareManuscriptNames('卷一', '2-xx.txt')).toBeLessThan(0)
    expect(compareManuscriptNames('卷一', '010-xx.txt')).toBeLessThan(0)

    // Complete mixed list sort test
    const mixedList = ['010-xx.txt', '2-xx.txt', '第二章.txt', '卷一']
    mixedList.sort(compareManuscriptNames)
    expect(mixedList[0]).toBe('卷一')
    expect(mixedList.slice(1, 3)).toEqual(expect.arrayContaining(['2-xx.txt', '第二章.txt']))
    expect(mixedList[3]).toBe('010-xx.txt')
  })

  it('generates standard default filename with title and current date', () => {
    const fixedDate = new Date(2026, 9, 13) // Month is 0-indexed: 9 = October
    const filename = getDefaultExportFilename('我的小说', fixedDate)
    expect(filename).toBe('我的小说-2026-10-13.txt')

    const safeFilename = getDefaultExportFilename('我的/小说:第一部*', fixedDate)
    expect(safeFilename).toBe('我的_小说_第一部_-2026-10-13.txt')
  })
})

describe('ProjectManager & File Exporter (Sandboxed)', () => {
  let tempProjectDir: string
  let tempConfigDir: string
  let manager: ProjectManager
  let testConfigStore: ConfigStore

  beforeEach(() => {
    tempProjectDir = path.join(os.tmpdir(), `explosion-export-test-${Date.now()}-${Math.random()}`)
    tempConfigDir = path.join(os.tmpdir(), `explosion-export-cfg-${Date.now()}-${Math.random()}`)
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
    vi.clearAllMocks()
  })

  it('recursively scans manuscript chapters across flat and multi-volume directories', () => {
    const manuscriptDir = path.join(tempProjectDir, 'manuscript')
    const vol1Dir = path.join(manuscriptDir, '01-第一卷')
    const vol2Dir = path.join(manuscriptDir, '02-第二卷')
    fs.mkdirSync(vol1Dir, { recursive: true })
    fs.mkdirSync(vol2Dir, { recursive: true })

    fs.writeFileSync(path.join(manuscriptDir, '000-序章.txt'), '天启之年。', 'utf-8')
    fs.writeFileSync(path.join(vol1Dir, '001-第一章.txt'), '草原上的雄鹰。', 'utf-8')
    fs.writeFileSync(path.join(vol1Dir, '002-第二章.txt'), '朔风凛冽。', 'utf-8')
    fs.writeFileSync(path.join(vol2Dir, '001-第三章.txt'), '古齿剑出鞘。', 'utf-8')

    const chapters = collectManuscriptChapters(manuscriptDir)

    expect(chapters.length).toBe(4)
    expect(chapters[0].title).toBe('序章')
    expect(chapters[0].volume).toBeUndefined()
    expect(chapters[1].title).toBe('第一章')
    expect(chapters[1].volume).toBe('01-第一卷')
    expect(chapters[2].title).toBe('第二章')
    expect(chapters[2].volume).toBe('01-第一卷')
    expect(chapters[3].title).toBe('第三章')
    expect(chapters[3].volume).toBe('02-第二卷')
  })

  it('handles mixed naming (010-xx, 2-xx, 第二章, 卷一/003-xx) in natural order without ASCII flaws', () => {
    const manuscriptDir = path.join(tempProjectDir, 'manuscript')
    const vol1Dir = path.join(manuscriptDir, '卷一')
    fs.mkdirSync(vol1Dir, { recursive: true })

    // Deliberately create in disordered sequence
    fs.writeFileSync(path.join(manuscriptDir, '010-第十章 决战.txt'), '第十章决战内容。', 'utf-8')
    fs.writeFileSync(path.join(manuscriptDir, '2-第二章 试炼A.txt'), '2-第二章试炼A内容。', 'utf-8')
    fs.writeFileSync(path.join(manuscriptDir, '第二章 试炼B.txt'), '第二章试炼B内容。', 'utf-8')
    fs.writeFileSync(path.join(vol1Dir, '003-第三章 突围.txt'), '卷一第三章突围内容。', 'utf-8')

    const chapters = collectManuscriptChapters(manuscriptDir)

    // Volume 1 (num 1) -> 2-第二章 (num 2) -> 第二章 (num 2) -> 010-第十章 (num 10)
    expect(chapters.length).toBe(4)
    expect(chapters[0].volume).toBe('卷一')
    expect(chapters[0].filename).toBe('003-第三章 突围.txt')

    // Chapter 10 must be the LAST item, never first!
    expect(chapters[3].filename).toBe('010-第十章 决战.txt')
  })

  it('exports manuscript to specified targetPath with zero markdown and standard typography', async () => {
    await manager.loadProject(tempProjectDir)

    // Remove the initial default empty chapter so we have only our test chapters
    const defaultFile = path.join(tempProjectDir, 'manuscript', '001-第一章.txt')
    if (fs.existsSync(defaultFile)) {
      fs.unlinkSync(defaultFile)
    }

    const ch1 = {
      id: 'ch-1',
      title: '第一章 蛮荒之鹰',
      content: '# 蛮荒\n\n**草原上的雄鹰**在暴风中盘旋。\n\n白狼潜行于草丛之中。',
      filename: '001-第一章 蛮荒之鹰.txt',
      updatedAt: Date.now()
    }
    const ch2 = {
      id: 'ch-2',
      title: '第二章 苍云古齿',
      content: '雨夜中，少年握紧铁剑--心跳如擂鼓。',
      filename: '002-第二章 苍云古齿.txt',
      updatedAt: Date.now()
    }

    manager.saveProjectChapter(tempProjectDir, ch1)
    manager.saveProjectChapter(tempProjectDir, ch2)

    const targetExportPath = path.join(tempProjectDir, 'output', '交稿手稿.txt')
    const res = await manager.exportManuscript(tempProjectDir, targetExportPath)

    expect(res.success).toBe(true)
    expect(res.filePath).toBe(targetExportPath)
    expect(res.chapterCount).toBe(2)
    expect(res.totalChars).toBeGreaterThan(0)
    expect(fs.existsSync(targetExportPath)).toBe(true)

    const fileContent = fs.readFileSync(targetExportPath, 'utf-8')
    // Zero markdown
    expect(fileContent).not.toContain('#')
    expect(fileContent).not.toContain('**')
    // Punctuation standardized
    expect(fileContent).toContain('——心跳如擂鼓')
    // Double fullwidth space indentation
    expect(fileContent).toContain('\u3000\u3000草原上的雄鹰在暴风中盘旋。')
    expect(fileContent).toContain('\u3000\u3000白狼潜行于草丛之中。')
    expect(fileContent).toContain('\u3000\u3000雨夜中，少年握紧铁剑——心跳如擂鼓。')
    // Chapter separation
    expect(fileContent).toContain('\u3000\u3000白狼潜行于草丛之中。\n\n\n第二章 苍云古齿')
  })

  it('invokes showSaveDialog when targetPath is omitted and handles user cancel', async () => {
    await manager.loadProject(tempProjectDir)

    const ch1 = {
      id: 'ch-1',
      title: '第一章',
      content: '测试正文。',
      filename: '001-第一章.txt',
      updatedAt: Date.now()
    }
    manager.saveProjectChapter(tempProjectDir, ch1)

    // User cancels dialog
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({
      canceled: true,
      filePath: ''
    })

    const cancelRes = await manager.exportManuscript(tempProjectDir)
    expect(cancelRes.success).toBe(false)
    expect(cancelRes.canceled).toBe(true)
    expect(dialog.showSaveDialog).toHaveBeenCalledTimes(1)

    // User chooses a path
    const chosenPath = path.join(tempProjectDir, 'exported-novel.txt')
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({
      canceled: false,
      filePath: chosenPath
    })

    const okRes = await manager.exportManuscript(tempProjectDir)
    expect(okRes.success).toBe(true)
    expect(okRes.filePath).toBe(chosenPath)
    expect(fs.existsSync(chosenPath)).toBe(true)
    expect(fs.readFileSync(chosenPath, 'utf-8')).toContain('第一章\n\n\u3000\u3000测试正文。')
  })

  it('returns clean error when manuscript directory is empty', async () => {
    const emptyProjDir = path.join(os.tmpdir(), `explosion-empty-${Date.now()}`)
    fs.mkdirSync(path.join(emptyProjDir, 'manuscript'), { recursive: true })

    const res = await manager.exportManuscript(emptyProjDir, path.join(emptyProjDir, 'out.txt'))
    expect(res.success).toBe(false)
    expect(res.error).toContain('暂无手稿章节')

    fs.rmSync(emptyProjDir, { recursive: true, force: true })
  })
})
