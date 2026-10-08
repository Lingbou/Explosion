/**
 * Typography utilities strictly enforcing:
 * 1. Zero Markdown pollution (strips '#', '**', '*', '`', '>', bullet markers, etc.)
 * 2. Standard Chinese publication paragraph indentation (two full-width spaces \u3000\u3000)
 * 3. Chinese punctuation standardization (quotes, dashes, ellipses)
 */

export function stripMarkdownMarks(text: string): string {
  if (!text) return ''

  let cleaned = text
    // Remove fenced code blocks (```...```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline backticks
    .replace(/`([^`]+)`/g, '$1')
    .replace(/`/g, '')
    // Remove bold/italics combinations (***...***, **...**, *...*)
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    // Remove underscores (__...__, _..._)
    .replace(/___([^_]+)___/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove headers (# Header)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove blockquotes (> text)
    .replace(/^>\s*/gm, '')
    // Remove bullet points (- item, * item, + item)
    .replace(/^[-*+]\s+/gm, '')

  return cleaned
}

export function standardizeChinesePunctuation(text: string): string {
  let result = text
    // Replace double hyphens with Chinese em-dash
    .replace(/--/g, '——')
    .replace(/——{2,}/g, '——')
    // Standardize ellipses
    .replace(/\.{3,}/g, '……')
    .replace(/。{2,}/g, '……')
    // Standardize straight double quotes to Chinese smart double quotes
    .replace(/"([^"]*)"/g, '“$1”')
    // Standardize straight single quotes to Chinese smart single quotes
    .replace(/'([^']*)'/g, '‘$1’')

  return result
}

export function formatChineseManuscript(rawText: string): string {
  // 1. Strip markdown artifacts
  const clean = stripMarkdownMarks(rawText)

  // 2. Standardize punctuation
  const punctuated = standardizeChinesePunctuation(clean)

  // 3. Process paragraphs: trim leading/trailing whitespace and ensure \u3000\u3000 at start
  const paragraphs = punctuated.split(/\r?\n/)
  const formattedParagraphs = paragraphs.map((para) => {
    const trimmed = para.trim().replace(/^[\s\u3000]+/, '')
    if (!trimmed) {
      return ''
    }
    return `\u3000\u3000${trimmed}`
  })

  // Normalize blank lines: maximum 1 empty line between paragraphs
  const result: string[] = []
  let prevEmpty = false

  for (const p of formattedParagraphs) {
    if (p === '') {
      if (!prevEmpty) {
        result.push('')
        prevEmpty = true
      }
    } else {
      result.push(p)
      prevEmpty = false
    }
  }

  return result.join('\n')
}

export function countTextStats(text: string): {
  totalChars: number
  chineseChars: number
  words: number
  readingMinutes: number
} {
  const normalized = text || ''
  // Total characters excluding newlines and white spaces
  const nonWhitespace = normalized.replace(/\s+/g, '')
  const totalChars = nonWhitespace.length

  // Match Chinese characters (Unicode range 4E00-9FFF, 3400-4DBF)
  const chineseMatches = normalized.match(/[\u4e00-\u9fa5\u3400-\u4dbf]/g)
  const chineseChars = chineseMatches ? chineseMatches.length : 0

  // Words estimation (Chinese characters + English space-separated tokens)
  const englishWords = (normalized.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length
  const words = chineseChars + englishWords

  // Average reading speed: ~400 characters per minute
  const readingMinutes = Math.max(1, Math.ceil(totalChars / 400))

  return {
    totalChars,
    chineseChars,
    words,
    readingMinutes
  }
}
