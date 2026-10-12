import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import { safeStorage } from 'electron'

export interface SafeStorageBackend {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

export interface CipherDiagnostics {
  safeStorageAvailable: boolean
  lastUsedMethod?: 'safeStorage' | 'fallback'
  lastError?: string
}

/**
 * 掩码脱敏工具：将 API Key 转换为脱敏形式，如 sk-****abcd 或 dee****9999
 * 当长度 <= 8 时统一返回 ****；空值返回空字符串。
 */
export function maskApiKey(apiKey?: string): string {
  if (!apiKey || typeof apiKey !== 'string') return ''
  const trimmed = apiKey.trim()
  if (trimmed.length === 0) return ''
  if (trimmed.length <= 8) return '****'
  if (trimmed.startsWith('sk-')) {
    return `sk-****${trimmed.slice(-4)}`
  }
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-4)}`
}

/**
 * 判断给定的 key 是否为掩码字符串（包含 ****），避免渲染端将掩码当作真实 key 写回
 */
export function isMaskedApiKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false
  return key.includes('****')
}

/**
 * 判断持久化字符串是否为已加密格式（以 enc:v1: 前缀开头）
 */
export function isEncryptedApiKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false
  return key.startsWith('enc:v1:')
}

/**
 * 机器特征派生密钥（用于 Linux 无系统钥匙串等环境下的 AES-256-GCM 回退加密）
 * 组合 /etc/machine-id 或 host/user 特征与固定盐，通过 SHA-256 派生 32 字节对称密钥。
 */
function getMachineDerivedKey(): Buffer {
  let machineSeed = ''
  try {
    if (fs.existsSync('/etc/machine-id')) {
      machineSeed = fs.readFileSync('/etc/machine-id', 'utf-8').trim()
    }
  } catch {
    // ignore
  }

  if (!machineSeed) {
    try {
      if (fs.existsSync('/var/lib/dbus/machine-id')) {
        machineSeed = fs.readFileSync('/var/lib/dbus/machine-id', 'utf-8').trim()
      }
    } catch {
      // ignore
    }
  }

  if (!machineSeed) {
    machineSeed = `${os.hostname()}:${os.userInfo().username}:${os.platform()}`
  }

  const salt = 'explosion:config:fallback-key-v1'
  return crypto.createHash('sha256').update(`${machineSeed}:${salt}`).digest()
}

/**
 * 回退加密：AES-256-GCM 机器绑定认证加密
 * 格式：enc:v1:fallback:<iv_hex>:<tag_hex>:<ciphertext_base64>
 */
function encryptWithFallback(plainText: string): string {
  const key = getMachineDerivedKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:v1:fallback:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64')}`
}

/**
 * 回退解密：AES-256-GCM 机器绑定认证解密
 */
