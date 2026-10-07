import { ProviderConfig } from '../../shared/types/config'
import {
  FetchModelsParams,
  FetchModelsResult,
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMStreamChunk,
  TestConnectionParams,
  TestConnectionResult
} from '../../shared/types/llm'
import { OpenAIChatClient } from './protocols/openai-chat'
import { OpenAIResponsesClient } from './protocols/openai-responses'
import { AnthropicMessagesClient } from './protocols/anthropic-messages'
import { fetchRemoteModels } from './model-fetcher'
import { globalConfigStore } from '../config/store'

export class LLMAdapter {
  private activeAbortControllers = new Map<string, AbortController>()

  private getClient(provider: ProviderConfig) {
    const { baseUrl, apiKey, protocol, activeModel } = provider

    switch (protocol) {
      case 'anthropic_messages':
        return new AnthropicMessagesClient({
          baseUrl,
          apiKey,
          defaultModel: activeModel
        })
      case 'openai_responses':
        return new OpenAIResponsesClient({
          baseUrl,
          apiKey,
          defaultModel: activeModel
        })
      case 'chat_completions':
      default:
        return new OpenAIChatClient({
          baseUrl,
          apiKey,
          defaultModel: activeModel
        })
    }
  }

  public async testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const { baseUrl, apiKey, protocol, model } = params
    if (!baseUrl?.trim()) {
      return { ok: false, latencyMs: 0, message: '请提供有效的 Base URL' }
    }

    const start = performance.now()

    // Step 1: Try fetching models to verify auth and connectivity
    let detectedModels: string[] | undefined
    try {
      const fetchResult = await fetchRemoteModels({ baseUrl, apiKey, protocol })
      if (fetchResult.ok && fetchResult.models.length > 0) {
        detectedModels = fetchResult.models
      }
    } catch {
      // Model listing might not be supported; fall back to ping completion
    }

    // Step 2: Test generation if a model is specified
    const targetModel = model?.trim() || detectedModels?.[0] || 'deepseek-chat'
    try {
      const dummyProvider: ProviderConfig = {
        presetId: 'custom',
        name: 'Test',
        baseUrl,
        apiKey,
        protocol,
        activeModel: targetModel,
        availableModels: detectedModels || [],
        temperature: 0.1
      }

      const client = this.getClient(dummyProvider)
      await client.generate({
        messages: [{ role: 'user', content: 'ping' }],
        model: targetModel,
        maxTokens: 5
      })

      const latencyMs = Math.round(performance.now() - start)
      return {
        ok: true,
        latencyMs,
        message: `连通性测试通过 (${latencyMs}ms)`,
        detectedModels
      }
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start)
      // If we managed to detect models but minimal completion threw (e.g. model name mismatch or quota),
      // we still know the server & credentials are reachable
      if (detectedModels && detectedModels.length > 0) {
        return {
          ok: true,
          latencyMs,
          message: `端点连通成功 (${latencyMs}ms)，已拉取 ${detectedModels.length} 个模型`,
          detectedModels
        }
      }

      return {
        ok: false,
        latencyMs,
        message: err instanceof Error ? err.message : '连接端点失败，请检查 URL 与凭据'
      }
    }
  }

  public async fetchModels(params: FetchModelsParams): Promise<FetchModelsResult> {
    return fetchRemoteModels(params)
  }

  public async generate(
    options: LLMGenerateOptions,
    customProvider?: ProviderConfig
  ): Promise<LLMGenerateResult> {
    const provider = customProvider || globalConfigStore.getConfig().provider
    const client = this.getClient(provider)
    return client.generate(options)
  }

  public async generateStream(
    options: LLMGenerateOptions,
    requestId: string,
    onChunk: (chunk: LLMStreamChunk) => void,
    customProvider?: ProviderConfig
  ): Promise<LLMGenerateResult> {
    const provider = customProvider || globalConfigStore.getConfig().provider
    const client = this.getClient(provider)

    const controller = new AbortController()
    this.activeAbortControllers.set(requestId, controller)

    try {
      const result = await client.generateStream(
        options,
        requestId,
        onChunk,
        controller.signal
      )
      return result
    } catch (err) {
      const isAbort = controller.signal.aborted
      const errorMsg = isAbort ? '生成已由用户中断' : err instanceof Error ? err.message : '生成异常'
      onChunk({
        requestId,
        delta: '',
        done: true,
        error: errorMsg
      })
      throw err
    } finally {
      this.activeAbortControllers.delete(requestId)
    }
  }

  public abortStream(requestId: string): boolean {
    const controller = this.activeAbortControllers.get(requestId)
    if (controller) {
      controller.abort()
      this.activeAbortControllers.delete(requestId)
      return true
    }
    return false
  }
}

export const globalLLMAdapter = new LLMAdapter()
