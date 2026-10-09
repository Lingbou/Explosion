import { LLMAdapter, globalLLMAdapter } from '../llm/adapter'
import { ConfigStore, globalConfigStore } from '../config/store'
import { SubAgentTaskInfo, SubAgentStepInfo } from '../../shared/types/ipc'
import { LLMMessage } from '../../shared/types/llm'
import { buildSubAgentSystemPrompt } from './prompts'
import { findAgentTool, AGENT_TOOLS } from './tools'
import { resolveToolCallIntent } from './runner'
import { agentToolToDefinition } from './tools/types'

export interface SubAgentSpawnOptions {
  parentTaskId: string
  taskName: string
  instruction: string
  contextFiles?: string[]
  projectPath?: string | null
  activeChapterFilename?: string | null
  onProgress?: (taskInfo: SubAgentTaskInfo) => void
  onFileModified?: (filePath: string, content: string) => void
}

export interface SubAgentAwaitResult {
  subagentId: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'terminated' | 'timeout'
  durationMs: number
  stepsCount: number
  output: string
  modifiedFiles: string[]
  error?: string
}

export interface SubAgentInstance {
  id: string
  parentTaskId: string
  name: string
  instruction: string
  contextFiles?: string[]
  status: 'running' | 'completed' | 'failed' | 'terminated'
  startTime: number
  endTime?: number
  durationMs?: number
  steps: SubAgentStepInfo[]
  output?: string
  modifiedFiles: string[]
  error?: string
  abortController: AbortController
  promise: Promise<void>
}

// Sub-agent 工具白名单（严禁包含 subagent 自身派生工具，杜绝死循环递归）
const SUBAGENT_DISALLOWED_TOOLS = [
  'spawn_subagent',
  'await_subagent',
  'terminate_subagent',
  'list_subagents'
]

export class SubAgentManager {
  private instances = new Map<string, SubAgentInstance>()

  constructor(
    private options?: {
      llmAdapter?: LLMAdapter
      configStore?: ConfigStore
      maxTurns?: number
    }
  ) {}

  private getLLMAdapter(): LLMAdapter {
    return this.options?.llmAdapter || globalLLMAdapter
  }

  private getConfigStore(): ConfigStore {
    return this.options?.configStore || globalConfigStore
  }

  public toTaskInfo(instance: SubAgentInstance): SubAgentTaskInfo {
    return {
      id: instance.id,
      parentTaskId: instance.parentTaskId,
      name: instance.name,
      instruction: instance.instruction,
      status: instance.status,
      stepsCount: instance.steps.length,
      durationMs: instance.durationMs ?? (Date.now() - instance.startTime),
      startTime: instance.startTime,
      endTime: instance.endTime,
      output: instance.output,
      modifiedFiles: [...instance.modifiedFiles],
      steps: [...instance.steps],
      error: instance.error
    }
  }

