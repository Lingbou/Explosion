import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  clampFontSize,
  clampLineHeight,
  isValidTheme,
  sanitizeUiConfig
} from '../src/shared/utils/uiConfig'
import {
  calculateTypewriterScrollTop,
  shouldUpdateScroll,
  getCaretLineMetrics
} from '../src/renderer/src/lib/typewriter'
import { ConfigStore, DEFAULT_CONFIG } from '../src/main/config/store'

describe('Editor Typing Feel: Font Size & Line Height Clamping (Pure Functions)', () => {
  it('clamps font sizes correctly within reasonable bounds [14px, 24px]', () => {
    expect(clampFontSize(10)).toBe(14)
    expect(clampFontSize(13)).toBe(14)
    expect(clampFontSize(14)).toBe(14)
    expect(clampFontSize(18)).toBe(18)
    expect(clampFontSize(24)).toBe(24)
    expect(clampFontSize(30)).toBe(24)
    expect(clampFontSize(18.4)).toBe(18)
    expect(clampFontSize(18.6)).toBe(19)
    // Fallback for invalid types
    expect(clampFontSize(NaN)).toBe(16)
    expect(clampFontSize('invalid')).toBe(16)
    expect(clampFontSize(undefined)).toBe(16)
  })

  it('clamps line heights correctly within reasonable bounds [1.5, 2.4]', () => {
    expect(clampLineHeight(1.0)).toBe(1.5)
    expect(clampLineHeight(1.49)).toBe(1.5)
    expect(clampLineHeight(1.5)).toBe(1.5)
    expect(clampLineHeight(1.85)).toBe(1.85)
    expect(clampLineHeight(2.1)).toBe(2.1)
    expect(clampLineHeight(2.4)).toBe(2.4)
    expect(clampLineHeight(3.5)).toBe(2.4)
    // Round to 2 decimal places
    expect(clampLineHeight(1.856)).toBe(1.86)
    // Fallback for invalid types
    expect(clampLineHeight(NaN)).toBe(1.85)
    expect(clampLineHeight('invalid')).toBe(1.85)
    expect(clampLineHeight(null)).toBe(1.85)
  })

  it('validates supported theme identifiers', () => {
    expect(isValidTheme('dark')).toBe(true)
    expect(isValidTheme('light')).toBe(true)
    expect(isValidTheme('sepia')).toBe(true)
    expect(isValidTheme('high-contrast')).toBe(false)
    expect(isValidTheme('')).toBe(false)
    expect(isValidTheme(null)).toBe(false)
    expect(isValidTheme(undefined)).toBe(false)
  })

  it('sanitizes partial UiConfig with secure defaults and clamped values', () => {
    const emptyConfig = sanitizeUiConfig()
    expect(emptyConfig.theme).toBe('dark')
    expect(emptyConfig.fontSize).toBe(16)
    expect(emptyConfig.lineHeight).toBe(1.85)
    expect(emptyConfig.typewriterMode).toBe(true)
    expect(emptyConfig.indentSize).toBe(2)

    const partialConfig = sanitizeUiConfig({
      fontSize: 99,
      lineHeight: 0.5,
      theme: 'light',
      typewriterMode: false
    })
    expect(partialConfig.fontSize).toBe(24) // clamped to max
    expect(partialConfig.lineHeight).toBe(1.5) // clamped to min
    expect(partialConfig.theme).toBe('light')
    expect(partialConfig.typewriterMode).toBe(false)
  })
})

