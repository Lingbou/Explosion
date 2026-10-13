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
  volume?: string
  relativePath?: string
  updatedAt: number
}

export interface StoryBibleFile {
  id: string
  type: 'outline' | 'character' | 'ledger'
  title: string
  filename: string
  relativePath: string
  content: string
  updatedAt: number
}

export interface StoryBibleData {
  outlines: StoryBibleFile[]
  characters: StoryBibleFile[]
  ledger: StoryBibleFile | null
}

export interface ProjectSnapshot {
  id: string
  filePath: string
  filename: string
  content?: string
  timestamp: number
  source: 'agent' | 'manual' | 'autosave' | 'rollback'
  charCount: number
}


export interface ManuscriptExportResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  chapterCount?: number
  totalChars?: number
  error?: string
}

export interface ProjectData {
  path: string
  title: string
  chapters: ProjectChapterFile[]
  volumes?: string[]
  activeChapterId?: string
  storyBible?: StoryBibleData
}

export interface LibraryBook {
  filename: string
  path: string
  size: number
  updatedAt: number
  bookName?: string
  relativePath?: string
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
  selectedText?: string | null
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

export interface SubAgentStepInfo {
  id: string
  toolName: string
  args: Record<string, unknown>
  result?: string
  error?: string
  durationMs?: number
  status: 'running' | 'success' | 'error'
  timestamp: number
}

export interface SubAgentTaskInfo {
  id: string
  parentTaskId: string
  name: string
  instruction: string
  status: 'running' | 'completed' | 'failed' | 'terminated'
  stepsCount: number
  durationMs?: number
  startTime: number
  endTime?: number
  output?: string
  modifiedFiles: string[]
  steps: SubAgentStepInfo[]
  error?: string
}

export interface AgentStreamEvent {
  taskId: string
  type: 'thinking' | 'delta' | 'tool_start' | 'tool_result' | 'subagent_update' | 'done' | 'error'
  delta?: string
  thinkingDelta?: string
  toolCall?: AgentToolCallInfo
  toolResult?: AgentToolResultInfo
  subagent?: SubAgentTaskInfo
  error?: string
  done?: boolean
}


export interface AgentTraceStep {
  id: string
  type: "tool_call"
  toolName: string
  args: Record<string, unknown>
  result?: string
  error?: string
  durationMs?: number
  status: "running" | "success" | "error"
  timestamp: number
}

export interface AgentMessage {
  id: string
  role: "user" | "assistant"
  content: string
  thinking?: string
  traces?: AgentTraceStep[]
  subagents?: SubAgentTaskInfo[]
  selectedText?: string
  timestamp: number
}

export interface AgentSession {
  id: string
  title: string
  projectPath?: string
  messages: AgentMessage[]
  createdAt: number
  updatedAt: number
}

export interface AgentSessionSummary {
  id: string
  title: string
  projectPath: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface AgentSessionIndex {
  activeSessionId?: string
  sessions: AgentSessionSummary[]
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
  PROJECT_CREATE_VOLUME: 'project:create-volume',
  PROJECT_RENAME_VOLUME: 'project:rename-volume',
  PROJECT_DELETE_VOLUME: 'project:delete-volume',
  PROJECT_REORDER_CHAPTERS: 'project:reorder-chapters',
  PROJECT_MOVE_CHAPTER: 'project:move-chapter',
  PROJECT_SAVE_META: 'project:save-meta',
  PROJECT_EXPORT_MANUSCRIPT: 'project:export-manuscript',
  PROJECT_CLOSE: 'project:close',
  PROJECT_FILE_CHANGED: 'project:file-changed',

  // Agent Sessions File Persistence
  AGENT_SESSION_LIST: 'agent:session:list',
  AGENT_SESSION_LOAD: 'agent:session:load',
  AGENT_SESSION_SAVE: 'agent:session:save',
  AGENT_SESSION_RENAME: 'agent:session:rename',
  AGENT_SESSION_DELETE: 'agent:session:delete',

  // Snapshots & Time Machine
  SNAPSHOT_LIST: 'snapshot:list',
  SNAPSHOT_RESTORE: 'snapshot:restore',
  SNAPSHOT_GET_CONTENT: 'snapshot:get-content',

  // Story Bible Management
  STORY_SAVE_FILE: 'story:save-file',
  STORY_CREATE_FILE: 'story:create-file',
  STORY_DELETE_FILE: 'story:delete-file',
  STORY_RENAME_FILE: 'story:rename-file',

  // Material Library
  LIBRARY_LIST: 'library:list',
  LIBRARY_IMPORT: 'library:import',
  LIBRARY_OPEN_FOLDER: 'library:open-folder',
  LIBRARY_READ_CONTENT: 'library:read-content',
  LIBRARY_DELETE: 'library:delete',
  LIBRARY_PROCESS_FILE: 'library:process-file',
  LIBRARY_PROCESSING_STATUS: 'library:processing-status',
  LIBRARY_BOOKS_UPDATED: 'library:books-updated',

    // Window Controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_MAXIMIZE_CHANGED: 'window:maximize-changed',



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
    volume?: string
  }) => Promise<{ success: boolean; newFilename: string }>
  deleteProjectChapter: (params: {
    projectPath: string
    filename: string
    volume?: string
  }) => Promise<boolean>
  createProjectVolume: (params: {
    projectPath: string
    volumeName: string
  }) => Promise<{ success: boolean; volumeName: string }>
  renameProjectVolume: (params: {
    projectPath: string
    oldVolumeName: string
    newVolumeName: string
  }) => Promise<{ success: boolean; newVolumeName: string }>
  deleteProjectVolume: (params: {
    projectPath: string
    volumeName: string
    keepChapters?: boolean
  }) => Promise<{ success: boolean }>
  reorderProjectChapters: (params: {
    projectPath: string
    volume?: string
    orderedFilenames: string[]
  }) => Promise<{ success: boolean; chapters: ProjectChapterFile[] }>
  moveProjectChapter: (params: {
    projectPath: string
    chapterId?: string
    filename: string
    sourceVolume?: string
    targetVolume?: string
    targetIndex: number
  }) => Promise<{ success: boolean; chapters: ProjectChapterFile[] }>
  saveProjectMeta: (params: { projectPath: string; title: string }) => Promise<boolean>
  closeProject: () => Promise<boolean>
  exportManuscript: (params: {
    projectPath: string
    targetPath?: string
  }) => Promise<ManuscriptExportResult>
  onProjectFileChanged: (
    callback: (payload: ProjectFileChangedPayload) => void
  ) => () => void

