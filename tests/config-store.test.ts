import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ConfigStore, DEFAULT_CONFIG } from '../src/main/config/store'
import { ApiKeyCipher, SafeStorageBackend } from '../src/main/config/crypto'

describe('ConfigStore', () => {
  let tempDir: string
  let store: ConfigStore

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `explosion-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    store = new ConfigStore(tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('initializes and creates directories with secure permissions', () => {
    const paths = store.getPaths()
    store.ensureDirectories()

    expect(fs.existsSync(paths.configDir)).toBe(true)
    expect(fs.existsSync(paths.libraryDir)).toBe(true)
    expect(fs.existsSync(paths.scriptsDir)).toBe(true)
    expect(fs.existsSync(paths.cacheDir)).toBe(true)

    if (process.platform !== 'win32') {
      const mode = fs.statSync(paths.configDir).mode & 0o777
      expect(mode).toBe(0o700)
    }
  })

  it('loads default config when no config exists', () => {
    const config = store.loadConfig()
    expect(config.version).toBe(DEFAULT_CONFIG.version)
    expect(config.provider.presetId).toBe('deepseek')
    expect(config.provider.activeModel).toBe('deepseek-chat')
    expect(config.provider.apiKey).toBe('')
  })

  it('accurately reports isConfigured status', () => {
    expect(store.isConfigured()).toBe(false) // Default has empty apiKey for deepseek

    const config = store.getConfig()
    config.provider.apiKey = 'sk-valid-key-1234'
    store.saveConfig(config)

    expect(store.isConfigured()).toBe(true)
  })

  it('Electron safeStorage: encrypts API key on disk as base64 and decrypts on read', () => {
    const mockSafeStorage: SafeStorageBackend = {
      isEncryptionAvailable: () => true,
      encryptString: (str: string) => Buffer.from(`safestorage-cipher:${str}`, 'utf-8'),
      decryptString: (buf: Buffer) => buf.toString('utf-8').replace(/^safestorage-cipher:/, '')
    }
    const safeStore = new ConfigStore(tempDir, new ApiKeyCipher(mockSafeStorage))

    const config = safeStore.loadConfig()
    config.provider.apiKey = 'sk-prod-deepseek-secret'
    safeStore.saveConfig(config)

    // Check disk content: must be encrypted base64, never raw plaintext
    const rawDiskContent = fs.readFileSync(safeStore.getPaths().configFile, 'utf-8')
    expect(rawDiskContent).not.toContain('sk-prod-deepseek-secret')
    expect(rawDiskContent).toContain('enc:v1:safeStorage:')

    const parsedDisk = JSON.parse(rawDiskContent)
    const storedCipher = parsedDisk.provider.apiKey
    expect(storedCipher.startsWith('enc:v1:safeStorage:')).toBe(true)
    const base64Part = storedCipher.slice('enc:v1:safeStorage:'.length)
    const decodedBuffer = Buffer.from(base64Part, 'base64')
    expect(decodedBuffer.toString('utf-8')).toBe('safestorage-cipher:sk-prod-deepseek-secret')

    // Check file permission (mode 0600)
    if (process.platform !== 'win32') {
      const mode = fs.statSync(safeStore.getPaths().configFile).mode & 0o777
      expect(mode).toBe(0o600)
    }

    // Check read: decrypts seamlessly
    const reloaded = safeStore.loadConfig()
    expect(reloaded.provider.apiKey).toBe('sk-prod-deepseek-secret')
  })

  it('Fallback AES-256-GCM: encrypts on disk when safeStorage is unavailable', () => {
    const fallbackStore = new ConfigStore(tempDir, new ApiKeyCipher(null))
    const config = fallbackStore.loadConfig()
    config.provider.apiKey = 'sk-fallback-linux-key'
    fallbackStore.saveConfig(config)

    const rawDisk = fs.readFileSync(fallbackStore.getPaths().configFile, 'utf-8')
    expect(rawDisk).not.toContain('sk-fallback-linux-key')
    expect(rawDisk).toContain('enc:v1:fallback:')

    if (process.platform !== 'win32') {
      const mode = fs.statSync(fallbackStore.getPaths().configFile).mode & 0o777
      expect(mode).toBe(0o600)
    }

    const reloaded = fallbackStore.loadConfig()
    expect(reloaded.provider.apiKey).toBe('sk-fallback-linux-key')
  })

  it('returns sanitized config for renderer with mask and hasKey flag', () => {
    const config = store.loadConfig()
    config.provider.apiKey = 'sk-ant-api03-12345678'
    store.saveConfig(config)

    const sanitized = store.getSanitizedConfig()
    expect(sanitized.provider.apiKey).toBe('sk-****5678')
    expect(sanitized.provider.hasKey).toBe(true)

    // In-memory getConfig() still contains plaintext for main process internal calls
    expect(store.getConfig().provider.apiKey).toBe('sk-ant-api03-12345678')
  })

  it('protects against mask overwrite: saving masked key does NOT overwrite real key', () => {
    const config = store.loadConfig()
    config.provider.apiKey = 'sk-actual-production-key-8888'
    store.saveConfig(config)

    // Renderer receives sanitized config with mask
    const sanitized = store.getSanitizedConfig()
    expect(sanitized.provider.apiKey).toBe('sk-****8888')

    // User modifies temperature in Settings, but keeps masked apiKey
    const modifiedConfig = {
      ...sanitized,
      provider: {
        ...sanitized.provider,
        temperature: 0.95
      }
    }

    store.saveConfig(modifiedConfig)

    // Verify: real key was NOT overwritten by the mask!
    const reloaded = store.loadConfig()
    expect(reloaded.provider.apiKey).toBe('sk-actual-production-key-8888')
    expect(reloaded.provider.temperature).toBe(0.95)
  })

  it('updates key when user enters a new plaintext value', () => {
    const config = store.loadConfig()
    config.provider.apiKey = 'sk-old-key-1111'
    store.saveConfig(config)

    const updated = {
      ...store.getSanitizedConfig(),
      provider: {
        ...store.getSanitizedConfig().provider,
        apiKey: 'sk-brand-new-key-2222'
      }
    }

    store.saveConfig(updated)
    expect(store.getConfig().provider.apiKey).toBe('sk-brand-new-key-2222')
    expect(store.getSanitizedConfig().provider.apiKey).toBe('sk-****2222')
  })

  it('clears key when user explicitly empties key with hasKey: false', () => {
    const config = store.loadConfig()
    config.provider.apiKey = 'sk-to-be-deleted-3333'
    store.saveConfig(config)
    expect(store.isConfigured()).toBe(true)

    const cleared = {
      ...store.getSanitizedConfig(),
      provider: {
        ...store.getSanitizedConfig().provider,
        apiKey: '',
        hasKey: false
      }
    }

    store.saveConfig(cleared)
    expect(store.getConfig().provider.apiKey).toBe('')
    expect(store.isConfigured()).toBe(false)
    expect(store.getSanitizedConfig().provider.hasKey).toBe(false)
  })

  it('preserves key when apiKey is empty string but hasKey is still true', () => {
    const config = store.loadConfig()
    config.provider.apiKey = 'sk-remain-untouched-4444'
    store.saveConfig(config)

    const untouched = {
      ...store.getSanitizedConfig(),
      provider: {
        ...store.getSanitizedConfig().provider,
        apiKey: '',
        hasKey: true
      }
    }

    store.saveConfig(untouched)
    expect(store.getConfig().provider.apiKey).toBe('sk-remain-untouched-4444')
  })

  it('automatically upgrades legacy plaintext config.json to encrypted storage', () => {
    // Write simulated legacy plaintext config.json directly to disk
    store.ensureDirectories()
    const legacyConfig = {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        apiKey: 'sk-legacy-unencrypted-secret'
      }
    }
    fs.writeFileSync(store.getPaths().configFile, JSON.stringify(legacyConfig, null, 2), 'utf-8')

    // Load config: should detect plaintext, read it, and upgrade on disk
    const loaded = store.loadConfig()
    expect(loaded.provider.apiKey).toBe('sk-legacy-unencrypted-secret')

    // Disk content must now be encrypted
    const upgradedDisk = fs.readFileSync(store.getPaths().configFile, 'utf-8')
    expect(upgradedDisk).not.toContain('sk-legacy-unencrypted-secret')
    expect(upgradedDisk).toContain('enc:v1:')

    // Subsequent reload reads correctly from upgraded encrypted file
    const freshStore = new ConfigStore(tempDir)
    expect(freshStore.loadConfig().provider.apiKey).toBe('sk-legacy-unencrypted-secret')
  })

  it('handles decryption failure gracefully and records diagnostic error', () => {
    const failingCipher = new ApiKeyCipher({
      isEncryptionAvailable: () => true,
      encryptString: () => Buffer.from(''),
      decryptString: () => {
        throw new Error('OS Keychain decrypt failed: bad key')
      }
    })
    const failingStore = new ConfigStore(tempDir, failingCipher)
    failingStore.ensureDirectories()

    const corruptedConfig = {
      ...DEFAULT_CONFIG,
      provider: {
        ...DEFAULT_CONFIG.provider,
        apiKey: 'enc:v1:safeStorage:bm90LWEtdmFsaWQtY2lwaGVy'
      }
    }
    fs.writeFileSync(failingStore.getPaths().configFile, JSON.stringify(corruptedConfig, null, 2), 'utf-8')

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loaded = failingStore.loadConfig()

    expect(loaded.provider.apiKey).toBe('')
    expect(failingStore.getLastDecryptionError()).toContain('OS Keychain decrypt failed')
    errSpy.mockRestore()
  })

  it('sandbox guard: never touches ~/.explosion/config.json', () => {
    const realExplosionConfig = path.join(os.homedir(), '.explosion', 'config.json')
    let realMtimeBefore: number | null = null
    if (fs.existsSync(realExplosionConfig)) {
      realMtimeBefore = fs.statSync(realExplosionConfig).mtimeMs
    }

    // Perform full suite operations on isolated store
    const isolatedStore = new ConfigStore(tempDir)
    const cfg = isolatedStore.loadConfig()
    cfg.provider.apiKey = 'sk-isolated-sandbox-key'
    isolatedStore.saveConfig(cfg)
    isolatedStore.resetConfig()

    if (realMtimeBefore !== null) {
      const realMtimeAfter = fs.statSync(realExplosionConfig).mtimeMs
      expect(realMtimeAfter).toBe(realMtimeBefore)
    }
    expect(isolatedStore.getPaths().configFile).toContain(tempDir)
  })
})
