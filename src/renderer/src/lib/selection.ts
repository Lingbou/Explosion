export interface TextSelectionRange {
  start: number
  end: number
}

export interface ValidatedSelection {
  selectedText: string
  selectionRange: TextSelectionRange
}

/**
 * 校验手稿划词选区是否符合定向指派规范：
 * 选区文本长度必须 >= 2 字符，且 selectionRange 有效且跨度 >= 2。
 */
export function validateSelection(
  text: string | null | undefined,
  range: TextSelectionRange | null | undefined
): ValidatedSelection | null {
  if (!text || typeof text !== 'string') return null
  if (text.length < 2) return null
  if (!range || typeof range.start !== 'number' || typeof range.end !== 'number') return null
  if (range.end - range.start < 2) return null

  return {
    selectedText: text,
    selectionRange: { start: range.start, end: range.end }
  }
}

/**
 * 格式化选中文段为微型引用胶囊展示预览
 */
export function formatSelectionSnippet(text: string, maxLength = 25): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed
  return trimmed.slice(0, maxLength) + '...'
}
