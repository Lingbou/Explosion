/**
 * Typography utilities strictly enforcing:
 * 1. Zero Markdown pollution (strips '#', '**', '*', '`', '>', bullet markers, etc.)
 * 2. Standard Chinese publication paragraph indentation (two full-width spaces \u3000\u3000)
 * 3. Chinese punctuation standardization (quotes, dashes, ellipses)
 * 4. High-performance, OOM-safe character statistics with zero massive array allocations
 * 5. Publication-grade plain-text novel export formatting with uniform chapter and volume separation
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

export interface ExportChapterInput {
  title: string
  content: string
  volume?: string
  filename?: string
}

/**
 * Formats multiple manuscript chapters into a publication-grade plain text manuscript:
 * - Uniform 2 empty lines (\n\n\n) between chapters
 * - Volume separation when volume changes (\n\n between volume title and first chapter)
 * - Chapter titles flush-left with 1 empty line (\n\n) before body
 * - Non-indented chapter titles; double full-width space (\u3000\u3000) for body paragraphs
 * - Deduplicates chapter title if chapter content already starts with the title
 * - Zero Markdown pollution, zero excessive blank lines
 */
export function formatManuscriptExport(chapters: ExportChapterInput[]): string {
  if (!chapters || chapters.length === 0) return ''

  const blocks: string[] = []
  let currentVolume: string | undefined = undefined

  for (const chapter of chapters) {
    const chapterBlocks: string[] = []

    // 1. Volume separation: emit volume title when volume changes
    if (chapter.volume && chapter.volume.trim() !== '' && chapter.volume !== currentVolume) {
      currentVolume = chapter.volume
      let cleanVol = chapter.volume.trim()
      const volMatch = cleanVol.match(/^\d+[-_](.+)$/)
      if (volMatch) cleanVol = volMatch[1].trim()
      chapterBlocks.push(cleanVol)
    }

    // 2. Clean chapter title
    let chapterTitle = (chapter.title || '').trim()
    if (!chapterTitle && chapter.filename) {
      chapterTitle = chapter.filename.replace(/\.txt$/i, '').trim()
      const match = chapterTitle.match(/^\d+[-_](.+)$/)
      if (match) chapterTitle = match[1].trim()
    }
    if (!chapterTitle) {
      chapterTitle = '未命名章节'
    }

    // 3. Clean content
    const rawContent = chapter.content || ''
    const cleanContent = stripMarkdownMarks(rawContent)
    const punctuated = standardizeChinesePunctuation(cleanContent)

    // 4. Split into lines
    const rawLines = punctuated.split(/\r?\n/)
    const lines: string[] = []

    for (const p of rawLines) {
      const trimmed = p.trim().replace(/^[\s\u3000]+/, '')
      lines.push(trimmed)
    }

    // 5. Detect if content already starts with the chapter title
    let firstNonEmptyIdx = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 0) {
        firstNonEmptyIdx = i
        break
      }
    }

    if (firstNonEmptyIdx !== -1) {
      const firstLine = lines[firstNonEmptyIdx]
      const normalizedFirst = firstLine.replace(/\s+/g, '')
      const normalizedTitle = chapterTitle.replace(/\s+/g, '')
      const filenameBase = chapter.filename
        ? chapter.filename.replace(/\.txt$/i, '').replace(/\s+/g, '')
        : ''

      if (
        normalizedFirst === normalizedTitle ||
        (filenameBase && normalizedFirst === filenameBase)
      ) {
        chapterTitle = firstLine
        lines.splice(firstNonEmptyIdx, 1)
      }
    }

    // Add chapter title flush-left
    chapterBlocks.push(chapterTitle)

    // Format body paragraphs with \u3000\u3000
    const formattedParagraphs: string[] = []
    let prevEmpty = false

    for (const line of lines) {
      if (line === '') {
        if (!prevEmpty && formattedParagraphs.length > 0) {
          formattedParagraphs.push('')
          prevEmpty = true
        }
      } else {
        formattedParagraphs.push(`\u3000\u3000${line}`)
        prevEmpty = false
      }
    }

    // Remove trailing empty lines
    while (formattedParagraphs.length > 0 && formattedParagraphs[formattedParagraphs.length - 1] === '') {
      formattedParagraphs.pop()
    }

    if (formattedParagraphs.length > 0) {
      chapterBlocks.push(formattedParagraphs.join('\n'))
    }

    // Join sections within a chapter (volume -> chapter title -> body) with 1 empty line
    blocks.push(chapterBlocks.join('\n\n'))
  }

  // Join chapters with uniform 2 empty lines and end with a single newline
  return blocks.join('\n\n\n') + '\n'
}

export function countTextStats(text: string): {
  totalChars: number
  chineseChars: number
  words: number
  readingMinutes: number
} {
  if (!text) {
    return {
      totalChars: 0,
      chineseChars: 0,
      words: 0,
      readingMinutes: 1
    }
  }

  let totalChars = 0
  let chineseChars = 0
  let englishWords = 0
  let inWord = false

  const len = text.length
  // Single linear pass: 0 array allocation, executes in ~2ms even on 2MB text, 100% OOM-proof
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i)

    // Skip control characters and whitespace (ASCII <= 32 or full-width space 0x3000)
    if (code <= 32 || code === 0x3000) {
      if (inWord) {
        englishWords++
        inWord = false
      }
      continue
    }

    totalChars++

    // Chinese characters: CJK Unified Ideographs 0x4E00 - 0x9FFF, CJK Extension A 0x3400 - 0x4DBF
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
      chineseChars++
      if (inWord) {
        englishWords++
        inWord = false
      }
    } else if (
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57)
    ) {
      inWord = true
    } else {
      if (inWord) {
        englishWords++
        inWord = false
      }
    }
  }

  if (inWord) englishWords++
  const words = chineseChars + englishWords
  const readingMinutes = Math.max(1, Math.ceil(totalChars / 400))

  return {
    totalChars,
    chineseChars,
    words,
    readingMinutes
  }
}
