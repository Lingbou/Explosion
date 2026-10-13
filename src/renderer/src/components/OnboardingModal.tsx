import React, { useState } from 'react'
import {
  PenLine,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react'
import { PROVIDER_PRESETS, PRESET_LIST } from '../../../shared/constants/presets'
import { LLMProtocol, ProviderPresetId } from '../../../shared/types/config'
import { useConfigStore } from '../store/configStore'
import { Combobox } from './common/Combobox'

export const OnboardingModal: React.FC = () => {
  const { config, isOnboardingOpen, setIsOnboardingOpen, saveConfig } = useConfigStore()

  const [presetId, setPresetId] = useState<ProviderPresetId>(config.provider.presetId || 'deepseek')
  const [baseUrl, setBaseUrl] = useState(config.provider.baseUrl || 'https://api.deepseek.com')
  const [apiKey, setApiKey] = useState(config.provider.apiKey || '')
  const [isApiKeyModified, setIsApiKeyModified] = useState(false)
  const [protocol, setProtocol] = useState<LLMProtocol>(config.provider.protocol || 'chat_completions')
  const [activeModel, setActiveModel] = useState(config.provider.activeModel || 'deepseek-chat')
  const [models, setModels] = useState<string[]>(
    config.provider.availableModels.length > 0
      ? config.provider.availableModels
      : PROVIDER_PRESETS.deepseek.defaultModels
  )

  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  if (!isOnboardingOpen) return null

  const currentPreset = PROVIDER_PRESETS[presetId]

  const handlePresetSelect = (id: ProviderPresetId) => {
    const preset = PROVIDER_PRESETS[id]
    setPresetId(id)
    setBaseUrl(preset.defaultBaseUrl)
    setProtocol(preset.defaultProtocol)
    setModels(preset.defaultModels)
    setActiveModel(preset.recommendedModel || preset.defaultModels[0] || '')
    setTestResult(null)

    if (id === config.provider.presetId) {
      setApiKey(config.provider.apiKey || '')
      setIsApiKeyModified(false)
    } else {
      setApiKey('')
      setIsApiKeyModified(true)
    }
  }

  const handleTestConnection = async () => {
    if (!baseUrl.trim()) return
    setIsTesting(true)
    setTestResult(null)

    try {
      const res = await window.api.testConnection({
        baseUrl: baseUrl.trim(),
        apiKey: isApiKeyModified ? apiKey.trim() : '',
        protocol,
        model: activeModel.trim()
      })

      if (res.ok) {
        setTestResult({
          ok: true,
          message: res.message,
          latency: res.latencyMs
        })
        if (res.detectedModels && res.detectedModels.length > 0) {
          setModels(res.detectedModels)
          if (!activeModel || !res.detectedModels.includes(activeModel)) {
            setActiveModel(res.detectedModels[0])
          }
        }
      } else {
        setTestResult({
          ok: false,
          message: res.message
        })
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : '连接异常'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleFetchModels = async () => {
    if (!baseUrl.trim()) return
    setIsFetchingModels(true)
    try {
      const res = await window.api.fetchModels({
        baseUrl: baseUrl.trim(),
        apiKey: isApiKeyModified ? apiKey.trim() : '',
        protocol
      })

      if (res.ok && res.models.length > 0) {
        setModels(res.models)
        if (!activeModel || !res.models.includes(activeModel)) {
          setActiveModel(res.models[0])
        }
        setTestResult({
          ok: true,
          message: `已获取 ${res.models.length} 个模型`
        })
      } else {
        setTestResult({
          ok: false,
          message: res.error || '未获取到模型，请直接手动输入'
        })
      }
    } catch {
      setTestResult({
        ok: false,
        message: '获取模型列表超时或失败，可手动输入'
      })
    } finally {
      setIsFetchingModels(false)
    }
  }

  const handleSaveAndStart = async () => {
    setIsSaving(true)
    const newConfig = {
      ...config,
      provider: {
        ...config.provider,
        presetId,
        name: currentPreset.name,
        baseUrl: baseUrl.trim(),
        ...(isApiKeyModified
          ? { apiKey: apiKey.trim(), hasKey: apiKey.trim().length > 0 }
          : { apiKey: config.provider.apiKey, hasKey: config.provider.hasKey }),
        protocol,
        activeModel: activeModel.trim(),
        availableModels: models
      }
    }

    const success = await saveConfig(newConfig)
    setIsSaving(false)
    if (success) {
      setIsOnboardingOpen(false)
    }
  }

  const hasKeyConfigured = isApiKeyModified
    ? apiKey.trim().length > 0
    : Boolean(config.provider.hasKey || (apiKey && apiKey.trim().length > 0))

  const isFormValid =
    baseUrl.trim().length > 0 &&
    activeModel.trim().length > 0 &&
    (!currentPreset.requiresApiKey || hasKeyConfigured)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-[#1f1e1c] border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-md">
              <PenLine className="w-5 h-5 text-stone-100" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">
                欢迎使用 Explosion
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                面向专业网络小说作家的本地优先、重度自动化 AI 创作桌面工作台
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Preset Selection */}
          <div>
            <label className="block font-medium text-stone-700 mb-1.5">
              1. 选择大模型服务商预设
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_LIST.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    presetId === preset.id
                      ? 'border-stone-800 dark:border-stone-300 bg-stone-50 dark:bg-[#252422] text-stone-900 dark:text-stone-100 shadow-2xs font-medium'
                      : 'border-stone-200 dark:border-stone-750 hover:border-stone-300 dark:hover:border-stone-600 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <div className="font-semibold text-xs">{preset.name}</div>
                  <div className="text-[10px] text-stone-400 mt-0.5 truncate">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Base URL & Protocol */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-medium text-stone-700 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full bg-white dark:bg-[#181716] border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 font-mono text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                协议
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as LLMProtocol)}
                className="w-full bg-white dark:bg-[#181716] border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
              >
                <option value="chat_completions">Chat Completions</option>
                <option value="openai_responses">OpenAI Responses</option>
                <option value="anthropic_messages">Anthropic Messages</option>
              </select>
            </div>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <label className="font-medium text-stone-700">
                  API Key 凭据
                </label>
                {config.provider.hasKey && !isApiKeyModified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                    已加密存储
                  </span>
                )}
              </div>
              {!currentPreset.requiresApiKey && (
                <span className="text-[10px] text-stone-400">无需密钥（可留空）</span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setIsApiKeyModified(true)
                }}
                placeholder={currentPreset.apiKeyPlaceholder}
                className="w-full bg-white dark:bg-[#181716] border border-stone-200 dark:border-stone-700 rounded-lg pl-3 pr-10 py-2 font-mono text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 p-1 text-stone-400 hover:text-stone-600"
                tabIndex={-1}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Active Model */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-stone-700">
                主力模型
              </label>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels || !baseUrl}
                className="text-[11px] text-stone-600 hover:text-stone-900 flex items-center gap-1 disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                拉取模型列表
              </button>
            </div>

            <Combobox
              value={activeModel}
              onChange={setActiveModel}
              options={models}
              placeholder="输入或选择模型（如 deepseek-chat）"
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs ${
                testResult.ok
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50/60 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-[#161514] flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !baseUrl}
            className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#242220] text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
            {isTesting ? '正在测试...' : '测试连通性'}
          </button>

          <button
            type="button"
            onClick={handleSaveAndStart}
            disabled={!isFormValid || isSaving}
            className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            {isSaving ? '正在保存...' : '完成配置，开始创作'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
