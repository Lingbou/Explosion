import { ipcMain, clipboard, BrowserWindow } from 'electron'
import { IPC_CHANNELS, ProjectChapterFile } from '../../shared/types/ipc'
import { AppConfig } from '../../shared/types/config'
import {
  FetchModelsParams,
  LLMGenerateOptions,
  TestConnectionParams
} from '../../shared/types/llm'
import { globalConfigStore } from '../config/store'
import { globalLLMAdapter } from '../llm/adapter'
import { globalProjectManager } from '../project/manager'
import { globalLibraryManager } from '../library/manager'

export function registerIpcHandlers(): void {
  // Config Handlers
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async () => {
    return globalConfigStore.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE, async (_event, config: AppConfig) => {
    const saved = globalConfigStore.saveConfig(config)
    return { success: true, config: saved }
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_RESET, async () => {
    return globalConfigStore.resetConfig()
  })

  // LLM Handlers
  ipcMain.handle(IPC_CHANNELS.LLM_TEST_CONNECTION, async (_event, params: TestConnectionParams) => {
    return globalLLMAdapter.testConnection(params)
  })

  ipcMain.handle(IPC_CHANNELS.LLM_FETCH_MODELS, async (_event, params: FetchModelsParams) => {
    return globalLLMAdapter.fetchModels(params)
  })

  ipcMain.handle(IPC_CHANNELS.LLM_GENERATE, async (_event, params: LLMGenerateOptions) => {
    return globalLLMAdapter.generate(params)
  })

  ipcMain.handle(
    IPC_CHANNELS.LLM_GENERATE_STREAM,
    async (event, { options, requestId }: { options: LLMGenerateOptions; requestId: string }) => {
      try {
        const result = await globalLLMAdapter.generateStream(
          options,
          requestId,
          (chunk) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:stream-chunk:${requestId}`, chunk)
            }
          }
        )
        return result
      } catch (err) {
        if (!event.sender.isDestroyed()) {
          event.sender.send(`llm:stream-chunk:${requestId}`, {
            requestId,
            delta: '',
            done: true,
            error: err instanceof Error ? err.message : '生成异常'
          })
        }
        throw err
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.LLM_ABORT_STREAM, async (_event, requestId: string) => {
    return globalLLMAdapter.abortStream(requestId)
  })

  // Project Management Handlers
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN_DIALOG, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return globalProjectManager.openProjectDialog(win)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE_DIALOG, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return globalProjectManager.createProjectDialog(win)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LOAD, async (_event, projectPath: string) => {
    return globalProjectManager.loadProject(projectPath)
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SAVE_CHAPTER,
    async (
      _event,
      { projectPath, chapter }: { projectPath: string; chapter: ProjectChapterFile }
    ) => {
      return globalProjectManager.saveProjectChapter(projectPath, chapter)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_RENAME_CHAPTER,
    async (
      _event,
      {
        projectPath,
        chapterId,
        oldFilename,
        newTitle
      }: {
        projectPath: string
        chapterId: string
        oldFilename: string
        newTitle: string
      }
    ) => {
      return globalProjectManager.renameProjectChapter(
        projectPath,
        chapterId,
        oldFilename,
        newTitle
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DELETE_CHAPTER,
    async (
      _event,
      { projectPath, filename }: { projectPath: string; filename: string }
    ) => {
      return globalProjectManager.deleteProjectChapter(projectPath, filename)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SAVE_META,
    async (_event, { projectPath, title }: { projectPath: string; title: string }) => {
      return globalProjectManager.saveProjectMeta(projectPath, title)
    }
  )

  // Library Handlers
  ipcMain.handle(IPC_CHANNELS.LIBRARY_LIST, async () => {
    return globalLibraryManager.listLibraryFiles()
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARY_IMPORT, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return globalLibraryManager.importLibraryFiles(win)
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARY_OPEN_FOLDER, async () => {
    return globalLibraryManager.openLibraryFolder()
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARY_READ_CONTENT, async (_event, filename: string) => {
    return globalLibraryManager.readLibraryFileContent(filename)
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARY_DELETE, async (_event, filename: string) => {
    return globalLibraryManager.deleteLibraryFile(filename)
  })

  // App Utilities
  ipcMain.handle(IPC_CHANNELS.APP_GET_PATHS, async () => {
    return globalConfigStore.getPaths()
  })

  ipcMain.handle(IPC_CHANNELS.APP_COPY_TEXT, async (_event, text: string) => {
    clipboard.writeText(text)
    return true
  })
}
