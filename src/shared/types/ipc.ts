import { AppConfig, AppPaths } from './config'
import {
  FetchModelsParams,
  FetchModelsResult,
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMStreamChunk,
  TestConnectionParams,
  TestConnectionResult
} from './llm'

export interface ProjectChapterFile {
  id: string
  title: string
  content: string
  filename: string
  updatedAt: number
}

export interface ProjectData {
  path: string
  title: string
  chapters: ProjectChapterFile[]
  activeChapterId?: string
}

export interface LibraryBook {
  filename: string
  path: string
  size: number
  updatedAt: number
  isProcessing?: boolean
}

export interface LibraryBookContent {
  filename: string
  content: string
  size: number
}

export interface AgentTaskOptions {
  userPrompt: string
  projectPath?: string | null
  activeChapterFilename?: string | null
  manuscriptContext?: string
}

export interface AgentToolCallInfo {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface AgentToolResultInfo {
  id: string
  name: string
  result: string
  error?: string
  durationMs: number
}

export interface AgentStreamEvent {
  taskId: string
  type: 'thinking' | 'delta' | 'tool_start' | 'tool_result' | 'done' | 'error'
  delta?: string
  thinkingDelta?: string
  toolCall?: AgentToolCallInfo
  toolResult?: AgentToolResultInfo
  error?: string
  done?: boolean
}

export interface ProjectFileChangedPayload {
  projectPath: string
  filePath: string
  filename: string
  content?: string
}

export const IPC_CHANNELS = {
  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',
  CONFIG_RESET: 'config:reset',

  // LLM
  LLM_TEST_CONNECTION: 'llm:test-connection',
  LLM_FETCH_MODELS: 'llm:fetch-models',
  LLM_GENERATE: 'llm:generate',
  LLM_GENERATE_STREAM: 'llm:generate-stream',
  LLM_ABORT_STREAM: 'llm:abort-stream',

  // Agent Autonomous Runner
  AGENT_RUN_TASK: 'agent:run-task',
  AGENT_ABORT_TASK: 'agent:abort-task',

  // Project Management & Live File Sync
  PROJECT_OPEN_DIALOG: 'project:open-dialog',
  PROJECT_CREATE_DIALOG: 'project:create-dialog',
  PROJECT_LOAD: 'project:load',
  PROJECT_SAVE_CHAPTER: 'project:save-chapter',
  PROJECT_RENAME_CHAPTER: 'project:rename-chapter',
  PROJECT_DELETE_CHAPTER: 'project:delete-chapter',
  PROJECT_SAVE_META: 'project:save-meta',
  PROJECT_CLOSE: 'project:close',
  PROJECT_FILE_CHANGED: 'project:file-changed',

  // Material Library
  LIBRARY_LIST: 'library:list',
  LIBRARY_IMPORT: 'library:import',
  LIBRARY_OPEN_FOLDER: 'library:open-folder',
  LIBRARY_READ_CONTENT: 'library:read-content',
  LIBRARY_DELETE: 'library:delete',
  LIBRARY_PROCESS_FILE: 'library:process-file',
  LIBRARY_PROCESSING_STATUS: 'library:processing-status',
  LIBRARY_BOOKS_UPDATED: 'library:books-updated',

  // App Utilities
  APP_GET_PATHS: 'app:get-paths',
  APP_COPY_TEXT: 'app:copy-text'
} as const

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface ElectronApi {
  // Config
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<{ success: boolean; config: AppConfig }>
  resetConfig: () => Promise<AppConfig>

  // LLM
  testConnection: (params: TestConnectionParams) => Promise<TestConnectionResult>
  fetchModels: (params: FetchModelsParams) => Promise<FetchModelsResult>
  generate: (params: LLMGenerateOptions) => Promise<LLMGenerateResult>
  generateStream: (
    options: LLMGenerateOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ) => { requestId: string; unsubscribe: () => void }
  abortStream: (requestId: string) => Promise<boolean>

  // Agent Autonomous Runner
  agentRunTask: (
    options: AgentTaskOptions,
    onEvent: (event: AgentStreamEvent) => void
  ) => { taskId: string; unsubscribe: () => void }
  agentAbortTask: (taskId: string) => Promise<boolean>

  // Project Management & Live File Sync
  openProjectDialog: () => Promise<string | null>
  createProjectDialog: () => Promise<string | null>
  loadProject: (projectPath: string) => Promise<ProjectData>
  saveProjectChapter: (params: {
    projectPath: string
    chapter: ProjectChapterFile
  }) => Promise<boolean>
  renameProjectChapter: (params: {
    projectPath: string
    chapterId: string
    oldFilename: string
    newTitle: string
  }) => Promise<{ success: boolean; newFilename: string }>
  deleteProjectChapter: (params: {
    projectPath: string
    filename: string
  }) => Promise<boolean>
  saveProjectMeta: (params: { projectPath: string; title: string }) => Promise<boolean>
  closeProject: () => Promise<boolean>
  onProjectFileChanged: (
    callback: (payload: ProjectFileChangedPayload) => void
  ) => () => void

  // Library
  listLibraryFiles: () => Promise<LibraryBook[]>
  importLibraryFiles: () => Promise<{
    success: boolean
    importedCount: number
    books: LibraryBook[]
  }>
  openLibraryFolder: () => Promise<boolean>
  readLibraryFileContent: (filename: string) => Promise<LibraryBookContent>
  deleteLibraryFile: (filename: string) => Promise<boolean>
  processLibraryFile: (filename: string) => Promise<boolean>
  onLibraryProcessingStatus: (
    callback: (payload: { processingFilenames: string[] }) => void
  ) => () => void
  onLibraryBooksUpdated: (
    callback: (books: LibraryBook[]) => void
  ) => () => void

  // App Utilities
  getAppPaths: () => Promise<AppPaths>
  copyText: (text: string) => Promise<boolean>
}
