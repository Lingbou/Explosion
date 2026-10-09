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

export function resolveToolCallIntent(rawName: string, rawArguments: any): {
  name: string
  args: Record<string, any>
} {
  let name = (rawName || '').trim()
  let args: Record<string, any> = {}

  // 1. Parse rawArguments first
  if (typeof rawArguments === 'string') {
    try {
      args = JSON.parse(rawArguments)
    } catch {
      args = rawArguments ? { raw: rawArguments } : {}
    }
  } else if (rawArguments && typeof rawArguments === 'object') {
    args = { ...rawArguments }
  }

  // 2. Strip standard prefixes like 'functions.', 'tools.', 'call_'
  if (name.startsWith('functions.')) name = name.slice(10)
  if (name.startsWith('tools.')) name = name.slice(6)
  if (name.startsWith('default_api:')) name = name.slice(12)

  // 3. Detect if name itself is a stringified JSON (e.g. {"path": "..."})
  if (name.startsWith('{') || name.includes('{')) {
    try {
      const parsedNameObj = JSON.parse(name)
      if (parsedNameObj && typeof parsedNameObj === 'object') {
        args = { ...args, ...parsedNameObj }
        if (parsedNameObj.name && typeof parsedNameObj.name === 'string') {
          name = parsedNameObj.name
        } else if (parsedNameObj.tool && typeof parsedNameObj.tool === 'string') {
          name = parsedNameObj.tool
        } else if (parsedNameObj.function && typeof parsedNameObj.function === 'string') {
          name = parsedNameObj.function
        } else {
          name = ''
        }
      }
    } catch {
      const pathMatch = name.match(/["']path["']\s*:\s*["']([^"']+)["']/)
      if (pathMatch) {
        args.path = pathMatch[1]
      }
      name = ''
    }
  }

  // 4. Auto-heal/infer tool name from args if name is empty or not in known tools
  const KNOWN_TOOLS = [
    'exec_command',
    'read_file',
    'write_file',
    'edit_file',
    'list_dir',
    'web_search',
    'web_extract',
    'search_library'
  ]

  if (!KNOWN_TOOLS.includes(name)) {
        if (args.query && (args.book_name || name.includes('library') || name.includes('search_lib') || name.includes('book'))) {
      name = 'search_library'
    } else if (args.command) {
      name = 'exec_command'
    } else if (args.old_str !== undefined && args.new_str !== undefined) {
      name = 'edit_file'
    } else if (args.content !== undefined && args.path) {
      name = 'write_file'
    } else if (args.path) {
      if (args.recursive !== undefined || String(args.path).endsWith('/')) {
        name = 'list_dir'
      } else {
        name = 'read_file'
      }
    } else if (args.query) {
      name = 'web_search'
    } else if (args.url) {
      name = 'web_extract'
    }
  }

  return { name, args }
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

    const rawMentions = taskOptions.userPrompt.match(/@[^\s,，。！？]+/g) || []
    const referencedBooks = rawMentions.map((m) => m.slice(1).trim()).filter(Boolean)

    const systemPrompt = buildAgentSystemPrompt({
      projectPath: taskOptions.projectPath,
      activeChapterFilename: taskOptions.activeChapterFilename,
      manuscriptContext: taskOptions.manuscriptContext,
      libraryPath: config.workspace.libraryPath,
      referencedBooks,
      selectedText: taskOptions.selectedText
    })

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ]

    if (taskOptions.manuscriptContext?.trim()) {
      let userContent = `【当前正在编辑的手稿参考】:\n${taskOptions.manuscriptContext.slice(0, 4000)}\n\n`
      if (taskOptions.selectedText?.trim()) {
        userContent += `【作者当前定向选中的目标文段】:\n「${taskOptions.selectedText.trim()}」\n\n`
      }
      userContent += `【用户指令】:\n${taskOptions.userPrompt.trim()}`
      messages.push({
        role: 'user',
        content: userContent
      })
    } else {
      let userContent = ''
      if (taskOptions.selectedText?.trim()) {
        userContent += `【作者当前定向选中的目标文段】:\n「${taskOptions.selectedText.trim()}」\n\n`
      }
      userContent += taskOptions.userPrompt.trim()
      messages.push({
        role: 'user',
        content: userContent
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

          // Resolve tool call name & arguments with auto-healing
          const { name: resolvedName, args: resolvedArgs } = resolveToolCallIntent(
            tc.name,
            tc.arguments
          )

          onEvent({
            taskId,
            type: 'tool_start',
            toolCall: {
              id: tc.id,
              name: resolvedName,
              args: resolvedArgs
            }
          })

          const tool = findAgentTool(resolvedName)
          const startTime = performance.now()
          let resultText = ''
          let toolError: string | undefined

          if (!tool) {
            resultText = `执行失败: 未识别的工具 "${resolvedName || tc.name}"`
            toolError = resultText
          } else {
            try {
              resultText = await tool.execute(resolvedArgs, {
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
              name: resolvedName,
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
