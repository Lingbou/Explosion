import { BrowserWindow } from 'electron'
import path from 'path'
import {
  AgentStreamEvent,
  AgentTaskOptions,
  IPC_CHANNELS,
  ProjectFileChangedPayload
} from '../../shared/types/ipc'
import { LLMMessage, ToolCall } from '../../shared/types/llm'
import { globalLLMAdapter, LLMAdapter } from '../llm/adapter'
import { globalConfigStore, ConfigStore } from '../config/store'
import { AGENT_TOOL_DEFINITIONS, findAgentTool } from './tools'
import { buildAgentSystemPrompt } from './prompts'

export interface AgentRunnerOptions {
  llmAdapter?: LLMAdapter
  configStore?: ConfigStore
  maxTurns?: number
}

export class AgentRunner {
  private activeAbortControllers = new Map<string, AbortController>()

  constructor(private options?: AgentRunnerOptions) {}

  private getLLMAdapter(): LLMAdapter {
    return this.options?.llmAdapter || globalLLMAdapter
  }

  private getConfigStore(): ConfigStore {
    return this.options?.configStore || globalConfigStore
  }

  public abortTask(taskId: string): boolean {
    const controller = this.activeAbortControllers.get(taskId)
    if (controller) {
      controller.abort()
      this.activeAbortControllers.delete(taskId)
      return true
    }
    return false
  }

  private broadcastFileChange(filePath: string, content: string, projectPath?: string | null): void {
    const filename = path.basename(filePath)
    const payload: ProjectFileChangedPayload = {
      projectPath: projectPath || path.dirname(filePath),
      filePath,
      filename,
      content
    }

    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.PROJECT_FILE_CHANGED, payload)
      }
    }
  }

  public async runTask(
    taskId: string,
    taskOptions: AgentTaskOptions,
    onEvent: (event: AgentStreamEvent) => void
  ): Promise<void> {
    const controller = new AbortController()
    this.activeAbortControllers.set(taskId, controller)
    const signal = controller.signal

    const llmAdapter = this.getLLMAdapter()
    const config = this.getConfigStore().getConfig()
    const maxTurns = this.options?.maxTurns || 15

    const systemPrompt = buildAgentSystemPrompt({
      projectPath: taskOptions.projectPath,
      activeChapterFilename: taskOptions.activeChapterFilename,
      manuscriptContext: taskOptions.manuscriptContext,
      libraryPath: config.workspace.libraryPath
    })

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ]

    if (taskOptions.manuscriptContext?.trim()) {
      messages.push({
        role: 'user',
        content: `【当前正在编辑的手稿参考】:\n${taskOptions.manuscriptContext.slice(0, 4000)}\n\n【用户指令】:\n${taskOptions.userPrompt.trim()}`
      })
    } else {
      messages.push({
        role: 'user',
        content: taskOptions.userPrompt.trim()
      })
    }

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        if (signal.aborted) {
          onEvent({
            taskId,
            type: 'error',
            error: '任务已被用户主动终止',
            done: true
          })
          return
        }

        const turnRequestId = `${taskId}-turn-${turn}`

        const generateResult = await llmAdapter.generateStream(
          {
            messages,
            tools: AGENT_TOOL_DEFINITIONS,
            temperature: 0.7
          },
          turnRequestId,
          (chunk) => {
            if (signal.aborted) return

            if (chunk.reasoningDelta) {
              onEvent({
                taskId,
                type: 'thinking',
                thinkingDelta: chunk.reasoningDelta
              })
            }
            if (chunk.delta) {
              onEvent({
                taskId,
                type: 'delta',
                delta: chunk.delta
              })
            }
          }
        )

        if (signal.aborted) {
          onEvent({
            taskId,
            type: 'error',
            error: '任务已被用户主动终止',
            done: true
          })
          return
        }

        const toolCalls = generateResult.toolCalls
        if (!toolCalls || toolCalls.length === 0) {
          // No more tool calls; autonomous agent loop completed!
          onEvent({
            taskId,
            type: 'done',
            done: true
          })
          return
        }

        // LLM called tools: Record assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: generateResult.text || null,
          tool_calls: toolCalls
        })

        // Execute each tool sequentially
        for (const tc of toolCalls) {
          if (signal.aborted) {
            onEvent({
              taskId,
              type: 'error',
              error: '任务已被用户主动终止',
              done: true
            })
            return
          }

          let parsedArgs: Record<string, any> = {}
          try {
            parsedArgs = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments || {}
          } catch {
            parsedArgs = { raw: tc.arguments }
          }

          onEvent({
            taskId,
            type: 'tool_start',
            toolCall: {
              id: tc.id,
              name: tc.name,
              args: parsedArgs
            }
          })

          const tool = findAgentTool(tc.name)
          const startTime = performance.now()
          let resultText = ''
          let toolError: string | undefined

          if (!tool) {
            resultText = `执行失败: 未识别的工具 "${tc.name}"`
            toolError = resultText
          } else {
            try {
              resultText = await tool.execute(parsedArgs, {
                projectPath: taskOptions.projectPath,
                activeChapterFilename: taskOptions.activeChapterFilename,
                onFileModified: (filePath, fileContent) => {
                  this.broadcastFileChange(filePath, fileContent, taskOptions.projectPath)
                }
              })
            } catch (err) {
              resultText = `工具执行发生异常: ${err instanceof Error ? err.message : String(err)}`
              toolError = resultText
            }
          }

          const durationMs = Math.round(performance.now() - startTime)

          onEvent({
            taskId,
            type: 'tool_result',
            toolResult: {
              id: tc.id,
              name: tc.name,
              result: resultText,
              error: toolError,
              durationMs
            }
          })

          // Append tool execution result back into conversation
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: resultText
          })
        }
      }

      // Reached max turns
      onEvent({
        taskId,
        type: 'done',
        delta: '\n\n[提示: 已达到最大自主调度轮次 (15轮)，任务结束]',
        done: true
      })
    } catch (err) {
      if (!signal.aborted) {
        onEvent({
          taskId,
          type: 'error',
          error: err instanceof Error ? err.message : String(err),
          done: true
        })
      }
    } finally {
      this.activeAbortControllers.delete(taskId)
    }
  }
}

export const globalAgentRunner = new AgentRunner()
