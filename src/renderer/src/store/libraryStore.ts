import { create } from 'zustand'
import { LibraryBook, LibraryBookContent } from '../../../shared/types/ipc'

interface LibraryState {
  books: LibraryBook[]
  isLoading: boolean
  previewBook: LibraryBookContent | null
  isPreviewOpen: boolean
  fetchBooks: () => Promise<void>
  importBooks: () => Promise<void>
  openFolder: () => Promise<void>
  openPreview: (filename: string) => Promise<void>
  closePreview: () => void
  deleteBook: (filename: string) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  isLoading: false,
  previewBook: null,
  isPreviewOpen: false,

  fetchBooks: async () => {
    set({ isLoading: true })
    try {
      const list = await window.api.listLibraryFiles()
      set({ books: list, isLoading: false })
    } catch {
      set({ books: [], isLoading: false })
    }
  },

  importBooks: async () => {
    try {
      const res = await window.api.importLibraryFiles()
      if (res.success && res.books) {
        set({ books: res.books })
      }
    } catch {
      // ignore
    }
  },

  openFolder: async () => {
    try {
      await window.api.openLibraryFolder()
    } catch {
      // ignore
    }
  },

  openPreview: async (filename: string) => {
    try {
      const content = await window.api.readLibraryFileContent(filename)
      set({ previewBook: content, isPreviewOpen: true })
    } catch {
      // ignore
    }
  },

  closePreview: () => set({ isPreviewOpen: false, previewBook: null }),

  deleteBook: async (filename: string) => {
    try {
      await window.api.deleteLibraryFile(filename)
      await get().fetchBooks()
    } catch {
      // ignore
    }
  }
}))
