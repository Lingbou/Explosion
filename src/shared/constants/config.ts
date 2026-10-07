import { AppConfig } from '../types/config'

export const DEFAULT_CONFIG: AppConfig = {
  version: '0.1.0',
  provider: {
    presetId: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    protocol: 'chat_completions',
    activeModel: 'deepseek-chat',
    availableModels: ['deepseek-chat', 'deepseek-reasoner'],
    temperature: 0.7
  },
  workspace: {
    libraryPath: '~/.explosion/library',
    autoSaveIntervalMs: 2000
  },
  ui: {
    theme: 'dark',
    fontSize: 16,
    lineHeight: 1.85,
    indentSize: 2
  }
}
