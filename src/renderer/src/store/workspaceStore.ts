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
    title: '第一章 暴雨将至',
    content: `\u3000\u3000南淮的夏天总是来得悄无声息。闷热的空气沉在长街两旁的石板缝里，青苔泛着发黑的潮气。
\u3000\u3000街角茶肆的竹帘垂得低低的，偶尔有一阵热风掠过，带起帘脚铜铃细微的碰撞声。少年靠在剥落红漆的廊柱旁，低头看着自己手心磨出的老茧。
\u3000\u3000“今晚有雨。”老掌柜拨弄着算盘，头也不抬地说了一句。算珠清脆的撞击声在寂静的午后传得很远。
\u3000\u3000少年没有抬头，只是把腰间的短刀往阴影深处挪了挪。他知道，暴雨落下来的时候，很多人就再也走不出这条街了。`,
    updatedAt: Date.now()
  },
  {
    id: 'ch-2',
    title: '第二章 逆流而上',
    content: `\u3000\u3000夜色像打翻的浓墨一样漫过了城门。
\u3000\u3000雷声在云层后面闷响，雨点噼里啪啦砸在瓦片上，激起一阵阵白蒙蒙的水雾。刀锋破开水幕的声音极轻，像是一声微不可闻的叹息。`,
    updatedAt: Date.now() - 3600000
  }
]

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projectTitle: '《未命名手稿》',
  chapters: INITIAL_CHAPTERS,
  activeChapterId: 'ch-1',
  isDirty: false,
  lastSavedAt: Date.now(),

  setProjectTitle: (title: string) => set({ projectTitle: title }),

  selectChapter: (id: string) => {
    // If dirty, save current first
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
      title: title || `第${count}章 新增章节`,
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
    if (chapters.length <= 1) return // Keep at least one chapter
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
    const newContent = active.content ? `${active.content}\n\n${text}` : text
    const updated = chapters.map((ch) =>
      ch.id === activeChapterId ? { ...ch, content: newContent, updatedAt: Date.now() } : ch
    )
    set({ chapters: updated, isDirty: true })
  }
}))
