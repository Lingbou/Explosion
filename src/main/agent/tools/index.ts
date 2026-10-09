import { AgentTool, agentToolToDefinition } from './types'
import { execCommandTool } from './exec-command'
import { readFileTool, writeFileTool, editFileTool, listDirTool } from './file-tools'
import { webSearchTool, webExtractTool } from './web-tools'
import { searchLibraryTool } from './search-library'
import {
  spawnSubAgentTool,
  awaitSubAgentTool,
  terminateSubAgentTool,
  listSubAgentsTool
} from './subagent-tools'
import { ToolDefinition } from '../../../shared/types/llm'

export * from './types'
export * from './exec-command'
export * from './file-tools'
export * from './web-tools'
export * from './search-library'
export * from './sandbox'
export * from './subagent-tools'

export const AGENT_TOOLS: AgentTool[] = [
  execCommandTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  webSearchTool,
  webExtractTool,
  searchLibraryTool,
  spawnSubAgentTool,
  awaitSubAgentTool,
  terminateSubAgentTool,
  listSubAgentsTool
]

export const AGENT_TOOL_DEFINITIONS: ToolDefinition[] = AGENT_TOOLS.map(agentToolToDefinition)

export function findAgentTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.name === name)
}
