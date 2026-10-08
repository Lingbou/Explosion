import { create } from 'zustand'
import { LibraryBook, LibraryBookContent } from '../../../shared/types/ipc'

interface LibraryState {
  books: LibraryBook[]
  isLoading: boolean
  isLibraryModalOpen: boolean
  selectedBookFilename: string | null
  previewBook: LibraryBookContent | null
  processingFilenames: string[]

  initLibraryListeners: () => void
  fetchBooks: () => Promise<void>
  importBooks: () => Promise<void>
  openFolder: () => Promise<void>
  openLibraryModal: () => Promise<void>
  closeLibraryModal: () => void
  selectBook: (filename: string) => Promise<void>
  deleteBook: (filename: string) => Promise<void>
  processBook: (filename: string) => Promise<void>
}

let isLibraryListenerSetup = false

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  isLoading: false,
  isLibraryModalOpen: false,
  selectedBookFilename: null,
  previewBook: null,
  processingFilenames: [],

  initLibraryListeners: () => {
    if (isLibraryListenerSetup) return
    isLibraryListenerSetup = true

    if (window.api?.onLibraryProcessingStatus) {
      window.api.onLibraryProcessingStatus((payload) => {
        set({ processingFilenames: payload.processingFilenames })
      })
    }

    if (window.api?.onLibraryBooksUpdated) {
      window.api.onLibraryBooksUpdated((updatedBooks) => {
        set({ books: updatedBooks })
        const { selectedBookFilename } = get()
        if (selectedBookFilename) {
          get().selectBook(selectedBookFilename)
        }
      })
    }
  },

  fetchBooks: async () => {
    get().initLibraryListeners()
    set({ isLoading: true })
    try {
      const list = await window.api.listLibraryFiles()
      set({ books: list, isLoading: false })
    } catch {
      set({ books: [], isLoading: false })
    }
  },

  importBooks: async () => {
    get().initLibraryListeners()
    try {
      const res = await window.api.importLibraryFiles()
      if (res.success && res.books) {
        set({ books: res.books })
        if (res.books.length > 0 && !get().selectedBookFilename) {
          get().selectBook(res.books[0].filename)
        }
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

  openLibraryModal: async () => {
    set({ isLibraryModalOpen: true })
    await get().fetchBooks()
    const { books, selectedBookFilename } = get()
    if (books.length > 0) {
      const target = selectedBookFilename && books.some((b) => b.filename === selectedBookFilename)
        ? selectedBookFilename
        : books[0].filename
      await get().selectBook(target)
    }
  },

  closeLibraryModal: () => {
    set({ isLibraryModalOpen: false })
  },

  selectBook: async (filename: string) => {
    set({ selectedBookFilename: filename })
    try {
      const content = await window.api.readLibraryFileContent(filename)
      set({ previewBook: content })
    } catch {
      set({ previewBook: null })
    }
  },

  deleteBook: async (filename: string) => {
    try {
      await window.api.deleteLibraryFile(filename)
      await get().fetchBooks()
      const { books, selectedBookFilename } = get()
      if (selectedBookFilename === filename) {
        if (books.length > 0) {
          get().selectBook(books[0].filename)
        } else {
          set({ selectedBookFilename: null, previewBook: null })
        }
      }
    } catch {
      // ignore
    }
  },

  processBook: async (filename: string) => {
    try {
      await window.api.processLibraryFile(filename)
      await get().fetchBooks()
    } catch {
      // ignore
    }
  }
}))
