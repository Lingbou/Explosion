import { describe, it, expect } from 'vitest'
import {
  validateSelection,
  formatSelectionSnippet
} from '../src/renderer/src/lib/selection'

describe('Manuscript Selection Perception & Formatting', () => {
  describe('validateSelection', () => {
    it('returns null when text or range is missing or invalid', () => {
      expect(validateSelection(null, null)).toBeNull()
      expect(validateSelection(undefined, undefined)).toBeNull()
      expect(validateSelection('', { start: 0, end: 0 })).toBeNull()
      expect(validateSelection('一段文字', null)).toBeNull()
      expect(validateSelection(null, { start: 0, end: 4 })).toBeNull()
    })

    it('rejects selections with length < 2 characters', () => {
      // Single character selection
      expect(validateSelection('字', { start: 5, end: 6 })).toBeNull()
    })

    it('rejects selections with invalid or collapsed ranges', () => {
      // Range end <= start
      expect(validateSelection('一段文字', { start: 5, end: 5 })).toBeNull()
      expect(validateSelection('一段文字', { start: 5, end: 4 })).toBeNull()
      // Range span < 2
      expect(validateSelection('一段文字', { start: 5, end: 6 })).toBeNull()
    })

    it('accepts valid selections with length >= 2 characters and valid range', () => {
      const valid = validateSelection('长剑在风中铮鸣', { start: 10, end: 17 })
      expect(valid).not.toBeNull()
      expect(valid?.selectedText).toBe('长剑在风中铮鸣')
      expect(valid?.selectionRange).toEqual({ start: 10, end: 17 })
    })

    it('preserves multi-line or long paragraph selections correctly', () => {
      const paragraph = '第一句台词。“第二句台词。”\n第三句旁白描摹。'
      const valid = validateSelection(paragraph, { start: 100, end: 100 + paragraph.length })
      expect(valid).not.toBeNull()
      expect(valid?.selectedText).toBe(paragraph)
      expect(valid?.selectionRange).toEqual({ start: 100, end: 100 + paragraph.length })
    })
  })

  describe('formatSelectionSnippet', () => {
    it('returns empty string for empty input', () => {
      expect(formatSelectionSnippet('')).toBe('')
    })

    it('returns text as is if length is within maxLength', () => {
      expect(formatSelectionSnippet('短选区文段', 25)).toBe('短选区文段')
      expect(formatSelectionSnippet('长刀破空而过', 25)).toBe('长刀破空而过')
    })

    it('truncates and adds ellipsis when exceeding maxLength', () => {
      const longText = '少年反手扣紧青黑色的重剑，冷冽的雨水顺着剑锋无声滑落，城门前静得能听见呼吸声。'
      const snippet = formatSelectionSnippet(longText, 25)
      expect(snippet.length).toBe(28) // 25 + '...' (3)
      expect(snippet.endsWith('...')).toBe(true)
      expect(snippet.startsWith('少年反手扣紧青黑色的重剑')).toBe(true)
    })
  })
})