function decryptWithFallback(cipherText: string): string {
  const parts = cipherText.split(':')
  if (parts.length !== 6 || parts[0] !== 'enc' || parts[1] !== 'v1' || parts[2] !== 'fallback') {
    throw new Error('Invalid fallback ciphertext format')
  }
  const iv = Buffer.from(parts[3], 'hex')
  const tag = Buffer.from(parts[4], 'hex')
  const ciphertext = Buffer.from(parts[5], 'base64')

  const key = getMachineDerivedKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * ApiKeyCipher: API Key 加密与解密管理器
 * 
 * 加密策略：
 * 1. 优先使用 Electron safeStorage (DPAPI on Windows, Keychain on macOS, Secret Service/libsecret on Linux)。
 *    落盘格式：enc:v1:safeStorage:<base64>
 * 2. safeStorage 不可用时（例如部分 Linux 无桌面系统钥匙串或 Headless CI），明确降级至：
 *    - 机器派生密钥 AES-256-GCM 认证加密 (enc:v1:fallback:...)
 *    - 文件权限严格收敛为 0o600 (-rw-------)
 * 3. 支持读取旧版明文格式并标记升级；加密/解密异常具备完整诊断信息。
 */
export class ApiKeyCipher {
  private safeStorageBackend: SafeStorageBackend | null = null
  private lastError?: string
  private lastUsedMethod?: 'safeStorage' | 'fallback'

  constructor(backend?: SafeStorageBackend | null) {
    if (backend !== undefined) {
      this.safeStorageBackend = backend
    } else {
      try {
        if (
          typeof safeStorage !== 'undefined' &&
          safeStorage &&
          typeof safeStorage.isEncryptionAvailable === 'function'
        ) {
          this.safeStorageBackend = safeStorage
        }
      } catch {
        this.safeStorageBackend = null
      }
    }
  }

  public isSafeStorageAvailable(): boolean {
    try {
      return Boolean(this.safeStorageBackend && this.safeStorageBackend.isEncryptionAvailable())
    } catch {
      return false
    }
  }

  /**
   * 将明文 API Key 加密为安全落盘字符串
   */
  public encrypt(plainText: string): string {
    if (!plainText || !plainText.trim()) return ''

    // 优先：Electron safeStorage
    if (this.isSafeStorageAvailable()) {
      try {
        const buffer = this.safeStorageBackend!.encryptString(plainText)
        this.lastUsedMethod = 'safeStorage'
        return `enc:v1:safeStorage:${buffer.toString('base64')}`
      } catch (err) {
        this.lastError = `safeStorage encrypt failed: ${err instanceof Error ? err.message : String(err)}`
        console.warn(
          '[ApiKeyCipher] safeStorage.encryptString 抛出异常，降级至 AES-256-GCM 机器绑定加密:',
          err
        )
      }
    }

    // 回退：AES-256-GCM 机器特征绑定加密
    try {
      const fallbackCipher = encryptWithFallback(plainText)
      this.lastUsedMethod = 'fallback'
      return fallbackCipher
    } catch (err) {
      this.lastError = `fallback encrypt failed: ${err instanceof Error ? err.message : String(err)}`
      console.error('[ApiKeyCipher] AES-256-GCM 回退加密失败:', err)
      throw new Error(`[ApiKeyCipher] API Key 加密失败: ${this.lastError}`)
    }
  }

  /**
   * 解密已加密字符串
   */
  public decrypt(cipherText: string): string {
    if (!cipherText || !cipherText.trim()) return ''

    if (cipherText.startsWith('enc:v1:safeStorage:')) {
      const base64 = cipherText.slice('enc:v1:safeStorage:'.length)
      const buffer = Buffer.from(base64, 'base64')

      if (!this.safeStorageBackend) {
        const errMsg = 'safeStorage backend 不可用，无法解密该 safeStorage 凭据'
        this.lastError = errMsg
        throw new Error(`[ApiKeyCipher] ${errMsg}`)
      }

      try {
        const plain = this.safeStorageBackend.decryptString(buffer)
        this.lastUsedMethod = 'safeStorage'
        return plain
      } catch (err) {
        this.lastError = `safeStorage decrypt failed: ${err instanceof Error ? err.message : String(err)}`
        console.error('[ApiKeyCipher] safeStorage 解密失败:', err)
        throw new Error(`[ApiKeyCipher] ${this.lastError}`)
      }
    }

    if (cipherText.startsWith('enc:v1:fallback:')) {
      try {
        const plain = decryptWithFallback(cipherText)
        this.lastUsedMethod = 'fallback'
        return plain
      } catch (err) {
        this.lastError = `fallback decrypt failed: ${err instanceof Error ? err.message : String(err)}`
        console.error('[ApiKeyCipher] AES-256-GCM 回退解密失败:', err)
        throw new Error(`[ApiKeyCipher] ${this.lastError}`)
      }
    }

    throw new Error(`[ApiKeyCipher] 未知或不支持的密文格式: ${cipherText.slice(0, 20)}...`)
  }

  public isEncrypted(str: string): boolean {
    return isEncryptedApiKey(str)
  }

  public getDiagnostics(): CipherDiagnostics {
    return {
      safeStorageAvailable: this.isSafeStorageAvailable(),
      lastUsedMethod: this.lastUsedMethod,
      lastError: this.lastError
    }
  }
}
