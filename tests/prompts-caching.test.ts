import { describe, it, expect } from 'vitest'
import {
  STATIC_SYSTEM_PROMPT_PREFIX,
  buildAgentSystemPrompt,
  buildSubAgentSystemPrompt
} from '../src/main/agent/prompts'

describe('Prompt Caching & Static-Dynamic Tiering', () => {
  it('guarantees identical static prefix across disparate task turns and projects', () => {
    const prompt1 = buildAgentSystemPrompt({
      projectPath: '/project/a',
      activeChapterFilename: '001.txt',
      selectedText: '文段一'
    })

    const prompt2 = buildAgentSystemPrompt({
      projectPath: '/project/b',
      activeChapterFilename: '002.txt',
      selectedText: '文段二'
    })

    // Both prompts must start with the exact static prompt prefix
    expect(prompt1.startsWith(STATIC_SYSTEM_PROMPT_PREFIX)).toBe(true)
    expect(prompt2.startsWith(STATIC_SYSTEM_PROMPT_PREFIX)).toBe(true)

    // Prefix contains the core invariant rules including subagent and state commit
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('Sub-agent 工蜂调度与长篇叙事状态提交')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('文学审美与静默去 AI 味门禁')
  })

  it('keeps dynamic elements (selection, mentions) strictly in the trailing suffix', () => {
    const selectedText = '他拔出了腰间的断剑。'
    const prompt = buildAgentSystemPrompt({
      projectPath: '/project/a',
      activeChapterFilename: '001.txt',
      selectedText
    })

    const staticLen = STATIC_SYSTEM_PROMPT_PREFIX.length
    const suffix = prompt.slice(staticLen)

    expect(STATIC_SYSTEM_PROMPT_PREFIX).not.toContain(selectedText)
    expect(suffix).toContain(selectedText)
    expect(suffix).toContain('【作者当前定向选中的目标文段】:')
  })

  it('builds specialized subagent prompt with state commit guidance', () => {
    const subPrompt = buildSubAgentSystemPrompt({
      taskName: '长篇叙事状态提交',
      instruction: '审查第一章事实增量，更新暗线与主角状态',
      contextFiles: ['manuscript/001.txt', 'story/threads.txt']
    })

    expect(subPrompt).toContain('Sub-agent 工作助理工蜂')
    expect(subPrompt).toContain('长篇叙事状态提交')
    expect(subPrompt).toContain('优先关联参考文件:')
    expect(subPrompt).toContain('story/threads.txt')
    expect(subPrompt).toContain('叙事状态提交 (State Commit)')
  })
})
