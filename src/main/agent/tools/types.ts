import { ToolDefinition } from '../../../shared/types/llm'
import { SubAgentTaskInfo } from '../../../shared/types/ipc'

export interface AgentToolContext {
  projectPath?: string | null
  activeChapterFilename?: string | null
  onFileModified?: (filePath: string, content: string) => void
  taskId?: string
  subagentManager?: any
  onSubAgentUpdate?: (subagent: SubAgentTaskInfo) => void
}

export interface AgentToolParamProperty {
  type: string
  description: string
  enum?: string[]
  items?: Record<string, unknown>
}

export interface AgentToolParameters {
  type: 'object'
  properties: Record<string, AgentToolParamProperty>
  required?: string[]
}

export interface AgentTool {
  name: string
  description: string
  parameters: AgentToolParameters
  execute: (args: Record<string, any>, context: AgentToolContext) => Promise<string>
}

export function agentToolToDefinition(tool: AgentTool): ToolDefinition {
  return {
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as unknown as Record<string, unknown>
  }
}
