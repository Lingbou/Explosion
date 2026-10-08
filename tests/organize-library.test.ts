import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execSync } from 'child_process'

describe('organize_library.py Book Splitting Script', () => {
  let tempSandboxDir: string

  beforeEach(() => {
    tempSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-organize-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true })
    }
  })

  it('splits multi-volume book into individual clean UTF-8 volumes and removes original large file', () => {
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

    const files = fs.readdirSync(outDir)
    expect(files.some((f) => f.includes('卷一') && f.includes('蛮荒之境'))).toBe(true)
    expect(files.some((f) => f.includes('卷二') && f.includes('苍云古齿'))).toBe(true)

    // Check volume 1 content
    const vol1File = files.find((f) => f.includes('卷一'))
    expect(vol1File).toBeDefined()
    const vol1Content = fs.readFileSync(path.join(outDir, vol1File!), 'utf-8')
    expect(vol1Content).toContain('卷一 蛮荒之境')
    expect(vol1Content).toContain('这是卷一的第 60 行')
    expect(vol1Content).not.toContain('卷二 苍云古齿')

    // Original monolithic file must be automatically removed!
    expect(fs.existsSync(bookFile)).toBe(false)
  })

  it('keeps original file when --keep-original flag is specified', () => {
    const scriptPath = path.resolve(__dirname, '../src/main/library/organize_library.py')
    const bookFile = path.join(tempSandboxDir, 'keep_test.txt')

    const lines: string[] = ['卷一 蛮荒']
    for (let i = 1; i <= 60; i++) lines.push(`正文 ${i}`)
    lines.push('卷二 苍云')
    for (let i = 1; i <= 60; i++) lines.push(`正文 ${i}`)

    fs.writeFileSync(bookFile, lines.join('\n'), 'utf-8')

    const outDir = path.join(tempSandboxDir, 'out_keep')
    fs.mkdirSync(outDir, { recursive: true })

    execSync(`python3 "${scriptPath}" "${bookFile}" --output-dir "${outDir}" --keep-original`, {
      encoding: 'utf-8'
    })

    expect(fs.existsSync(bookFile)).toBe(true)
  })
})
