import { useAgentStore } from './agentStore'
import { create } from 'zustand'
import { formatChineseManuscript } from '../lib/typography'
import { validateSelection } from '../lib/selection'
import { getNextChapterTitle } from '../../../shared/utils/chineseNumerals'
import { ProjectChapterFile, StoryBibleData, StoryBibleFile, ManuscriptExportResult } from '../../../shared/types/ipc'

export type Chapter = ProjectChapterFile

interface WorkspaceState {
  projectPath: string | null
  projectTitle: string
  chapters: Chapter[]
  volumes: string[]
  selectedVolume: string | null
  collapsedVolumes: Record<string, boolean>
  activeChapterId: string

  // Story Bible & Active Document
  storyBible: StoryBibleData | null
  activeDocumentType: 'chapter' | 'story'
  activeStoryFile: StoryBibleFile | null

  isDirty: boolean
  lastSavedAt: number | null

  // Selection Perception
  selectedText: string | null
  selectionRange: { start: number; end: number } | null
  setSelection: (text: string | null, range: { start: number; end: number } | null) => void
  clearSelection: () => void

  initWorkspace: (lastProjectPath?: string | null) => Promise<void>
  openProject: () => Promise<void>
  createProject: () => Promise<void>
  loadProjectByPath: (path: string) => Promise<void>
  closeProject: () => Promise<void>
  setProjectTitle: (title: string) => void

  // Volume & Manuscript Actions
  toggleVolumeCollapse: (volumeName: string) => void
  setSelectedVolume: (volumeName: string | null) => void
  createVolume: (volumeName: string) => Promise<string | undefined>
  renameVolume: (oldName: string, newName: string) => Promise<void>
  deleteVolume: (volumeName: string, keepChapters?: boolean) => Promise<void>
  reorderChapters: (volume: string | undefined, orderedFilenames: string[]) => Promise<void>
  moveChapter: (params: {
    chapterId?: string
    filename: string
    sourceVolume?: string
    targetVolume?: string
    targetIndex: number
  }) => Promise<void>
  selectChapter: (id: string) => void
  updateContent: (content: string) => void
  updateChapterTitle: (id: string, title: string) => Promise<void>
  addChapter: (customTitle?: string, volume?: string) => Promise<void>
  deleteChapter: (id: string) => Promise<void>

  // Story Bible Actions
  selectStoryFile: (file: StoryBibleFile) => void
  createStoryFile: (type: 'outline' | 'character', title?: string) => Promise<void>
  deleteStoryFile: (relativePath: string) => Promise<void>
  renameStoryFile: (relativePath: string, newTitle: string) => Promise<void>

  // Common Actions
  applyTypography: () => void
  saveActiveDocument: () => Promise<void>
  saveActiveChapter: () => Promise<void>
  insertText: (text: string) => void
  // Export Actions & State
  isExporting: boolean
  exportResult: {
    visible: boolean
    filePath: string
    chapterCount: number
    totalChars: number
  } | null
  dismissExportResult: () => void
  exportManuscript: () => Promise<ManuscriptExportResult>
}

const DEFAULT_CHAPTER_TEMPLATE = {
  title: '第一章',
  content: '',
  filename: '001-第一章.txt'
}

