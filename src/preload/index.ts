import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import {
  IPC_CHANNELS,
  ElectronApi,
  ProjectData,
  ProjectChapterFile,
  LibraryBook,
  LibraryBookContent,
  AgentTaskOptions,
  AgentStreamEvent,
  ProjectFileChangedPayload
} from '../shared/types/ipc'
import { AppConfig, AppPaths } from '../shared/types/config'
import {
  FetchModelsParams,
  FetchModelsResult,
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMStreamChunk,
  TestConnectionParams,
  TestConnectionResult
} from '../shared/types/llm'

const api: ElectronApi = {
  // Config
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),

  saveConfig: (config: AppConfig): Promise<{ success: boolean; config: AppConfig }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SAVE, config),

  resetConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_RESET),

  // LLM
  testConnection: (params: TestConnectionParams): Promise<TestConnectionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_TEST_CONNECTION, params),

  fetchModels: (params: FetchModelsParams): Promise<FetchModelsResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_FETCH_MODELS, params),

  generate: (params: LLMGenerateOptions): Promise<LLMGenerateResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_GENERATE, params),

  generateStream: (
    options: LLMGenerateOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ): { requestId: string; unsubscribe: () => void } => {
    const requestId = crypto.randomUUID()
    const channel = `llm:stream-chunk:${requestId}`

    const listener = (_event: IpcRendererEvent, chunk: LLMStreamChunk): void => {
      onChunk(chunk)
    }

    ipcRenderer.on(channel, listener)

    ipcRenderer.invoke(IPC_CHANNELS.LLM_GENERATE_STREAM, { options, requestId }).catch((err) => {
      onChunk({
        requestId,
        delta: '',
        done: true,
        error: err instanceof Error ? err.message : String(err)
      })
    })

    return {
      requestId,
      unsubscribe: () => {
        ipcRenderer.removeListener(channel, listener)
      }
    }
  },

  abortStream: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_ABORT_STREAM, requestId),

  // Agent Autonomous Runner
  agentRunTask: (
    options: AgentTaskOptions,
    onEvent: (event: AgentStreamEvent) => void
  ): { taskId: string; unsubscribe: () => void } => {
    const taskId = crypto.randomUUID()
    const channel = `agent:event:${taskId}`

    const listener = (_event: IpcRendererEvent, eventData: AgentStreamEvent): void => {
      onEvent(eventData)
    }

    ipcRenderer.on(channel, listener)

    ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUN_TASK, { options, taskId }).catch((err) => {
      onEvent({
        taskId,
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
        done: true
      })
    })

    return {
      taskId,
      unsubscribe: () => {
        ipcRenderer.removeListener(channel, listener)
      }
    }
  },

  agentAbortTask: (taskId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_ABORT_TASK, taskId),

  // Project Management & Live File Sync
  openProjectDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN_DIALOG),

  createProjectDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE_DIALOG),

  loadProject: (projectPath: string): Promise<ProjectData> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LOAD, projectPath),

  saveProjectChapter: (params: {
    projectPath: string
    chapter: ProjectChapterFile
  }): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SAVE_CHAPTER, params),

  renameProjectChapter: (params: {
    projectPath: string
    chapterId: string
    oldFilename: string
    newTitle: string
  }): Promise<{ success: boolean; newFilename: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_RENAME_CHAPTER, params),

  deleteProjectChapter: (params: {
    projectPath: string
    filename: string
  }): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE_CHAPTER, params),

  saveProjectMeta: (params: { projectPath: string; title: string }): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SAVE_META, params),

  closeProject: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE),

  onProjectFileChanged: (
    callback: (payload: ProjectFileChangedPayload) => void
  ): (() => void) => {
    const listener = (
      _event: IpcRendererEvent,
      payload: ProjectFileChangedPayload
    ): void => {
      callback(payload)
    }

    ipcRenderer.on(IPC_CHANNELS.PROJECT_FILE_CHANGED, listener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PROJECT_FILE_CHANGED, listener)
    }
  },

  // Library
  listLibraryFiles: (): Promise<LibraryBook[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_LIST),

  importLibraryFiles: (): Promise<{
    success: boolean
    importedCount: number
    books: LibraryBook[]
  }> => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_IMPORT),

  openLibraryFolder: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_OPEN_FOLDER),

  readLibraryFileContent: (filename: string): Promise<LibraryBookContent> =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_READ_CONTENT, filename),

  deleteLibraryFile: (filename: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_DELETE, filename),

  // App Utilities
  getAppPaths: (): Promise<AppPaths> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATHS),

  copyText: (text: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_COPY_TEXT, text)
}

contextBridge.exposeInMainWorld('api', api)
