import {
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMStreamChunk,
  ToolCall
} from '../../../shared/types/llm'
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

  private formatInput(messages: LLMGenerateOptions['messages']): Array<Record<string, unknown>> {
    return messages.map((m) => {
      const item: Record<string, unknown> = {
        role: m.role,
        content: m.content
      }
      if (m.tool_calls && m.tool_calls.length > 0) {
        item.tool_calls = m.tool_calls
      }
      if (m.tool_call_id) {
        item.tool_call_id = m.tool_call_id
      }
      return item
    })
  }

  public async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const url = this.getUrl()
    const model = options.model || this.config.defaultModel

    const body: Record<string, unknown> = {
      model,
      input: this.formatInput(options.messages),
      stream: false
    }
    if (typeof options.temperature === 'number') {
      body.temperature = options.temperature
    }
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
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
    const toolCalls: ToolCall[] = []

    if (typeof data?.output_text === 'string') {
      text = data.output_text
    } else if (Array.isArray(data?.output)) {
      for (const item of data.output) {
        if (typeof item === 'string') {
          text += item
        } else if (item?.type === 'function_call') {
          toolCalls.push({
            id: item.call_id || item.id || `call_${Date.now()}`,
            type: 'function',
            name: item.name || '',
            arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {})
          })
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
      },
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
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
      input: this.formatInput(options.messages),
      stream: true
    }
    if (typeof options.temperature === 'number') {
      body.temperature = options.temperature
    }
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
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
    let usage: LLMGenerateResult['usage']
    const toolCallsMap = new Map<string, { id: string; name: string; arguments: string }>()

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
        } else if (parsed.type === 'response.output_item.added' && parsed.item?.type === 'function_call') {
          const item = parsed.item
          const id = item.call_id || item.id || `call_${Date.now()}`
          toolCallsMap.set(id, { id, name: item.name || '', arguments: item.arguments || '' })
        } else if (parsed.type === 'response.function_call_arguments.delta') {
          const id = parsed.call_id || parsed.item_id || ''
          const current = toolCallsMap.get(id) || { id, name: '', arguments: '' }
          current.arguments += parsed.delta || ''
          toolCallsMap.set(id, current)
        } else if (parsed.type === 'response.output_item.done' && parsed.item?.type === 'function_call') {
          const item = parsed.item
          const id = item.call_id || item.id || `call_${Date.now()}`
          toolCallsMap.set(id, {
            id,
            name: item.name || '',
            arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {})
          })
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

    const finalToolCalls = toolCallsMap.size > 0
      ? Array.from(toolCallsMap.values()).map((t) => ({
          id: t.id,
          type: 'function' as const,
          name: t.name,
          arguments: t.arguments
        }))
      : undefined

    onChunk({
      requestId,
      delta: '',
      done: true,
      usage,
      toolCalls: finalToolCalls
    })

    return {
      text: fullText,
      model: reportedModel,
      usage,
      toolCalls: finalToolCalls
    }
  }
}