let isFileSyncSubscribed = false

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projectPath: null,
  projectTitle: '',
  chapters: [],
  volumes: [],
  selectedVolume: null,
  collapsedVolumes: {},
  activeChapterId: '',
  storyBible: null,
  activeDocumentType: 'chapter',
  activeStoryFile: null,
  isDirty: false,
  lastSavedAt: null,
  selectedText: null,
  selectionRange: null,
  isExporting: false,
  exportResult: null,
  dismissExportResult: () => {
    set({ exportResult: null })
  },
  exportManuscript: async () => {
    const { projectPath, isDirty, saveActiveDocument, chapters } = get()
    if (!projectPath) {
      return { success: false, error: "未打开工程" }
    }
    if (chapters.length === 0) {
      return { success: false, error: "当前工程暂无手稿章节可供导出" }
    }

    if (isDirty) {
      await saveActiveDocument()
    }

    set({ isExporting: true })
    try {
      const res = await window.api.exportManuscript({ projectPath })
      if (res.success && res.filePath) {
        set({
          exportResult: {
            visible: true,
            filePath: res.filePath,
            chapterCount: res.chapterCount || chapters.length,
            totalChars: res.totalChars || 0
          }
        })
      }
      return res
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "导出异常"
      }
    } finally {
      set({ isExporting: false })
    }
  },

  initWorkspace: async (lastProjectPath?: string | null) => {
    // Setup Live File Sync listener once
    if (!isFileSyncSubscribed && window.api?.onProjectFileChanged) {
      window.api.onProjectFileChanged((payload) => {
        const { projectPath, filename, content, filePath } = payload
        const state = get()
        if (!state.projectPath || state.projectPath !== projectPath) return

        if (filePath.includes('story/')) {
          // Story Bible file changed
          if (state.activeStoryFile && state.activeStoryFile.filename === filename) {
            set({
              activeStoryFile: {
                ...state.activeStoryFile,
                content: content ?? state.activeStoryFile.content,
                updatedAt: Date.now()
              },
              isDirty: false,
              lastSavedAt: Date.now(),
              selectedText: null,
              selectionRange: null
            })
          }
          state.loadProjectByPath(projectPath)
          return
        }

        const existing = state.chapters.find((ch) => ch.filename === filename)
        if (existing) {
          // Live update chapter content directly on screen!
          const updated = state.chapters.map((ch) =>
            ch.filename === filename
              ? { ...ch, content: content ?? ch.content, updatedAt: Date.now() }
              : ch
          )
          set({ chapters: updated, isDirty: false, lastSavedAt: Date.now(), selectedText: null, selectionRange: null })
        } else {
          // New chapter file created on disk, reload project list
          state.loadProjectByPath(projectPath)
        }
      })
      isFileSyncSubscribed = true
    }

    if (lastProjectPath && typeof lastProjectPath === 'string') {
      try {
        await get().loadProjectByPath(lastProjectPath)
        return
      } catch {
        // Fallback to empty slate
      }
    }
  },

  openProject: async () => {
    try {
      const selected = await window.api.openProjectDialog()
      if (selected) {
        await get().loadProjectByPath(selected)
      }
    } catch {
      // ignore
    }
  },

  createProject: async () => {
    try {
      const selected = await window.api.createProjectDialog()
      if (selected) {
        await get().loadProjectByPath(selected)
      }
    } catch {
      // ignore
    }
  },

  loadProjectByPath: async (p: string) => {
    try {
      const data = await window.api.loadProject(p)
      if (data && data.chapters.length > 0) {
        set({
          projectPath: data.path,
          projectTitle: data.title,
          chapters: data.chapters,
          volumes: data.volumes || [],
          activeChapterId: data.activeChapterId || (data.chapters[0] ? data.chapters[0].id : ''),
          storyBible: data.storyBible || null,
          isDirty: false,
          lastSavedAt: Date.now(),
          selectedText: null,
          selectionRange: null
        })
        useAgentStore.getState().initProjectSessions(data.path)
      }
    } catch {
      // ignore
    }
  },

  closeProject: async () => {
    try {
      await window.api.closeProject()
    } catch {
      // ignore
    }
    set({
      projectPath: null,
      projectTitle: '',
      chapters: [],
      volumes: [],
      selectedVolume: null,
      collapsedVolumes: {},
      activeChapterId: '',
      storyBible: null,
      activeDocumentType: 'chapter',
      activeStoryFile: null,
      isDirty: false,
      lastSavedAt: null,
      selectedText: null,
      selectionRange: null
    })
    useAgentStore.getState().initProjectSessions(null)
  },

  setProjectTitle: (title: string) => {
    const { projectPath } = get()
    set({ projectTitle: title })
    if (projectPath) {
      window.api.saveProjectMeta({ projectPath, title }).catch(() => {})
    }
  },

  toggleVolumeCollapse: (volumeName: string) => {
    set((state) => ({
      collapsedVolumes: {
        ...state.collapsedVolumes,
        [volumeName]: !state.collapsedVolumes[volumeName]
      }
    }))
  },

  setSelectedVolume: (volumeName: string | null) => {
    set({ selectedVolume: volumeName })
  },

  createVolume: async (volumeName: string) => {
    const { projectPath, volumes } = get()
    if (!projectPath || !volumeName.trim()) return undefined

    try {
      const res = await window.api.createProjectVolume({
        projectPath,
        volumeName: volumeName.trim()
      })
      if (res.success) {
        const nextVolumes = [...volumes, res.volumeName].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        )
        set((state) => ({
          volumes: nextVolumes,
          selectedVolume: res.volumeName,
          collapsedVolumes: { ...state.collapsedVolumes, [res.volumeName]: false }
        }))
        return res.volumeName
      }
    } catch {
      // ignore
    }
    return undefined
  },

  renameVolume: async (oldName: string, newName: string) => {
    const { projectPath } = get()
    if (!projectPath || !newName.trim()) return

    try {
      const res = await window.api.renameProjectVolume({
        projectPath,
        oldVolumeName: oldName,
        newVolumeName: newName.trim()
      })
      if (res.success) {
        await get().loadProjectByPath(projectPath)
      }
    } catch {
      // ignore
    }
  },

  deleteVolume: async (volumeName: string, keepChapters: boolean = true) => {
    const { projectPath } = get()
    if (!projectPath) return

    try {
      const res = await window.api.deleteProjectVolume({
        projectPath,
        volumeName,
        keepChapters
      })
      if (res.success) {
        await get().loadProjectByPath(projectPath)
      }
    } catch {
      // ignore
    }
  },

  reorderChapters: async (volume: string | undefined, orderedFilenames: string[]) => {
    const { projectPath } = get()
    if (!projectPath) return

    try {
      const res = await window.api.reorderProjectChapters({
        projectPath,
        volume,
        orderedFilenames
      })
      if (res.success && res.chapters) {
        set({ chapters: res.chapters })
      }
    } catch {
      // ignore
    }
  },

  moveChapter: async (params: {
    chapterId?: string
    filename: string
    sourceVolume?: string
    targetVolume?: string
    targetIndex: number
  }) => {
    const { projectPath } = get()
    if (!projectPath) return

    try {
      const res = await window.api.moveProjectChapter({
        projectPath,
        chapterId: params.chapterId,
        filename: params.filename,
        sourceVolume: params.sourceVolume,
        targetVolume: params.targetVolume,
        targetIndex: params.targetIndex
      })
      if (res.success && res.chapters) {
        set((state) => ({
          chapters: res.chapters,
          selectedVolume: params.targetVolume || null,
          collapsedVolumes: params.targetVolume
            ? { ...state.collapsedVolumes, [params.targetVolume]: false }
            : state.collapsedVolumes
        }))
      }
    } catch {
      // ignore
    }
  },

  selectChapter: (id: string) => {
    get().saveActiveDocument()
    const target = get().chapters.find((c) => c.id === id)
    set({
      activeDocumentType: 'chapter',
      activeChapterId: id,
      selectedVolume: target?.volume || null,
      activeStoryFile: null,
      isDirty: false,
      selectedText: null,
      selectionRange: null
    })
  },

  selectStoryFile: (file: StoryBibleFile) => {
    get().saveActiveDocument()
    set({
      activeDocumentType: 'story',
      activeStoryFile: file,
      isDirty: false,
      selectedText: null,
      selectionRange: null
    })
  },

  updateContent: (content: string) => {
    const { activeDocumentType, chapters, activeChapterId, activeStoryFile } = get()

    if (activeDocumentType === 'chapter') {
      const updated = chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, content, updatedAt: Date.now() } : ch
      )
      set({ chapters: updated, isDirty: true })
    } else if (activeStoryFile) {
      set({
        activeStoryFile: { ...activeStoryFile, content, updatedAt: Date.now() },
        isDirty: true
      })
    }
  },

  updateChapterTitle: async (id: string, title: string) => {
    const { chapters, projectPath } = get()
    const target = chapters.find((ch) => ch.id === id)
    if (!target) return

    let newFilename = target.filename
    if (projectPath && target.filename) {
      try {
        const res = await window.api.renameProjectChapter({
          projectPath,
          chapterId: id,
          oldFilename: target.filename,
          newTitle: title,
          volume: target.volume
        })
        if (res.success) {
          newFilename = res.newFilename
        }
      } catch {
        // ignore
      }
    }

    const updated = chapters.map((ch) =>
      ch.id === id ? { ...ch, title, filename: newFilename, updatedAt: Date.now() } : ch
    )
    set({ chapters: updated, isDirty: true })
  },

  addChapter: async (customTitle?: string, volume?: string) => {
    const { chapters, volumes, activeChapterId, selectedVolume, projectPath } = get()
    if (!projectPath) {
      await get().createProject()
      return
    }

    // Determine target volume:
    // 1. Explicit volume parameter
    // 2. Currently selected volume if valid
    // 3. Current active chapter volume if valid
    let targetVolume = volume
    if (targetVolume === undefined) {
      if (selectedVolume && volumes.includes(selectedVolume)) {
        targetVolume = selectedVolume
      } else {
        const activeChapter = chapters.find((c) => c.id === activeChapterId)
        if (activeChapter?.volume) {
          targetVolume = activeChapter.volume
        }
      }
    }

    // Chapters belonging to this volume container
    const volumeChapters = targetVolume
      ? chapters.filter((c) => c.volume === targetVolume)
      : chapters.filter((c) => !c.volume)

    const existingTitles = chapters.map((c) => c.title)
    const title = customTitle || getNextChapterTitle(existingTitles)

    // Calculate correct index within this container
    let nextIndex = volumeChapters.length + 1
    for (const ch of volumeChapters) {
      const match = ch.filename.match(/^(\d+)-/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num >= nextIndex) {
          nextIndex = num + 1
        }
      }
    }

    const padIndex = String(nextIndex).padStart(3, '0')
    const filename = `${padIndex}-${title}.txt`
    const newId = `ch-${targetVolume || 'root'}-${filename}`

    const newChapter: Chapter = {
      id: newId,
      title,
      content: '',
      filename,
      volume: targetVolume,
      relativePath: targetVolume ? `manuscript/${targetVolume}/${filename}` : `manuscript/${filename}`,
      updatedAt: Date.now()
    }

    try {
      await window.api.saveProjectChapter({
        projectPath,
        chapter: newChapter
      })
    } catch {
      // ignore
    }

    set((state) => ({
      chapters: [...state.chapters, newChapter],
      activeDocumentType: 'chapter',
      activeChapterId: newId,
      selectedVolume: targetVolume || null,
      collapsedVolumes: targetVolume
        ? { ...state.collapsedVolumes, [targetVolume]: false }
        : state.collapsedVolumes,
      activeStoryFile: null,
      isDirty: false,
      lastSavedAt: Date.now()
    }))
  },

  deleteChapter: async (id: string) => {
    const { chapters, activeChapterId, projectPath } = get()
    const target = chapters.find((ch) => ch.id === id)

    if (projectPath && target?.filename) {
      try {
        await window.api.deleteProjectChapter({
          projectPath,
          filename: target.filename,
          volume: target.volume
        })
      } catch {
        // ignore
      }
    }

    if (projectPath) {
      await get().loadProjectByPath(projectPath)
      const freshChapters = get().chapters
      if (freshChapters.length > 0) {
        if (!freshChapters.some((c) => c.id === activeChapterId)) {
          get().selectChapter(freshChapters[0].id)
        }
      } else {
        const resetChapter: Chapter = {
          id: `ch-${Date.now()}`,
          title: DEFAULT_CHAPTER_TEMPLATE.title,
          content: '',
          filename: DEFAULT_CHAPTER_TEMPLATE.filename,
          updatedAt: Date.now()
        }
        await window.api.saveProjectChapter({
          projectPath,
          chapter: resetChapter
        })
        set({
          chapters: [resetChapter],
          activeDocumentType: 'chapter',
          activeChapterId: resetChapter.id,
          activeStoryFile: null,
          isDirty: false,
          lastSavedAt: Date.now()
        })
      }
    }
  },

    createStoryFile: async (type: 'outline' | 'character', title?: string) => {
    const { projectPath } = get()
    if (!projectPath) return

    const defaultTitle = type === 'outline' ? '分卷大纲' : '新人物档案'
    const finalTitle = title || defaultTitle

    try {
      const newFile = await window.api.createStoryFile({
        projectPath,
        type,
        title: finalTitle
      })

      const storyBible = get().storyBible
      if (storyBible) {
        if (type === 'outline') {
          storyBible.outlines = [...storyBible.outlines, newFile]
        } else {
          storyBible.characters = [...storyBible.characters, newFile]
        }
        set({ storyBible: { ...storyBible } })
      }

      get().selectStoryFile(newFile)
    } catch {
      // ignore
    }
  },

  deleteStoryFile: async (relativePath: string) => {
    const { projectPath, storyBible, activeStoryFile } = get()
    if (!projectPath) return

    try {
      await window.api.deleteStoryFile({ projectPath, relativePath })

      if (storyBible) {
        const outlines = storyBible.outlines.filter((o) => o.relativePath !== relativePath)
        const characters = storyBible.characters.filter((c) => c.relativePath !== relativePath)
        set({ storyBible: { ...storyBible, outlines, characters } })
      }

      if (activeStoryFile?.relativePath === relativePath) {
        // Fall back to first chapter
        const chapters = get().chapters
        if (chapters.length > 0) {
          get().selectChapter(chapters[0].id)
        }
      }
    } catch {
      // ignore
    }
  },

  renameStoryFile: async (relativePath: string, newTitle: string) => {
    const { projectPath, storyBible, activeStoryFile } = get()
    if (!projectPath || !newTitle.trim()) return

    try {
      const res = await window.api.renameStoryFile({
        projectPath,
        relativePath,
        newTitle: newTitle.trim()
      })

      if (res.success && storyBible) {
        const updateList = (list: StoryBibleFile[]) =>
          list.map((item) =>
            item.relativePath === relativePath
              ? {
                  ...item,
                  title: newTitle.trim(),
                  filename: res.newFilename,
                  relativePath: res.newRelativePath,
                  updatedAt: Date.now()
                }
              : item
          )

        const outlines = updateList(storyBible.outlines)
        const characters = updateList(storyBible.characters)
        set({ storyBible: { ...storyBible, outlines, characters } })

        if (activeStoryFile?.relativePath === relativePath) {
          set({
            activeStoryFile: {
              ...activeStoryFile,
              title: newTitle.trim(),
              filename: res.newFilename,
              relativePath: res.newRelativePath,
              updatedAt: Date.now()
            }
          })
        }
      }
    } catch {
      // ignore
    }
  },

  applyTypography: () => {
    const { activeDocumentType, chapters, activeChapterId, activeStoryFile } = get()

    if (activeDocumentType === 'chapter') {
      const active = chapters.find((ch) => ch.id === activeChapterId)
      if (!active) return
      const formatted = formatChineseManuscript(active.content)
      const updated = chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, content: formatted, updatedAt: Date.now() } : ch
      )
      set({ chapters: updated, isDirty: true })
    } else if (activeStoryFile) {
      const formatted = formatChineseManuscript(activeStoryFile.content)
      set({
        activeStoryFile: { ...activeStoryFile, content: formatted, updatedAt: Date.now() },
        isDirty: true
      })
    }
  },

  saveActiveDocument: async () => {
    const { activeDocumentType, chapters, activeChapterId, activeStoryFile, projectPath } = get()
    if (!projectPath) return

    if (activeDocumentType === 'chapter') {
      const active = chapters.find((ch) => ch.id === activeChapterId)
      if (active && active.filename) {
        try {
          await window.api.saveProjectChapter({
            projectPath,
            chapter: active
          })
        } catch {}
      }
    } else if (activeStoryFile) {
      try {
        await window.api.saveStoryFile({
          projectPath,
          relativePath: activeStoryFile.relativePath,
          content: activeStoryFile.content
        })
      } catch {}
    }

    set({ isDirty: false, lastSavedAt: Date.now() })
  },

  saveActiveChapter: async () => {
    return get().saveActiveDocument()
  },

  setSelection: (text: string | null, range: { start: number; end: number } | null) => {
    const validated = validateSelection(text, range)
    if (validated) {
      const current = get()
      if (
        current.selectedText === validated.selectedText &&
        current.selectionRange?.start === validated.selectionRange.start &&
        current.selectionRange?.end === validated.selectionRange.end
      ) {
        return
      }
      set({ selectedText: validated.selectedText, selectionRange: validated.selectionRange })
    } else {
      const current = get()
      if (current.selectedText !== null || current.selectionRange !== null) {
        set({ selectedText: null, selectionRange: null })
      }
    }
  },

  clearSelection: () => {
    const current = get()
    if (current.selectedText !== null || current.selectionRange !== null) {
      set({ selectedText: null, selectionRange: null })
    }
  },

  insertText: (text: string) => {
    const { activeDocumentType, chapters, activeChapterId, activeStoryFile } = get()
    const cleanText = text.trim()

    if (activeDocumentType === 'chapter') {
      const active = chapters.find((ch) => ch.id === activeChapterId)
      if (!active) return
      const newContent = active.content ? `${active.content}\n\n${cleanText}` : cleanText
      const updated = chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, content: newContent, updatedAt: Date.now() } : ch
      )
      set({ chapters: updated, isDirty: true })
    } else if (activeStoryFile) {
      const newContent = activeStoryFile.content ? `${activeStoryFile.content}\n\n${cleanText}` : cleanText
      set({
        activeStoryFile: { ...activeStoryFile, content: newContent, updatedAt: Date.now() },
        isDirty: true
      })
    }

    get().saveActiveDocument()
  }
}))
