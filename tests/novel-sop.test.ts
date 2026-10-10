import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  STATIC_SYSTEM_PROMPT_PREFIX,
  buildAgentSystemPrompt,
  buildSubAgentSystemPrompt
} from '../src/main/agent/prompts'
import { ConfigStore } from '../src/main/config/store'

describe('Novel Authoring SOP Protocol', () => {
  let tempConfigDir: string
  let testConfigStore: ConfigStore

  beforeEach(() => {
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'explosion-sop-test-'))
    testConfigStore = new ConfigStore(tempConfigDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })

  it('contains the full 6-phase novel authoring SOP in the static prompt prefix', () => {
    // Phase 1: Voice DNA & Premise
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('文风基因解构与核心原点 (Voice DNA & Premise)')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('story/outlines/premise.txt')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('Logline / Premise')

    // Phase 2: Character Dossiers
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('人物小传与世界底色 (Character Dossiers & World Canvas)')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('表层渴望 (Want)')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('深层创伤/致命谎言 (Wound / Lie)')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('story/characters/<名字>.txt')

    // Phase 3: Volume Arc & Scene Beats
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('分卷大纲与首章场景节拍表 (Volume Arc & Scene Beats)')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('Dwight Swain')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('Scene')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('Sequel')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('story/outlines/第一卷_大纲.txt')

    // Phase 4: Undercurrent Setup
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('暗线账本立项 (Undercurrent Setup)')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('story/threads.txt')

    // Phase 5: Beat-Driven MRU Drafting
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('节拍驱动的 MRU 场景执笔 (Beat-Driven Drafting via MRUs)')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('Motivation-Reaction Units')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('[M - 外部刺激]')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('[R1 - 生理本能反应]')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('[R2 - 物理反射动作]')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('[R3 - 语言与对话]')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('manuscript/001-第一章.txt')

    // Phase 6: Narrative State Commit
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('叙事状态提交 (State Commit)')

    // Conversational Presentation Principles
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('与作者的对话交互呈现原则')
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain('首章 3~4 个场景节拍表 (Scene Beats)')
  })

  it('mounts referenced book guidance for Voice DNA and search_library integration', () => {
    const prompt = buildAgentSystemPrompt({
      projectPath: '/test/novel',
      activeChapterFilename: '001-第一章.txt',
      referencedBooks: ['九州·缥缈录']
    })

    expect(prompt).toContain('【作者 @ 显式引用的参考资料】')
    expect(prompt).toContain('九州·缥缈录')
    expect(prompt).toContain('search_library')
  })

  it('builds Sub-agent prompt with state commit and narrative consistency rules', () => {
    const subPrompt = buildSubAgentSystemPrompt({
      taskName: '第一章叙事状态提交',
      instruction: '审查本章角色的心理变化与暗线伏笔',
      contextFiles: ['story/threads.txt', 'story/characters/主角.txt']
    })

    expect(subPrompt).toContain('叙事状态提交 (State Commit)')
    expect(subPrompt).toContain('story/threads.txt')
    expect(subPrompt).toContain('story/characters/*.txt')
    expect(subPrompt).toContain('零 Markdown 污染')
  })

  it('strictly isolates test configuration from real ~/.explosion/config.json', () => {
    const cfg = testConfigStore.getConfig()
    expect(cfg).toBeDefined()
    expect(testConfigStore.getPaths().configDir).toBe(tempConfigDir)
  })
})
