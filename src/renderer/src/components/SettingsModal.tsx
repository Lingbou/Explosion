import React, { useState, useEffect } from 'react'
import {
  X,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Folder,
  Eye,
  EyeOff
} from 'lucide-react'
import { PROVIDER_PRESETS, PRESET_LIST } from '../../../shared/constants/presets'
import { AppPaths, LLMProtocol, ProviderPresetId } from '../../../shared/types/config'
import { useConfigStore } from '../store/configStore'
import { Combobox } from './common/Combobox'

export const SettingsModal: React.FC = () => {
  const { config, isSettingsOpen, setIsSettingsOpen, saveConfig, resetConfig } = useConfigStore()

  const [presetId, setPresetId] = useState<ProviderPresetId>(config.provider.presetId || 'deepseek')
  const [baseUrl, setBaseUrl] = useState(config.provider.baseUrl)
  const [apiKey, setApiKey] = useState(config.provider.apiKey)
  const [protocol, setProtocol] = useState<LLMProtocol>(config.provider.protocol)
  const [activeModel, setActiveModel] = useState(config.provider.activeModel)
  const [models, setModels] = useState<string[]>(config.provider.availableModels || [])
  const [temperature, setTemperature] = useState(config.provider.temperature ?? 0.7)
  const [libraryPath, setLibraryPath] = useState(config.workspace.libraryPath)

  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [appPaths, setAppPaths] = useState<AppPaths | null>(null)

  useEffect(() => {
    if (isSettingsOpen) {
      setPresetId(config.provider.presetId || 'deepseek')
      setBaseUrl(config.provider.baseUrl)
      setApiKey(config.provider.apiKey)
      setProtocol(config.provider.protocol)
      setActiveModel(config.provider.activeModel)
      setModels(config.provider.availableModels || [])
      setTemperature(config.provider.temperature ?? 0.7)
      setLibraryPath(config.workspace.libraryPath)
      setTestResult(null)

      window.api.getAppPaths().then(setAppPaths).catch(() => {})
    }
  }, [isSettingsOpen, config])

  if (!isSettingsOpen) return null

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

      setTestResult({
        ok: res.ok,
        message: res.message
      })

      if (res.ok && res.detectedModels && res.detectedModels.length > 0) {
        setModels(res.detectedModels)
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
          message: res.error || '未获取到模型列表，可手动输入'
        })
      }
    } catch {
      setTestResult({
        ok: false,
        message: '拉取模型异常'
      })
    } finally {
      setIsFetchingModels(false)
    }
  }

  const handleSave = async () => {
    const updated = {
      ...config,
      provider: {
        ...config.provider,
        presetId,
        name: currentPreset.name,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        protocol,
        activeModel: activeModel.trim(),
        availableModels: models,
        temperature
      },
      workspace: {
        ...config.workspace,
        libraryPath: libraryPath.trim()
      }
    }

    await saveConfig(updated)
    setIsSettingsOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-stone-800" />
            <h3 className="font-semibold text-stone-900 text-sm">设置与模型配置</h3>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs scrollbar-thin">
          {/* Provider Preset */}
          <div>
            <label className="block font-medium text-stone-700 mb-1.5">服务商预设</label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_LIST.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-2 rounded-lg border text-xs transition-all ${
                    presetId === preset.id
                      ? 'border-stone-900 bg-stone-50 text-stone-900 font-medium'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL & Protocol */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-medium text-stone-700 mb-1">API Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 font-mono text-stone-900 focus:outline-none focus:border-stone-800"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700 mb-1">协议</label>
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
            <label className="block font-medium text-stone-700 mb-1">API Key 凭据</label>
            <div className="relative flex items-center">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-white border border-stone-200 rounded-lg pl-3 pr-10 py-2 font-mono text-stone-900 focus:outline-none focus:border-stone-800"
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
                重新拉取
              </button>
            </div>
            <Combobox
              value={activeModel}
              onChange={setActiveModel}
              options={models}
              placeholder="输入或选择模型标识"
            />
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-stone-700">发散度 (Temperature)</label>
              <span className="font-mono text-stone-600">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-stone-800"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
              <span>0.0 (严谨)</span>
              <span>0.7 (默认)</span>
              <span>1.5 (奔放)</span>
            </div>
          </div>

          {/* Library Path */}
          <div>
            <label className="block font-medium text-stone-700 mb-1 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-stone-500" />
              独立素材资料库路径 (Library)
            </label>
            <input
              type="text"
              value={libraryPath}
              onChange={(e) => setLibraryPath(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 font-mono text-stone-900 focus:outline-none focus:border-stone-800"
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

          {/* System Paths Info */}
          {appPaths && (
            <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100 text-[11px] font-mono text-stone-500 space-y-0.5">
              <div>配置持久化: {appPaths.configFile}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 flex items-center justify-between bg-stone-50/50">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !baseUrl}
            className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs hover:bg-stone-50 transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-stone-500" />
            {isTesting ? '正在测试...' : '测试连通'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetConfig}
              className="px-3 py-1.5 text-stone-500 hover:text-stone-800 text-xs transition-colors"
            >
              恢复默认
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs transition-colors"
            >
              保存更改
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
