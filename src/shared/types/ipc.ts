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

export const IPC_CHANNELS = {
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',
  CONFIG_RESET: 'config:reset',
  LLM_TEST_CONNECTION: 'llm:test-connection',
  LLM_FETCH_MODELS: 'llm:fetch-models',
  LLM_GENERATE: 'llm:generate',
  LLM_GENERATE_STREAM: 'llm:generate-stream',
  LLM_ABORT_STREAM: 'llm:abort-stream',
  APP_GET_PATHS: 'app:get-paths',
  APP_COPY_TEXT: 'app:copy-text'
} as const

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface ElectronApi {
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<{ success: boolean; config: AppConfig }>
  resetConfig: () => Promise<AppConfig>
  testConnection: (params: TestConnectionParams) => Promise<TestConnectionResult>
  fetchModels: (params: FetchModelsParams) => Promise<FetchModelsResult>
  generate: (params: LLMGenerateOptions) => Promise<LLMGenerateResult>
  generateStream: (
    params: LLMGenerateOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ) => { requestId: string; unsubscribe: () => void }
  abortStream: (requestId: string) => Promise<boolean>
  getAppPaths: () => Promise<AppPaths>
  copyText: (text: string) => Promise<boolean>
}
