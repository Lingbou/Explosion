import { describe, it, expect } from 'vitest'
import { validateSilentGuardrails, isManuscriptPath } from '../src/main/agent/guardrails/silent-guardrails'

describe('Silent Guardrails (静默去 AI 味门禁)', () => {
  it('passes on clean literary prose featuring concrete physical actions and show-don\'t-tell', () => {
    const cleanProse = `暴雨初歇，南淮城外的青石官道上升起一层惨白的雾气。
林巡勒住马缰，皮靴踏在积水的凹坑里，溅起一片浊泥。
他反手按住腰间的生锈铁剑，指节因用力而隐隐发白。`

    const res = validateSilentGuardrails(cleanProse)
    expect(res.passed).toBe(true)
    expect(res.violations).toHaveLength(0)
    expect(res.formattedMessage).toBeUndefined()
  })

  it('detects and intercepts dialectical parallelisms (不是……而是…… / 不仅……更是……)', () => {
    const text1 = '那不是一把普通的长剑，而是一个王朝覆灭的见证。'
    const res1 = validateSilentGuardrails(text1)
    expect(res1.passed).toBe(false)
    expect(res1.violations.some((v) => v.category === '辩证排比套话')).toBe(true)
    expect(res1.formattedMessage).toContain('去 AI 味门禁拦截')

    const text2 = '这不仅关乎他一个人的生死，更关乎整座南淮城的安危。'
    const res2 = validateSilentGuardrails(text2)
    expect(res2.passed).toBe(false)
    expect(res2.violations.some((v) => v.patternName.includes('关乎'))).toBe(true)
  })

  it('detects time/air freeze clichés (时间/空气仿佛在这一刻静止)', () => {
    const text1 = '时间仿佛在这一刻静止，所有人的目光都汇聚在少年身上。'
    const res1 = validateSilentGuardrails(text1)
    expect(res1.passed).toBe(false)
    expect(res1.violations.some((v) => v.category === '时间空气凝固')).toBe(true)

    const text2 = '仿佛连空气都凝固了下来，无人敢发一言。'
    const res2 = validateSilentGuardrails(text2)
    expect(res2.passed).toBe(false)
  })

  it('detects stock AI micro-expressions (嘴角勾起一抹…… / 眼中闪过一丝……)', () => {
    const text1 = '黑衣人嘴角勾起一抹冷笑，刀锋指向了少年。'
    const res1 = validateSilentGuardrails(text1)
    expect(res1.passed).toBe(false)
    expect(res1.violations.some((v) => v.patternName.includes('嘴角'))).toBe(true)

    const text2 = '林巡眼中闪过一丝狠厉，随即恢复了平静。'
    const res2 = validateSilentGuardrails(text2)
    expect(res2.passed).toBe(false)
    expect(res2.violations.some((v) => v.patternName.includes('眼中'))).toBe(true)

    const text3 = '他深吸一口气，平复了一下激动的心情。'
    const res3 = validateSilentGuardrails(text3)
    expect(res3.passed).toBe(false)
  })

  it('detects didactic or explanatory omniscient interjections', () => {
    const text1 = '然而事情并没有那么简单，阴谋正在暗中发酵。'
    const res1 = validateSilentGuardrails(text1)
    expect(res1.passed).toBe(false)

    const text2 = '殊不知，这仅仅是一个开始。'
    const res2 = validateSilentGuardrails(text2)
    expect(res2.passed).toBe(false)

    const text3 = '他在心中暗自思忖，权衡着其中的利害关系。'
    const res3 = validateSilentGuardrails(text3)
    expect(res3.passed).toBe(false)
  })

  it('accurately identifies manuscript paths and ignores non-manuscript paths', () => {
    expect(isManuscriptPath('manuscript/001-第一章.txt')).toBe(true)
    expect(isManuscriptPath('/path/to/project/manuscript/vol_01/01.txt')).toBe(true)
    expect(isManuscriptPath('001-第一章.txt')).toBe(true)
    expect(isManuscriptPath('vol_01_起/001_暴雨初歇.txt')).toBe(true)

    expect(isManuscriptPath('story/threads.txt')).toBe(false)
    expect(isManuscriptPath('story/characters/主角.txt')).toBe(false)
    expect(isManuscriptPath('scripts/organize_library.py')).toBe(false)
    expect(isManuscriptPath('README.md')).toBe(false)
  })
})
