import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn()
  },
  shell: {
    openPath: vi.fn()
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
    getAllWindows: vi.fn(() => [])
  }
}))

import { AgentRunner, resolveToolCallIntent } from '../src/main/agent/runner'
import { ConfigStore } from '../src/main/config/store'
import { LLMAdapter } from '../src/main/llm/adapter'
import { AgentStreamEvent } from '../src/shared/types/ipc'

describe('AgentRunner Autonomous Loop', () => {
  let tempSandboxDir: string
  let tempConfigDir: string
  let testConfigStore: ConfigStore

  beforeEach(() => {
    tempSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-runner-test-'))
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-runner-cfg-'))
    testConfigStore = new ConfigStore(tempConfigDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true })
    }
    if (fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })

  describe('resolveToolCallIntent (Auto-Healing)', () => {
    it('auto-heals tool calls where rawName is a JSON path string', () => {
      const resolved = resolveToolCallIntent('{"path":"manuscript/001-第一章.txt"}', '')
      expect(resolved.name).toBe('read_file')
      expect(resolved.args.path).toBe('manuscript/001-第一章.txt')
    })

    it('auto-heals tool calls where rawName contains command to exec_command', () => {
      const resolved = resolveToolCallIntent('{"command":"python3 script.py"}', '')
      expect(resolved.name).toBe('exec_command')
      expect(resolved.args.command).toBe('python3 script.py')
    })

    it('strips functions. and tools. prefixes', () => {
      const resolved = resolveToolCallIntent('functions.web_search', JSON.stringify({ query: '九州' }))
      expect(resolved.name).toBe('web_search')
      expect(resolved.args.query).toBe('九州')
    })

    it('extracts tool name from JSON payload inside rawName', () => {
      const resolved = resolveToolCallIntent('{"name":"list_dir","path":"."}', '')
      expect(resolved.name).toBe('list_dir')
      expect(resolved.args.path).toBe('.')
    })
  })

  it('executes a multi-turn ReAct loop with real disk write_file tool call and completes', async () => {
    let callCount = 0

    const mockLLMAdapter = {
      generateStream: vi.fn().mockImplementation(async (options, requestId, onChunk) => {
        callCount++
        if (callCount === 1) {
          // First turn: LLM decides to call write_file tool
          const toolCall = {
            id: 'call-write-1',
            type: 'function' as const,
            name: 'write_file',
            arguments: JSON.stringify({
              path: 'manuscript/001-第一章.txt',
              content: '暴雨倾盆，南淮城外的古道上一匹黑马疾驰而来。'
            })
          }
          onChunk({
            requestId,
            delta: '',
            done: true,
            toolCalls: [toolCall]
          })
          return {
            text: '',
            model: 'mock-model',
            toolCalls: [toolCall]
          }
        } else {
          // Second turn: LLM reports completion after seeing tool execution result
          onChunk({
            requestId,
            delta: '已直接在磁盘上手稿第一章完成撰写并保存。',
            done: true
          })
          return {
            text: '已直接在磁盘上手稿第一章完成撰写并保存。',
            model: 'mock-model'
          }
        }
      })
    } as unknown as LLMAdapter

    const runner = new AgentRunner({
      llmAdapter: mockLLMAdapter,
      configStore: testConfigStore,
      maxTurns: 5
    })

    const events: AgentStreamEvent[] = []
    const taskId = 'task-test-1'

    await runner.runTask(
      taskId,
      {
        userPrompt: '请帮我写第一章开头并直接写入手稿文件',
        projectPath: tempSandboxDir,
        activeChapterFilename: '001-第一章.txt'
      },
      (ev) => {
        events.push(ev)
      }
    )

    // Verify LLM was called 2 times
    expect(callCount).toBe(2)

    // Verify file was written to disk!
    const targetFile = path.join(tempSandboxDir, 'manuscript', '001-第一章.txt')
    expect(fs.existsSync(targetFile)).toBe(true)
    const content = fs.readFileSync(targetFile, 'utf-8')
    expect(content).toBe('暴雨倾盆，南淮城外的古道上一匹黑马疾驰而来。')

    // Verify event trajectory
    const eventTypes = events.map((e) => e.type)
    expect(eventTypes).toContain('tool_start')
    expect(eventTypes).toContain('tool_result')
    expect(eventTypes).toContain('done')

    const toolStartEvent = events.find((e) => e.type === 'tool_start')
    expect(toolStartEvent?.toolCall?.name).toBe('write_file')

    const toolResultEvent = events.find((e) => e.type === 'tool_result')
    expect(toolResultEvent?.toolResult?.name).toBe('write_file')
    expect(toolResultEvent?.toolResult?.result).toContain('已成功写入文件')
  })

  it('auto-heals and executes tool call when model sends JSON string in tool name', async () => {
    // Write a test chapter first
    const chapterDir = path.join(tempSandboxDir, 'manuscript')
    fs.mkdirSync(chapterDir, { recursive: true })
    fs.writeFileSync(path.join(chapterDir, '001-第一章.txt'), '这是旧章节正文。', 'utf-8')

    let callCount = 0
    const mockLLMAdapter = {
      generateStream: vi.fn().mockImplementation(async (options, requestId, onChunk) => {
        callCount++
        if (callCount === 1) {
          // Model sends JSON as tool name!
          const toolCall = {
            id: 'call-malformed-json-name',
            type: 'function' as const,
            name: JSON.stringify({ path: path.join(tempSandboxDir, 'manuscript/001-第一章.txt') }),
            arguments: ''
          }
          onChunk({
            requestId,
            delta: '',
            done: true,
            toolCalls: [toolCall]
          })
          return {
            text: '',
            model: 'mock-model',
            toolCalls: [toolCall]
          }
        } else {
          onChunk({
            requestId,
            delta: '已成功读取该章节。',
            done: true
          })
          return {
            text: '已成功读取该章节。',
            model: 'mock-model'
          }
        }
      })
    } as unknown as LLMAdapter

    const runner = new AgentRunner({
      llmAdapter: mockLLMAdapter,
      configStore: testConfigStore,
      maxTurns: 5
    })

    const events: AgentStreamEvent[] = []
    await runner.runTask(
      'task-auto-heal-test',
      {
        userPrompt: '查看手稿第一章',
        projectPath: tempSandboxDir
      },
      (ev) => {
        events.push(ev)
      }
    )

    expect(callCount).toBe(2)

    // Verify tool_start had the auto-healed tool name 'read_file'
    const toolStart = events.find((e) => e.type === 'tool_start')
    expect(toolStart?.toolCall?.name).toBe('read_file')
    expect(toolStart?.toolCall?.args.path).toContain('001-第一章.txt')

    // Verify tool_result succeeded with content
    const toolResult = events.find((e) => e.type === 'tool_result')
    expect(toolResult?.toolResult?.name).toBe('read_file')
    expect(toolResult?.toolResult?.result).toContain('这是旧章节正文。')
    expect(toolResult?.toolResult?.error).toBeUndefined()
  })

  it('terminates gracefully when aborted', async () => {
    const mockLLMAdapter = {
      generateStream: vi.fn().mockImplementation(async (_options, _requestId, _onChunk) => {
        await new Promise((r) => setTimeout(r, 100))
        return { text: '完成', model: 'mock-model' }
      })
    } as unknown as LLMAdapter

    const runner = new AgentRunner({
      llmAdapter: mockLLMAdapter,
      configStore: testConfigStore,
      maxTurns: 5
    })

    const events: AgentStreamEvent[] = []
    const taskId = 'task-abort-test'

    const promise = runner.runTask(
      taskId,
      {
        userPrompt: '慢慢写',
        projectPath: tempSandboxDir
      },
      (ev) => {
        events.push(ev)
      }
    )

    runner.abortTask(taskId)
    await promise

    const hasErrorOrAborted = events.some((e) => e.type === 'error' && e.error?.includes('终止'))
    expect(hasErrorOrAborted).toBe(true)
  })
})
