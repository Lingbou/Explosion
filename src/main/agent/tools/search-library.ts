import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
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

export interface MatchRecord {
  book: string
  volume: string
  paragraph: string
  score?: number
  matchType?: 'hybrid' | 'vector' | 'fts5'
  ftsRank?: number
  vectorRank?: number
  vectorSimilarity?: number
}

export interface SearchOptions {
  scriptPath?: string
  pythonBin?: string
  enableVector?: boolean
  queryVector?: Float32Array
}

export class QueryEmbeddingService {
  private queryCache = new Map<string, Float32Array>()

  public resolvePythonBin(): string {
    if (process.env.EXPLOSION_PYTHON_BIN && fs.existsSync(process.env.EXPLOSION_PYTHON_BIN)) {
      return process.env.EXPLOSION_PYTHON_BIN
    }
    const venvPython3 = path.join(os.homedir(), '.explosion', '.venv', 'bin', 'python3')
    if (fs.existsSync(venvPython3)) return venvPython3
    const venvPython = path.join(os.homedir(), '.explosion', '.venv', 'bin', 'python')
    if (fs.existsSync(venvPython)) return venvPython
    return 'python3'
  }

  public resolveScriptPath(customPath?: string): string | null {
    if (customPath && fs.existsSync(customPath)) {
      return customPath
    }
    if (process.env.EXPLOSION_ORGANIZE_SCRIPT && fs.existsSync(process.env.EXPLOSION_ORGANIZE_SCRIPT)) {
      return process.env.EXPLOSION_ORGANIZE_SCRIPT
    }
    const candidates = [
      path.join(os.homedir(), '.explosion', 'scripts', 'organize_library.py'),
      path.resolve(__dirname, '../../library/organize_library.py'),
      path.resolve(__dirname, '../library/organize_library.py'),
      path.resolve(process.cwd(), 'src/main/library/organize_library.py')
    ]
    for (const cand of candidates) {
      if (fs.existsSync(cand)) return cand
    }
    return null
  }

  public async getEmbedding(
    query: string,
    options?: SearchOptions
  ): Promise<Float32Array | null> {
    const trimmed = query.trim()
    if (!trimmed) return null

    if (options?.queryVector) {
      return options.queryVector
    }

    if (options?.enableVector === false) {
      return null
    }

    if (this.queryCache.has(trimmed)) {
      return this.queryCache.get(trimmed)!
    }

    const scriptPath = this.resolveScriptPath(options?.scriptPath)
    if (!scriptPath) return null

    const pythonBin = options?.pythonBin || this.resolvePythonBin()

    return new Promise<Float32Array | null>((resolve) => {
      execFile(
        pythonBin,
        [scriptPath, '--embed-query', trimmed],
        { timeout: 8000, maxBuffer: 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            resolve(null)
            return
          }
          try {
            const data = JSON.parse(stdout.trim())
            if (data && typeof data.embedding === 'string') {
              const buf = Buffer.from(data.embedding, 'base64')
              if (buf.length === 768 * 4) {
                const vec = new Float32Array(buf.buffer, buf.byteOffset, 768)
                if (this.queryCache.size > 200) {
                  this.queryCache.clear()
                }
                this.queryCache.set(trimmed, vec)
                resolve(vec)
                return
              }
            }
          } catch {
            // ignore parse error
          }
          resolve(null)
        }
      )
    })
  }
}

export const queryEmbeddingService = new QueryEmbeddingService()

interface RawFtsMatch {
  book: string
  volume: string
  paragraph: string
  bm25Score: number
}

interface RawVectorMatch {
  book: string
  volume: string
  paragraph: string
  similarity: number
}

