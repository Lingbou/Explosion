import { vi } from 'vitest'

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn()
  },
  shell: {
    openPath: vi.fn()
  },
  clipboard: {
    writeText: vi.fn(),
    readText: vi.fn()
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
    getAllWindows: vi.fn(() => [])
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))