  // Agent Sessions File Persistence
  listAgentSessions: (params: { projectPath: string }) => Promise<AgentSession[]>
  loadAgentSession: (params: { projectPath: string; sessionId: string }) => Promise<AgentSession | null>
  saveAgentSession: (params: { projectPath: string; session: AgentSession }) => Promise<boolean>
  renameAgentSession: (params: { projectPath: string; sessionId: string; title: string }) => Promise<boolean>
  deleteAgentSession: (params: { projectPath: string; sessionId: string }) => Promise<boolean>

  // Snapshots & Time Machine
  listSnapshots: (params: { projectPath: string; filename?: string }) => Promise<ProjectSnapshot[]>
  restoreSnapshot: (params: { projectPath: string; snapshotId: string }) => Promise<{ success: boolean; filePath: string; filename: string; content: string }>
  getSnapshotContent: (params: { projectPath: string; snapshotId: string }) => Promise<string>

  // Story Bible
  saveStoryFile: (params: { projectPath: string; relativePath: string; content: string }) => Promise<boolean>
  createStoryFile: (params: { projectPath: string; type: 'outline' | 'character'; title?: string }) => Promise<StoryBibleFile>
  deleteStoryFile: (params: { projectPath: string; relativePath: string }) => Promise<boolean>
  renameStoryFile: (params: { projectPath: string; relativePath: string; newTitle: string }) => Promise<{ success: boolean; newRelativePath: string; newFilename: string }>

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

  // Window Controls
  minimizeWindow: () => Promise<boolean>
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<boolean>
  isWindowMaximized: () => Promise<boolean>
  onWindowMaximizeChanged?: (callback: (isMaximized: boolean) => void) => () => void

  // App Utilities
  getAppPaths: () => Promise<AppPaths>
  copyText: (text: string) => Promise<boolean>
}
