import {
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMStreamChunk,
  ToolCall
} from '../../../shared/types/llm'
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

  private formatMessages(messages: LLMGenerateOptions['messages']): Array<Record<string, unknown>> {
    return messages.map((m) => {
      const formatted: Record<string, unknown> = {
        role: m.role,
        content: m.content
      }
      if (m.tool_calls && m.tool_calls.length > 0) {
        formatted.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments
          }
        }))
      }
      if (m.tool_call_id) {
        formatted.tool_call_id = m.tool_call_id
      }
      return formatted
    })
  }

  public async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const url = this.getUrl()
    const model = options.model || this.config.defaultModel

    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessages(options.messages),
      temperature: options.temperature ?? 0.7,
      stream: false
    }
    if (options.maxTokens) body.max_tokens = options.maxTokens
    if (options.topP) body.top_p = options.topP
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }))
    }

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

    let toolCalls: ToolCall[] | undefined
    if (Array.isArray(choice?.message?.tool_calls) && choice.message.tool_calls.length > 0) {
      toolCalls = choice.message.tool_calls.map((tc: any) => ({
        id: tc.id || `call_${Date.now()}`,
        type: 'function',
        name: tc.function?.name || '',
        arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {})
      }))
    }

    return {
      text,
      reasoning: reasoning || undefined,
      model: data?.model || model,
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens
      },
      toolCalls
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
      messages: this.formatMessages(options.messages),
      temperature: options.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true }
    }
    if (options.maxTokens) body.max_tokens = options.maxTokens
    if (options.topP) body.top_p = options.topP
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
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
      throw new Error(`OpenAI Chat 响应错误 (${res.status}): ${errText}`)
    }

    if (!res.body) {
      throw new Error('未收到可读响应流')
    }

    let fullText = ''
    let fullReasoning = ''
    let reportedModel = model
    let usage: LLMGenerateResult['usage']
    const accumulatedTools = new Map<number, { id: string; name: string; arguments: string }>()

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

        // Handle streaming tool calls
        if (Array.isArray(choice.delta?.tool_calls)) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index ?? 0
            const current = accumulatedTools.get(idx) || { id: '', name: '', arguments: '' }
            if (tc.id) current.id = tc.id
            if (tc.function?.name) current.name += tc.function.name
            if (tc.function?.arguments) current.arguments += tc.function.arguments
            accumulatedTools.set(idx, current)

            onChunk({
              requestId,
              delta: '',
              done: false,
              toolCallDelta: {
                index: idx,
                id: tc.id,
                name: tc.function?.name,
                argumentsDelta: tc.function?.arguments
              }
            })
          }
        }

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

    let finalToolCalls: ToolCall[] | undefined
    if (accumulatedTools.size > 0) {
      finalToolCalls = Array.from(accumulatedTools.values()).map((t, idx) => ({
        id: t.id || `call_${Date.now()}_${idx}`,
        type: 'function',
        name: t.name,
        arguments: t.arguments
      }))
    }

    onChunk({
      requestId,
      delta: '',
      done: true,
      usage,
      toolCalls: finalToolCalls
    })

    return {
      text: fullText,
      reasoning: fullReasoning || undefined,
      model: reportedModel,
      usage,
      toolCalls: finalToolCalls
    }
  }
}
