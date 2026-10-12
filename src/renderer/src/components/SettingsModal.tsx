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
  EyeOff,
  Sun,
  Moon,
  Target,
  Type
} from 'lucide-react'
import { PROVIDER_PRESETS, PRESET_LIST } from '../../../shared/constants/presets'
import { AppPaths, LLMProtocol, ProviderPresetId, AppTheme } from '../../../shared/types/config'
import {
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_FONT_SIZE,
  MIN_LINE_HEIGHT,
  MAX_LINE_HEIGHT,
  DEFAULT_LINE_HEIGHT
} from '../../../shared/constants/config'
import { useConfigStore, applyTheme } from '../store/configStore'
import { Combobox } from './common/Combobox'

export const SettingsModal: React.FC = () => {
  const { config, isSettingsOpen, setIsSettingsOpen, saveConfig, resetConfig } = useConfigStore()

  // Provider & Workspace settings state
  const [presetId, setPresetId] = useState<ProviderPresetId>(config.provider.presetId || 'deepseek')
  const [baseUrl, setBaseUrl] = useState(config.provider.baseUrl)
  const [apiKey, setApiKey] = useState(config.provider.apiKey)
  const [isApiKeyModified, setIsApiKeyModified] = useState(false)
  const [protocol, setProtocol] = useState<LLMProtocol>(config.provider.protocol)
  const [activeModel, setActiveModel] = useState(config.provider.activeModel)
  const [models, setModels] = useState<string[]>(config.provider.availableModels || [])
  const [temperature, setTemperature] = useState(config.provider.temperature ?? 0.7)
  const [libraryPath, setLibraryPath] = useState(config.workspace.libraryPath)

  // Editor & Display settings state
  const [theme, setTheme] = useState<AppTheme>(config.ui?.theme || 'dark')
  const [fontSize, setFontSize] = useState<number>(config.ui?.fontSize || DEFAULT_FONT_SIZE)
  const [lineHeight, setLineHeight] = useState<number>(config.ui?.lineHeight || DEFAULT_LINE_HEIGHT)
  const [typewriterMode, setTypewriterMode] = useState<boolean>(config.ui?.typewriterMode ?? true)

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
      setIsApiKeyModified(false)
      setProtocol(config.provider.protocol)
      setActiveModel(config.provider.activeModel)
      setModels(config.provider.availableModels || [])
      setTemperature(config.provider.temperature ?? 0.7)
      setLibraryPath(config.workspace.libraryPath)

      setTheme(config.ui?.theme || 'dark')
      setFontSize(config.ui?.fontSize || DEFAULT_FONT_SIZE)
      setLineHeight(config.ui?.lineHeight || DEFAULT_LINE_HEIGHT)
      setTypewriterMode(config.ui?.typewriterMode ?? true)

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

    if (id === config.provider.presetId) {
      setApiKey(config.provider.apiKey)
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

  const handleThemeChange = (newTheme: AppTheme) => {
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  const handleSave = async () => {
    const updated = {
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
        availableModels: models,
        temperature
      },
      workspace: {
        ...config.workspace,
        libraryPath: libraryPath.trim()
      },
      ui: {
        ...config.ui,
        theme,
        fontSize,
        lineHeight,
        typewriterMode
      }
    }

    applyTheme(theme)
    await saveConfig(updated)
    setIsSettingsOpen(false)
  }

  const handleReset = async () => {
    await resetConfig()
    setIsApiKeyModified(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-[#1f1e1c] border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-[#181716]/50">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-stone-600 dark:text-stone-300" />
            <h2 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">全局系统设置</h2>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1 hover:bg-stone-200/50 dark:hover:bg-stone-800 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs scrollbar-thin">
          {/* Section: 界面与编辑器手感 */}
          <div className="p-3.5 rounded-lg border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-[#181716] space-y-3.5">
            <div className="font-semibold text-stone-800 dark:text-stone-200 text-xs flex items-center gap-1.5 pb-1 border-b border-stone-200/60 dark:border-stone-800">
              <Type className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span>界面与码字手感</span>
            </div>

            {/* Theme Selection */}
            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                色彩主题 (Theme)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-stone-900 dark:border-stone-100 bg-stone-900 text-white font-medium shadow-xs'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#242220] text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>深色夜间模式 (Dark)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-stone-900 dark:border-stone-100 bg-stone-900 text-white font-medium shadow-xs'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#242220] text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>浅色明亮模式 (Light)</span>
                </button>
              </div>
            </div>

            {/* Font Size & Line Height */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-stone-700 dark:text-stone-300">手稿字号</span>
                  <span className="font-mono text-stone-900 dark:text-stone-100 font-medium">
                    {fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  step={1}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full accent-stone-800 dark:accent-stone-200"
                />
                <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                  <span>14px</span>
                  <span>16px (默认)</span>
                  <span>24px</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-stone-700 dark:text-stone-300">手稿行距</span>
                  <span className="font-mono text-stone-900 dark:text-stone-100 font-medium">
                    {lineHeight.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_LINE_HEIGHT}
                  max={MAX_LINE_HEIGHT}
                  step={0.05}
                  value={lineHeight}
                  onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                  className="w-full accent-stone-800 dark:accent-stone-200"
                />
                <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                  <span>1.5</span>
                  <span>1.85 (默认)</span>
                  <span>2.4</span>
                </div>
              </div>
            </div>

            {/* Typewriter Mode */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                  <span>打字机定焦滚动模式</span>
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  输入时编辑器视口保持将光标所在行稳定定焦在垂直居中位置
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTypewriterMode(!typewriterMode)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  typewriterMode
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                {typewriterMode ? '已开启' : '已关闭'}
              </button>
            </div>
          </div>

          {/* Section: Provider Presets */}
          <div>
            <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1.5">快捷服务商预设</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_LIST.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    presetId === preset.id
                      ? 'border-stone-800 dark:border-stone-100 bg-stone-50 dark:bg-[#2b2927] font-medium text-stone-900 dark:text-stone-100 shadow-2xs'
                      : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 text-stone-600 dark:text-stone-400 bg-white dark:bg-[#22211f]'
                  }`}
                >
                  <div className="text-xs font-semibold">{preset.name}</div>
                  <div className="text-[10px] text-stone-400 truncate mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Base URL & Protocol */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com"
                className="w-full bg-white dark:bg-[#181716] border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
              />
            </div>
            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">协议规范</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as LLMProtocol)}
                className="w-full bg-white dark:bg-[#181716] border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
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
                <label className="font-medium text-stone-700 dark:text-stone-300">API Key 凭据</label>
                {config.provider.hasKey && !isApiKeyModified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
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
                placeholder={currentPreset.apiKeyPlaceholder || 'sk-...'}
                className="w-full bg-white dark:bg-[#181716] border border-stone-200 dark:border-stone-700 rounded-lg pl-3 pr-10 py-2 font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                tabIndex={-1}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Active Model */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-stone-700 dark:text-stone-300">
                主力模型
              </label>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels || !baseUrl}
                className="text-[11px] text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
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
              <label className="font-medium text-stone-700 dark:text-stone-300">发散度 (Temperature)</label>
              <span className="font-mono text-stone-600 dark:text-stone-400">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-stone-800 dark:accent-stone-200"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
              <span>0.0 (严谨)</span>
              <span>0.7 (默认)</span>
              <span>1.5 (奔放)</span>
            </div>
          </div>

          {/* Library Path */}
          <div>
            <label className="font-medium text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              独立素材资料库路径 (Library)
            </label>
            <input
              type="text"
              value={libraryPath}
              onChange={(e) => setLibraryPath(e.target.value)}
              className="w-full bg-white dark:bg-[#181716] border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs ${
                testResult.ok
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* System Paths Info */}
          {appPaths && (
            <div className="p-2.5 bg-stone-50 dark:bg-[#181716] rounded-lg border border-stone-100 dark:border-stone-800 text-[11px] font-mono text-stone-500 dark:text-stone-400 space-y-0.5">
              <div>配置持久化: {appPaths.configFile}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-[#181716]/50">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !baseUrl}
            className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#242220] text-stone-700 dark:text-stone-300 text-xs hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            {isTesting ? '正在测试...' : '测试连通'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 text-xs transition-colors cursor-pointer"
            >
              恢复默认
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 font-medium text-xs transition-colors cursor-pointer"
            >
              保存更改
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
