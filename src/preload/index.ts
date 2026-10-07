import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC_CHANNELS, ElectronApi } from '../shared/types/ipc'
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
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),

  saveConfig: (config: AppConfig): Promise<{ success: boolean; config: AppConfig }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SAVE, config),

  resetConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_RESET),

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

    // Trigger main process stream handler
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

  getAppPaths: (): Promise<AppPaths> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATHS),

  copyText: (text: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_COPY_TEXT, text)
}

contextBridge.exposeInMainWorld('api', api)
