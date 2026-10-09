import { cleanVolumeName } from '../src/shared/utils/cleanName'
import { describe, it, expect } from 'vitest'
import {
  stripMarkdownMarks,
  standardizeChinesePunctuation,
  formatChineseManuscript,
  countTextStats
} from '../src/renderer/src/lib/typography'
import { generateSessionTitle } from '../src/shared/utils/session'

describe('Typography & Chinese Formatting', () => {
  it('should strip markdown headers, bold, italics, quotes, backticks and lists', () => {
    const raw = `# 第一章 暴风雨\n\n> 这是一个引用\n\n**加粗内容** 与 *斜体内容*\n\n1. **\`web_search\`**: 搜索关键词\n- 列表项1\n- 列表项2\n\n正文正常句子。`
    const cleaned = stripMarkdownMarks(raw)

    expect(cleaned).not.toContain('#')
    expect(cleaned).not.toContain('**')
    expect(cleaned).not.toContain('*')
    expect(cleaned).not.toContain('`')
    expect(cleaned).not.toContain('>')
    expect(cleaned).not.toContain('- 列表项')
    expect(cleaned).toContain('加粗内容 与 斜体内容')
    expect(cleaned).toContain('1. web_search: 搜索关键词')
    expect(cleaned).toContain('正文正常句子。')
  })

  it('should thoroughly clean bold words embedded in sentences', () => {
    const raw = '我**完全具备实时联网搜索能力**，通过**AnySearch**进行搜索'
    const cleaned = stripMarkdownMarks(raw)
    expect(cleaned).toBe('我完全具备实时联网搜索能力，通过AnySearch进行搜索')
  })

  it('should standardize Chinese punctuation', () => {
    const raw = `他说:"今晚行动..."随后拔刀--迎着夜色。`
    const standardized = standardizeChinesePunctuation(raw)

    expect(standardized).toContain('“今晚行动……”')
    expect(standardized).toContain('——迎着夜色')
  })

  it('should format Chinese manuscript with double full-width space indentation', () => {
    const raw = `南淮的夏天总是悄无声息。\n\n街角茶肆的竹帘垂得低低的。`
    const formatted = formatChineseManuscript(raw)

    const lines = formatted.split('\n')
    expect(lines[0].startsWith('\u3000\u3000')).toBe(true)
    expect(lines[1]).toBe('')
    expect(lines[2].startsWith('\u3000\u3000')).toBe(true)
  })

  it('should count characters and Chinese characters accurately', () => {
    const sample = '南淮的夏天。 Hello world!'
    const stats = countTextStats(sample)

    expect(stats.chineseChars).toBe(5)
    expect(stats.words).toBe(7)
  })

  it('should generate concise session titles from first user prompt', () => {
    const title1 = generateSessionTitle('请帮我润色第一章主角吕归尘出场的动作细节与环境微氛围')
    expect(title1.length).toBeLessThanOrEqual(14)
    expect(title1).toContain('请帮我润色第一章主角')

    const title2 = generateSessionTitle('   ')
    expect(title2).toBe('新会话')
  })
})

  it('safely and quickly calculates statistics on massive text without OOM', () => {
    const chunk = '南淮的夏天总是悄无声息，少年拔出铁剑迎着夜色。Hello world 123! '
    const massive = chunk.repeat(10000) // ~550,000 characters

    const start = performance.now()
    const stats = countTextStats(massive)
    const duration = performance.now() - start

    expect(stats.totalChars).toBe(370000)
    expect(stats.chineseChars).toBe(210000)
    expect(duration).toBeLessThan(150) // Under 150ms
  })

describe('cleanVolumeName', () => {
  it('cleans redundant book names and .txt extensions from volume names', () => {
    const cleaned1 = cleanVolumeName('《九州·缥缈录》_卷六_豹魂.txt', '九州·缥缈录')
    expect(cleaned1).toBe('卷六_豹魂')

    const cleaned2 = cleanVolumeName('《九州·缥缈录》_00_序言与简介.txt', '九州·缥缈录')
    expect(cleaned2).toBe('00_序言与简介')

    const cleaned3 = cleanVolumeName('第一卷.txt')
    expect(cleaned3).toBe('第一卷')
  })
})
