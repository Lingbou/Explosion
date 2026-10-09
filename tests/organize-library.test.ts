import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execSync } from 'child_process'
import { DatabaseSync } from 'node:sqlite'

describe('organize_library.py Book Splitting & Indexing Script', () => {
  let tempSandboxDir: string
  const testBookName = '大荒记'
  const cacheBookDir = path.join(os.homedir(), '.explosion', 'cache', 'books', testBookName)

  beforeEach(() => {
    tempSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-organize-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true })
    }
    if (fs.existsSync(cacheBookDir)) {
      fs.rmSync(cacheBookDir, { recursive: true, force: true })
    }
  })

  it('splits multi-volume book into structured book directory with volumes, .cache symlink and removes original large file', () => {
    const scriptPath = path.resolve(__dirname, '../src/main/library/organize_library.py')
    const bookFile = path.join(tempSandboxDir, '《大荒记》（实体版全本）作者：测试.txt')

    const lines: string[] = [
      '《大荒记》',
      '作者：测试',
      '内容简介：',
      '这是一部测试小说。',
      ''
    ]

    // Volume 1 (> 50 lines)
    lines.push('卷一 蛮荒之境')
    for (let i = 1; i <= 60; i++) {
      lines.push(`这是卷一的第 ${i} 行小说正文，白描与微风拂过草原。`)
    }

    // Volume 2 (> 50 lines)
    lines.push('卷二 苍云古齿')
    for (let i = 1; i <= 60; i++) {
      lines.push(`这是卷二的第 ${i} 行小说正文，古剑出鞘，龙吟彻夜。`)
    }

    fs.writeFileSync(bookFile, lines.join('\n'), 'utf-8')

    const outDir = path.join(tempSandboxDir, 'output')
    fs.mkdirSync(outDir, { recursive: true })

    const output = execSync(`python3 "${scriptPath}" "${bookFile}" --output-dir "${outDir}"`, {
      encoding: 'utf-8'
    })

    expect(output).toContain('成功物理拆解')

    const bookDir = path.join(outDir, testBookName)
    expect(fs.existsSync(bookDir)).toBe(true)

    const files = fs.readdirSync(bookDir)
    expect(files.some((f) => f.includes('卷一') && f.includes('蛮荒之境'))).toBe(true)
    expect(files.some((f) => f.includes('卷二') && f.includes('苍云古齿'))).toBe(true)

    // Check volume 1 content
    const vol1File = files.find((f) => f.includes('卷一'))
    expect(vol1File).toBeDefined()
    const vol1Content = fs.readFileSync(path.join(bookDir, vol1File!), 'utf-8')
    expect(vol1Content).toContain('卷一 蛮荒之境')
    expect(vol1Content).toContain('这是卷一的第 60 行')
    expect(vol1Content).not.toContain('卷二 苍云古齿')

    // Check .cache symlink exists
    const symlinkPath = path.join(bookDir, '.cache')
    expect(fs.existsSync(symlinkPath)).toBe(true)

    // Original monolithic file must be automatically removed!
    expect(fs.existsSync(bookFile)).toBe(false)

    // Verify index.db contains both FTS5 table and paragraph_embeddings table
    const dbPath = path.join(cacheBookDir, 'index.db')
    expect(fs.existsSync(dbPath)).toBe(true)

    const db = new DatabaseSync(dbPath)
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[])
      .map((t) => t.name)
    expect(tables).toContain('library_paragraphs')
    expect(tables).toContain('paragraph_embeddings')

    const pCount = (db.prepare('SELECT count(*) as count FROM library_paragraphs').get() as any).count
    expect(pCount).toBeGreaterThan(0)

    const vRow = db.prepare('SELECT id, volume, paragraph, embedding FROM paragraph_embeddings LIMIT 1').get() as any
    if (vRow) {
      expect(vRow.embedding).toBeDefined()
      expect(vRow.embedding.byteLength).toBe(768 * 4) // 3072 bytes (768 float32s)
    }
    db.close()
  }, 30000)

  it('keeps original file when --keep-original flag is specified and supports --no-embeddings', () => {
    const scriptPath = path.resolve(__dirname, '../src/main/library/organize_library.py')
    const bookFile = path.join(tempSandboxDir, 'keep_test.txt')

    const lines: string[] = ['卷一 蛮荒']
    for (let i = 1; i <= 60; i++) lines.push(`正文 ${i}`)
    lines.push('卷二 苍云')
    for (let i = 1; i <= 60; i++) lines.push(`正文 ${i}`)

    fs.writeFileSync(bookFile, lines.join('\n'), 'utf-8')

    const outDir = path.join(tempSandboxDir, 'out_keep')
    fs.mkdirSync(outDir, { recursive: true })

    execSync(`python3 "${scriptPath}" "${bookFile}" --output-dir "${outDir}" --keep-original --no-embeddings`, {
      encoding: 'utf-8'
    })

    expect(fs.existsSync(bookFile)).toBe(true)
  })

  it('calculates 768-dim query embedding via --embed-query CLI returning valid base64 payload', () => {
    const scriptPath = path.resolve(__dirname, '../src/main/library/organize_library.py')
    const stdout = execSync(`python3 "${scriptPath}" --embed-query "南淮城头的暴风雪"`, {
      encoding: 'utf-8'
    })

    const parsed = JSON.parse(stdout.trim())
    expect(parsed.dim).toBe(768)
    expect(parsed.model).toBe('BAAI/bge-base-zh-v1.5')
    expect(typeof parsed.embedding).toBe('string')

    const buf = Buffer.from(parsed.embedding, 'base64')
    expect(buf.length).toBe(768 * 4) // 3072 bytes

    const f32 = new Float32Array(buf.buffer, buf.byteOffset, 768)
    let norm = 0
    for (let i = 0; i < 768; i++) norm += f32[i] * f32[i]
    expect(Math.sqrt(norm)).toBeCloseTo(1.0, 3)
  })
})
