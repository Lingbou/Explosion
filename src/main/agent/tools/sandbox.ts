import path from 'path'
import os from 'os'
import { AgentToolContext } from './types'

export interface SandboxCheckResult {
  allowed: boolean
  resolvedPath: string
  reason?: string
}

export function getSandboxRoots(context: AgentToolContext): string[] {
  const roots: string[] = []

  // 1. Current open novel project directory
  if (context.projectPath && typeof context.projectPath === 'string' && context.projectPath.trim()) {
    roots.push(path.resolve(context.projectPath.trim()))
  }

  // 2. Global Explosion app and library directory (~/.explosion)
  const explosionHome = path.resolve(path.join(os.homedir(), '.explosion'))
  roots.push(explosionHome)

  // 3. System temp directory
  roots.push(path.resolve(os.tmpdir()))

  return roots
}

export function isPathInsideRoot(targetPath: string, rootDir: string): boolean {
  const relative = path.relative(rootDir, targetPath)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

export function validateSandboxPath(inputPath: string, context: AgentToolContext): SandboxCheckResult {
  if (!inputPath || typeof inputPath !== 'string' || !inputPath.trim()) {
    return {
      allowed: false,
      resolvedPath: '',
      reason: '[轻沙箱安全拦截]: 提供的路径为空。'
    }
  }

  let p = inputPath.trim()

  // Expand ~ to user home
  if (p.startsWith('~')) {
    p = path.join(os.homedir(), p.slice(1))
  }

  // Resolve relative path
  let resolved: string
  if (path.isAbsolute(p)) {
    resolved = path.resolve(p)
  } else if (context.projectPath) {
    resolved = path.resolve(context.projectPath, p)
  } else {
    resolved = path.resolve(path.join(os.homedir(), '.explosion'), p)
  }

  // Explicit blacklist of critical system and sensitive user locations
  const home = os.homedir()
  const sensitiveBlacklist = [
    path.join(home, '.ssh'),
    path.join(home, '.gnupg'),
    path.join(home, '.bashrc'),
    path.join(home, '.zshrc'),
    path.join(home, '.profile'),
    '/etc',
    '/root',
    '/bin',
    '/sbin',
    '/usr',
    '/boot',
    '/proc',
    '/sys',
    '/dev'
  ]

  for (const black of sensitiveBlacklist) {
    if (resolved === black || isPathInsideRoot(resolved, black)) {
      return {
        allowed: false,
        resolvedPath: resolved,
        reason: `[轻沙箱安全拦截]: 严禁访问系统敏感目录 (${black})。仅允许读写当前小说工程目录与 ~/.explosion/。`
      }
    }
  }

  // Check against allowed whitelist roots
  const roots = getSandboxRoots(context)
  const isAllowed = roots.some((root) => resolved === root || isPathInsideRoot(resolved, root))

  if (!isAllowed) {
    return {
      allowed: false,
      resolvedPath: resolved,
      reason: `[轻沙箱安全拦截]: 访问路径超出允许的工作区范围 -> ${resolved}。仅允许读写当前小说工程目录、~/.explosion/ 或临时目录。`
    }
  }

  return {
    allowed: true,
    resolvedPath: resolved
  }
}

export function validateCommandSafety(command: string): { safe: boolean; reason?: string } {
  const dangerousPatterns = [
    /\brm\s+-[rfRF]{1,4}\s+[\/~]/,
    /\brm\s+-[rfRF]{1,4}\s+\/\*/,
    /\bmkfs\b/,
    /\bdd\s+if=\/dev/,
    /:\(\)\{\s*:\|:&\s*\};:/
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return {
        safe: false,
        reason: '[轻沙箱安全拦截]: 检测到高危破坏性系统指令，已安全拦截。'
      }
    }
  }

  return { safe: true }
}
