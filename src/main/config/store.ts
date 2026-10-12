import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { AppConfig, AppPaths } from '../../shared/types/config'
import { PROVIDER_PRESETS } from '../../shared/constants/presets'
import { DEFAULT_CONFIG } from '../../shared/constants/config'
import {
  ApiKeyCipher,
  isMaskedApiKey,
  maskApiKey,
  CipherDiagnostics
} from './crypto'

export { DEFAULT_CONFIG, maskApiKey, isMaskedApiKey }

export class ConfigStore {
  private configDir: string
  private configFile: string
  private currentConfig: AppConfig | null = null
  private cipher: ApiKeyCipher
  private lastDecryptionError?: string

  constructor(customConfigDir?: string, customCipher?: ApiKeyCipher) {
    this.configDir = customConfigDir || path.join(os.homedir(), '.explosion')
    this.configFile = path.join(this.configDir, 'config.json')
    this.cipher = customCipher || new ApiKeyCipher()
  }

  public getPaths(): AppPaths {
    return {
      configDir: this.configDir,
      configFile: this.configFile,
      libraryDir: path.join(this.configDir, 'library'),
      scriptsDir: path.join(this.configDir, 'scripts'),
      cacheDir: path.join(this.configDir, 'cache')
    }
  }

  public ensureDirectories(): void {
    const paths = this.getPaths()
    const dirs = [paths.configDir, paths.libraryDir, paths.scriptsDir, paths.cacheDir]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
      }
      try {
        fs.chmodSync(dir, 0o700)
      } catch {
        // ignore on platforms without posix permission semantics
      }
    }
  }

  public loadConfig(): AppConfig {
    this.ensureDirectories()
    if (!fs.existsSync(this.configFile)) {
      this.currentConfig = this.buildInitialConfig()
      this.saveConfig(this.currentConfig)
      return this.currentConfig
    }

    try {
      const raw = fs.readFileSync(this.configFile, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      let needsMigration = false

      const storedApiKey = parsed.provider?.apiKey || ''
      let decryptedApiKey = ''

      if (storedApiKey) {
        if (this.cipher.isEncrypted(storedApiKey)) {
          try {
            decryptedApiKey = this.cipher.decrypt(storedApiKey)
          } catch (err) {
            this.lastDecryptionError = err instanceof Error ? err.message : String(err)
            console.error('[ConfigStore] 无法解密 config.json 中的 API Key:', this.lastDecryptionError)
            decryptedApiKey = ''
          }
        } else {
          // 兼容旧版明文格式：直接读取并标记需升级为加密存储
          decryptedApiKey = storedApiKey
          needsMigration = true
        }
      }

      this.currentConfig = this.mergeWithDefault({
        ...parsed,
        provider: {
          ...(parsed.provider || {}),
          apiKey: decryptedApiKey
        }
      })

      // 发现旧版明文 API Key 时，自动升级为当前系统的加密存储
      if (needsMigration) {
        this.persistToDisk(this.currentConfig)
      }

      return this.currentConfig
    } catch {
      this.currentConfig = this.buildInitialConfig()
      return this.currentConfig
    }
  }

  public saveConfig(config: AppConfig): AppConfig {
    this.ensureDirectories()

    // 保护机制：若传入的 key 为掩码，或者未修改，则保留已有明文 key
    const existingKey = this.getConfig().provider.apiKey || ''
    const incomingKey = config.provider?.apiKey
    let finalApiKey = existingKey

    if (incomingKey !== undefined && !isMaskedApiKey(incomingKey)) {
      if (incomingKey.trim().length === 0) {
        // 用户明确清空 key（hasKey === false 或提交空串）
        if (config.provider?.hasKey === false) {
          finalApiKey = ''
        } else {
          // 若 hasKey 仍为 true 但提交空串，视为未修改现有 key
          finalApiKey = existingKey
        }
      } else {
        // 用户输入了新的真实 key
        finalApiKey = incomingKey.trim()
      }
    } else {
      // 传入的是掩码（如 sk-****abcd）或 undefined，保留现有真实 key
      finalApiKey = existingKey
    }

    const merged = this.mergeWithDefault({
      ...config,
      provider: {
        ...(config.provider || {}),
        apiKey: finalApiKey
      }
    })

    this.currentConfig = merged
    this.persistToDisk(this.currentConfig)
    return this.currentConfig
  }

  public resetConfig(): AppConfig {
    const initial = this.buildInitialConfig()
    return this.saveConfig(initial)
  }

  public getConfig(): AppConfig {
    if (!this.currentConfig) {
      return this.loadConfig()
    }
    return this.currentConfig
  }

  /**
   * 渲染端专用脱敏配置：CONFIG_GET 时返回掩码与 hasKey 标志，不暴露明文
   */
  public getSanitizedConfig(): AppConfig {
    const config = this.getConfig()
    const rawApiKey = config.provider?.apiKey || ''
    return {
      ...config,
      provider: {
        ...config.provider,
        apiKey: maskApiKey(rawApiKey),
        hasKey: Boolean(rawApiKey && rawApiKey.trim().length > 0)
      }
    }
  }

  public isConfigured(): boolean {
    const config = this.getConfig()
    const provider = config.provider
    if (!provider || !provider.baseUrl?.trim() || !provider.activeModel?.trim()) {
      return false
    }

    const preset = PROVIDER_PRESETS[provider.presetId]
    if (preset?.requiresApiKey) {
      return Boolean(provider.apiKey && provider.apiKey.trim().length > 0)
    }

    return true
  }

  public getCipher(): ApiKeyCipher {
    return this.cipher
  }

  public getCipherDiagnostics(): CipherDiagnostics {
    return this.cipher.getDiagnostics()
  }

  public getLastDecryptionError(): string | undefined {
    return this.lastDecryptionError
  }

  private persistToDisk(config: AppConfig): void {
    const rawApiKey = config.provider.apiKey || ''
    const encryptedApiKey = rawApiKey ? this.cipher.encrypt(rawApiKey) : ''

    const diskConfig: AppConfig = {
      ...config,
      provider: {
        ...config.provider,
        apiKey: encryptedApiKey
      }
    }
    delete (diskConfig.provider as unknown as Record<string, unknown>).hasKey

    const tempFile = `${this.configFile}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`
    fs.writeFileSync(tempFile, JSON.stringify(diskConfig, null, 2), {
      encoding: 'utf-8',
      mode: 0o600
    })

    try {
      fs.chmodSync(tempFile, 0o600)
    } catch {
      // ignore
    }

    fs.renameSync(tempFile, this.configFile)

    try {
      fs.chmodSync(this.configFile, 0o600)
    } catch {
      // ignore
    }
  }

  private buildInitialConfig(): AppConfig {
    return {
      ...DEFAULT_CONFIG,
      workspace: {
        ...DEFAULT_CONFIG.workspace,
        libraryPath: path.join(this.configDir, 'library')
      }
    }
  }

  private mergeWithDefault(partial: {
    version?: string
    provider?: Partial<AppConfig["provider"]>
    workspace?: Partial<AppConfig["workspace"]>
    ui?: Partial<AppConfig["ui"]>
  }): AppConfig {
    const initial = this.buildInitialConfig()
    return {
      version: partial.version || initial.version,
      provider: {
        ...initial.provider,
        ...(partial.provider || {})
      },
      workspace: {
        ...initial.workspace,
        ...(partial.workspace || {})
      },
      ui: {
        ...initial.ui,
        ...(partial.ui || {})
      }
    }
  }
}

export const globalConfigStore = new ConfigStore()
