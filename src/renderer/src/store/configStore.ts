import { create } from 'zustand'
import { AppConfig, ProviderConfig } from '../../../shared/types/config'
import { DEFAULT_CONFIG } from '../../../shared/constants/config'
import { PROVIDER_PRESETS } from '../../../shared/constants/presets'

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
  setIsOnboardingOpen: (open: boolean) => void
  setIsSettingsOpen: (open: boolean) => void
}

function checkIsConfigured(config: AppConfig): boolean {
  const provider = config?.provider
  if (!provider || !provider.baseUrl?.trim() || !provider.activeModel?.trim()) {
    return false
  }
  const preset = PROVIDER_PRESETS[provider.presetId]
  if (preset?.requiresApiKey) {
    return Boolean(provider.apiKey && provider.apiKey.trim().length > 0)
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
      set({
        config: cfg,
        isConfigured: configured,
        isOnboardingOpen: !configured,
        isLoading: false
      })
    } catch {
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

  setIsOnboardingOpen: (open: boolean) => set({ isOnboardingOpen: open }),
  setIsSettingsOpen: (open: boolean) => set({ isSettingsOpen: open })
}))
