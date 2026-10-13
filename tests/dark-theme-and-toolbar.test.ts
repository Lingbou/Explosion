import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '../src/shared/types/ipc'

describe('Dark Theme & Toolbar Layout Guardrails', () => {
  it('defines WINDOW_MAXIMIZE_CHANGED channel for frameless titlebar synchronization', () => {
    expect(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED).toBe('window:maximize-changed')
  })

  it('guarantees EditorCenter 44px subheader bar is completely removed, title is unified with content, and time machine is in footer', () => {
    const editorFilePath = path.resolve(__dirname, '../src/renderer/src/components/layout/EditorCenter.tsx')
    const content = fs.readFileSync(editorFilePath, 'utf-8')

    // Sub-header bar container must be completely removed
    expect(content).not.toContain('backdrop-blur-xs select-none shrink-0 z-20 min-w-0')
    expect(content).not.toContain('规范排版</span>')
    expect(content).not.toContain('复制纯文本</span>')

    // Immersive Title is unified inside editor scroll flow (Notion / Typora style)
    expect(content).toContain('placeholder="未命名章节"')
    expect(content).toContain('max-w-4xl mx-auto px-8 md:px-12 pt-10')

    // Time Machine button is present in bottom status bar footer
    expect(content).toContain('时光机</span>')
    expect(content).toMatch(/<footer[\s\S]*?时光机[\s\S]*?<\/footer>/)

    // SettingsModal has Typewriter Focus Mode toggle
    const settingsFilePath = path.resolve(__dirname, '../src/renderer/src/components/SettingsModal.tsx')
    const settingsContent = fs.readFileSync(settingsFilePath, 'utf-8')
    expect(settingsContent).toContain('打字机定焦滚动模式')
    expect(settingsContent).toContain('typewriterMode')
  })

  it('guarantees RightPanel input area has complete dark theme styles with zero white background bleed', () => {
    const rightPanelPath = path.resolve(__dirname, '../src/renderer/src/components/layout/RightPanel.tsx')
    const content = fs.readFileSync(rightPanelPath, 'utf-8')

    // The bottom input container must specify dark:bg-[#1e1d1b] and dark:border-stone-800
    expect(content).toContain('dark:bg-[#1e1d1b] border border-stone-200 dark:border-stone-800')

    // Live Delta block must have dark theme styles
    expect(content).toMatch(/dark:bg-\[#1e1d1b\][^>]*text-stone-900 dark:text-stone-100 font-serif/)

    // TraceCard container must have dark styles
    expect(content).toContain('border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden bg-white dark:bg-[#1f1e1c]')

    // SubAgentTaskCard must have dark styles
    expect(content).toContain('border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden bg-white dark:bg-[#1f1e1c]')
  })

  it('guarantees LibraryPreviewModal, SnapshotDrawer and OnboardingModal have dark footers', () => {
    const libModal = fs.readFileSync(path.resolve(__dirname, '../src/renderer/src/components/LibraryPreviewModal.tsx'), 'utf-8')
    expect(libModal).toContain('border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#161514]')

    const snapDrawer = fs.readFileSync(path.resolve(__dirname, '../src/renderer/src/components/SnapshotDrawer.tsx'), 'utf-8')
    expect(snapDrawer).toContain('border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#161514]')

    const onboardModal = fs.readFileSync(path.resolve(__dirname, '../src/renderer/src/components/OnboardingModal.tsx'), 'utf-8')
    expect(onboardModal).toContain('border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-[#161514]')
  })
})
