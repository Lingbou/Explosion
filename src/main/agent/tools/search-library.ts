import fs from 'fs'
import path from 'path'
import os from 'os'
import { DatabaseSync } from 'node:sqlite'
import { AgentTool } from './types'

export function tokenizeQuery(query: string, operator: 'AND' | 'OR' = 'AND'): string {
  const parts = query.trim().split(/\s+/)
  const matchPhrases: string[] = []
  for (const part of parts) {
    const tokens = part.match(/[\u4e00-\u9fa5\u3400-\u4dbf]|[a-zA-Z0-9_]+/g)
    if (tokens && tokens.length > 0) {
      matchPhrases.push(`"${tokens.join(' ')}"`)
    }
  }
  return matchPhrases.join(` ${operator} `)
}

interface MatchRecord {
  book: string
  volume: string
  paragraph: string
}

export function searchBooksIndex(
  cacheBaseDir: string,
  queryText: string,
  targetBookName?: string,
  limit: number = 6
): MatchRecord[] {
  if (!fs.existsSync(cacheBaseDir)) return []

  const bookDirs: string[] = []
  if (targetBookName && targetBookName.trim()) {
    const cleanName = targetBookName.replace(/[《》]/g, '').trim()
    const targetDir = path.join(cacheBaseDir, cleanName)
    if (fs.existsSync(targetDir)) {
      bookDirs.push(targetDir)
    } else {
      // Fuzzy match book directory
      const allDirs = fs.readdirSync(cacheBaseDir)
      for (const d of allDirs) {
        if (d.includes(cleanName) || cleanName.includes(d)) {
          bookDirs.push(path.join(cacheBaseDir, d))
          break
        }
      }
    }
  } else {
    // Search all indexed books
    const allDirs = fs.readdirSync(cacheBaseDir)
    for (const d of allDirs) {
      const full = path.join(cacheBaseDir, d)
      if (fs.statSync(full).isDirectory()) {
        bookDirs.push(full)
      }
    }
  }

  const results: MatchRecord[] = []
  const andTokens = tokenizeQuery(queryText, 'AND')
  const orTokens = tokenizeQuery(queryText, 'OR')

  for (const dir of bookDirs) {
    const dbPath = path.join(dir, 'index.db')
    if (!fs.existsSync(dbPath)) continue

    const bookName = path.basename(dir)

    try {
      const db = new DatabaseSync(dbPath)
      const queryStmt = db.prepare(
        'SELECT volume, paragraph FROM library_paragraphs WHERE tokens MATCH ? LIMIT ?'
      )

      let rows = andTokens ? (queryStmt.all(andTokens, limit) as any[]) : []
      if ((!rows || rows.length === 0) && orTokens && orTokens !== andTokens) {
        rows = (queryStmt.all(orTokens, limit) as any[]) || []
      }

      for (const r of rows) {
        results.push({
          book: bookName,
          volume: r.volume,
          paragraph: r.paragraph
        })
        if (results.length >= limit) break
      }

      db.close()
    } catch {
      // ignore individual db query error
    }

    if (results.length >= limit) break
  }

  return results
}

export const searchLibraryTool: AgentTool = {
  name: 'search_library',
  description:
    '在素材资料库中对已拆解索引的书籍（如《九州·缥缈录》）执行高精度自然段全文检索，毫秒级快速定位原著剧情段落、人物名场面、关键对话与设定细节。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '检索关键词或短语，支持多个词用空格隔开（如 "姬野 演武场", "天驱 军规"）'
      },
      book_name: {
        type: 'string',
        description: '可选。指定检索的书名（如 "九州·缥缈录"）。留空则自动检索全部藏书'
      },
      limit: {
        type: 'number',
        description: '可选。最多返回段落数（默认 6，最多 12）'
      }
    },
    required: ['query']
  },
  execute: async (args: { query?: string; book_name?: string; limit?: number }) => {
    const q = args.query?.trim()
    if (!q) {
      return '检索失败: 请提供有效的搜索关键词 query。'
    }

    const count = typeof args.limit === 'number' ? Math.max(1, Math.min(12, args.limit)) : 6
    const cacheBaseDir = path.join(os.homedir(), '.explosion', 'cache', 'books')

    const matches = searchBooksIndex(cacheBaseDir, q, args.book_name, count)

    if (matches.length === 0) {
      return `资料库全文检索未命中与 "${q}" 相关的段落。请尝试换用更简短的核心词（如单独搜人名或地名）。`
    }

    const lines: string[] = [
      `## 资料库原著全文检索结果: "${q}" (命中 ${matches.length} 个段落)\n`
    ]

    matches.forEach((item, idx) => {
      lines.push(`### [${idx + 1}] 《${item.book}》· ${item.volume}`)
      lines.push(`${item.paragraph.trim()}`)
      lines.push('')
    })

    return lines.join('\n').trim()
  }
}
