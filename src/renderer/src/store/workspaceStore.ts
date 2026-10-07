import { create } from 'zustand'
import { formatChineseManuscript } from '../lib/typography'

export interface Chapter {
  id: string
  title: string
  content: string
  updatedAt: number
}

interface WorkspaceState {
  projectTitle: string
  chapters: Chapter[]
  activeChapterId: string
  isDirty: boolean
  lastSavedAt: number | null
  setProjectTitle: (title: string) => void
  selectChapter: (id: string) => void
  updateContent: (content: string) => void
  updateChapterTitle: (id: string, title: string) => void
  addChapter: (title?: string) => void
  deleteChapter: (id: string) => void
  applyTypography: () => void
  saveActiveChapter: () => void
  insertText: (text: string) => void
}

const INITIAL_CHAPTERS: Chapter[] = [
  {
    id: 'ch-1',
    title: '第一章',
    content: '',
    updatedAt: Date.now()
  }
]

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projectTitle: '未命名作品',
  chapters: INITIAL_CHAPTERS,
  activeChapterId: 'ch-1',
  isDirty: false,
  lastSavedAt: Date.now(),

  setProjectTitle: (title: string) => set({ projectTitle: title }),

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

  updateChapterTitle: (id: string, title: string) => {
    const { chapters } = get()
    const updated = chapters.map((ch) =>
      ch.id === id ? { ...ch, title, updatedAt: Date.now() } : ch
    )
    set({ chapters: updated, isDirty: true })
  },

  addChapter: (title?: string) => {
    const { chapters } = get()
    const count = chapters.length + 1
    const newId = `ch-${Date.now()}`
    const newChapter: Chapter = {
      id: newId,
      title: title || `第${count}章`,
      content: '',
      updatedAt: Date.now()
    }
    set({
      chapters: [...chapters, newChapter],
      activeChapterId: newId,
      isDirty: false,
      lastSavedAt: Date.now()
    })
  },

  deleteChapter: (id: string) => {
    const { chapters, activeChapterId } = get()
    if (chapters.length <= 1) return
    const remaining = chapters.filter((ch) => ch.id !== id)
    const nextActive = activeChapterId === id ? remaining[0].id : activeChapterId
    set({
      chapters: remaining,
      activeChapterId: nextActive,
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

  saveActiveChapter: () => {
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
  }
}))
