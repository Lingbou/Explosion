import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { BrowserWindow, dialog } from 'electron'
import { parseChineseNumber } from '../../shared/utils/chineseNumerals'
import {
  countTextStats,
  formatManuscriptExport,
  ExportChapterInput
} from '../../shared/utils/typography'
import { ManuscriptExportResult } from '../../shared/types/ipc'

export interface CollectedManuscriptChapter extends ExportChapterInput {
  id: string
  filePath: string
  relativePath: string
}

/**
 * Natural numeric and Chinese chapter/volume comparator:
 * 1. Numeric prefix: "001-", "002-", "10-"
 * 2. Chinese chapter numerals: "第一章", "第二章", "第十章", "第一百章"
 * 3. Chinese volume numerals: "第一卷", "第二卷", "卷一", "卷十"
 * 4. Fallback to standard natural locale comparison
 */
export function compareManuscriptNames(a: string, b: string): number {
  // 1. Numeric prefix: e.g. "001-..." vs "010-..."
  const numMatchA = a.match(/^(\d+)[-_.]/)
  const numMatchB = b.match(/^(\d+)[-_.]/)
  if (numMatchA && numMatchB) {
    const numA = parseInt(numMatchA[1], 10)
    const numB = parseInt(numMatchB[1], 10)
    if (numA !== numB) {
      return numA - numB
    }
  }

  // 2. Chinese chapter numeral: "第X章..."
  const chMatchA = a.match(/^第([0-9零一二三四五六七八九十百千万]+)章/)
  const chMatchB = b.match(/^第([0-9零一二三四五六七八九十百千万]+)章/)
  if (chMatchA && chMatchB) {
    const numA = parseChineseNumber(chMatchA[1])
    const numB = parseChineseNumber(chMatchB[1])
    if (numA !== null && numB !== null && numA !== numB) {
      return numA - numB
    }
  }

  // 3. Chinese volume numeral: "第X卷..." or "卷X..."
  const volMatchA = a.match(/^(?:第([0-9零一二三四五六七八九十百千万]+)卷|卷([0-9零一二三四五六七八九十百千万]+))/)
  const volMatchB = b.match(/^(?:第([0-9零一二三四五六七八九十百千万]+)卷|卷([0-9零一二三四五六七八九十百千万]+))/)
  if (volMatchA && volMatchB) {
    const rawNumA = volMatchA[1] || volMatchA[2]
    const rawNumB = volMatchB[1] || volMatchB[2]
    const numA = parseChineseNumber(rawNumA)
    const numB = parseChineseNumber(rawNumB)
    if (numA !== null && numB !== null && numA !== numB) {
      return numA - numB
    }
  }

  // 4. Fallback natural sort
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Returns default export filename format: "小说名-YYYY-MM-DD.txt"
 */
export function getDefaultExportFilename(projectTitle?: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const safeTitle = (projectTitle || '未命名作品').replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名作品'
  return `${safeTitle}-${yyyy}-${mm}-${dd}.txt`
}

/**
 * Recursively scans manuscript directory in directory and natural file order,
 * collecting all chapters (.txt).
 */
export function collectManuscriptChapters(manuscriptDir: string): CollectedManuscriptChapter[] {
  if (!fs.existsSync(manuscriptDir)) return []

  const chapters: CollectedManuscriptChapter[] = []

  function walk(dir: string, relativeDir: string = ''): void {
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    const filtered = entries
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => compareManuscriptNames(a.name, b.name))

    for (const entry of filtered) {
      const fullPath = path.join(dir, entry.name)
      const relPath = relativeDir ? path.join(relativeDir, entry.name) : entry.name

      if (entry.isDirectory()) {
        walk(fullPath, relPath)
      } else if (entry.isFile() && entry.name.endsWith('.txt')) {
        let content = ''
        try {
          content = fs.readFileSync(fullPath, 'utf-8')
        } catch {
          content = ''
        }

        let title = path.basename(entry.name, '.txt')
        const match = title.match(/^\d+[-_](.+)$/)
        if (match) title = match[1]

        chapters.push({
          id: `ch-${relPath.replace(/[\\/]/g, '-')}`,
          title,
          filename: entry.name,
          filePath: fullPath,
          relativePath: path.join('manuscript', relPath),
          volume: relativeDir || undefined,
          content
        })
      }
    }
  }

  walk(manuscriptDir)
  return chapters
}

/**
 * Executes manuscript export:
 * 1. Scans chapters in recursive directory order
 * 2. Normalizes typography (title flush-left, double fullwidth indent for paragraphs, uniform chapter breaks)
 * 3. Shows system save dialog if targetPath not provided
 * 4. Writes plain-text .txt file
 */
export async function exportManuscriptToFile(
  projectPath: string,
  targetPath?: string,
  window?: BrowserWindow | null
): Promise<ManuscriptExportResult> {
  const manuscriptDir = path.join(projectPath, 'manuscript')
  if (!fs.existsSync(manuscriptDir)) {
    return { success: false, error: '手稿目录不存在' }
  }

  const chapters = collectManuscriptChapters(manuscriptDir)
  if (chapters.length === 0) {
    return { success: false, error: '当前小说工程暂无手稿章节可供导出' }
  }

  // Get project title
  let projectTitle = path.basename(projectPath)
  const metaFile = path.join(projectPath, '.explosion', 'project.json')
  if (fs.existsSync(metaFile)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
      if (meta.title) projectTitle = meta.title
    } catch {
      // ignore
    }
  }

  let finalPath = targetPath

  if (!finalPath) {
    const defaultFilename = getDefaultExportFilename(projectTitle)
    const defaultDir = projectPath ? path.dirname(projectPath) : os.homedir()
    const defaultPath = path.join(defaultDir, defaultFilename)

    const res = await dialog.showSaveDialog(window || (undefined as any), {
      title: '交稿导出小说纯文本手稿',
      defaultPath,
      filters: [
        { name: '纯文本文件 (*.txt)', extensions: ['txt'] },
        { name: '所有文件 (*.*)', extensions: ['*'] }
      ]
    })

    if (res.canceled || !res.filePath) {
      return { success: false, canceled: true }
    }

    finalPath = res.filePath
  }

  const formattedContent = formatManuscriptExport(chapters)
  const stats = countTextStats(formattedContent)

  try {
    const targetDir = path.dirname(finalPath)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    fs.writeFileSync(finalPath, formattedContent, 'utf-8')

    return {
      success: true,
      filePath: finalPath,
      chapterCount: chapters.length,
      totalChars: stats.totalChars
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '写入导出文件失败'
    }
  }
}
