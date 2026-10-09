import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { DatabaseSync } from 'node:sqlite'
import {
  tokenizeQuery,
  searchBooksIndex,
  searchLibraryTool,
  queryEmbeddingService
} from '../src/main/agent/tools/search-library'

describe('search_library Tool & Hybrid RAG (FTS5 + 768-dim Vector)', () => {
  let tempSandboxDir: string
  let booksCacheDir: string

  beforeEach(() => {
    tempSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-search-lib-test-'))
    booksCacheDir = path.join(tempSandboxDir, 'books')
    fs.mkdirSync(booksCacheDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true })
    }
  })

  // 辅助函数：构造 768 维归一化向量
  function createNormalizedVector(seed: number): Float32Array {
    const vec = new Float32Array(768)
    for (let i = 0; i < 768; i++) {
      vec[i] = Math.sin(seed * (i + 1))
    }
    let norm = 0
    for (let i = 0; i < 768; i++) norm += vec[i] * vec[i]
    norm = Math.sqrt(norm) || 1
    for (let i = 0; i < 768; i++) vec[i] /= norm
    return vec
  }

  // 辅助函数：将 Float32Array 转化为 3072 字节 BLOB Buffer
  function vectorToBlob(vec: Float32Array): Buffer {
    return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength)
  }

  it('tokenizes Chinese queries into spaced token phrases', () => {
    const tokens = tokenizeQuery('姬野 演武场')
    expect(tokens).toContain('"姬 野"')
    expect(tokens).toContain('"演 武 场"')
    expect(tokens).toContain('AND')
  })

  it('searches indexed book database via FTS5 fallback when vector table does not exist', async () => {
    const bookDir = path.join(booksCacheDir, '九州·缥缈录')
    fs.mkdirSync(bookDir, { recursive: true })
    const dbPath = path.join(bookDir, 'index.db')

    const db = new DatabaseSync(dbPath)
    db.exec('CREATE VIRTUAL TABLE library_paragraphs USING fts5(volume, paragraph, tokens)')

    const insert = db.prepare('INSERT INTO library_paragraphs VALUES (?, ?, ?)')
    const p1 = '阿苏勒第一次见到姬野的时候，姬野还在演武场上搏命厮杀。'
    const tokens1 = '阿 苏 勒 第 一 次 见 到 姬 野 的 时 候 姬 野 还 在 演 武 场 上 搏 命 厮 杀'
    insert.run('卷一 蛮荒', p1, tokens1)

    const p2 = '息衍站在城楼上，望着远方的风雪。'
    const tokens2 = '息 衍 站 在 城 楼 上 望 着 远 方 的 风 雪'
    insert.run('卷二 苍云古齿', p2, tokens2)

    db.close()

    const matches = await searchBooksIndex(booksCacheDir, '姬野 演武场', '九州·缥缈录', 5, {
      enableVector: false
    })
    expect(matches.length).toBe(1)
    expect(matches[0].book).toBe('九州·缥缈录')
    expect(matches[0].volume).toBe('卷一 蛮荒')
    expect(matches[0].paragraph).toContain('搏命厮杀')
    expect(matches[0].matchType).toBe('fts5')
  })

  it('recalls semantically similar paragraphs via 768-dim vector embeddings when keywords do not match', async () => {
    const bookDir = path.join(booksCacheDir, '九州·缥缈录')
    fs.mkdirSync(bookDir, { recursive: true })
    const dbPath = path.join(bookDir, 'index.db')

    const db = new DatabaseSync(dbPath)
    db.exec('CREATE VIRTUAL TABLE library_paragraphs USING fts5(volume, paragraph, tokens)')
    db.exec(`
      CREATE TABLE paragraph_embeddings (
        id INTEGER PRIMARY KEY,
        volume TEXT,
        paragraph TEXT,
        embedding BLOB
      )
    `)

    // query vector
    const queryVec = createNormalizedVector(1.0)
    // paragraph 1: highly similar vector to query (seed 1.0 -> dot product 1.0), but text has ZERO keyword overlap!
    const similarVec = createNormalizedVector(1.0)
    // paragraph 2: orthogonal/different vector (seed 5.0)
    const dissimilarVec = createNormalizedVector(5.0)

    const ftsInsert = db.prepare('INSERT INTO library_paragraphs VALUES (?, ?, ?)')
    const p1 = '黑发黑眸的少年倒在泥泞中，紧握着长枪一次次爬起，暴雨冲刷着血迹。'
    const t1 = '黑 发 黑 眸 的 少 年 倒 在 泥 泞 中 紧 握 着 长 枪 一 次 次 爬 起 暴 雨 冲 刷 着 血 迹'
    ftsInsert.run('卷一 蛮荒', p1, t1)

    const p2 = '市集上的包子冒着热腾腾的白气，小贩在吆喝叫卖。'
    const t2 = '市 集 上 的 包 子 冒 着 热 腾 腾 的 白 气 小 贩 在 吆 喝 叫 卖'
    ftsInsert.run('卷一 蛮荒', p2, t2)

    const vecInsert = db.prepare('INSERT INTO paragraph_embeddings VALUES (?, ?, ?, ?)')
    vecInsert.run(1, '卷一 蛮荒', p1, vectorToBlob(similarVec))
    vecInsert.run(2, '卷一 蛮荒', p2, vectorToBlob(dissimilarVec))

    db.close()

    // 搜索关键词为 "演武场生死决斗"，FTS5 完全没有匹配词，但向量语义高相似命中 p1
    const matches = await searchBooksIndex(booksCacheDir, '演武场生死决斗', '九州·缥缈录', 5, {
      queryVector: queryVec
    })

    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches[0].paragraph).toContain('少年倒在泥泞中')
    expect(matches[0].matchType).toBe('vector')
    expect(matches[0].vectorRank).toBe(1)
    expect(matches[0].vectorSimilarity).toBeGreaterThan(0.9)
  })

  it('ranks dual-matching paragraphs higher using Reciprocal Rank Fusion (RRF)', async () => {
    const bookDir = path.join(booksCacheDir, '测试小说')
    fs.mkdirSync(bookDir, { recursive: true })
    const dbPath = path.join(bookDir, 'index.db')

    const db = new DatabaseSync(dbPath)
    db.exec('CREATE VIRTUAL TABLE library_paragraphs USING fts5(volume, paragraph, tokens)')
    db.exec(`
      CREATE TABLE paragraph_embeddings (
        id INTEGER PRIMARY KEY,
        volume TEXT,
        paragraph TEXT,
        embedding BLOB
      )
    `)

    const queryVec = createNormalizedVector(2.0)
    const vecHigh = createNormalizedVector(2.0) // rank 1 in vector
    const vecMid = createNormalizedVector(2.1)  // rank 2 in vector
    const vecLow = createNormalizedVector(9.0)  // rank 3 in vector

    const ftsInsert = db.prepare('INSERT INTO library_paragraphs VALUES (?, ?, ?)')
    const vecInsert = db.prepare('INSERT INTO paragraph_embeddings VALUES (?, ?, ?, ?)')

    // Document A: Matches BOTH FTS5 ("大辟刀") and Vector (rank 1)
    const pA = '息衍拔出大辟刀，静候长夜。'
    ftsInsert.run('卷一', pA, '息 衍 拔 出 大 辟 刀 静 候 长 夜')
    vecInsert.run(1, '卷一', pA, vectorToBlob(vecHigh))

    // Document B: Matches only FTS5 ("大辟刀"), but low vector similarity
    const pB = '大辟刀是一柄沉重古拙的长刀。'
    ftsInsert.run('卷一', pB, '大 辟 刀 是 一 柄 沉 重 古 拙 的 长 刀')
    vecInsert.run(2, '卷一', pB, vectorToBlob(vecLow))

    // Document C: Matches only Vector (rank 2), but NO FTS5 keywords
    const pC = '中年剑客倚着松树，凝视着沉寂的山谷。'
    ftsInsert.run('卷一', pC, '中 年 剑 客 倚 着 松 树 凝 视 着 沉 寂 的 山 谷')
    vecInsert.run(3, '卷一', pC, vectorToBlob(vecMid))

    db.close()

    const matches = await searchBooksIndex(booksCacheDir, '大辟刀 息衍', '测试小说', 5, {
      queryVector: queryVec
    })

    expect(matches.length).toBeGreaterThanOrEqual(2)
    // Document A must be #1 due to dual-path RRF boost!
    expect(matches[0].paragraph).toContain('息衍拔出大辟刀')
    expect(matches[0].matchType).toBe('hybrid')
    expect(matches[0].ftsRank).toBeDefined()
    expect(matches[0].vectorRank).toBeDefined()
    // RRF score for both rank 1: 1/(60+1) + 1/(60+1) approx 0.03278
    expect(matches[0].score).toBeCloseTo(1 / 61 + 1 / 61, 3)
  })

  it('gracefully handles offline or missing vector environment with zero-degradation fallback to FTS5', async () => {
    const bookDir = path.join(booksCacheDir, 'fallback_book')
    fs.mkdirSync(bookDir, { recursive: true })
    const dbPath = path.join(bookDir, 'index.db')

    const db = new DatabaseSync(dbPath)
    db.exec('CREATE VIRTUAL TABLE library_paragraphs USING fts5(volume, paragraph, tokens)')
    const insert = db.prepare('INSERT INTO library_paragraphs VALUES (?, ?, ?)')
    insert.run('卷一', '吕归尘紧握着影月之刀。', '吕 归 尘 紧 握 着 影 月 之 刀')
    db.close()

    // Pass invalid script path to simulate broken/offline vector engine
    const matches = await searchBooksIndex(booksCacheDir, '吕归尘 影月', 'fallback_book', 5, {
      scriptPath: '/non/existent/script.py'
    })

    expect(matches.length).toBe(1)
    expect(matches[0].paragraph).toContain('吕归尘紧握着影月之刀')
    expect(matches[0].matchType).toBe('fts5')
  })

  it('formats search results cleanly with match badge tags via tool execute', async () => {
    const res = await searchLibraryTool.execute({ query: '不存在的词语xyz123' }, {})
    expect(res).toContain('未命中')
  })

  it('end-to-end: computes query embedding via real Python script and returns 768-dim vector', async () => {
    const scriptPath = path.resolve(__dirname, '../src/main/library/organize_library.py')
    const vec = await queryEmbeddingService.getEmbedding('南淮夏夜市井风貌', {
      scriptPath
    })

    // If python onnxruntime environment is available on this machine
    if (vec) {
      expect(vec.length).toBe(768)
      let norm = 0
      for (let i = 0; i < 768; i++) norm += vec[i] * vec[i]
      expect(Math.sqrt(norm)).toBeCloseTo(1.0, 3)
    }
  })
})
