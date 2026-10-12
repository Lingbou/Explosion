import { ipcMain, clipboard, BrowserWindow } from 'electron'
import { AgentSession, AgentTaskOptions, IPC_CHANNELS, ProjectChapterFile } from '../../shared/types/ipc'
import { AppConfig } from '../../shared/types/config'
import {
  FetchModelsParams,
  LLMGenerateOptions,
  TestConnectionParams
} from '../../shared/types/llm'
import { globalConfigStore, isMaskedApiKey } from '../config/store'
import { globalLLMAdapter } from '../llm/adapter'
import { globalProjectManager } from '../project/manager'
import { globalLibraryManager } from '../library/manager'
import { globalAgentRunner } from '../agent/runner'
import { globalSnapshotManager } from '../project/snapshot-manager'
import { globalSessionManager } from '../agent/session-manager'

export function registerIpcHandlers(): void {
  // Config Handlers
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async () => {
    return globalConfigStore.getSanitizedConfig()
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE, async (_event, config: AppConfig) => {
    globalConfigStore.saveConfig(config)
    return { success: true, config: globalConfigStore.getSanitizedConfig() }
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_RESET, async () => {
    globalConfigStore.resetConfig()
    return globalConfigStore.getSanitizedConfig()
  })

  // LLM Handlers
  ipcMain.handle(IPC_CHANNELS.LLM_TEST_CONNECTION, async (_event, params: TestConnectionParams) => {
    const effectiveApiKey =
      params.apiKey && !isMaskedApiKey(params.apiKey)
        ? params.apiKey
        : globalConfigStore.getConfig().provider.apiKey
    return globalLLMAdapter.testConnection({
      ...params,
      apiKey: effectiveApiKey
    })
  })

  ipcMain.handle(IPC_CHANNELS.LLM_FETCH_MODELS, async (_event, params: FetchModelsParams) => {
    const effectiveApiKey =
      params.apiKey && !isMaskedApiKey(params.apiKey)
        ? params.apiKey
        : globalConfigStore.getConfig().provider.apiKey
    return globalLLMAdapter.fetchModels({
      ...params,
      apiKey: effectiveApiKey
    })
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

  // Autonomous Agent Handlers
  ipcMain.handle(
    IPC_CHANNELS.AGENT_RUN_TASK,
    async (
      event,
      { options, taskId }: { options: AgentTaskOptions; taskId: string }
    ) => {
      try {
        await globalAgentRunner.runTask(taskId, options, (streamEvent) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(`agent:event:${taskId}`, streamEvent)
          }
        })
        return { success: true }
      } catch (err) {
        if (!event.sender.isDestroyed()) {
          event.sender.send(`agent:event:${taskId}`, {
            taskId,
            type: 'error',
            error: err instanceof Error ? err.message : '智能体任务执行异常',
            done: true
          })
        }
        throw err
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.AGENT_ABORT_TASK, async (_event, taskId: string) => {
    return globalAgentRunner.abortTask(taskId)
  })

  // Agent Sessions File Persistence
  ipcMain.handle(IPC_CHANNELS.AGENT_SESSION_LIST, async (_event, { projectPath }: { projectPath: string }) => {
    return globalSessionManager.listSessions(projectPath)
  })

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_LOAD,
    async (_event, { projectPath, sessionId }: { projectPath: string; sessionId: string }) => {
      return globalSessionManager.loadSession(projectPath, sessionId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_SAVE,
    async (_event, { projectPath, session }: { projectPath: string; session: AgentSession }) => {
      return globalSessionManager.saveSession(projectPath, session)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_RENAME,
    async (
      _event,
      { projectPath, sessionId, title }: { projectPath: string; sessionId: string; title: string }
    ) => {
      return globalSessionManager.renameSession(projectPath, sessionId, title)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_DELETE,
    async (_event, { projectPath, sessionId }: { projectPath: string; sessionId: string }) => {
      return globalSessionManager.deleteSession(projectPath, sessionId)
    }
  )


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
        newTitle,
        volume
      }: {
        projectPath: string
        chapterId: string
        oldFilename: string
        newTitle: string
        volume?: string
      }
    ) => {
      return globalProjectManager.renameProjectChapter(
        projectPath,
        chapterId,
        oldFilename,
        newTitle,
        volume
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DELETE_CHAPTER,
    async (
      _event,
      { projectPath, filename, volume }: { projectPath: string; filename: string; volume?: string }
    ) => {
      return globalProjectManager.deleteProjectChapter(projectPath, filename, volume)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE_VOLUME,
    async (_event, { projectPath, volumeName }: { projectPath: string; volumeName: string }) => {
      return globalProjectManager.createVolume(projectPath, volumeName)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_RENAME_VOLUME,
    async (
      _event,
      {
        projectPath,
        oldVolumeName,
        newVolumeName
      }: { projectPath: string; oldVolumeName: string; newVolumeName: string }
    ) => {
      return globalProjectManager.renameVolume(projectPath, oldVolumeName, newVolumeName)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DELETE_VOLUME,
    async (
      _event,
      {
        projectPath,
        volumeName,
        keepChapters
      }: { projectPath: string; volumeName: string; keepChapters?: boolean }
    ) => {
      return globalProjectManager.deleteVolume(projectPath, volumeName, keepChapters)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_REORDER_CHAPTERS,
    async (
      _event,
      {
        projectPath,
        volume,
        orderedFilenames
      }: { projectPath: string; volume?: string; orderedFilenames: string[] }
    ) => {
      return globalProjectManager.reorderProjectChapters(projectPath, volume, orderedFilenames)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_MOVE_CHAPTER,
    async (
      _event,
      params: {
        projectPath: string
        chapterId?: string
        filename: string
        sourceVolume?: string
        targetVolume?: string
        targetIndex: number
      }
    ) => {
      return globalProjectManager.moveProjectChapter(params.projectPath, params)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SAVE_META,
    async (_event, { projectPath, title }: { projectPath: string; title: string }) => {
      return globalProjectManager.saveProjectMeta(projectPath, title)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_EXPORT_MANUSCRIPT,
    async (
      event,
      { projectPath, targetPath }: { projectPath: string; targetPath?: string }
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return globalProjectManager.exportManuscript(projectPath, targetPath, win)
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_CLOSE, async () => {
    return globalProjectManager.closeCurrentProject()
  })

  // Snapshots & Time Machine
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_LIST,
    async (_event, { projectPath, filename }: { projectPath: string; filename?: string }) => {
      return globalSnapshotManager.listSnapshots(projectPath, filename)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_RESTORE,
    async (_event, { projectPath, snapshotId }: { projectPath: string; snapshotId: string }) => {
      return globalSnapshotManager.restoreSnapshot(projectPath, snapshotId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_GET_CONTENT,
    async (_event, { projectPath, snapshotId }: { projectPath: string; snapshotId: string }) => {
      return globalSnapshotManager.getSnapshotContent(projectPath, snapshotId)
    }
  )

  // Story Bible Management
  ipcMain.handle(
    IPC_CHANNELS.STORY_SAVE_FILE,
    async (
      _event,
      { projectPath, relativePath, content }: { projectPath: string; relativePath: string; content: string }
    ) => {
      return globalProjectManager.saveStoryFile(projectPath, relativePath, content)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.STORY_CREATE_FILE,
    async (
      _event,
      { projectPath, type, title }: { projectPath: string; type: 'outline' | 'character'; title: string }
    ) => {
      return globalProjectManager.createStoryFile(projectPath, type, title)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.STORY_DELETE_FILE,
    async (
      _event,
      { projectPath, relativePath }: { projectPath: string; relativePath: string }
    ) => {
      return globalProjectManager.deleteStoryFile(projectPath, relativePath)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.STORY_RENAME_FILE,
    async (
      _event,
      {
        projectPath,
        relativePath,
        newTitle
      }: {
        projectPath: string
        relativePath: string
        newTitle: string
      }
    ) => {
      return globalProjectManager.renameStoryFile(projectPath, relativePath, newTitle)
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

  ipcMain.handle(IPC_CHANNELS.LIBRARY_PROCESS_FILE, async (_event, filename: string) => {
    return globalLibraryManager.processLibraryFile(filename)
  })

    // Window Controls (Frameless Titlebar)
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.minimize()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
      return win.isMaximized()
    }
    return false
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isMaximized() : false
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