describe('Editor Typing Feel: Typewriter Focus Scrolling Math (Pure Functions)', () => {
  it('accurately calculates target scrollTop to center the caret line at 50% viewport', () => {
    // Caret at top = 1000px, lineHeight = 30px, viewport = 600px
    // Caret center = 1000 + 15 = 1015px
    // Target viewport Y = 600 * 0.5 = 300px
    // Target scrollTop = 1015 - 300 = 715px
    const targetScroll = calculateTypewriterScrollTop({
      caretTop: 1000,
      lineHeight: 30,
      viewportHeight: 600,
      targetRatio: 0.5
    })
    expect(targetScroll).toBe(715)

    // Verification: in viewport, line top is at (1000 - 715) = 285px
    // line bottom is at 285 + 30 = 315px
    // line midpoint is (285 + 315) / 2 = 300px (exact 50% of 600px)
    expect(1000 - targetScroll + 30 / 2).toBe(300)
  })

  it('clamps to zero when caret is near the top of the manuscript', () => {
    // Caret at 50px, viewport = 600px
    // Caret center = 50 + 15 = 65px
    // Target = 65 - 300 = -235 -> should clamp to 0
    const targetScroll = calculateTypewriterScrollTop({
      caretTop: 50,
      lineHeight: 30,
      viewportHeight: 600,
      targetRatio: 0.5
    })
    expect(targetScroll).toBe(0)
  })

  it('supports custom vertical focus ratios (e.g. 40% focus height)', () => {
    // Caret at 1000px, lineHeight = 30px, viewport = 600px, targetRatio = 0.4
    // Target viewport Y = 600 * 0.4 = 240px
    // Target scrollTop = 1015 - 240 = 775px
    const targetScroll = calculateTypewriterScrollTop({
      caretTop: 1000,
      lineHeight: 30,
      viewportHeight: 600,
      targetRatio: 0.4
    })
    expect(targetScroll).toBe(775)
    expect(1000 - targetScroll + 30 / 2).toBe(240)
  })

  it('respects scrollHeight maximum bound when provided', () => {
    // Max scroll is scrollHeight (1000) - viewportHeight (600) = 400px
    // Even if calculated target is 715px, it should clamp to 400px
    const targetScroll = calculateTypewriterScrollTop({
      caretTop: 1000,
      lineHeight: 30,
      viewportHeight: 600,
      targetRatio: 0.5,
      scrollHeight: 1000
    })
    expect(targetScroll).toBe(400)
  })

  it('safely handles zero or negative viewportHeight without crashing', () => {
    expect(calculateTypewriterScrollTop({ caretTop: 500, lineHeight: 30, viewportHeight: 0 })).toBe(0)
    expect(calculateTypewriterScrollTop({ caretTop: 500, lineHeight: 30, viewportHeight: -100 })).toBe(0)
  })

  it('correctly filters negligible scroll deltas via deadband threshold', () => {
    expect(shouldUpdateScroll(500, 501, 2)).toBe(false)
    expect(shouldUpdateScroll(500, 502, 2)).toBe(true)
    expect(shouldUpdateScroll(500, 505, 2)).toBe(true)
    expect(shouldUpdateScroll(500, 499, 2)).toBe(false)
    expect(shouldUpdateScroll(500, 498, 2)).toBe(true)
  })

  it('computes caret line vertical metrics accurately', () => {
    const metrics = getCaretLineMetrics(10, 24, 40)
    // top = 40 + 10 * 24 = 280
    // bottom = 280 + 24 = 304
    // center = 280 + 12 = 292
    expect(metrics.top).toBe(280)
    expect(metrics.bottom).toBe(304)
    expect(metrics.center).toBe(292)
  })
})

describe('ConfigStore Sandboxed Isolation: UI & Typing Feel Persistence', () => {
  let tempDir: string
  let store: ConfigStore
  const realHomeConfigPath = path.join(os.homedir(), '.explosion', 'config.json')
  let originalRealConfigMtime: number | null = null

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `explosion-ui-test-${Date.now()}-${Math.random()}`)
    store = new ConfigStore(tempDir)

    if (fs.existsSync(realHomeConfigPath)) {
      originalRealConfigMtime = fs.statSync(realHomeConfigPath).mtimeMs
    }
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }

    // Verify sandbox isolation: real ~/.explosion/config.json must NEVER be touched
    if (fs.existsSync(realHomeConfigPath) && originalRealConfigMtime !== null) {
      const currentRealConfigMtime = fs.statSync(realHomeConfigPath).mtimeMs
      expect(currentRealConfigMtime).toBe(originalRealConfigMtime)
    }
  })

  it('loads initial default UI configuration with typewriterMode and typography defaults', () => {
    const config = store.loadConfig()
    expect(config.ui).toBeDefined()
    expect(config.ui.fontSize).toBe(16)
    expect(config.ui.lineHeight).toBe(1.85)
    expect(config.ui.theme).toBe('dark')
    expect(config.ui.typewriterMode).toBe(true)
  })

  it('persists and reloads modified UI preferences cleanly', () => {
    const config = store.loadConfig()
    config.ui.fontSize = 20
    config.ui.lineHeight = 2.2
    config.ui.theme = 'light'
    config.ui.typewriterMode = false

    store.saveConfig(config)

    const reloaded = store.loadConfig()
    expect(reloaded.ui.fontSize).toBe(20)
    expect(reloaded.ui.lineHeight).toBe(2.2)
    expect(reloaded.ui.theme).toBe('light')
    expect(reloaded.ui.typewriterMode).toBe(false)
  })

  it('safely clamps out-of-range UI values upon load and merge', () => {
    const config = store.loadConfig()
    config.ui.fontSize = 99 // out of [14, 24]
    config.ui.lineHeight = 0.5 // out of [1.5, 2.4]
    store.saveConfig(config)

    const reloaded = store.loadConfig()
    expect(reloaded.ui.fontSize).toBe(24)
    expect(reloaded.ui.lineHeight).toBe(1.5)
  })
})