export async function searchBooksIndex(
  cacheBaseDir: string,
  queryText: string,
  targetBookName?: string,
  limit: number = 6,
  options: SearchOptions = {}
): Promise<MatchRecord[]> {
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
      try {
        if (fs.statSync(full).isDirectory()) {
          bookDirs.push(full)
        }
      } catch {}
    }
  }

  if (bookDirs.length === 0) return []

  // 1. 尝试获取 768 维语义向量
  const queryVector = await queryEmbeddingService.getEmbedding(queryText, options)

  const andTokens = tokenizeQuery(queryText, 'AND')
  const orTokens = tokenizeQuery(queryText, 'OR')

  const allFtsMatches: RawFtsMatch[] = []
  const allVectorMatches: RawVectorMatch[] = []

  for (const dir of bookDirs) {
    const dbPath = path.join(dir, 'index.db')
    if (!fs.existsSync(dbPath)) continue

    const bookName = path.basename(dir)

    try {
      const db = new DatabaseSync(dbPath)

      // 检查存在的表
      const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[])
        .map((t) => t.name)
      const hasFts = tables.includes('library_paragraphs')
      const hasVector = tables.includes('paragraph_embeddings')

      // 路网 1：SQLite FTS5 倒排匹配
      if (hasFts) {
        let rows: any[] = []
        try {
          if (andTokens) {
            const queryStmt = db.prepare(
              'SELECT volume, paragraph, bm25(library_paragraphs) as bm25_score FROM library_paragraphs WHERE tokens MATCH ? ORDER BY bm25(library_paragraphs) ASC LIMIT 50'
            )
            rows = queryStmt.all(andTokens) as any[]
          }
          if ((!rows || rows.length === 0) && orTokens && orTokens !== andTokens) {
            const orStmt = db.prepare(
              'SELECT volume, paragraph, bm25(library_paragraphs) as bm25_score FROM library_paragraphs WHERE tokens MATCH ? ORDER BY bm25(library_paragraphs) ASC LIMIT 50'
            )
            rows = (orStmt.all(orTokens) as any[]) || []
          }
        } catch {
          // bm25 异常时平稳回退至无权重 MATCH 查询
          try {
            const queryStmt = db.prepare(
              'SELECT volume, paragraph FROM library_paragraphs WHERE tokens MATCH ? LIMIT 50'
            )
            rows = andTokens ? (queryStmt.all(andTokens) as any[]) : []
            if ((!rows || rows.length === 0) && orTokens) {
              rows = (queryStmt.all(orTokens) as any[]) || []
            }
          } catch {}
        }

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          allFtsMatches.push({
            book: bookName,
            volume: r.volume,
            paragraph: r.paragraph,
            bm25Score: typeof r.bm25_score === 'number' ? r.bm25_score : i
          })
        }
      }

      // 路网 2：768 维语义向量余弦相似度计算
      if (hasVector && queryVector) {
        try {
          const vRows = db.prepare(
            'SELECT volume, paragraph, embedding FROM paragraph_embeddings'
          ).all() as any[]

          for (const r of vRows) {
            const raw = r.embedding as Uint8Array | Buffer
            if (!raw || raw.byteLength !== 768 * 4) continue

            const vec = new Float32Array(raw.buffer, raw.byteOffset, 768)
            let dot = 0
            for (let j = 0; j < 768; j++) {
              dot += queryVector[j] * vec[j]
            }

            allVectorMatches.push({
              book: bookName,
              volume: r.volume,
              paragraph: r.paragraph,
              similarity: dot
            })
          }
        } catch {
          // ignore vector read errors
        }
      }

      db.close()
    } catch {
      // ignore individual db error
    }
  }

  // 排序并赋予 1-based 排名
  allFtsMatches.sort((a, b) => a.bm25Score - b.bm25Score)
  allVectorMatches.sort((a, b) => b.similarity - a.similarity)

  // 候选池合并
  interface CandidateEntry {
    book: string
    volume: string
    paragraph: string
    ftsRank?: number
    vectorRank?: number
    vectorSimilarity?: number
  }

  const candidateMap = new Map<string, CandidateEntry>()

  for (let i = 0; i < allFtsMatches.length; i++) {
    const item = allFtsMatches[i]
    const key = `${item.book}\0${item.volume}\0${item.paragraph}`
    candidateMap.set(key, {
      book: item.book,
      volume: item.volume,
      paragraph: item.paragraph,
      ftsRank: i + 1
    })
  }

  // 仅取向量召回的前 50 个高相关段落参与融合，避免长尾噪音
  const topVectorMatches = allVectorMatches.slice(0, 50)
  for (let i = 0; i < topVectorMatches.length; i++) {
    const item = topVectorMatches[i]
    const key = `${item.book}\0${item.volume}\0${item.paragraph}`
    const existing = candidateMap.get(key)
    if (existing) {
      existing.vectorRank = i + 1
      existing.vectorSimilarity = item.similarity
    } else {
      candidateMap.set(key, {
        book: item.book,
        volume: item.volume,
        paragraph: item.paragraph,
        vectorRank: i + 1,
        vectorSimilarity: item.similarity
      })
    }
  }

  // RRF 融合打分公式：Score(d) = sum(1 / (60 + rank_m(d)))
  const RRF_K = 60
  const fusedList: MatchRecord[] = []

  for (const entry of candidateMap.values()) {
    let score = 0
    let matchType: 'hybrid' | 'vector' | 'fts5' = 'fts5'

    if (entry.ftsRank !== undefined) {
      score += 1 / (RRF_K + entry.ftsRank)
    }
    if (entry.vectorRank !== undefined) {
      score += 1 / (RRF_K + entry.vectorRank)
    }

    if (entry.ftsRank !== undefined && entry.vectorRank !== undefined) {
      matchType = 'hybrid'
    } else if (entry.vectorRank !== undefined) {
      matchType = 'vector'
    } else {
      matchType = 'fts5'
    }

    fusedList.push({
      book: entry.book,
      volume: entry.volume,
      paragraph: entry.paragraph,
      score,
      matchType,
      ftsRank: entry.ftsRank,
      vectorRank: entry.vectorRank,
      vectorSimilarity: entry.vectorSimilarity
    })
  }

  // 综合 RRF 降序排列
  fusedList.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  return fusedList.slice(0, limit)
}

export const searchLibraryTool: AgentTool = {
  name: 'search_library',
  description:
    '在素材资料库中执行文学级 Hybrid RAG 混合检索（结合 768 维本地语义向量与 SQLite FTS5 全文倒排索引），毫秒级召回原著剧情段落、人物名场面、关键对话、动作情绪以及抽象文学意境氛围。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '检索关键词、句子或场景氛围描述（如 "姬野 演武场", "息衍城楼观雪", "雨夜长街杀机"）'
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

    const matches = await searchBooksIndex(cacheBaseDir, q, args.book_name, count)

    if (matches.length === 0) {
      return `资料库原著检索未命中与 "${q}" 相关的段落。请尝试换用更简短的核心词或描述更具体的情景氛围。`
    }

    const lines: string[] = [
      `## 资料库原著检索结果: "${q}" (命中 ${matches.length} 个段落)\n`
    ]

    matches.forEach((item, idx) => {
      const badge =
        item.matchType === 'hybrid'
          ? ' [双路混合命中/高相关]'
          : item.matchType === 'vector'
            ? ' [意境语义召回]'
            : ' [关键词精准命中]'
      lines.push(`### [${idx + 1}] 《${item.book}》· ${item.volume}${badge}`)
      lines.push(`${item.paragraph.trim()}`)
      lines.push('')
    })

    return lines.join('\n').trim()
  }
}