  public spawn(options: SubAgentSpawnOptions): SubAgentTaskInfo {
    const subagentId = `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const abortController = new AbortController()

    let resolvePromise: () => void = () => {}
    const completionPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    const instance: SubAgentInstance = {
      id: subagentId,
      parentTaskId: options.parentTaskId,
      name: options.taskName,
      instruction: options.instruction,
      contextFiles: options.contextFiles,
      status: 'running',
      startTime: Date.now(),
      steps: [],
      modifiedFiles: [],
      abortController,
      promise: completionPromise
    }

    this.instances.set(subagentId, instance)

    // 启动后台独立异步 ReAct 循环
    this.executeSubAgentLoop(instance, options)
      .catch((err) => {
        instance.status = 'failed'
        instance.error = err instanceof Error ? err.message : String(err)
        instance.endTime = Date.now()
        instance.durationMs = instance.endTime - instance.startTime
      })
      .finally(() => {
        resolvePromise()
        options.onProgress?.(this.toTaskInfo(instance))
      })

    // 初始状态触发一次回调
    options.onProgress?.(this.toTaskInfo(instance))
    return this.toTaskInfo(instance)
  }

  private async executeSubAgentLoop(
    instance: SubAgentInstance,
    options: SubAgentSpawnOptions
  ): Promise<void> {
    const signal = instance.abortController.signal
    const llmAdapter = this.getLLMAdapter()
    const maxTurns = this.options?.maxTurns || 8

    // 1. 组装干净隔离的 System Prompt
    const subPrompt = buildSubAgentSystemPrompt({
      taskName: options.taskName,
      instruction: options.instruction,
      projectPath: options.projectPath,
      contextFiles: options.contextFiles
    })

    // 2. 准备子智能体独立工具集（过滤掉派生工具）
    const allowedTools = AGENT_TOOLS.filter((t) => !SUBAGENT_DISALLOWED_TOOLS.includes(t.name))
    const toolDefinitions = allowedTools.map(agentToolToDefinition)

    // 3. 构建独立纯净的会话历史（执行完毕后即释放）
    let messages: LLMMessage[] = [
      {
        role: 'system',
        content: subPrompt
      },
      {
        role: 'user',
        content: options.instruction
      }
    ]

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        if (signal.aborted) {
          instance.status = 'terminated'
          instance.error = '子任务已被主动终止'
          break
        }

        const requestId = `${instance.id}-turn-${turn}`
        const generateResult = await llmAdapter.generateStream(
          {
            messages,
            tools: toolDefinitions,
            temperature: 0.5
          },
          requestId,
          () => {} // Sub-agent 内部 token 流不向主界面无意义倾倒
        )

        if (signal.aborted) {
          instance.status = 'terminated'
          instance.error = '子任务已被主动终止'
          break
        }

        const toolCalls = generateResult.toolCalls
        if (!toolCalls || toolCalls.length === 0) {
          // 子任务已自决完成
          instance.status = 'completed'
          instance.output = (generateResult.text || '').trim() || '子任务执行完毕。'
          break
        }

        messages.push({
          role: 'assistant',
          content: generateResult.text || null,
          tool_calls: toolCalls
        })

        // 顺序执行子任务调用的真实工具
        for (const tc of toolCalls) {
          if (signal.aborted) {
            instance.status = 'terminated'
            instance.error = '子任务已被主动终止'
            break
          }

          const { name: resolvedName, args: resolvedArgs } = resolveToolCallIntent(
            tc.name,
            tc.arguments
          )

          const step: SubAgentStepInfo = {
            id: tc.id,
            toolName: resolvedName,
            args: resolvedArgs,
            status: 'running',
            timestamp: Date.now()
          }

          instance.steps.push(step)
          options.onProgress?.(this.toTaskInfo(instance))

          const startTime = performance.now()
          const tool = findAgentTool(resolvedName)
          let resultText = ''
          let toolError: string | undefined

          if (!tool || SUBAGENT_DISALLOWED_TOOLS.includes(resolvedName)) {
            resultText = `执行失败: 子智能体未授权或不支持工具 "${resolvedName}"`
            toolError = resultText
          } else {
            try {
              resultText = await tool.execute(resolvedArgs, {
                projectPath: options.projectPath,
                activeChapterFilename: options.activeChapterFilename,
                onFileModified: (filePath, fileContent) => {
                  if (!instance.modifiedFiles.includes(filePath)) {
                    instance.modifiedFiles.push(filePath)
                  }
                  options.onFileModified?.(filePath, fileContent)
                }
              })
            } catch (err) {
              resultText = `工具执行发生异常: ${err instanceof Error ? err.message : String(err)}`
              toolError = resultText
            }
          }

          const durationMs = Math.round(performance.now() - startTime)
          step.status = toolError ? 'error' : 'success'
          step.result = resultText
          step.error = toolError
          step.durationMs = durationMs

          options.onProgress?.(this.toTaskInfo(instance))

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: resultText
          })
        }
      }

      if (instance.status === 'running') {
        instance.status = 'completed'
        instance.output = instance.output || '子任务达到最大步骤并完成。'
      }
    } finally {
      // 释放内存与会话历史，杜绝上下文泄漏与堆积
      messages = []
      instance.endTime = Date.now()
      instance.durationMs = instance.endTime - instance.startTime
    }
  }

  public async awaitCompletion(subagentId: string, timeoutMs: number = 60000): Promise<SubAgentAwaitResult> {
    const instance = this.instances.get(subagentId)
    if (!instance) {
      return {
        subagentId,
        name: '未知任务',
        status: 'failed',
        durationMs: 0,
        stepsCount: 0,
        output: '',
        modifiedFiles: [],
        error: `未找到 ID 为 "${subagentId}" 的子任务`
      }
    }

    if (instance.status !== 'running') {
      return {
        subagentId: instance.id,
        name: instance.name,
        status: instance.status,
        durationMs: instance.durationMs || (Date.now() - instance.startTime),
        stepsCount: instance.steps.length,
        output: instance.output || '',
        modifiedFiles: instance.modifiedFiles,
        error: instance.error
      }
    }

    let isTimedOut = false
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      const timer = setTimeout(() => {
        isTimedOut = true
        resolve('timeout')
      }, timeoutMs)
      instance.promise.finally(() => clearTimeout(timer))
    })

    const outcome = await Promise.race([instance.promise, timeoutPromise])

    if (outcome === 'timeout' || isTimedOut) {
      return {
        subagentId: instance.id,
        name: instance.name,
        status: 'timeout',
        durationMs: Date.now() - instance.startTime,
        stepsCount: instance.steps.length,
        output: instance.output || '[等待超时]',
        modifiedFiles: instance.modifiedFiles,
        error: `子任务在 ${timeoutMs}ms 内未完成`
      }
    }

    return {
      subagentId: instance.id,
      name: instance.name,
      status: instance.status,
      durationMs: instance.durationMs || (Date.now() - instance.startTime),
      stepsCount: instance.steps.length,
      output: instance.output || '',
      modifiedFiles: instance.modifiedFiles,
      error: instance.error
    }
  }

  public terminate(subagentId: string): boolean {
    const instance = this.instances.get(subagentId)
    if (!instance) return false

    if (instance.status === 'running') {
      instance.abortController.abort()
      instance.status = 'terminated'
      instance.endTime = Date.now()
      instance.durationMs = instance.endTime - instance.startTime
      instance.error = '已被强制终止'
      return true
    }
    return false
  }

  public list(parentTaskId?: string): SubAgentTaskInfo[] {
    const list: SubAgentTaskInfo[] = []
    for (const inst of this.instances.values()) {
      if (!parentTaskId || inst.parentTaskId === parentTaskId) {
        list.push(this.toTaskInfo(inst))
      }
    }
    return list
  }

  public get(subagentId: string): SubAgentTaskInfo | undefined {
    const inst = this.instances.get(subagentId)
    return inst ? this.toTaskInfo(inst) : undefined
  }

  public release(parentTaskId: string): void {
    for (const [id, inst] of this.instances.entries()) {
      if (inst.parentTaskId === parentTaskId) {
        if (inst.status === 'running') {
          inst.abortController.abort()
        }
        this.instances.delete(id)
      }
    }
  }
}

export const globalSubAgentManager = new SubAgentManager()
