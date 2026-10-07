import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ConfigStore, DEFAULT_CONFIG } from '../src/main/config/store'

describe('ConfigStore', () => {
  let tempDir: string
  let store: ConfigStore

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `explosion-test-${Date.now()}-${Math.random()}`)
    store = new ConfigStore(tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('initializes and creates directories', () => {
    const paths = store.getPaths()
    store.ensureDirectories()

    expect(fs.existsSync(paths.configDir)).toBe(true)
    expect(fs.existsSync(paths.libraryDir)).toBe(true)
    expect(fs.existsSync(paths.scriptsDir)).toBe(true)
    expect(fs.existsSync(paths.cacheDir)).toBe(true)
  })

  it('loads default config when no config exists', () => {
    const config = store.loadConfig()
    expect(config.version).toBe(DEFAULT_CONFIG.version)
    expect(config.provider.presetId).toBe('deepseek')
    expect(config.provider.activeModel).toBe('deepseek-chat')
  })

  it('saves and reads updated config', () => {
    const config = store.loadConfig()
    config.provider.apiKey = 'sk-custom-test-key'
    config.provider.activeModel = 'deepseek-reasoner'

    store.saveConfig(config)

    const reloaded = store.loadConfig()
    expect(reloaded.provider.apiKey).toBe('sk-custom-test-key')
    expect(reloaded.provider.activeModel).toBe('deepseek-reasoner')
  })

  it('accurately reports isConfigured status', () => {
    expect(store.isConfigured()).toBe(false) // Default has empty apiKey for deepseek

    const config = store.getConfig()
    config.provider.apiKey = 'sk-valid'
    store.saveConfig(config)

    expect(store.isConfigured()).toBe(true)
  })
})
