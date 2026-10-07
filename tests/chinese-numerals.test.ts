import { describe, it, expect } from 'vitest'
import {
  numberToChinese,
  parseChineseNumber,
  getNextChapterTitle
} from '../src/shared/utils/chineseNumerals'

describe('Chinese Numerals Utilities', () => {
  it('converts numbers 1 to 25 correctly', () => {
    expect(numberToChinese(1)).toBe('一')
    expect(numberToChinese(2)).toBe('二')
    expect(numberToChinese(9)).toBe('九')
    expect(numberToChinese(10)).toBe('十')
    expect(numberToChinese(11)).toBe('十一')
    expect(numberToChinese(19)).toBe('十九')
    expect(numberToChinese(20)).toBe('二十')
    expect(numberToChinese(21)).toBe('二十一')
    expect(numberToChinese(99)).toBe('九十九')
    expect(numberToChinese(100)).toBe('一百')
  })

  it('parses Chinese numbers back to integer', () => {
    expect(parseChineseNumber('一')).toBe(1)
    expect(parseChineseNumber('二')).toBe(2)
    expect(parseChineseNumber('十')).toBe(10)
    expect(parseChineseNumber('十一')).toBe(11)
    expect(parseChineseNumber('二十五')).toBe(25)
    expect(parseChineseNumber('3')).toBe(3)
  })

  it('increments chapter titles consistently in Chinese', () => {
    expect(getNextChapterTitle([])).toBe('第一章')
    expect(getNextChapterTitle(['第一章'])).toBe('第二章')
    expect(getNextChapterTitle(['第一章', '第二章'])).toBe('第三章')
    expect(getNextChapterTitle(['第十九章'])).toBe('第二十章')
    expect(getNextChapterTitle(['第一章 序章', '第二章 逆流'])).toBe('第三章')
  })
})
