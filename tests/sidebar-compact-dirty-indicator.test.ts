import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('LeftSidebar Compact Layout & VSCode-style Dirty Indicator Guardrails', () => {
  const sidebarPath = path.resolve(__dirname, '../src/renderer/src/components/layout/LeftSidebar.tsx')
  const editorPath = path.resolve(__dirname, '../src/renderer/src/components/layout/EditorCenter.tsx')
  const workspaceStorePath = path.resolve(__dirname, '../src/renderer/src/store/workspaceStore.ts')

  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8')
  const editorContent = fs.readFileSync(editorPath, 'utf-8')
  const storeContent = fs.readFileSync(workspaceStorePath, 'utf-8')

  it('guarantees LeftSidebar top project switcher header is compact h-9 with Typora/VSCode aesthetic', () => {
    // 1. Container must be h-9 and compact padding
    expect(sidebarContent).toContain('h-9 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1f1e1c] px-2')

    // 2. Project switcher button must be compact font and padding (11px, py-0.5)
    expect(sidebarContent).toContain('px-1.5 py-0.5 rounded text-[11px] font-medium')

    // 3. Icons must be delicately sized (w-3 h-3 for FolderOpen, w-2.5 h-2.5 for ChevronDown)
    expect(sidebarContent).toMatch(/FolderOpen[^>]*w-3 h-3/)
    expect(sidebarContent).toMatch(/ChevronDown[^>]*w-2\.5 h-2\.5/)

    // 4. Quick add action buttons must use compact w-3 h-3 icons
    expect(sidebarContent).toMatch(/FolderPlus[^>]*w-3 h-3/)
    expect(sidebarContent).toMatch(/Plus[^>]*w-3 h-3/)

    // 5. Dropdown menu should be positioned compact below the header
    expect(sidebarContent).toContain('top-full mt-0.5 w-56')
  })

  it('completely abolishes legacy save status text badges from EditorCenter', () => {
    // 1. Must NOT contain "已保存" text badge anywhere
    expect(editorContent).not.toContain('已保存')

    // 2. Must NOT contain "编辑中" text badge anywhere
    expect(editorContent).not.toContain('编辑中')

    // 3. Must NOT import CheckCircle2 or FileEdit for save badges
    expect(editorContent).not.toMatch(/import\s*\{[^}]*CheckCircle2[^}]*\}\s*from\s*['"]lucide-react['"]/)
    expect(editorContent).not.toMatch(/import\s*\{[^}]*FileEdit[^}]*\}\s*from\s*['"]lucide-react['"]/)

    // 4. Must NOT have dangling separator line where the save status used to be
    expect(editorContent).not.toMatch(/\{\/\* Save Status \*\/\}/)
  })

  it('renders VSCode-style grey translucent dirty indicator dot in chapter items when active and dirty', () => {
    // Must destructure isDirty in LeftSidebar
    expect(sidebarContent).toMatch(/const\s*\{[\s\S]*?\bisDirty\b[\s\S]*?\}\s*=\s*useWorkspaceStore\(\)/)

    // renderChapterItem must contain the dirty dot indicator matching the specified styling
    expect(sidebarContent).toContain('w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0')
    expect(sidebarContent).toMatch(/isActive\s*&&\s*isDirty[\s\S]*?w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0/)
  })

  it('renders VSCode-style dirty dot indicator in Story Bible files (outlines, characters, ledger)', () => {
    // Outlines list must render dirty indicator when active && isDirty
    const outlinesSection = sidebarContent.slice(sidebarContent.indexOf('大纲规划'), sidebarContent.indexOf('人物档案'))
    expect(outlinesSection).toContain('w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0')
    expect(outlinesSection).toMatch(/isActive\s*&&\s*isDirty/)

    // Characters list must render dirty indicator when active && isDirty
    const charactersSection = sidebarContent.slice(sidebarContent.indexOf('人物档案'), sidebarContent.indexOf('3. Threads (暗线)'))
    expect(charactersSection).toContain('w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0')
    expect(charactersSection).toMatch(/isActive\s*&&\s*isDirty/)

    // Ledger (暗线) must render dirty indicator when active && isDirty
    const ledgerSection = sidebarContent.slice(sidebarContent.indexOf('3. Threads (暗线)'), sidebarContent.indexOf('Bottom Pinned Library Entry'))
    expect(ledgerSection).toContain('w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 opacity-80 shrink-0')
    expect(ledgerSection).toMatch(/isActive\s*&&\s*isDirty/)
  })

  it('guarantees workspaceStore accurately manages isDirty state across all writing & switching workflows', () => {
    // isDirty is initially false in store state definition
    expect(storeContent).toMatch(/isDirty:\s*false/)

    // updateContent must set isDirty: true for active chapter
    expect(storeContent).toMatch(/if\s*\(activeDocumentType === 'chapter'\)[\s\S]*?set\(\{\s*chapters:\s*updated,\s*isDirty:\s*true\s*\}\)/)

    // updateContent must set isDirty: true for active story file
    expect(storeContent).toMatch(/else if\s*\(activeStoryFile\)[\s\S]*?isDirty:\s*true/)

    // saveActiveDocument must clear isDirty to false
    expect(storeContent).toMatch(/saveActiveDocument:[\s\S]*?set\(\{\s*isDirty:\s*false,\s*lastSavedAt:/)

    // selectChapter must reset isDirty to false upon switching
    expect(storeContent).toMatch(/selectChapter:[\s\S]*?isDirty:\s*false/)

    // selectStoryFile must reset isDirty to false upon switching
    expect(storeContent).toMatch(/selectStoryFile:[\s\S]*?isDirty:\s*false/)

    // closeProject must reset isDirty to false
    expect(storeContent).toMatch(/closeProject:[\s\S]*?isDirty:\s*false/)
  })
})
