import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  validateSandboxPath,
  validateCommandSafety,
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  execCommandTool
} from '../src/main/agent/tools'

describe('Lightweight Directory Sandbox', () => {
  let tempSandboxDir: string

  beforeEach(() => {
    tempSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-sandbox-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true })
    }
  })

  it('allows access to files within novel project directory', () => {
    const filePath = path.join(tempSandboxDir, 'manuscript', '001-第一章.txt')
    const check = validateSandboxPath(filePath, { projectPath: tempSandboxDir })
    expect(check.allowed).toBe(true)
    expect(check.resolvedPath).toBe(path.resolve(filePath))
  })

  it('allows access to global ~/.explosion directory', () => {
    const check = validateSandboxPath('~/.explosion/library/book.txt', { projectPath: tempSandboxDir })
    expect(check.allowed).toBe(true)
    expect(check.resolvedPath).toContain('.explosion')
  })

  it('allows access to system temp directory', () => {
    const tempFile = path.join(os.tmpdir(), 'some-temp-doc.txt')
    const check = validateSandboxPath(tempFile, { projectPath: tempSandboxDir })
    expect(check.allowed).toBe(true)
  })

  it('intercepts path traversal escaping whitelist roots', () => {
    const traversalPath = path.join(tempSandboxDir, '../../../../etc/passwd')
    const check = validateSandboxPath(traversalPath, { projectPath: tempSandboxDir })
    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('轻沙箱安全拦截')
  })

  it('intercepts sensitive system paths like /etc, /root, ~/.ssh', () => {
    const etcCheck = validateSandboxPath('/etc/shadow', { projectPath: tempSandboxDir })
    expect(etcCheck.allowed).toBe(false)
    expect(etcCheck.reason).toContain('轻沙箱安全拦截')

    const sshCheck = validateSandboxPath('~/.ssh/id_rsa', { projectPath: tempSandboxDir })
    expect(sshCheck.allowed).toBe(false)
    expect(sshCheck.reason).toContain('轻沙箱安全拦截')
  })

  it('blocks read_file, write_file, edit_file on restricted paths', async () => {
    const readRes = await readFileTool.execute({ path: '/etc/passwd' }, { projectPath: tempSandboxDir })
    expect(readRes).toContain('轻沙箱安全拦截')

    const writeRes = await writeFileTool.execute({ path: '/etc/evil.txt', content: 'test' }, { projectPath: tempSandboxDir })
    expect(writeRes).toContain('轻沙箱安全拦截')

    const editRes = await editFileTool.execute({ path: '/etc/hosts', old_str: 'a', new_str: 'b' }, { projectPath: tempSandboxDir })
    expect(editRes).toContain('轻沙箱安全拦截')

    const listRes = await listDirTool.execute({ path: '/root' }, { projectPath: tempSandboxDir })
    expect(listRes).toContain('轻沙箱安全拦截')
  })

  it('intercepts dangerous destructive shell commands in exec_command', async () => {
    const check1 = validateCommandSafety('rm -rf /')
    expect(check1.safe).toBe(false)
    expect(check1.reason).toContain('轻沙箱安全拦截')

    const check2 = validateCommandSafety('rm -rf /*')
    expect(check2.safe).toBe(false)

    const execRes = await execCommandTool.execute({ command: 'rm -rf /' }, { projectPath: tempSandboxDir })
    expect(execRes).toContain('轻沙箱安全拦截')
  })
})
