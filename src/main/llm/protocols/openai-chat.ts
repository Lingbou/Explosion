import { LLMGenerateOptions, LLMGenerateResult, LLMStreamChunk } from '../../../shared/types/llm'
import { parseSSEStream, resolveEndpoint } from '../utils'

export interface OpenAIChatClientConfig {
  baseUrl: string
  apiKey: string
  defaultModel: string
}

export class OpenAIChatClient {
  constructor(private config: OpenAIChatClientConfig) {}

  private getUrl(): string {
    return resolveEndpoint(this.config.baseUrl, '/chat/completions')
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (this.config.apiKey?.trim()) {
      headers['Authorization'] = `Bearer ${this.config.apiKey.trim()}`
    }
    return headers
  }

  public async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const url = this.getUrl()
    const model = options.model || this.config.defaultModel

    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      stream: false
    }
    if (options.maxTokens) body.max_tokens = options.maxTokens
    if (options.topP) body.top_p = options.topP

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI Chat API 请求失败 (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as any
    const choice = data?.choices?.[0]
    const text = choice?.message?.content || ''
    const reasoning = choice?.message?.reasoning_content || choice?.message?.reasoning

    return {
      text,
      reasoning: reasoning || undefined,
      model: data?.model || model,
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens
      }
    }
  }

  public async generateStream(
    options: LLMGenerateOptions,
    requestId: string,
    onChunk: (chunk: LLMStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<LLMGenerateResult> {
    const url = this.getUrl()
    const model = options.model || this.config.defaultModel

    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true }
    }
    if (options.maxTokens) body.max_tokens = options.maxTokens
    if (options.topP) body.top_p = options.topP

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI Chat 响应错误 (${res.status}): ${errText}`)
    }

    if (!res.body) {
      throw new Error('未收到可读响应流')
    }

    let fullText = ''
    let fullReasoning = ''
    let reportedModel = model
    let usage

    for await (const { data } of parseSSEStream(res.body)) {
      if (data === '[DONE]') {
        break
      }

      try {
        const parsed = JSON.parse(data)
        if (parsed.model) reportedModel = parsed.model
        if (parsed.usage) {
          usage = {
            promptTokens: parsed.usage.prompt_tokens,
            completionTokens: parsed.usage.completion_tokens,
            totalTokens: parsed.usage.total_tokens
          }
        }

        const choice = parsed.choices?.[0]
        if (!choice) continue

        const delta = choice.delta?.content || ''
        const reasoningDelta =
          choice.delta?.reasoning_content || choice.delta?.reasoning || undefined

        if (delta) fullText += delta
        if (reasoningDelta) fullReasoning += reasoningDelta

        if (delta || reasoningDelta) {
          onChunk({
            requestId,
            delta,
            reasoningDelta,
            done: false,
            usage
          })
        }
      } catch {
        // ignore non-json SSE lines
      }
    }

    onChunk({
      requestId,
      delta: '',
      done: true,
      usage
    })

    return {
      text: fullText,
      reasoning: fullReasoning || undefined,
      model: reportedModel,
      usage
    }
  }
}
