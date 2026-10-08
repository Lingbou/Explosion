import { create } from 'zustand'
import { formatChineseManuscript } from '../lib/typography'
import { getNextChapterTitle } from '../../../shared/utils/chineseNumerals'
import { ProjectChapterFile, StoryBibleData, StoryBibleFile } from '../../../shared/types/ipc'

export type Chapter = ProjectChapterFile

interface WorkspaceState {
  projectPath: string | null
  projectTitle: string
  chapters: Chapter[]
  activeChapterId: string

  // Story Bible & Active Document
  storyBible: StoryBibleData | null
  activeDocumentType: 'chapter' | 'story'
  activeStoryFile: StoryBibleFile | null

  isDirty: boolean
  lastSavedAt: number | null

  initWorkspace: (lastProjectPath?: string | null) => Promise<void>
  openProject: () => Promise<void>
  createProject: () => Promise<void>
  loadProjectByPath: (path: string) => Promise<void>
  closeProject: () => Promise<void>
  setProjectTitle: (title: string) => void

  // Manuscript Actions
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
  activeChapterId: '',
  storyBible: null,
  activeDocumentType: 'chapter',
  activeStoryFile: null,
  isDirty: false,
  lastSavedAt: null,

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
              lastSavedAt: Date.now()
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
          set({ chapters: updated, isDirty: false, lastSavedAt: Date.now() })
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
          activeChapterId: data.activeChapterId || data.chapters[0].id,
          storyBible: data.storyBible || null,
          isDirty: false,
          lastSavedAt: Date.now()
        })
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
      activeChapterId: '',
      storyBible: null,
      activeDocumentType: 'chapter',
      activeStoryFile: null,
      isDirty: false,
      lastSavedAt: null
    })
  },

  setProjectTitle: (title: string) => {
    const { projectPath } = get()
    set({ projectTitle: title })
    if (projectPath) {
      window.api.saveProjectMeta({ projectPath, title }).catch(() => {})
    }
  },

  selectChapter: (id: string) => {
    get().saveActiveDocument()
    set({
      activeDocumentType: 'chapter',
      activeChapterId: id,
      activeStoryFile: null,
      isDirty: false
    })
  },

  selectStoryFile: (file: StoryBibleFile) => {
    get().saveActiveDocument()
    set({
      activeDocumentType: 'story',
      activeStoryFile: file,
      isDirty: false
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
          newTitle: title
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
    const { chapters, projectPath } = get()
    if (!projectPath) {
      await get().createProject()
      return
    }

    const existingTitles = chapters.map((c) => c.title)
    const title = customTitle || getNextChapterTitle(existingTitles)
    const index = chapters.length + 1
    const padIndex = String(index).padStart(3, '0')
    const filename = `${padIndex}-${title}.txt`
    const newId = `ch-${Date.now()}`

    const newChapter: Chapter = {
      id: newId,
      title,
      content: '',
      filename,
      volume,
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

    set({
      chapters: [...chapters, newChapter],
      activeDocumentType: 'chapter',
      activeChapterId: newId,
      activeStoryFile: null,
      isDirty: false,
      lastSavedAt: Date.now()
    })
  },

  deleteChapter: async (id: string) => {
    const { chapters, activeChapterId, projectPath } = get()
    const target = chapters.find((ch) => ch.id === id)

    if (projectPath && target?.filename) {
      try {
        await window.api.deleteProjectChapter({
          projectPath,
          filename: target.filename
        })
      } catch {
        // ignore
      }
    }

    const remaining = chapters.filter((ch) => ch.id !== id)

    if (remaining.length === 0) {
      const resetChapter: Chapter = {
        id: `ch-${Date.now()}`,
        title: DEFAULT_CHAPTER_TEMPLATE.title,
        content: '',
        filename: DEFAULT_CHAPTER_TEMPLATE.filename,
        updatedAt: Date.now()
      }
      if (projectPath) {
        window.api
          .saveProjectChapter({
            projectPath,
            chapter: resetChapter
          })
          .catch(() => {})
      }
      set({
        chapters: [resetChapter],
        activeDocumentType: 'chapter',
        activeChapterId: resetChapter.id,
        activeStoryFile: null,
        isDirty: false,
        lastSavedAt: Date.now()
      })
      return
    }

    let nextActiveId = activeChapterId
    if (activeChapterId === id) {
      const deletedIndex = chapters.findIndex((ch) => ch.id === id)
      const nextIndex = Math.max(0, deletedIndex - 1)
      nextActiveId = remaining[nextIndex]?.id || remaining[0].id
    }

    set({
      chapters: remaining,
      activeChapterId: nextActiveId,
      isDirty: false
    })
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
