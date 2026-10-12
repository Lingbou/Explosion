import { describe, it, expect, vi } from 'vitest'
import {
  ApiKeyCipher,
  maskApiKey,
  isMaskedApiKey,
  isEncryptedApiKey,
  SafeStorageBackend
} from '../src/main/config/crypto'

describe('ApiKeyCipher and Masking Utilities', () => {
  describe('maskApiKey', () => {
    it('masks sk- style API keys preserving prefix and last 4 characters', () => {
      expect(maskApiKey('sk-ant-api03-12345678')).toBe('sk-****5678')
      expect(maskApiKey('sk-1234abcd')).toBe('sk-****abcd')
      expect(maskApiKey('sk-1234567890')).toBe('sk-****7890')
    })

    it('masks arbitrary keys longer than 8 characters', () => {
      expect(maskApiKey('custom-key-9999')).toBe('cus****9999')
      expect(maskApiKey('deepseek-prod-api-key')).toBe('dee****-key')
    })

    it('masks short keys with length <= 8 as ****', () => {
      expect(maskApiKey('sk-short')).toBe('****')
      expect(maskApiKey('12345678')).toBe('****')
      expect(maskApiKey('123')).toBe('****')
    })

    it('returns empty string for empty or whitespace-only keys', () => {
      expect(maskApiKey('')).toBe('')
      expect(maskApiKey('   ')).toBe('')
      expect(maskApiKey(undefined)).toBe('')
    })
  })

  describe('isMaskedApiKey and isEncryptedApiKey', () => {
    it('detects masked keys accurately', () => {
      expect(isMaskedApiKey('sk-****abcd')).toBe(true)
      expect(isMaskedApiKey('cus****9999')).toBe(true)
      expect(isMaskedApiKey('****')).toBe(true)
      expect(isMaskedApiKey('sk-real-secret-1234')).toBe(false)
      expect(isMaskedApiKey('')).toBe(false)
      expect(isMaskedApiKey(undefined)).toBe(false)
    })

    it('detects encrypted disk payload prefix', () => {
      expect(isEncryptedApiKey('enc:v1:safeStorage:AQAA...')).toBe(true)
      expect(isEncryptedApiKey('enc:v1:fallback:iv:tag:ciphertext')).toBe(true)
      expect(isEncryptedApiKey('sk-real-plain-key')).toBe(false)
      expect(isEncryptedApiKey('')).toBe(false)
      expect(isEncryptedApiKey(undefined)).toBe(false)
    })
  })

  describe('Electron safeStorage Backend Integration', () => {
    const createMockSafeStorage = (): SafeStorageBackend => {
      return {
        isEncryptionAvailable: vi.fn(() => true),
        encryptString: vi.fn((plain: string) => Buffer.from(`mock-safe:${plain}`, 'utf-8')),
        decryptString: vi.fn((buf: Buffer) => {
          const str = buf.toString('utf-8')
          if (!str.startsWith('mock-safe:')) {
            throw new Error('OS Keychain decrypt failed')
          }
          return str.slice('mock-safe:'.length)
        })
      }
    }

    it('encrypts using safeStorage when available and formats as base64', () => {
      const mockBackend = createMockSafeStorage()
      const cipher = new ApiKeyCipher(mockBackend)

      expect(cipher.isSafeStorageAvailable()).toBe(true)
      const encrypted = cipher.encrypt('sk-real-deepseek-key')

      expect(encrypted.startsWith('enc:v1:safeStorage:')).toBe(true)
      const base64Part = encrypted.slice('enc:v1:safeStorage:'.length)
      const decodedBuf = Buffer.from(base64Part, 'base64')
      expect(decodedBuf.toString('utf-8')).toBe('mock-safe:sk-real-deepseek-key')

      // Roundtrip decrypt
      const decrypted = cipher.decrypt(encrypted)
      expect(decrypted).toBe('sk-real-deepseek-key')
      expect(cipher.getDiagnostics().lastUsedMethod).toBe('safeStorage')
    })

    it('diagnoses safeStorage decryption failure with descriptive error', () => {
      const mockBackend = createMockSafeStorage()
      const cipher = new ApiKeyCipher(mockBackend)

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const corruptedCipher = 'enc:v1:safeStorage:' + Buffer.from('corrupted-data').toString('base64')
      expect(() => cipher.decrypt(corruptedCipher)).toThrowError(/safeStorage decrypt failed/)
      expect(cipher.getDiagnostics().lastError).toContain('safeStorage decrypt failed')
      errorSpy.mockRestore()
    })

    it('gracefully falls back to AES-256-GCM if safeStorage.encryptString throws', () => {
      const failingBackend: SafeStorageBackend = {
        isEncryptionAvailable: () => true,
        encryptString: () => {
          throw new Error('GNOME Keyring daemon locked')
        },
        decryptString: () => 'noop'
      }

      const cipher = new ApiKeyCipher(failingBackend)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const encrypted = cipher.encrypt('sk-test-fallback-after-error')
      expect(encrypted.startsWith('enc:v1:fallback:')).toBe(true)
      expect(cipher.getDiagnostics().lastUsedMethod).toBe('fallback')
      expect(cipher.getDiagnostics().lastError).toContain('GNOME Keyring daemon locked')

      // Can be decrypted by fallback
      const decrypted = cipher.decrypt(encrypted)
      expect(decrypted).toBe('sk-test-fallback-after-error')
      warnSpy.mockRestore()
    })
  })

  describe('Fallback AES-256-GCM Mode (safeStorage unavailable)', () => {
    it('uses machine-bound AES-256-GCM encryption when safeStorage is unavailable', () => {
      const cipher = new ApiKeyCipher(null)
      expect(cipher.isSafeStorageAvailable()).toBe(false)

      const rawKey = 'sk-linux-headless-key-99999'
      const encrypted = cipher.encrypt(rawKey)

      expect(encrypted.startsWith('enc:v1:fallback:')).toBe(true)
      const parts = encrypted.split(':')
      expect(parts.length).toBe(6) // enc, v1, fallback, iv, tag, ciphertext
      expect(parts[3].length).toBe(24) // 12 bytes hex
      expect(parts[4].length).toBe(32) // 16 bytes hex

      // Decryption roundtrip
      const decrypted = cipher.decrypt(encrypted)
      expect(decrypted).toBe(rawKey)
      expect(cipher.getDiagnostics().lastUsedMethod).toBe('fallback')
    })

    it('throws descriptive diagnostic error on tampered fallback ciphertext', () => {
      const cipher = new ApiKeyCipher(null)
      const rawKey = 'sk-secret-payload'
      const encrypted = cipher.encrypt(rawKey)
      const parts = encrypted.split(':')
      // Tamper ciphertext
      parts[5] = Buffer.from('tampered').toString('base64')
      const tampered = parts.join(':')

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => cipher.decrypt(tampered)).toThrowError(/回退解密失败|fallback decrypt failed/)
      expect(cipher.getDiagnostics().lastError).toBeDefined()
      errorSpy.mockRestore()
    })

    it('returns empty string for empty encryption payload', () => {
      const cipher = new ApiKeyCipher(null)
      expect(cipher.encrypt('')).toBe('')
      expect(cipher.encrypt('   ')).toBe('')
      expect(cipher.decrypt('')).toBe('')
    })
  })
})
