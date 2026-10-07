import { LLMGenerateOptions, LLMGenerateResult, LLMStreamChunk } from '../../../shared/types/llm'
import { parseSSEStream, resolveEndpoint } from '../utils'

export interface AnthropicMessagesClientConfig {
  baseUrl: string
  apiKey: string
  defaultModel: string
}

export class AnthropicMessagesClient {
  constructor(private config: AnthropicMessagesClientConfig) {}

  private getUrl(): string {
    return resolveEndpoint(this.config.baseUrl, '/messages')
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    }
    if (this.config.apiKey?.trim()) {
      headers['x-api-key'] = this.config.apiKey.trim()
    }
    return headers
  }

  private formatPayload(options: LLMGenerateOptions, stream: boolean) {
    const model = options.model || this.config.defaultModel

    // Extract system prompt
    const systemParts: string[] = []
    const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const msg of options.messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content)
      } else {
        chatMessages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }

    const payload: Record<string, unknown> = {
      model,
      messages: chatMessages.length > 0 ? chatMessages : [{ role: 'user', content: ' ' }],
      max_tokens: options.maxTokens || 4096,
      stream
    }

    if (systemParts.length > 0) {
      payload.system = systemParts.join('\n\n')
    }
    if (typeof options.temperature === 'number') {
      payload.temperature = options.temperature
    }
    if (typeof options.topP === 'number') {
      payload.top_p = options.topP
    }

    return { payload, model }
  }

  public async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const url = this.getUrl()
    const { payload, model } = this.formatPayload(options, false)

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Anthropic Messages API 请求失败 (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as any
    let text = ''
    if (Array.isArray(data?.content)) {
      for (const block of data.content) {
        if (block?.type === 'text') {
          text += block.text || ''
        }
      }
    }

    return {
      text,
      model: data?.model || model,
      usage: {
        promptTokens: data?.usage?.input_tokens,
        completionTokens: data?.usage?.output_tokens,
        totalTokens:
          (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0) || undefined
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
    const { payload, model } = this.formatPayload(options, true)

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Anthropic Messages 响应错误 (${res.status}): ${errText}`)
    }

    if (!res.body) {
      throw new Error('未收到可读响应流')
    }

    let fullText = ''
    let reportedModel = model
    let inputTokens = 0
    let outputTokens = 0

    for await (const { event, data } of parseSSEStream(res.body)) {
      try {
        const parsed = JSON.parse(data)

        if (parsed.type === 'message_start' && parsed.message) {
          reportedModel = parsed.message.model || reportedModel
          if (parsed.message.usage?.input_tokens) {
            inputTokens = parsed.message.usage.input_tokens
          }
        }

        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          const delta = parsed.delta.text
          fullText += delta
          onChunk({
            requestId,
            delta,
            done: false
          })
        }

        if (parsed.type === 'message_delta' && parsed.usage?.output_tokens) {
          outputTokens = parsed.usage.output_tokens
        }

        if (event === 'message_stop' || parsed.type === 'message_stop') {
          break
        }
      } catch {
        // ignore non-json
      }
    }

    const usage = {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens
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
