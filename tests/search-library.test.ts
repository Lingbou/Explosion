import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { DatabaseSync } from 'node:sqlite'
import {
  tokenizeQuery,
  searchBooksIndex,
  searchLibraryTool
} from '../src/main/agent/tools/search-library'

describe('search_library Tool & FTS5 Indexing', () => {
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

  it('tokenizes Chinese queries into spaced token phrases', () => {
    const tokens = tokenizeQuery('姬野 演武场')
    expect(tokens).toContain('"姬 野"')
    expect(tokens).toContain('"演 武 场"')
    expect(tokens).toContain('AND')
  })

  it('searches indexed book database and returns matching paragraphs with 0ms speed', () => {
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

    const matches = searchBooksIndex(booksCacheDir, '姬野 演武场', '九州·缥缈录', 5)
    expect(matches.length).toBe(1)
    expect(matches[0].book).toBe('九州·缥缈录')
    expect(matches[0].volume).toBe('卷一 蛮荒')
    expect(matches[0].paragraph).toContain('搏命厮杀')
  })

  it('formats search results cleanly via tool execute', async () => {
    const res = await searchLibraryTool.execute({ query: '不存在的词语xyz123' }, {})
    expect(res).toContain('未命中')
  })
})
