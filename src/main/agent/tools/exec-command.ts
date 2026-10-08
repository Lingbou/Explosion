import { exec } from 'child_process'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { AgentTool, AgentToolContext } from './types'
import { validateCommandSafety, validateSandboxPath } from './sandbox'

const MAX_OUTPUT_LENGTH = 30000

export function resolveWorkingDir(cwdInput?: string, projectPath?: string | null): string {
  if (cwdInput && typeof cwdInput === 'string' && cwdInput.trim()) {
    let p = cwdInput.trim()
    if (p.startsWith('~')) {
      p = path.join(os.homedir(), p.slice(1))
    }
    if (path.isAbsolute(p)) {
      return path.resolve(p)
    }
    const base = projectPath || path.join(os.homedir(), '.explosion')
    return path.resolve(base, p)
  }

  if (projectPath && fs.existsSync(projectPath)) {
    return path.resolve(projectPath)
  }

  const defaultDir = path.join(os.homedir(), '.explosion')
  if (fs.existsSync(defaultDir)) {
    return defaultDir
  }

  return process.cwd()
}

export function truncateOutput(output: string, maxLength: number = MAX_OUTPUT_LENGTH): string {
  if (output.length <= maxLength) return output
  const half = Math.floor(maxLength / 2)
  return `${output.slice(0, half)}\n\n... [输出过长，中间部分已截断省略 ${output.length - maxLength} 字符] ...\n\n${output.slice(-half)}`
}

export const execCommandTool: AgentTool = {
  name: 'exec_command',
  description:
    '在宿主系统终端中执行命令（如 python 脚本、git 或数据处理工具），捕获并返回 exitCode、stdout 和 stderr。执行目录严格隔离在小说工程目录或 ~/.explosion/ 内。',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要在系统终端执行的命令行指令（如 python3 ~/.explosion/scripts/organize_library.py ...）'
      },
      cwd: {
        type: 'string',
        description: '执行命令的工作目录（可选）。受轻沙箱限制，仅允许在当前小说工程目录或 ~/.explosion 下执行'
      },
      timeout_ms: {
        type: 'number',
        description: '可选的超时时间（毫秒），默认 120000 (2分钟)'
      }
    },
    required: ['command']
  },
  execute: async (args: { command?: string; cwd?: string; timeout_ms?: number }, context: AgentToolContext) => {
    const rawCmd = args.command?.trim()
    if (!rawCmd) {
      return '执行失败: 未提供有效的 command 命令内容。'
    }

    // Command Safety Defense
    const cmdCheck = validateCommandSafety(rawCmd)
    if (!cmdCheck.safe) {
      return cmdCheck.reason || '[轻沙箱安全拦截]: 检测到高危破坏性系统指令，已安全拦截。'
    }

    // CWD Sandbox Defense: ensure cwd is inside whitelist roots
    let workingDir = resolveWorkingDir(args.cwd, context.projectPath)
    const cwdCheck = validateSandboxPath(workingDir, context)
    if (!cwdCheck.allowed) {
      // Fall back to project path or ~/.explosion
      workingDir = context.projectPath && fs.existsSync(context.projectPath)
        ? path.resolve(context.projectPath)
        : path.resolve(path.join(os.homedir(), '.explosion'))
    }

    const timeout = typeof args.timeout_ms === 'number' && args.timeout_ms > 0 ? args.timeout_ms : 120000

    return new Promise<string>((resolve) => {
      const shellEnv = {
        ...process.env,
        LANG: process.env.LANG || 'zh_CN.UTF-8',
        LC_ALL: process.env.LC_ALL || 'zh_CN.UTF-8'
      }

      const execOptions = {
        cwd: workingDir,
        env: shellEnv,
        timeout,
        maxBuffer: 20 * 1024 * 1024 // 20MB buffer
      }

      exec(rawCmd, execOptions, (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === 'number' ? error.code : error ? 1 : 0
        const outStr = truncateOutput(stdout ? stdout.toString() : '')
        const errStr = truncateOutput(stderr ? stderr.toString() : '')

        const sections: string[] = [
          `[命令退出码: ${exitCode}]`,
          `[工作目录: ${workingDir}]`
        ]

        if (error && error.killed) {
          sections.push(`[提示: 命令由于超过 ${timeout}ms 超时被系统终止]`)
        }

        if (outStr.trim()) {
          sections.push(`--- 标准输出 (STDOUT) ---\n${outStr}`)
        } else {
          sections.push(`--- 标准输出 (STDOUT) ---\n(无输出)`)
        }

        if (errStr.trim()) {
          sections.push(`--- 标准错误 (STDERR) ---\n${errStr}`)
        }

        resolve(sections.join('\n\n'))
      })
    })
  }
}
