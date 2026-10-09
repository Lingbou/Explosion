import { AgentTool, AgentToolContext } from './types'
import { globalSubAgentManager, SubAgentManager } from '../subagent-manager'

function getManager(context: AgentToolContext): SubAgentManager {
  return context.subagentManager || globalSubAgentManager
}

export const spawnSubAgentTool: AgentTool = {
  name: 'spawn_subagent',
  description:
    '派生后台独立 Sub-agent 子任务（工蜂智能体），在完全干净隔离的上下文中异步执行指定任务（如: 梳理本章事实增量并提交暗线状态、深入考据大纲、角色细节核对等）。返回 subagent_id。',
  parameters: {
    type: 'object',
    properties: {
      task_name: {
        type: 'string',
        description: '子任务名称（如: 叙事状态提交 / 梳理本章事实增量）'
      },
      instruction: {
        type: 'string',
        description: '给子智能体的详尽任务指令（要求其阅读哪些文件、分析何种增量、如何更新设定）'
      },
      context_files: {
        type: 'array',
        items: { type: 'string' },
        description: '可选。指定子任务优先参考或需编辑的文件路径（如 ["manuscript/001.txt", "story/threads.txt"]）'
      }
    },
    required: ['task_name', 'instruction']
  },
  execute: async (
    args: { task_name?: string; instruction?: string; context_files?: string[] },
    context: AgentToolContext
  ) => {
    if (!args.task_name?.trim()) {
      return '派生失败: 请提供清晰的子任务名称 task_name。'
    }
    if (!args.instruction?.trim()) {
      return '派生失败: 请提供具体的子任务指令 instruction。'
    }

    const manager = getManager(context)
    const parentTaskId = context.taskId || 'main-task'

    const taskInfo = manager.spawn({
      parentTaskId,
      taskName: args.task_name.trim(),
      instruction: args.instruction.trim(),
      contextFiles: args.context_files,
      projectPath: context.projectPath,
      activeChapterFilename: context.activeChapterFilename,
      onProgress: (info) => {
        context.onSubAgentUpdate?.(info)
      },
      onFileModified: (filePath, fileContent) => {
        context.onFileModified?.(filePath, fileContent)
      }
    })

    return [
      `[Sub-agent 已成功派生并启动后台执行]`,
      `- 子任务 ID: ${taskInfo.id}`,
      `- 任务名称: ${taskInfo.name}`,
      `- 关联文件: ${args.context_files?.join(', ') || '无'}`,
      `提示: 该子任务已在独立沙箱上下文中运行。你可以继续执行其他操作，或调用 await_subagent("${taskInfo.id}") 等待其产出与文件修改汇总。`
    ].join('\n')
  }
}

export const awaitSubAgentTool: AgentTool = {
  name: 'await_subagent',
  description:
    '等待指定的 Sub-agent 子任务执行完成，并获取其执行输出、耗时与文件修改结果。',
  parameters: {
    type: 'object',
    properties: {
      subagent_id: {
        type: 'string',
        description: '待等待的子任务 ID'
      },
      timeout_ms: {
        type: 'number',
        description: '可选。最大等待超时毫秒数（默认 60000ms）'
      }
    },
    required: ['subagent_id']
  },
  execute: async (
    args: { subagent_id?: string; timeout_ms?: number },
    context: AgentToolContext
  ) => {
    if (!args.subagent_id?.trim()) {
      return '等待失败: 请提供有效的子任务 ID subagent_id。'
    }

    const manager = getManager(context)
    const timeout = typeof args.timeout_ms === 'number' && args.timeout_ms > 0 ? args.timeout_ms : 60000

    const result = await manager.awaitCompletion(args.subagent_id.trim(), timeout)

    if (result.status === 'timeout') {
      return `[Sub-agent 等待超时]: 子任务「${result.name}」(${result.subagentId}) 仍在后台执行中，已耗时 ${result.durationMs}ms。`
    }

    if (result.status === 'failed') {
      return `[Sub-agent 执行失败]: 子任务「${result.name}」遇到异常: ${result.error || '未知错误'}`
    }

    if (result.status === 'terminated') {
      return `[Sub-agent 已终止]: 子任务「${result.name}」已被提前终止。`
    }

    const modifiedMsg = result.modifiedFiles.length > 0
      ? `已修改/落盘文件: ${result.modifiedFiles.join(', ')}`
      : '未修改任何本地文件'

    return [
      `[Sub-agent 任务完成]`,
      `- 任务名称: ${result.name}`,
      `- 执行步骤: ${result.stepsCount} 步 (耗时 ${result.durationMs}ms)`,
      `- ${modifiedMsg}`,
      `- 执行成果汇报:\n${result.output || '(无额外文本汇报)'}`
    ].join('\n')
  }
}

export const terminateSubAgentTool: AgentTool = {
  name: 'terminate_subagent',
  description: '强制提前终止正在运行的 Sub-agent 子任务。',
  parameters: {
    type: 'object',
    properties: {
      subagent_id: {
        type: 'string',
        description: '待终止的子任务 ID'
      }
    },
    required: ['subagent_id']
  },
  execute: async (args: { subagent_id?: string }, context: AgentToolContext) => {
    if (!args.subagent_id?.trim()) {
      return '终止失败: 请提供有效的子任务 ID subagent_id。'
    }

    const manager = getManager(context)
    const success = manager.terminate(args.subagent_id.trim())

    if (success) {
      return `已成功提前终止 Sub-agent 子任务: ${args.subagent_id}`
    } else {
      return `未能终止 Sub-agent: 任务已结束或不存在该 ID (${args.subagent_id})。`
    }
  }
}

export const listSubAgentsTool: AgentTool = {
  name: 'list_subagents',
  description: '查看当前派生出的所有 Sub-agent 子任务及其运行状态、耗时与产出概况。',
  parameters: {
    type: 'object',
    properties: {}
  },
  execute: async (_args: Record<string, any>, context: AgentToolContext) => {
    const manager = getManager(context)
    const tasks = manager.list(context.taskId)

    if (tasks.length === 0) {
      return '当前尚无任何派生的 Sub-agent 子任务。'
    }

    const lines = tasks.map((t, idx) => {
      const files = t.modifiedFiles.length > 0 ? ` [修改文件: ${t.modifiedFiles.join(', ')}]` : ''
      return `${idx + 1}. [${t.status}] ${t.name} (ID: ${t.id}, 步骤: ${t.stepsCount}, 耗时: ${t.durationMs}ms)${files}`
    })

    return `=== 当前 Sub-agent 子任务列表 ===\n${lines.join('\n')}`
  }
}
