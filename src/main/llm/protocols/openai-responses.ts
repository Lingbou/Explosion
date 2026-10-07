import { LLMGenerateOptions, LLMGenerateResult, LLMStreamChunk } from '../../../shared/types/llm'
import { parseSSEStream, resolveEndpoint } from '../utils'

export interface OpenAIResponsesClientConfig {
  baseUrl: string
  apiKey: string
  defaultModel: string
}

export class OpenAIResponsesClient {
  constructor(private config: OpenAIResponsesClientConfig) {}

  private getUrl(): string {
    return resolveEndpoint(this.config.baseUrl, '/responses')
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
      input: options.messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      stream: false
    }
    if (typeof options.temperature === 'number') {
      body.temperature = options.temperature
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI Responses API 请求失败 (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as any
    let text = ''

    if (typeof data?.output_text === 'string') {
      text = data.output_text
    } else if (Array.isArray(data?.output)) {
      for (const item of data.output) {
        if (typeof item === 'string') {
          text += item
        } else if (item?.content) {
          if (typeof item.content === 'string') {
            text += item.content
          } else if (Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c?.type === 'text') text += c.text || ''
              else if (typeof c === 'string') text += c
            }
          }
        }
      }
    }

    return {
      text,
      model: data?.model || model,
      usage: {
        promptTokens: data?.usage?.input_tokens ?? data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.output_tokens ?? data?.usage?.completion_tokens,
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
      input: options.messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      stream: true
    }
    if (typeof options.temperature === 'number') {
      body.temperature = options.temperature
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI Responses 响应错误 (${res.status}): ${errText}`)
    }

    if (!res.body) {
      throw new Error('未收到可读响应流')
    }

    let fullText = ''
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
            promptTokens: parsed.usage.input_tokens ?? parsed.usage.prompt_tokens,
            completionTokens: parsed.usage.output_tokens ?? parsed.usage.completion_tokens,
            totalTokens: parsed.usage.total_tokens
          }
        }

        let delta = ''
        if (parsed.type === 'response.text.delta' && parsed.delta) {
          delta = parsed.delta
        } else if (parsed.type === 'response.output_item.delta' && parsed.delta?.text) {
          delta = parsed.delta.text
        } else if (parsed.delta?.content) {
          delta = parsed.delta.content
        } else if (typeof parsed.delta === 'string') {
          delta = parsed.delta
        }

        if (delta) {
          fullText += delta
          onChunk({
            requestId,
            delta,
            done: false,
            usage
          })
        }
      } catch {
        // ignore non-json
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
      model: reportedModel,
      usage
    }
  }
}
