import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '../src/shared/types/ipc'

describe('Dark Theme & Toolbar Layout Guardrails', () => {
  it('defines WINDOW_MAXIMIZE_CHANGED channel for frameless titlebar synchronization', () => {
    expect(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED).toBe('window:maximize-changed')
  })

  it('guarantees EditorCenter subheader buttons cannot wrap or break words across lines', () => {
    const editorFilePath = path.resolve(__dirname, '../src/renderer/src/components/layout/EditorCenter.tsx')
    const content = fs.readFileSync(editorFilePath, 'utf-8')

    // Sub-header bar container must be min-w-0
    expect(content).toContain('backdrop-blur-xs select-none shrink-0 z-20 min-w-0')

    // Left title must have min-w-0 to prevent pushing buttons out
    expect(content).toContain('flex items-center gap-2 flex-1 min-w-0 mr-2 md:mr-4')

    // Status and actions buttons container must be shrink-0
    expect(content).toContain('flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-none')

    // Core buttons must have shrink-0 and whitespace-nowrap to forbid Chinese vertical word wrapping
    expect(content).toContain('定焦</span>')
    expect(content).toMatch(/定焦<\/span>[\s\S]*?whitespace-nowrap|whitespace-nowrap[\s\S]*?定焦<\/span>/)

    expect(content).toContain('排版</span>')
    expect(content).toMatch(/排版<\/span>[\s\S]*?whitespace-nowrap|whitespace-nowrap[\s\S]*?排版<\/span>/)

    expect(content).toContain('时光机</span>')
    expect(content).toMatch(/时光机<\/span>[\s\S]*?whitespace-nowrap|whitespace-nowrap[\s\S]*?时光机<\/span>/)

    expect(content).toContain('规范排版</span>')
    expect(content).toMatch(/规范排版<\/span>[\s\S]*?whitespace-nowrap|whitespace-nowrap[\s\S]*?规范排版<\/span>/)

    expect(content).toContain('交稿导出')
    expect(content).toMatch(/交稿导出[\s\S]*?whitespace-nowrap|whitespace-nowrap[\s\S]*?交稿导出/)
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
