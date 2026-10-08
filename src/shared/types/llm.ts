import { LLMProtocol } from './config'

export interface ToolDefinition {
  type?: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  type?: 'function'
  name: string
  arguments: string
}

export interface ToolCallDelta {
  index: number
  id?: string
  name?: string
  argumentsDelta?: string
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface LLMUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface LLMGenerateOptions {
  messages: LLMMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
  tools?: ToolDefinition[]
}

export interface LLMGenerateResult {
  text: string
  reasoning?: string
  model: string
  usage?: LLMUsage
  toolCalls?: ToolCall[]
}

export interface LLMStreamChunk {
  requestId: string
  delta: string
  reasoningDelta?: string
  done: boolean
  error?: string
  usage?: LLMUsage
  toolCalls?: ToolCall[]
  toolCallDelta?: ToolCallDelta
}

export interface TestConnectionParams {
  baseUrl: string
  apiKey: string
  protocol: LLMProtocol
  model?: string
}

export interface TestConnectionResult {
  ok: boolean
  latencyMs: number
  message: string
  detectedModels?: string[]
}

export interface FetchModelsParams {
  baseUrl: string
  apiKey: string
  protocol?: LLMProtocol
}

export interface FetchModelsResult {
  ok: boolean
  models: string[]
  error?: string
}
