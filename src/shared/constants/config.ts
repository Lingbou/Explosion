import { AppConfig } from '../types/config'

export const MIN_FONT_SIZE = 14
export const MAX_FONT_SIZE = 24
export const DEFAULT_FONT_SIZE = 16

export const MIN_LINE_HEIGHT = 1.5
export const MAX_LINE_HEIGHT = 2.4
export const DEFAULT_LINE_HEIGHT = 1.85

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
    autoSaveIntervalMs: 2000,
    lastProjectPath: null
  },
  ui: {
    theme: 'dark',
    fontSize: DEFAULT_FONT_SIZE,
    lineHeight: DEFAULT_LINE_HEIGHT,
    indentSize: 2,
    typewriterMode: true
  }
}
