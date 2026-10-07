import { create } from 'zustand'
import { formatChineseManuscript } from '../lib/typography'
import { getNextChapterTitle } from '../../../shared/utils/chineseNumerals'

export interface Chapter {
  id: string
  title: string
  content: string
  filename: string
  updatedAt: number
}

interface WorkspaceState {
  projectPath: string | null
  projectTitle: string
  chapters: Chapter[]
  activeChapterId: string
  isDirty: boolean
  lastSavedAt: number | null
  initWorkspace: (lastProjectPath?: string) => Promise<void>
  openProject: () => Promise<void>
  createProject: () => Promise<void>
  loadProjectByPath: (path: string) => Promise<void>
  setProjectTitle: (title: string) => void
  selectChapter: (id: string) => void
  updateContent: (content: string) => void
  updateChapterTitle: (id: string, title: string) => Promise<void>
  addChapter: (customTitle?: string) => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  applyTypography: () => void
  saveActiveChapter: () => Promise<void>
  insertText: (text: string) => void
}

const DEFAULT_CHAPTER: Chapter = {
  id: 'ch-1',
  title: '第一章',
  content: '',
  filename: '001-第一章.txt',
  updatedAt: Date.now()
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projectPath: null,
  projectTitle: '未命名作品',
  chapters: [DEFAULT_CHAPTER],
  activeChapterId: 'ch-1',
  isDirty: false,
  lastSavedAt: Date.now(),

  initWorkspace: async (lastProjectPath?: string) => {
    if (lastProjectPath) {
      try {
        await get().loadProjectByPath(lastProjectPath)
        return
      } catch {
        // Fallback to default
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
          isDirty: false,
          lastSavedAt: Date.now()
        })
      }
    } catch {
      // ignore
    }
  },

  setProjectTitle: (title: string) => {
    const { projectPath } = get()
    set({ projectTitle: title })
    if (projectPath) {
      window.api.saveProjectMeta({ projectPath, title }).catch(() => {})
    }
  },

  selectChapter: (id: string) => {
    get().saveActiveChapter()
    set({ activeChapterId: id, isDirty: false })
  },

  updateContent: (content: string) => {
    const { chapters, activeChapterId } = get()
    const updated = chapters.map((ch) =>
      ch.id === activeChapterId ? { ...ch, content, updatedAt: Date.now() } : ch
    )
    set({ chapters: updated, isDirty: true })
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

  addChapter: async (customTitle?: string) => {
    const { chapters, projectPath } = get()
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
      updatedAt: Date.now()
    }

    if (projectPath) {
      try {
        await window.api.saveProjectChapter({
          projectPath,
          chapter: newChapter
        })
      } catch {
        // ignore
      }
    }

    set({
      chapters: [...chapters, newChapter],
      activeChapterId: newId,
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

    // If all chapters were deleted, reset safely to a fresh blank "第一章"
    if (remaining.length === 0) {
      const resetChapter: Chapter = {
        ...DEFAULT_CHAPTER,
        id: `ch-${Date.now()}`,
        updatedAt: Date.now()
      }
      if (projectPath) {
        window.api.saveProjectChapter({
          projectPath,
          chapter: resetChapter
        }).catch(() => {})
      }
      set({
        chapters: [resetChapter],
        activeChapterId: resetChapter.id,
        isDirty: false,
        lastSavedAt: Date.now()
      })
      return
    }

    // Smoothly transition active chapter to adjacent chapter
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

  applyTypography: () => {
    const { chapters, activeChapterId } = get()
    const active = chapters.find((ch) => ch.id === activeChapterId)
    if (!active) return

    const formatted = formatChineseManuscript(active.content)
    const updated = chapters.map((ch) =>
      ch.id === activeChapterId ? { ...ch, content: formatted, updatedAt: Date.now() } : ch
    )
    set({ chapters: updated, isDirty: true })
  },

  saveActiveChapter: async () => {
    const { chapters, activeChapterId, projectPath } = get()
    const active = chapters.find((ch) => ch.id === activeChapterId)
    if (!active) return

    if (projectPath && active.filename) {
      try {
        await window.api.saveProjectChapter({
          projectPath,
          chapter: active
        })
      } catch {
        // ignore
      }
    }

    set({ isDirty: false, lastSavedAt: Date.now() })
  },

  insertText: (text: string) => {
    const { chapters, activeChapterId } = get()
    const active = chapters.find((ch) => ch.id === activeChapterId)
    if (!active) return
    const cleanText = text.trim()
    const newContent = active.content ? `${active.content}\n\n${cleanText}` : cleanText
    const updated = chapters.map((ch) =>
      ch.id === activeChapterId ? { ...ch, content: newContent, updatedAt: Date.now() } : ch
    )
    set({ chapters: updated, isDirty: true })
    get().saveActiveChapter()
  }
}))
