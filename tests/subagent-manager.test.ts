import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ConfigStore } from '../src/main/config/store'
import { SubAgentManager } from '../src/main/agent/subagent-manager'
import {
  spawnSubAgentTool,
  awaitSubAgentTool,
  terminateSubAgentTool,
  listSubAgentsTool
} from '../src/main/agent/tools/subagent-tools'
import { AgentRunner } from '../src/main/agent/runner'
import { AgentStreamEvent } from '../src/shared/types/ipc'

describe('SubAgentManager & Narrative State Commit', () => {
  let tempSandboxDir: string
  let configStore: ConfigStore

  beforeEach(() => {
    tempSandboxDir = path.join(
      os.tmpdir(),
      `explosion-subagent-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    )
    fs.mkdirSync(tempSandboxDir, { recursive: true })
    configStore = new ConfigStore(tempSandboxDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true })
    }
  })

  it('spawns a subagent that executes tools independently and releases context upon completion', async () => {
    // Prepare test files in sandbox
    const manuscriptDir = path.join(tempSandboxDir, 'manuscript')
    const storyDir = path.join(tempSandboxDir, 'story')
    fs.mkdirSync(manuscriptDir, { recursive: true })
    fs.mkdirSync(storyDir, { recursive: true })

    const chapterFile = path.join(manuscriptDir, '001-第一章.txt')
    fs.writeFileSync(chapterFile, '暴雨初歇，林巡在城门外拾得半枚带血的青铜兵符，左肩受了箭伤。', 'utf-8')

    let callCount = 0
    const mockLLMAdapter: any = {
      generateStream: vi.fn().mockImplementation(async (_options, requestId, onChunk) => {
        callCount++
        if (callCount === 1) {
          // Sub-agent reads chapter
          const toolCall = {
            id: 'call-read-1',
            type: 'function' as const,
            name: 'read_file',
            arguments: JSON.stringify({ path: 'manuscript/001-第一章.txt' })
          }
          onChunk({ requestId, delta: '', done: true, toolCalls: [toolCall] })
          return { text: '', model: 'mock-model', toolCalls: [toolCall] }
        } else if (callCount === 2) {
          // Sub-agent writes state commit to story/threads.txt
          const toolCall = {
            id: 'call-write-threads',
            type: 'function' as const,
            name: 'write_file',
            arguments: JSON.stringify({
              path: 'story/threads.txt',
              content: '【第一章伏笔与暗线增量】\n1. 获得道具：半枚带血青铜兵符（来源：城门外拾得，未解之谜）。\n2. 角色状态：林巡左肩受箭伤。'
            })
          }
          onChunk({ requestId, delta: '', done: true, toolCalls: [toolCall] })
          return { text: '', model: 'mock-model', toolCalls: [toolCall] }
        } else {
          // Sub-agent concludes
          onChunk({ requestId, delta: '已成功梳理第一章事实增量，并更新暗线账本。', done: true })
          return { text: '已成功梳理第一章事实增量，并更新暗线账本。', model: 'mock-model' }
        }
      })
    }

    const manager = new SubAgentManager({
      llmAdapter: mockLLMAdapter,
      configStore
    })

    const progressUpdates: any[] = []
    const subagent = manager.spawn({
      parentTaskId: 'task-main-001',
      taskName: '叙事状态提交 (State Commit)',
      instruction: '审查第一章手稿的事实增量，并写入 story/threads.txt',
      projectPath: tempSandboxDir,
      onProgress: (info) => progressUpdates.push(info)
    })

    expect(subagent.id).toBeDefined()
    expect(subagent.name).toBe('叙事状态提交 (State Commit)')
    expect(subagent.status).toBe('running')

    // Wait for subagent to finish
    const result = await manager.awaitCompletion(subagent.id, 5000)

    expect(result.status).toBe('completed')
    expect(result.stepsCount).toBe(2)
    expect(result.output).toContain('已成功梳理第一章事实增量')
    expect(result.modifiedFiles.some((f) => f.includes('story/threads.txt'))).toBe(true)

    // Check disk content
    const threadsPath = path.join(storyDir, 'threads.txt')
    expect(fs.existsSync(threadsPath)).toBe(true)
    const savedThreads = fs.readFileSync(threadsPath, 'utf-8')
    expect(savedThreads).toContain('半枚带血青铜兵符')
    expect(savedThreads).toContain('林巡左肩受箭伤')

    // Progress updates should have been fired
    expect(progressUpdates.length).toBeGreaterThan(0)
    const finalProgress = progressUpdates[progressUpdates.length - 1]
    expect(finalProgress.status).toBe('completed')
  })

  it('prohibits subagent from calling disallowed recursive subagent tools', async () => {
    let callCount = 0
    const mockLLMAdapter: any = {
      generateStream: vi.fn().mockImplementation(async (_options, requestId, onChunk) => {
        callCount++
        if (callCount === 1) {
          // Attempting recursive spawn_subagent
          const toolCall = {
            id: 'call-illegal-spawn',
            type: 'function' as const,
            name: 'spawn_subagent',
            arguments: JSON.stringify({ task_name: '非法递归', instruction: '测试' })
          }
          onChunk({ requestId, delta: '', done: true, toolCalls: [toolCall] })
          return { text: '', model: 'mock-model', toolCalls: [toolCall] }
        } else {
          onChunk({ requestId, delta: '执行受阻。', done: true })
          return { text: '执行受阻。', model: 'mock-model' }
        }
      })
    }

    const manager = new SubAgentManager({
      llmAdapter: mockLLMAdapter,
      configStore
    })

    const subagent = manager.spawn({
      parentTaskId: 'task-main-002',
      taskName: '测试权限限制',
      instruction: '尝试派生下层子智能体',
      projectPath: tempSandboxDir
    })

    const result = await manager.awaitCompletion(subagent.id, 5000)
    expect(result.status).toBe('completed')
    // Step should report error about disallowed tool
    const subInst = manager.get(subagent.id)
    expect(subInst?.steps[0].status).toBe('error')
    expect(subInst?.steps[0].error).toContain('未授权或不支持')
  })

  it('supports terminating a subagent prematurely', async () => {
    const mockLLMAdapter: any = {
      generateStream: vi.fn().mockImplementation(async () => {
        // Simulates a very long running call
        await new Promise((resolve) => setTimeout(resolve, 3000))
        return { text: '完成', model: 'mock-model' }
      })
    }

    const manager = new SubAgentManager({
      llmAdapter: mockLLMAdapter,
      configStore
    })

    const subagent = manager.spawn({
      parentTaskId: 'task-main-003',
      taskName: '长时间任务',
      instruction: '推演百万字世界观',
      projectPath: tempSandboxDir
    })

    expect(manager.get(subagent.id)?.status).toBe('running')

    const terminated = manager.terminate(subagent.id)
    expect(terminated).toBe(true)

    const result = await manager.awaitCompletion(subagent.id, 1000)
    expect(result.status).toBe('terminated')
  })

  it('handles subagent timeout gracefully', async () => {
    const mockLLMAdapter: any = {
      generateStream: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return { text: '慢任务', model: 'mock-model' }
      })
    }

    const manager = new SubAgentManager({
      llmAdapter: mockLLMAdapter,
      configStore
    })

    const subagent = manager.spawn({
      parentTaskId: 'task-main-004',
      taskName: '超时测试',
      instruction: '等待',
      projectPath: tempSandboxDir
    })

    // Timeout of 50ms should trigger timeout
    const result = await manager.awaitCompletion(subagent.id, 50)
    expect(result.status).toBe('timeout')
    expect(result.error).toContain('未完成')
  })

  it('provides subagent tools (spawn, await, list, terminate) to the main agent runner', async () => {
    let callCount = 0
    let spawnedId = ''

    const mockLLMAdapter: any = {
      generateStream: vi.fn().mockImplementation(async (_options, requestId, onChunk) => {
        callCount++
        if (callCount === 1) {
          // Main agent calls spawn_subagent tool
          const toolCall = {
            id: 'call-spawn-1',
            type: 'function' as const,
            name: 'spawn_subagent',
            arguments: JSON.stringify({
              task_name: '梳理暗线',
              instruction: '分析第一章'
            })
          }
          onChunk({ requestId, delta: '', done: true, toolCalls: [toolCall] })
          return { text: '', model: 'mock-model', toolCalls: [toolCall] }
        } else if (callCount === 2) {
          // Main agent calls list_subagents tool
          const toolCall = {
            id: 'call-list-1',
            type: 'function' as const,
            name: 'list_subagents',
            arguments: '{}'
          }
          onChunk({ requestId, delta: '', done: true, toolCalls: [toolCall] })
          return { text: '', model: 'mock-model', toolCalls: [toolCall] }
        } else if (callCount === 3) {
          // Main agent calls await_subagent tool
          const toolCall = {
            id: 'call-await-1',
            type: 'function' as const,
            name: 'await_subagent',
            arguments: JSON.stringify({ subagent_id: spawnedId })
          }
          onChunk({ requestId, delta: '', done: true, toolCalls: [toolCall] })
          return { text: '', model: 'mock-model', toolCalls: [toolCall] }
        } else {
          onChunk({ requestId, delta: '主任务已协调 Sub-agent 完结全流程。', done: true })
          return { text: '主任务已协调 Sub-agent 完结全流程。', model: 'mock-model' }
        }
      })
    }

    const subMockLLMAdapter: any = {
      generateStream: vi.fn().mockImplementation(async () => {
        return { text: '子任务已就绪并归纳完毕。', model: 'mock-model' }
      })
    }

    const manager = new SubAgentManager({
      llmAdapter: subMockLLMAdapter,
      configStore
    })

    const runner = new AgentRunner({
      llmAdapter: mockLLMAdapter,
      configStore,
      subagentManager: manager
    })

    const events: AgentStreamEvent[] = []
    await runner.runTask(
      'main-e2e-task',
      {
        userPrompt: '写完第一章，请派生子任务更新暗线并等待完成',
        projectPath: tempSandboxDir
      },
      (ev) => {
        events.push(ev)
        if (ev.type === 'tool_result' && ev.toolResult?.name === 'spawn_subagent') {
          // Extract spawned subagent id from tool result
          const match = ev.toolResult.result.match(/subagent-\d+-[a-z0-9]+/i)
          if (match) {
            spawnedId = match[0]
          }
        }
      }
    )

    expect(spawnedId).toBeTruthy()
    expect(events.some((e) => e.type === 'subagent_update')).toBe(true)
    const awaitResultEvent = events.find(
      (e) => e.type === 'tool_result' && e.toolResult?.name === 'await_subagent'
    )
    expect(awaitResultEvent?.toolResult?.result).toContain('Sub-agent 任务完成')
  })
})
