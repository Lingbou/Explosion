import { ProviderPreset, ProviderPresetId } from '../types/config'

export const PROVIDER_PRESETS: Record<ProviderPresetId, ProviderPreset> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '深度求索官方端点，文笔构思细腻，极具文学审美与超高性价比',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultProtocol: 'chat_completions',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    recommendedModel: 'deepseek-chat',
    apiKeyPlaceholder: 'sk-...',
    supportsModelFetching: true,
    requiresApiKey: true
  },
  siliconflow: {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    description: '高并发模型路由平台，聚合 DeepSeek-V3/R1、Qwen2.5 等开源旗舰',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    defaultProtocol: 'chat_completions',
    defaultModels: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct',
      'THUDM/glm-4-9b-chat'
    ],
    recommendedModel: 'deepseek-ai/DeepSeek-V3',
    apiKeyPlaceholder: 'sk-...',
    supportsModelFetching: true,
    requiresApiKey: true
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 官方 API，业界顶尖文学长文本理解与精细场景描摹',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultProtocol: 'anthropic_messages',
    defaultModels: [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022'
    ],
    recommendedModel: 'claude-3-7-sonnet-20250219',
    apiKeyPlaceholder: 'sk-ant-...',
    supportsModelFetching: true,
    requiresApiKey: true
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o 与 OpenAI 新一代推理模型，通用创作与逻辑分析能力扎实',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultProtocol: 'chat_completions',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4.5-preview'],
    recommendedModel: 'gpt-4o',
    apiKeyPlaceholder: 'sk-proj-...',
    supportsModelFetching: true,
    requiresApiKey: true
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama 本地服务',
    description: '本地完全离线私有化运行，零网络延迟与零数据泄露风险',
    defaultBaseUrl: 'http://localhost:11434',
    defaultProtocol: 'chat_completions',
    defaultModels: ['qwen2.5:72b', 'deepseek-r1:14b', 'llama3.3:70b'],
    recommendedModel: 'qwen2.5:72b',
    apiKeyPlaceholder: '本地免密（留空即可）',
    supportsModelFetching: true,
    modelsEndpoint: '/api/tags',
    requiresApiKey: false
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '全球模型一站式中继路由，统一账户访问各类国内外顶级模型',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultProtocol: 'chat_completions',
    defaultModels: [
      'deepseek/deepseek-chat',
      'anthropic/claude-3.7-sonnet',
      'openai/gpt-4o',
      'meta-llama/llama-3.3-70b-instruct'
    ],
    recommendedModel: 'deepseek/deepseek-chat',
    apiKeyPlaceholder: 'sk-or-...',
    supportsModelFetching: true,
    requiresApiKey: true
  },
  custom: {
    id: 'custom',
    name: '自定义端点 (Custom)',
    description: '任意兼容 OpenAI 或 Anthropic 协议的反向代理与私有化服务器',
    defaultBaseUrl: 'https://api.example.com/v1',
    defaultProtocol: 'chat_completions',
    defaultModels: [],
    recommendedModel: '',
    apiKeyPlaceholder: 'API Key',
    supportsModelFetching: true,
    requiresApiKey: false
  }
}

export const PRESET_LIST = Object.values(PROVIDER_PRESETS)
