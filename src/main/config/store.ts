import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { AppConfig, AppPaths } from '../../shared/types/config'
import { PROVIDER_PRESETS } from '../../shared/constants/presets'
import { DEFAULT_CONFIG } from '../../shared/constants/config'

export { DEFAULT_CONFIG }

export class ConfigStore {
  private configDir: string
  private configFile: string
  private currentConfig: AppConfig | null = null

  constructor(customConfigDir?: string) {
    this.configDir = customConfigDir || path.join(os.homedir(), '.explosion')
    this.configFile = path.join(this.configDir, 'config.json')
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
        fs.mkdirSync(dir, { recursive: true })
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
      this.currentConfig = this.mergeWithDefault(parsed)
      return this.currentConfig
    } catch {
      this.currentConfig = this.buildInitialConfig()
      return this.currentConfig
    }
  }

  public saveConfig(config: AppConfig): AppConfig {
    this.ensureDirectories()
    this.currentConfig = this.mergeWithDefault(config)
    const tempFile = `${this.configFile}.${Date.now()}.tmp`
    fs.writeFileSync(tempFile, JSON.stringify(this.currentConfig, null, 2), 'utf-8')
    fs.renameSync(tempFile, this.configFile)
    return this.currentConfig
  }

  public resetConfig(): AppConfig {
    return this.saveConfig(this.buildInitialConfig())
  }

  public getConfig(): AppConfig {
    if (!this.currentConfig) {
      return this.loadConfig()
    }
    return this.currentConfig
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

  private buildInitialConfig(): AppConfig {
    return {
      ...DEFAULT_CONFIG,
      workspace: {
        ...DEFAULT_CONFIG.workspace,
        libraryPath: path.join(os.homedir(), '.explosion', 'library')
      }
    }
  }

  private mergeWithDefault(partial: Partial<AppConfig>): AppConfig {
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
