/**
 * 静默去 AI 味与叙事视角门禁 (Silent Guardrails)
 * 毫秒级正则扫描排查典型的“AI 辩证排比套话”与“空洞微表情说明”，
 * 确保输出彻底遵守“白描、具象动作化 (Show don't tell) 与自然留白”。
 */

export interface GuardrailViolation {
  category: string
  patternName: string
  matchedText: string
  suggestion: string
}

export interface GuardrailValidationResult {
  passed: boolean
  violations: GuardrailViolation[]
  formattedMessage?: string
}

interface GuardrailRule {
  category: string
  patternName: string
  regex: RegExp
  suggestion: string
}

const GUARDRAIL_RULES: GuardrailRule[] = [
  // 1. 辩证排比与哲理套话 (允许中间有分句逗号)
  {
    category: '辩证排比套话',
    patternName: '不是……而是…… / 不仅……更是……',
    regex: /(?:不是|不仅|不单|不止|既是)[^。！？\n]{1,40}?(?:而是|更是|反而是|又是|也是)/g,
    suggestion: '删除抽象思辨，改用纯粹人物动作或环境细节描写（Show don\'t tell）。'
  },
  {
    category: '辩证排比套话',
    patternName: '这不仅关乎……更关乎……',
    regex: /(?:这不仅关乎|这不仅仅是|这不仅是|这不单是)[^。！？\n]{1,40}?(?:更关乎|更是|还是)/g,
    suggestion: '避免上帝视角解释利害关系，通过角色具体的取舍展现代价。'
  },

  // 2. 气氛与时间凝固陈词滥调
  {
    category: '时间空气凝固',
    patternName: '时间/空气仿佛凝固',
    regex: /(?:时间|空气|气氛|呼吸|世界)(?:仿佛|似乎|好像)?在这一?(?:刻|瞬间|刹那)(?:凝固|静止|定格|停滞)/g,
    suggestion: '改用具体的环境声响骤停、光影变化或人物肌肉动作反应。'
  },
  {
    category: '时间空气凝固',
    patternName: '仿佛连空气都凝固了',
    regex: /(?:仿佛|似乎)?连空气都(?:凝固|安静|静止)了下来/g,
    suggestion: '改用动作白描与声响对照，保留叙事留白。'
  },

  // 3. 千篇一律的眼眸与嘴角微表情套话
  {
    category: 'AI套路微表情',
    patternName: '嘴角勾起一抹……',
    regex: /(?:嘴角|唇角)(?:微微|悄然)?勾起(?:了)?一抹(?:冷笑|弧度|讥讽|玩味|神秘|淡淡的笑意|苦笑|笑意)/g,
    suggestion: '去除脸谱化神态，改用具体眼神聚焦、下颌收紧或呼吸节奏变化。'
  },
  {
    category: 'AI套路微表情',
    patternName: '眼中闪过一丝……',
    regex: /(?:眼中|眸中|眼底|眸底)(?:飞快地|悄然)?闪过(?:了)?一丝(?:复杂|狠厉|赞赏|不易察觉的|冰冷|杀意|异色|诧异|决绝)/g,
    suggestion: '避免用抽象词直接定性内心活动，写其目光落点或肢体微颤。'
  },
  {
    category: 'AI套路心理宣泄',
    patternName: '深吸一口气平复心情',
    regex: /(?:深吸一口气|长舒一口气)[，,]?(?:试图)?平复(?:了一?下)?(?:内心的|胸中的)?(?:激动|心绪|心情|心跳|呼吸|情绪|震动)(?:的心情|的心绪)?/g,
    suggestion: '直接写衣袖下的手指发紧、咽喉干涩或胸口起伏。'
  },

  // 4. 预告片式上帝视角与说明性旁白
  {
    category: '说明性宣教旁白',
    patternName: '事情并没有那么简单',
    regex: /(?:然而|殊不知)[，,]?事情并(?:没有|非)那么简单/g,
    suggestion: '删除旁白预警，直接呈现障碍事件本身。'
  },
  {
    category: '说明性宣教旁白',
    patternName: '这仅仅是一个开始',
    regex: /(?:殊不知|未曾料到)[，,]?这(?:仅仅|才)?是(?:一个|一切的)?开始/g,
    suggestion: '禁止剧透式旁白，保持第一视角或当下视角的未知与压迫感。'
  },
  {
    category: '说明性宣教旁白',
    patternName: '心中暗自思忖',
    regex: /(?:心中暗自|暗暗)(?:思忖|思索|盘算|发誓)/g,
    suggestion: '直接使用内心独白或外化为视线停顿与动作迟疑。'
  }
]

/**
 * 校验文本是否含有典型 AI 味套话
 * 执行时间 < 1ms
 */
export function validateSilentGuardrails(text: string): GuardrailValidationResult {
  if (!text || typeof text !== 'string') {
    return { passed: true, violations: [] }
  }

  const violations: GuardrailViolation[] = []

  for (const rule of GUARDRAIL_RULES) {
    rule.regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.regex.exec(text)) !== null) {
      violations.push({
        category: rule.category,
        patternName: rule.patternName,
        matchedText: match[0],
        suggestion: rule.suggestion
      })
      if (match.index === rule.regex.lastIndex) {
        rule.regex.lastIndex++
      }
    }
  }

  if (violations.length === 0) {
    return { passed: true, violations: [] }
  }

  const summaryLines = violations.slice(0, 3).map((v) => {
    return `• 【${v.category}】: 「${v.matchedText}」\n  ↳ 建议: ${v.suggestion}`
  })

  const formattedMessage = [
    `[静默去 AI 味门禁拦截]: 检测到 ${violations.length} 处典型 AI 辩证排比或空洞套话：`,
    ...summaryLines,
    '文学创作铁律：严禁说教排比与空洞心理说明，必须遵守“白描、具象动作化 (Show don\'t tell) 与自然留白”。请修改后重新落盘。'
  ].join('\n')

  return {
    passed: false,
    violations,
    formattedMessage
  }
}

/**
 * 判断目标路径是否属于正文手稿范畴
 */
export function isManuscriptPath(filePath: string): boolean {
  if (!filePath) return false
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  return (
    normalized.includes('/manuscript/') ||
    normalized.startsWith('manuscript/') ||
    /^(?:vol_\d+_[^/]+\/)?\d+[^/]*\.txt$/i.test(normalized)
  )
}
