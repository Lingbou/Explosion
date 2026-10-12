import { AppTheme, UiConfig } from '../types/config'
import {
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_FONT_SIZE,
  MIN_LINE_HEIGHT,
  MAX_LINE_HEIGHT,
  DEFAULT_LINE_HEIGHT
} from '../constants/config'

export function clampFontSize(size: unknown): number {
  if (typeof size !== 'number' || isNaN(size)) return DEFAULT_FONT_SIZE
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(size)))
}

export function clampLineHeight(lh: unknown): number {
  if (typeof lh !== 'number' || isNaN(lh)) return DEFAULT_LINE_HEIGHT
  const clamped = Math.max(MIN_LINE_HEIGHT, Math.min(MAX_LINE_HEIGHT, lh))
  return Math.round(clamped * 100) / 100
}

export function isValidTheme(theme: unknown): theme is AppTheme {
  return theme === 'dark' || theme === 'light' || theme === 'sepia'
}

export function sanitizeUiConfig(partial?: Partial<UiConfig>): UiConfig {
  const theme: AppTheme = isValidTheme(partial?.theme) ? partial.theme : 'dark'
  const fontSize = clampFontSize(partial?.fontSize)
  const lineHeight = clampLineHeight(partial?.lineHeight)
  const indentSize = typeof partial?.indentSize === 'number' && partial.indentSize >= 0 ? partial.indentSize : 2
  const typewriterMode = typeof partial?.typewriterMode === 'boolean' ? partial.typewriterMode : true

  return {
    theme,
    fontSize,
    lineHeight,
    indentSize,
    typewriterMode
  }
}
