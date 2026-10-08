import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  execCommandTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  webSearchTool,
  webExtractTool,
  decodeBuffer,
  resolveFilePath
} from '../src/main/agent/tools'

describe('Agent Tools', () => {
  let tempSandboxDir: string

  beforeEach(() => {
    tempSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-agent-tools-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true })
    }
  })

  describe('decodeBuffer', () => {
    it('decodes UTF-8 strings correctly', () => {
      const original = '这是 UTF-8 测试文本，包含中文与英文 English。'
      const buf = Buffer.from(original, 'utf-8')
      expect(decodeBuffer(buf)).toBe(original)
    })

    it('decodes GB18030/GBK strings correctly', () => {
      // Create a valid GBK byte sequence using Node.js TextEncoder/Decoder or specific GBK bytes
      // "中文" in GBK is [0xd6, 0xd0, 0xce, 0xc4]
      const gbkBuf = Buffer.from([0xd6, 0xd0, 0xce, 0xc4])
      const decoded = decodeBuffer(gbkBuf)
      expect(decoded).toBe('中文')
    })
  })

  describe('resolveFilePath', () => {
    it('resolves relative paths against projectPath', () => {
      const resolved = resolveFilePath('manuscript/001-第一章.txt', tempSandboxDir)
      expect(resolved).toBe(path.join(tempSandboxDir, 'manuscript/001-第一章.txt'))
    })

    it('expands ~ to home directory', () => {
      const resolved = resolveFilePath('~/.explosion/test.txt')
      expect(resolved).toBe(path.join(os.homedir(), '.explosion/test.txt'))
    })
  })

  describe('exec_command', () => {
    it('executes a basic shell command and returns exitCode and stdout', async () => {
      const result = await execCommandTool.execute(
        { command: 'echo "Explosion Shell Test"', cwd: tempSandboxDir },
        { projectPath: tempSandboxDir }
      )

      expect(result).toContain('[命令退出码: 0]')
      expect(result).toContain('Explosion Shell Test')
    })

    it('captures exit code and stderr on failing command', async () => {
      const result = await execCommandTool.execute(
        { command: 'ls /non_existent_directory_for_explosion_test_xyz', cwd: tempSandboxDir },
        { projectPath: tempSandboxDir }
      )

      expect(result).toContain('[命令退出码:')
      expect(result).not.toContain('[命令退出码: 0]')
    })
  })

  describe('file tools (read_file, write_file, edit_file, list_dir)', () => {
    it('writes and reads files on disk, triggering onFileModified callback', async () => {
      let modifiedPath = ''
      let modifiedContent = ''

      const writeRes = await writeFileTool.execute(
        { path: 'manuscript/001-第一章.txt', content: '暴雨倾盆，南淮城外的古道上一匹黑马疾驰而来。' },
        {
          projectPath: tempSandboxDir,
          onFileModified: (p, c) => {
            modifiedPath = p
            modifiedContent = c
          }
        }
      )

      expect(writeRes).toContain('已成功写入文件')
      expect(modifiedPath).toBe(path.join(tempSandboxDir, 'manuscript/001-第一章.txt'))
      expect(modifiedContent).toContain('南淮城外的古道上')

      // Read back
      const readRes = await readFileTool.execute(
        { path: 'manuscript/001-第一章.txt' },
        { projectPath: tempSandboxDir }
      )

      expect(readRes).toContain('暴雨倾盆')
    })

    it('edits file in place with precise replacement', async () => {
      const filePath = path.join(tempSandboxDir, 'test.txt')
      fs.writeFileSync(filePath, '少年拔出了腰间的铁剑，眼神冷漠。', 'utf-8')

      const editRes = await editFileTool.execute(
        { path: 'test.txt', old_str: '铁剑', new_str: '影月长刀' },
        { projectPath: tempSandboxDir }
      )

      expect(editRes).toContain('已成功在文件')
      const updated = fs.readFileSync(filePath, 'utf-8')
      expect(updated).toBe('少年拔出了腰间的影月长刀，眼神冷漠。')
    })

    it('lists directory tree cleanly', async () => {
      fs.mkdirSync(path.join(tempSandboxDir, 'manuscript'), { recursive: true })
      fs.writeFileSync(path.join(tempSandboxDir, 'manuscript', '001-第一章.txt'), '内容', 'utf-8')

      const listRes = await listDirTool.execute(
        { path: tempSandboxDir, recursive: true },
        { projectPath: tempSandboxDir }
      )

      expect(listRes).toContain('manuscript')
      expect(listRes).toContain('001-第一章.txt')
    })
  })

  describe('web tools (web_search, web_extract)', () => {
    it('handles web search and formats results', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            results: [
              {
                title: '九州历史考据',
                url: 'https://example.com/jiuzhou',
                content: '九州设定包括青阳、东陆与羽族...'
              }
            ]
          }
        })
      })

      vi.stubGlobal('fetch', mockFetch)

      const result = await webSearchTool.execute({ query: '九州 设定', max_results: 3 }, {})
      expect(result).toContain('AnySearch 实时搜索结果')
      expect(result).toContain('九州历史考据')
      expect(result).toContain('https://example.com/jiuzhou')

      vi.unstubAllGlobals()
    })

    it('handles web extract and formats content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            title: '九州缥缈录设定集',
            url: 'https://example.com/doc',
            content: '这是网页的正文内容。'
          }
        })
      })

      vi.stubGlobal('fetch', mockFetch)

      const result = await webExtractTool.execute({ url: 'https://example.com/doc' }, {})
      expect(result).toContain('九州缥缈录设定集')
      expect(result).toContain('这是网页的正文内容。')

      vi.unstubAllGlobals()
    })
  })
})
