const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * Converts a positive integer (1 to 99999) into standard Chinese numeral format.
 * Examples:
 * 1 -> 一
 * 2 -> 二
 * 10 -> 十
 * 11 -> 十一
 * 20 -> 二十
 * 21 -> 二十一
 * 100 -> 一百
 * 105 -> 一百零五
 * 110 -> 一百一十
 */
export function numberToChinese(n: number): string {
  if (n <= 0) return '零'
  if (n < 10) return CHINESE_DIGITS[n]
  if (n === 10) return '十'
  if (n < 20) return `十${CHINESE_DIGITS[n % 10]}`
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return `${CHINESE_DIGITS[tens]}十${ones > 0 ? CHINESE_DIGITS[ones] : ''}`
  }

  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const remainder = n % 100
    let res = `${CHINESE_DIGITS[hundreds]}百`
    if (remainder === 0) return res
    if (remainder < 10) {
      res += `零${CHINESE_DIGITS[remainder]}`
    } else if (remainder < 20) {
      res += `一十${remainder % 10 > 0 ? CHINESE_DIGITS[remainder % 10] : ''}`
    } else {
      res += numberToChinese(remainder)
    }
    return res
  }

  if (n < 10000) {
    const thousands = Math.floor(n / 1000)
    const remainder = n % 1000
    let res = `${CHINESE_DIGITS[thousands]}千`
    if (remainder === 0) return res
    if (remainder < 100) {
      res += `零${numberToChinese(remainder)}`
    } else {
      res += numberToChinese(remainder)
    }
    return res
  }

  // 10000 - 99999
  const myriads = Math.floor(n / 10000)
  const remainder = n % 10000
  let res = `${numberToChinese(myriads)}万`
  if (remainder > 0) {
    if (remainder < 1000) res += '零'
    res += numberToChinese(remainder)
  }
  return res
}

/**
 * Parses Chinese numeral back to integer, or parses Arabic numbers if present.
 */
export function parseChineseNumber(str: string): number | null {
  const trimmed = str.trim()
  const arabic = parseInt(trimmed, 10)
  if (!isNaN(arabic)) return arabic

  const map: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  }

  if (trimmed.length === 1 && map[trimmed] !== undefined) {
    return map[trimmed]
  }

  let total = 0
  let current = 0

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]
    if (map[char] !== undefined) {
      current = map[char]
      if (i === trimmed.length - 1) total += current
    } else if (char === '十') {
      total += (current === 0 ? 1 : current) * 10
      current = 0
    } else if (char === '百') {
      total += current * 100
      current = 0
    } else if (char === '千') {
      total += current * 1000
      current = 0
    }
  }

  return total > 0 ? total : null
}

/**
 * Extracts the highest chapter number from a list of titles and generates the next chapter title.
 * Handles "第一章", "第二章", etc.
 */
export function getNextChapterTitle(existingTitles: string[]): string {
  let maxChapterNum = 0

  for (const title of existingTitles) {
    const match = title.match(/^第([0-9零一二三四五六七八九十百千万]+)章/)
    if (match) {
      const num = parseChineseNumber(match[1])
      if (num && num > maxChapterNum) {
        maxChapterNum = num
      }
    }
  }

  const nextNum = maxChapterNum > 0 ? maxChapterNum + 1 : existingTitles.length + 1
  return `第${numberToChinese(nextNum)}章`
}
