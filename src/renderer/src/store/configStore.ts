import { create } from 'zustand'
import { AppConfig, ProviderConfig, UiConfig, AppTheme } from '../../../shared/types/config'
import { DEFAULT_CONFIG } from '../../../shared/constants/config'
import { PROVIDER_PRESETS } from '../../../shared/constants/presets'
import { sanitizeUiConfig } from '../../../shared/utils/uiConfig'

interface ConfigState {
  config: AppConfig
  isLoading: boolean
  isConfigured: boolean
  isOnboardingOpen: boolean
  isSettingsOpen: boolean
  loadConfig: () => Promise<void>
  saveConfig: (newConfig: AppConfig) => Promise<boolean>
  resetConfig: () => Promise<void>
  updateProvider: (updates: Partial<ProviderConfig>) => void
  updateUiConfig: (updates: Partial<UiConfig>) => Promise<boolean>
  setIsOnboardingOpen: (open: boolean) => void
  setIsSettingsOpen: (open: boolean) => void
}

export function applyTheme(theme: AppTheme | string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function checkIsConfigured(config: AppConfig): boolean {
  const provider = config?.provider
  if (!provider || !provider.baseUrl?.trim() || !provider.activeModel?.trim()) {
    return false
  }
  const preset = PROVIDER_PRESETS[provider.presetId]
  if (preset?.requiresApiKey) {
    return Boolean(provider.hasKey || (provider.apiKey && provider.apiKey.trim().length > 0))
  }
  return true
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: DEFAULT_CONFIG,
  isLoading: true,
  isConfigured: false,
  isOnboardingOpen: false,
  isSettingsOpen: false,

  loadConfig: async () => {
    set({ isLoading: true })
    try {
      const cfg = await window.api.getConfig()
      const configured = checkIsConfigured(cfg)
      if (cfg?.ui?.theme) {
        applyTheme(cfg.ui.theme)
      } else {
        applyTheme('dark')
      }
      set({
        config: cfg,
        isConfigured: configured,
        isOnboardingOpen: !configured,
        isLoading: false
      })
    } catch {
      applyTheme('dark')
      set({
        config: DEFAULT_CONFIG,
        isConfigured: false,
        isOnboardingOpen: true,
        isLoading: false
      })
    }
  },

  saveConfig: async (newConfig: AppConfig) => {
    try {
      if (newConfig.ui?.theme) {
        applyTheme(newConfig.ui.theme)
      }
      const res = await window.api.saveConfig(newConfig)
      if (res.success) {
        const configured = checkIsConfigured(res.config)
        set({
          config: res.config,
          isConfigured: configured,
          isOnboardingOpen: !configured ? true : false
        })
        return true
      }
      return false
    } catch {
      return false
    }
  },

  resetConfig: async () => {
    try {
      const reset = await window.api.resetConfig()
      if (reset?.ui?.theme) {
        applyTheme(reset.ui.theme)
      }
      set({
        config: reset,
        isConfigured: false,
        isOnboardingOpen: true
      })
    } catch {
      // ignore
    }
  },

  updateProvider: (updates: Partial<ProviderConfig>) => {
    const current = get().config
    const updated: AppConfig = {
      ...current,
      provider: {
        ...current.provider,
        ...updates
      }
    }
    set({ config: updated })
  },

  updateUiConfig: async (updates: Partial<UiConfig>) => {
    const current = get().config
    const newUi = sanitizeUiConfig({
      ...current.ui,
      ...updates
    })
    const updated: AppConfig = {
      ...current,
      ui: newUi
    }
    if (newUi.theme) {
      applyTheme(newUi.theme)
    }
    set({ config: updated })
    try {
      const res = await window.api.saveConfig(updated)
      if (res.success) {
        set({ config: res.config })
        return true
      }
      return false
    } catch {
      return false
    }
  },

  setIsOnboardingOpen: (open: boolean) => set({ isOnboardingOpen: open }),
  setIsSettingsOpen: (open: boolean) => set({ isSettingsOpen: open })
}))
