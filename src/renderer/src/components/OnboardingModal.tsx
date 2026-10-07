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
  }

  const handleTestConnection = async () => {
    if (!baseUrl.trim()) return
    setIsTesting(true)
    setTestResult(null)

    try {
      const res = await window.api.testConnection({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
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
        apiKey: apiKey.trim(),
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
        apiKey: apiKey.trim(),
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

  const isFormValid =
    baseUrl.trim().length > 0 &&
    activeModel.trim().length > 0 &&
    (!currentPreset.requiresApiKey || apiKey.trim().length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center border border-stone-200">
              <PenLine className="w-4 h-4 text-stone-800" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                Explosion 创作工作台
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                首次配置：设定主力语言模型以启动写作辅助功能。
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs scrollbar-thin">
          {/* Preset Selector */}
          <div>
            <label className="block font-medium text-stone-700 mb-2">
              服务商预设
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_LIST.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    presetId === preset.id
                      ? 'border-stone-900 bg-stone-50 text-stone-900 font-medium'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900'
                  }`}
                >
                  <div className="text-xs">{preset.name}</div>
                  <div className="text-[10px] text-stone-400 truncate mt-0.5">
                    {preset.id === 'deepseek' ? '推荐' : preset.id}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500 mt-1.5 px-0.5">
              {currentPreset.description}
            </p>
          </div>

          {/* Base URL & Protocol */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-stone-700 mb-1">
                API Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                协议
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as LLMProtocol)}
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-900 focus:outline-none focus:border-stone-800"
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
              <label className="font-medium text-stone-700">
                API Key 凭据
              </label>
              {!currentPreset.requiresApiKey && (
                <span className="text-[10px] text-stone-400">无需密钥（可留空）</span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={currentPreset.apiKeyPlaceholder}
                className="w-full bg-white border border-stone-200 rounded-lg pl-3 pr-10 py-2 font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800"
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
        <div className="p-4 px-6 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !baseUrl}
            className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5 text-stone-600" />
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
