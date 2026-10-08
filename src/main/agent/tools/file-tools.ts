import fs from 'fs'
import path from 'path'
import os from 'os'
import { AgentTool, AgentToolContext } from './types'

export function decodeBuffer(buf: Buffer): string {
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
    return utf8Decoder.decode(buf)
  } catch {
    try {
      const gbkDecoder = new TextDecoder('gb18030')
      return gbkDecoder.decode(buf)
    } catch {
      return buf.toString('utf-8')
    }
  }
}

export function resolveFilePath(filePathInput: string, projectPath?: string | null): string {
  let p = filePathInput.trim()
  if (p.startsWith('~')) {
    p = path.join(os.homedir(), p.slice(1))
  }
  if (path.isAbsolute(p)) {
    return path.resolve(p)
  }
  if (projectPath) {
    return path.resolve(projectPath, p)
  }
  return path.resolve(path.join(os.homedir(), '.explosion'), p)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const readFileTool: AgentTool = {
  name: 'read_file',
  description:
    '读取本地磁盘上的文本文件内容，自动兼容并解码 UTF-8 与 GB18030/GBK 编码。可用于读取小说手稿章节、素材藏书库书籍、设定资料或脚本文件。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径（支持绝对路径、相对路径或 ~ 波浪号，如 ~/.explosion/library/xxx.txt 或 manuscript/001-第一章.txt）'
      },
      max_lines: {
        type: 'number',
        description: '可选。最多读取行数，用于快速预览大文件或检索目录'
      }
    },
    required: ['path']
  },
  execute: async (args: { path?: string; max_lines?: number }, context: AgentToolContext) => {
    if (!args.path?.trim()) {
      return '读取失败: 请提供有效的文件路径 path。'
    }

    const resolved = resolveFilePath(args.path, context.projectPath)
    if (!fs.existsSync(resolved)) {
      return `读取失败: 目标文件不存在 -> ${resolved}`
    }

    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) {
      return `读取失败: ${resolved} 是一个文件夹，请使用 list_dir 工具查看目录内容。`
    }

    try {
      const buffer = fs.readFileSync(resolved)
      const text = decodeBuffer(buffer)

      if (typeof args.max_lines === 'number' && args.max_lines > 0) {
        const lines = text.split('\n')
        const sliced = lines.slice(0, args.max_lines).join('\n')
        return `[文件路径: ${resolved} (${formatBytes(stat.size)}) - 前 ${args.max_lines} 行预览 (全书共 ${lines.length} 行)]\n\n${sliced}`
      }

      const MAX_PREVIEW_CHARS = 80000
      if (text.length > MAX_PREVIEW_CHARS) {
        const head = text.slice(0, MAX_PREVIEW_CHARS / 2)
        const tail = text.slice(-MAX_PREVIEW_CHARS / 2)
        return `[文件路径: ${resolved} (${formatBytes(stat.size)}, 共 ${text.length} 字符 - 超长文件自动截断)]\n\n${head}\n\n... [中间部分已省略 ${text.length - MAX_PREVIEW_CHARS} 字符，如需针对性阅读请使用 max_lines 或拆分后的单卷文件] ...\n\n${tail}`
      }

      return `[文件路径: ${resolved} (${formatBytes(stat.size)}, 共 ${text.length} 字符)]\n\n${text}`
    } catch (err) {
      return `读取异常: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

export const writeFileTool: AgentTool = {
  name: 'write_file',
  description:
    '直接在本地磁盘上创建或覆盖写入文件。若写入的是当前打开小说工程的手稿章节（如 manuscript/001-第一章.txt），工作台界面将自动无感实时热重载手稿！注意：小说手稿正文容器必须保持纯文本，严禁写入任何 Markdown 标记（如 #、**、- 等）。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '目标文件路径（支持绝对路径、相对路径或 ~ 波浪号）'
      },
      content: {
        type: 'string',
        description: '要写入的完整文本内容'
      }
    },
    required: ['path', 'content']
  },
  execute: async (args: { path?: string; content?: string }, context: AgentToolContext) => {
    if (!args.path?.trim()) {
      return '写入失败: 请提供有效的文件路径 path。'
    }
    if (args.content === undefined || args.content === null) {
      return '写入失败: 请提供要写入的内容 content。'
    }

    const resolved = resolveFilePath(args.path, context.projectPath)

    try {
      const parentDir = path.dirname(resolved)
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }

      fs.writeFileSync(resolved, args.content, 'utf-8')

      // Notify live file sync if hooked
      context.onFileModified?.(resolved, args.content)

      return `已成功写入文件: ${resolved} (共 ${args.content.length} 字符，UTF-8 编码)`
    } catch (err) {
      return `写入异常: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

export const editFileTool: AgentTool = {
  name: 'edit_file',
  description:
    '对本地文本文件进行精准局部替换（将 old_str 替换为 new_str）。适用于长篇手稿或设定的局部润色与修改。若修改当前手稿，编辑器将实时热重载。手稿中严禁 Markdown 标记。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '目标文件路径（支持绝对路径、相对路径或 ~ 波浪号）'
      },
      old_str: {
        type: 'string',
        description: '文件中待替换的原始文本（必须与文件内某段文字完全精确匹配）'
      },
      new_str: {
        type: 'string',
        description: '替换后的新文本内容'
      }
    },
    required: ['path', 'old_str', 'new_str']
  },
  execute: async (
    args: { path?: string; old_str?: string; new_str?: string },
    context: AgentToolContext
  ) => {
    if (!args.path?.trim()) {
      return '替换失败: 未提供文件路径 path。'
    }
    if (!args.old_str) {
      return '替换失败: 未提供待替换的原始文本 old_str。'
    }
    if (args.new_str === undefined || args.new_str === null) {
      return '替换失败: 未提供新文本 new_str。'
    }

    const resolved = resolveFilePath(args.path, context.projectPath)
    if (!fs.existsSync(resolved)) {
      return `替换失败: 目标文件不存在 -> ${resolved}`
    }

    try {
      const buf = fs.readFileSync(resolved)
      const content = decodeBuffer(buf)

      if (!content.includes(args.old_str)) {
        return `替换失败: 未在文件 ${path.basename(resolved)} 中找到与 old_str 精确匹配的文本。请重新读取文件确认上下文段落与标点。`
      }

      // Count occurrences
      const occurrences = content.split(args.old_str).length - 1
      const updatedContent = content.replace(args.old_str, args.new_str)

      fs.writeFileSync(resolved, updatedContent, 'utf-8')

      // Notify live file sync
      context.onFileModified?.(resolved, updatedContent)

      return `已成功在文件 ${resolved} 中完成替换 (共匹配 ${occurrences} 处，已完成替换)。`
    } catch (err) {
      return `替换异常: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

export const listDirTool: AgentTool = {
  name: 'list_dir',
  description:
    '列出指定目录下的文件与子目录列表、大小及修改时间。可用于查看工程目录结构、手稿章节列表或 ~/.explosion/library/ 藏书库。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要列出的目录路径（可选，支持 ~ 波浪号。若留空则同时展示当前小说工程和 ~/.explosion/library/ 藏书库）'
      },
      recursive: {
        type: 'boolean',
        description: '是否递归列出子目录（默认 false）'
      }
    }
  },
  execute: async (args: { path?: string; recursive?: boolean }, context: AgentToolContext) => {
    const listSingle = (targetDir: string, recursive: boolean = false, depth: number = 0): string[] => {
      if (!fs.existsSync(targetDir)) return [`[目录不存在: ${targetDir}]`]
      const entries = fs.readdirSync(targetDir, { withFileTypes: true })
      const lines: string[] = []

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.explosion') continue
        if (entry.name === 'node_modules' || entry.name === '__pycache__') continue

        const fullPath = path.join(targetDir, entry.name)
        const indent = '  '.repeat(depth)

        if (entry.isDirectory()) {
          lines.push(`${indent}📁 ${entry.name}/`)
          if (recursive && depth < 3) {
            lines.push(...listSingle(fullPath, recursive, depth + 1))
          }
        } else {
          try {
            const stat = fs.statSync(fullPath)
            lines.push(`${indent}📄 ${entry.name} (${formatBytes(stat.size)})`)
          } catch {
            lines.push(`${indent}📄 ${entry.name}`)
          }
        }
      }
      return lines
    }

    if (args.path?.trim()) {
      const resolved = resolveFilePath(args.path, context.projectPath)
      if (!fs.existsSync(resolved)) {
        return `目录不存在: ${resolved}`
      }
      const stat = fs.statSync(resolved)
      if (!stat.isDirectory()) {
        return `${resolved} 是一个文件，不是目录。大小: ${formatBytes(stat.size)}`
      }
      const lines = listSingle(resolved, Boolean(args.recursive))
      return `[目录列表: ${resolved}]\n${lines.join('\n') || '(空目录)'}`
    }

    // Default: list both project path (if open) and ~/.explosion/library
    const results: string[] = []
    if (context.projectPath && fs.existsSync(context.projectPath)) {
      results.push(`=== 当前小说工程 (${context.projectPath}) ===`)
      results.push(...listSingle(context.projectPath, true))
      results.push('')
    }

    const libraryDir = path.join(os.homedir(), '.explosion', 'library')
    results.push(`=== 素材藏书库 (~/.explosion/library) ===`)
    if (fs.existsSync(libraryDir)) {
      results.push(...listSingle(libraryDir, false))
    } else {
      results.push('(藏书库目录尚未创建)')
    }

    const scriptsDir = path.join(os.homedir(), '.explosion', 'scripts')
    results.push('')
    results.push(`=== 全局脚本目录 (~/.explosion/scripts) ===`)
    if (fs.existsSync(scriptsDir)) {
      results.push(...listSingle(scriptsDir, false))
    } else {
      results.push('(脚本目录尚未创建)')
    }

    return results.join('\n')
  }
}
