import { describe, it, expect } from 'vitest'
import {
  stripMarkdownMarks,
  standardizeChinesePunctuation,
  formatChineseManuscript,
  countTextStats
} from '../src/renderer/src/lib/typography'

describe('Typography & Chinese Formatting', () => {
  it('should strip markdown headers, bold, italics, quotes and lists', () => {
    const raw = `# 第一章 暴风雨\n\n> 这是一个引用\n\n**加粗内容** 与 *斜体内容*\n\n- 列表项1\n- 列表项2\n\n正文正常句子。`
    const cleaned = stripMarkdownMarks(raw)

    expect(cleaned).not.toContain('#')
    expect(cleaned).not.toContain('**')
    expect(cleaned).not.toContain('*')
    expect(cleaned).not.toContain('>')
    expect(cleaned).not.toContain('- 列表项')
    expect(cleaned).toContain('加粗内容 与 斜体内容')
    expect(cleaned).toContain('正文正常句子。')
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

    expect(stats.chineseChars).toBe(5) // 南淮的夏天 (5 han ideographs)
    expect(stats.words).toBe(7) // 5 Chinese + 2 English words
  })
})
