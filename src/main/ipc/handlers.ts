import { ipcMain, clipboard } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'
import { AppConfig } from '../../shared/types/config'
import {
  FetchModelsParams,
  LLMGenerateOptions,
  TestConnectionParams
} from '../../shared/types/llm'
import { globalConfigStore } from '../config/store'
import { globalLLMAdapter } from '../llm/adapter'

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

  // App Utilities
  ipcMain.handle(IPC_CHANNELS.APP_GET_PATHS, async () => {
    return globalConfigStore.getPaths()
  })

  ipcMain.handle(IPC_CHANNELS.APP_COPY_TEXT, async (_event, text: string) => {
    clipboard.writeText(text)
    return true
  })
}
