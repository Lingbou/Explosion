import { AgentTool } from './types'

const ANYSEARCH_BASE_URL = (
  process.env.ANYSEARCH_API_BASE_URL || 'https://api.anysearch.com'
).replace(/\/$/, '')

function getAnySearchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Anysearch-Client': 'explosion/0.1.0'
  }
  const apiKey = process.env.ANYSEARCH_API_KEY?.trim()
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  return headers
}

export const webSearchTool: AgentTool = {
  name: 'web_search',
  description:
    '直通 AnySearch REST 检索真实互联网最新事实、学术论文、历史人文背景与文学资料。可用于考据历史事件、武器名物、科学设定或实时热点。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词或查询意图'
      },
      max_results: {
        type: 'number',
        description: '可选。返回结果条数（1-10，默认 5）'
      }
    },
    required: ['query']
  },
  execute: async (args: { query?: string; max_results?: number }) => {
    const q = args.query?.trim()
    if (!q) {
      return '搜索失败: 请提供有效的搜索关键词 query。'
    }

    const count = typeof args.max_results === 'number' ? Math.max(1, Math.min(10, args.max_results)) : 5
    const url = `${ANYSEARCH_BASE_URL}/v1/search`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      const res = await fetch(url, {
        method: 'POST',
        headers: getAnySearchHeaders(),
        body: JSON.stringify({
          query: q,
          max_results: count
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        const text = await res.text()
        return `AnySearch 搜索失败 (HTTP ${res.status}): ${text}`
      }

      const json = (await res.json()) as any
      const results = json?.data?.results || []

      if (results.length === 0) {
        return `AnySearch 未检索到关于 "${q}" 的相关结果。`
      }

      const lines: string[] = [
        `## AnySearch 实时搜索结果: "${q}" (共 ${results.length} 条)\n`
      ]

      results.forEach((item: any, idx: number) => {
        lines.push(`### ${idx + 1}. ${item.title || '(无标题)'}`)
        if (item.url) lines.push(`- 链接: ${item.url}`)
        const snippet = item.content || item.snippet
        if (snippet) lines.push(`- 内容摘要: ${snippet.trim()}`)
        lines.push('')
      })

      return lines.join('\n').trim()
    } catch (err) {
      return `AnySearch 网络检索异常: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

export const webExtractTool: AgentTool = {
  name: 'web_extract',
  description:
    '直通 AnySearch 页面清洗抓取端点，获取指定 URL 网页的完整正文清洗文本，用于深入阅读参考资料或深度考据。',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要抓取的网页绝对 URL 地址'
      }
    },
    required: ['url']
  },
  execute: async (args: { url?: string }) => {
    const targetUrl = args.url?.trim()
    if (!targetUrl) {
      return '抓取失败: 请提供有效的网页 URL。'
    }

    const endpoint = `${ANYSEARCH_BASE_URL}/v1/extract`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 25000)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAnySearchHeaders(),
        body: JSON.stringify({ url: targetUrl }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        const text = await res.text()
        return `AnySearch 抓取失败 (HTTP ${res.status}): ${text}`
      }

      const json = (await res.json()) as any
      const data = json?.data || {}
      const title = data.title || '(无标题)'
      let content = (data.content || '').trim()

      const MAX_CONTENT_LENGTH = 30000
      if (content.length > MAX_CONTENT_LENGTH) {
        content = `${content.slice(0, MAX_CONTENT_LENGTH)}\n\n... [正文过长，已截断显示前 ${MAX_CONTENT_LENGTH} 字符] ...`
      }

      return [
        `## 网页抓取内容: ${title}`,
        `- 原始链接: ${targetUrl}`,
        `---\n`,
        content || '(页面正文为空)'
      ].join('\n')
    } catch (err) {
      return `AnySearch 抓取异常: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
