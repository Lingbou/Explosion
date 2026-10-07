import { LLMProtocol } from './config'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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
}

export interface LLMGenerateResult {
  text: string
  reasoning?: string
  model: string
  usage?: LLMUsage
}

export interface LLMStreamChunk {
  requestId: string
  delta: string
  reasoningDelta?: string
  done: boolean
  error?: string
  usage?: LLMUsage
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
