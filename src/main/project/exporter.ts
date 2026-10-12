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
 * Extracts a sequence number from a manuscript chapter/volume name or filename.
 * Handles:
 * - Semantic markers: "序章", "引子", "楔子" -> 0; "尾声", "后记", "终章" -> 999999
 * - Numeric prefixes: "001-", "010-", "2-", "1."
 * - Chinese chapter numerals: "第一章", "第二章", "第十章", "第一百章", "第1章", "第10章"
 * - Chinese volume numerals: "第一卷", "第二卷", "卷一", "卷十", "Volume 1"
 * - Standalone Chinese numerals: "一", "二", "十"
 */
export function extractSequenceNumber(name: string): number | null {
  const baseName = name.replace(/\.txt$/i, '').trim()

  // Prologue markers -> 0
  if (/(?:^|[-_.])(?:序章|序幕|序言|序|引子|前言|楔子)/.test(baseName)) {
    return 0
  }
  // Epilogue markers -> 999999
  if (/(?:^|[-_.])(?:尾声|后记|后序|结语|终章)/.test(baseName)) {
    return 999999
  }

  // 1. Numeric prefix: e.g. "010-", "2-", "003."
  const numMatch = baseName.match(/^(\d+)[-_.]/)
  if (numMatch) {
    return parseInt(numMatch[1], 10)
  }

  // 2. Chinese chapter numeral: "第X章", "第X回", "第X节"
  const chMatch = baseName.match(/^第([0-9零一二三四五六七八九十百千万]+)[章回节]/)
  if (chMatch) {
    return parseChineseNumber(chMatch[1])
  }

  // 3. Chinese volume numeral: "第X卷", "卷X", "Volume X"
  const volMatch = baseName.match(
    /^(?:第([0-9零一二三四五六七八九十百千万]+)卷|卷([0-9零一二三四五六七八九十百千万]+)|volume\s*(\d+))/i
  )
  if (volMatch) {
    const raw = volMatch[1] || volMatch[2] || volMatch[3]
    return parseChineseNumber(raw)
  }

  // 4. Standalone Chinese numerals at start: "一", "二", "十" followed by separator or end
  const standaloneMatch = baseName.match(/^([零一二三四五六七八九十百千万]+)(?:[-_.\s]|$)/)
  if (standaloneMatch) {
    const parsed = parseChineseNumber(standaloneMatch[1])
    if (parsed !== null) return parsed
  }

  return null
}

/**
 * Natural numeric and Chinese chapter/volume comparator:
 * Compares by extracted sequence number across ALL formats (Arabic, Chinese, Volume, Chapter),
 * falling back to natural locale comparison when sequence numbers are identical or null.
 */
export function compareManuscriptNames(a: string, b: string): number {
  const numA = extractSequenceNumber(a)
  const numB = extractSequenceNumber(b)

  if (numA !== null && numB !== null) {
    if (numA !== numB) {
      return numA - numB
    }
  } else if (numA !== null && numB === null) {
    return -1
  } else if (numA === null && numB !== null) {
    return 1
  }

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
