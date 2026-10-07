export type LLMProtocol = 'chat_completions' | 'openai_responses' | 'anthropic_messages'

export type ProviderPresetId =
  | 'deepseek'
  | 'siliconflow'
  | 'anthropic'
  | 'openai'
  | 'ollama'
  | 'openrouter'
  | 'custom'

export interface ProviderPreset {
  id: ProviderPresetId
  name: string
  description: string
  defaultBaseUrl: string
  defaultProtocol: LLMProtocol
  defaultModels: string[]
  recommendedModel: string
  apiKeyPlaceholder: string
  supportsModelFetching: boolean
  modelsEndpoint?: string
  requiresApiKey: boolean
}

export interface ProviderConfig {
  presetId: ProviderPresetId
  name: string
  baseUrl: string
  apiKey: string
  protocol: LLMProtocol
  activeModel: string
  availableModels: string[]
  temperature: number
  maxTokens?: number
  topP?: number
}

export interface WorkspaceConfig {
  lastProjectPath?: string
  libraryPath: string
  autoSaveIntervalMs: number
}

export interface UiConfig {
  theme: 'dark' | 'light' | 'sepia'
  fontSize: number
  lineHeight: number
  indentSize: number
}

export interface AppConfig {
  version: string
  provider: ProviderConfig
  workspace: WorkspaceConfig
  ui: UiConfig
}

export interface AppPaths {
  configDir: string
  configFile: string
  libraryDir: string
  scriptsDir: string
  cacheDir: string
}
