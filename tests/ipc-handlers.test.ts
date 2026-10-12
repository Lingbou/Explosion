import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../src/shared/types/ipc'
import { registerIpcHandlers } from '../src/main/ipc/handlers'
import { globalConfigStore } from '../src/main/config/store'
import { globalLLMAdapter } from '../src/main/llm/adapter'
import { DEFAULT_CONFIG } from '../src/shared/constants/config'

describe('IPC Config and LLM Handlers', () => {
  const handlerMap = new Map<string, Function>()

  beforeEach(() => {
    vi.clearAllMocks()
    handlerMap.clear()
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, fn: any) => {
      handlerMap.set(channel, fn)
      return undefined as any
    })
    registerIpcHandlers()
  })

  it('CONFIG_GET returns sanitized config without exposing plaintext apiKey', async () => {
    const mockSanitized = {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        apiKey: 'sk-****5678',
        hasKey: true
      }
    }
    vi.spyOn(globalConfigStore, 'getSanitizedConfig').mockReturnValue(mockSanitized)

    const handler = handlerMap.get(IPC_CHANNELS.CONFIG_GET)
    expect(handler).toBeDefined()

    const result = await handler!()
    expect(result.provider.apiKey).toBe('sk-****5678')
    expect(result.provider.hasKey).toBe(true)
    expect(globalConfigStore.getSanitizedConfig).toHaveBeenCalled()
  })

  it('CONFIG_SAVE saves config and returns sanitized config to renderer', async () => {
    const incomingConfig = {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        apiKey: 'sk-****5678'
      }
    }
    const mockSanitized = {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        apiKey: 'sk-****5678',
        hasKey: true
      }
    }

    vi.spyOn(globalConfigStore, 'saveConfig').mockReturnValue(incomingConfig)
    vi.spyOn(globalConfigStore, 'getSanitizedConfig').mockReturnValue(mockSanitized)

    const handler = handlerMap.get(IPC_CHANNELS.CONFIG_SAVE)
    expect(handler).toBeDefined()

    const result = await handler!({}, incomingConfig)
    expect(result.success).toBe(true)
    expect(result.config.provider.apiKey).toBe('sk-****5678')
    expect(result.config.provider.hasKey).toBe(true)
    expect(globalConfigStore.saveConfig).toHaveBeenCalledWith(incomingConfig)
  })

  it('LLM_TEST_CONNECTION resolves masked apiKey to stored real key', async () => {
    const storedConfig = {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        apiKey: 'sk-real-secret-key-1234'
      }
    }
    vi.spyOn(globalConfigStore, 'getConfig').mockReturnValue(storedConfig)
    const testSpy = vi.spyOn(globalLLMAdapter, 'testConnection').mockResolvedValue({
      ok: true,
      latencyMs: 120,
      message: 'OK'
    })

    const handler = handlerMap.get(IPC_CHANNELS.LLM_TEST_CONNECTION)
    expect(handler).toBeDefined()

    // Case 1: Renderer sends masked key
    await handler!({}, {
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-****1234',
      protocol: 'chat_completions'
    })

    expect(testSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-real-secret-key-1234'
      })
    )

    // Case 2: Renderer sends user-entered new plaintext key
    testSpy.mockClear()
    await handler!({}, {
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-new-typed-key-9999',
      protocol: 'chat_completions'
    })

    expect(testSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-new-typed-key-9999'
      })
    )
  })

  it('LLM_FETCH_MODELS resolves masked apiKey to stored real key', async () => {
    const storedConfig = {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        apiKey: 'sk-stored-real-key'
      }
    }
    vi.spyOn(globalConfigStore, 'getConfig').mockReturnValue(storedConfig)
    const fetchSpy = vi.spyOn(globalLLMAdapter, 'fetchModels').mockResolvedValue({
      ok: true,
      models: ['deepseek-chat']
    })

    const handler = handlerMap.get(IPC_CHANNELS.LLM_FETCH_MODELS)
    expect(handler).toBeDefined()

    // Pass masked key
    await handler!({}, {
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-****1234',
      protocol: 'chat_completions'
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-stored-real-key'
      })
    )
  })
})
