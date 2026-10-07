import React, { useState } from 'react'
import {
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Flame,
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
          message: `已成功获取 ${res.models.length} 个模型`
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-800/80 bg-stone-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Flame className="w-5 h-5 text-stone-950 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
                Explosion 创作工作台
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  单一主力模型驱动
                </span>
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                首次启动向导：仅需配置一个顶尖模型，主笔与并发审校 Agent 即可全自动各司其职。
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm scrollbar-thin">
          {/* Preset Selector */}
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-2">
              选择服务商预设模板
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_LIST.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    presetId === preset.id
                      ? 'border-amber-500/80 bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/50 shadow-sm'
                      : 'border-stone-800 bg-stone-950/60 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                  }`}
                >
                  <div className="font-semibold text-xs text-stone-200">{preset.name}</div>
                  <div className="text-[10px] text-stone-500 truncate mt-1">
                    {preset.id === 'deepseek' ? '推荐首选' : preset.id}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500 mt-2 px-1">
              {currentPreset.description}
            </p>
          </div>

          {/* Base URL & Protocol */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                API Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                协议规范
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as LLMProtocol)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80"
              >
                <option value="chat_completions">Chat Completions</option>
                <option value="openai_responses">OpenAI Responses</option>
                <option value="anthropic_messages">Anthropic Messages</option>
              </select>
            </div>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-stone-300">
                API Key 凭据
              </label>
              {!currentPreset.requiresApiKey && (
                <span className="text-[10px] text-stone-500">该端点无需密钥（可留空）</span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={currentPreset.apiKeyPlaceholder}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 p-1 text-stone-500 hover:text-stone-300 transition-colors"
                tabIndex={-1}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Active Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                主力创作模型（支持手动输入或下拉选择）
              </label>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels || !baseUrl}
                className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                拉取上游可用模型
              </button>
            </div>

            <Combobox
              value={activeModel}
              onChange={setActiveModel}
              options={models}
              placeholder="输入或选择模型（如 deepseek-chat, gpt-4o 等）"
            />
          </div>

          {/* Test Connectivity Result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in duration-150 ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 break-all">
                <div className="font-medium">{testResult.message}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-stone-800/80 bg-stone-900/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !baseUrl}
            className="px-4 py-2 rounded-lg border border-stone-700 bg-stone-800/80 text-stone-200 text-xs font-medium hover:bg-stone-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-400 ${isTesting ? 'animate-bounce' : ''}`} />
            {isTesting ? '正在探测连通性...' : '测试连通性'}
          </button>

          <button
            type="button"
            onClick={handleSaveAndStart}
            disabled={!isFormValid || isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold text-xs shadow-lg shadow-orange-500/20 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? '正在保存...' : '完成配置，开始创作'}
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  )
}
