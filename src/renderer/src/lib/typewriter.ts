export interface TypewriterScrollParams {
  /** Vertical pixel offset of the caret from the top of the textarea content (including paddingTop) */
  caretTop: number
  /** Line height in pixels */
  lineHeight: number
  /** Visible client height of the textarea */
  viewportHeight: number
  /** Target vertical ratio within viewport (default 0.5 = exact vertical center) */
  targetRatio?: number
  /** Current scrollTop of the textarea */
  currentScrollTop?: number
  /** Total scrollHeight of the textarea */
  scrollHeight?: number
}

/**
 * Calculates the target scrollTop so that the caret line is centered at targetRatio of the viewport.
 * Pure function: fully deterministic, testable in node without DOM.
 */
export function calculateTypewriterScrollTop(params: TypewriterScrollParams): number {
  const {
    caretTop,
    lineHeight,
    viewportHeight,
    targetRatio = 0.5,
    scrollHeight
  } = params

  if (viewportHeight <= 0) return 0

  const caretCenter = caretTop + lineHeight / 2
  const targetViewportY = viewportHeight * targetRatio
  let targetScrollTop = caretCenter - targetViewportY

  targetScrollTop = Math.max(0, targetScrollTop)

  if (scrollHeight !== undefined && scrollHeight > viewportHeight) {
    const maxScroll = scrollHeight - viewportHeight
    targetScrollTop = Math.min(targetScrollTop, maxScroll)
  }

  return Math.round(targetScrollTop)
}

/**
 * Checks if the scroll position needs updating based on a minimum delta threshold (deadband).
 */
export function shouldUpdateScroll(
  currentScrollTop: number,
  targetScrollTop: number,
  threshold: number = 2
): boolean {
  return Math.abs(currentScrollTop - targetScrollTop) >= threshold
}

/**
 * Pure calculation for metrics of a caret line given line index.
 */
export function getCaretLineMetrics(
  lineIndex: number,
  lineHeight: number,
  paddingTop: number = 0
): { top: number; bottom: number; center: number } {
  const top = paddingTop + Math.max(0, lineIndex) * lineHeight
  const bottom = top + lineHeight
  const center = top + lineHeight / 2
  return { top, bottom, center }
}
