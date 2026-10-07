import { FetchModelsParams, FetchModelsResult } from '../../shared/types/llm'
import { resolveEndpoint } from './utils'

export async function fetchRemoteModels(params: FetchModelsParams): Promise<FetchModelsResult> {
  const { baseUrl, apiKey, protocol } = params
  if (!baseUrl?.trim()) {
    return { ok: false, models: [], error: '未提供 Base URL' }
  }

  const cleanBase = baseUrl.trim()
  const isOllama = cleanBase.includes('11434') || cleanBase.includes('ollama')

  // Try Ollama /api/tags if Ollama detected or port matches
  if (isOllama) {
    try {
      const url = resolveEndpoint(cleanBase, '/api/tags')
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      })

      if (res.ok) {
        const json = (await res.json()) as any
        if (Array.isArray(json?.models)) {
          const names = json.models
            .map((m: { name?: string }) => m.name?.trim())
            .filter((n: string | undefined): n is string => Boolean(n))
          if (names.length > 0) {
            return { ok: true, models: Array.from(new Set(names)) }
          }
        }
      }
    } catch {
      // Fall through to standard /models
    }
  }

  // Anthropic Models API
  if (protocol === 'anthropic_messages') {
    try {
      const url = resolveEndpoint(cleanBase, '/models')
      const headers: Record<string, string> = {
        'anthropic-version': '2023-06-01'
      }
      if (apiKey?.trim()) {
        headers['x-api-key'] = apiKey.trim()
      }

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000)
      })

      if (res.ok) {
        const json = (await res.json()) as any
        if (Array.isArray(json?.data)) {
          const ids = json.data
            .map((m: { id?: string }) => m.id?.trim())
            .filter((id: string | undefined): id is string => Boolean(id))
          if (ids.length > 0) {
            return { ok: true, models: Array.from(new Set(ids)) }
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  // Standard OpenAI-compatible /models endpoint
  try {
    const candidateUrls = [
      resolveEndpoint(cleanBase, '/models'),
      resolveEndpoint(cleanBase, '/v1/models')
    ]
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey?.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`
    }

    for (const url of Array.from(new Set(candidateUrls))) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(8000)
        })

        if (res.ok) {
          const json = (await res.json()) as any
          const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : null
          if (list) {
            const ids = list
              .map((m: { id?: string; name?: string }) => (m.id || m.name)?.trim())
              .filter((id: string | undefined): id is string => Boolean(id))
            if (ids.length > 0) {
              return { ok: true, models: Array.from(new Set(ids)) }
            }
          }
        }
      } catch {
        continue
      }
    }
  } catch (err) {
    return {
      ok: false,
      models: [],
      error: err instanceof Error ? err.message : '获取模型列表失败'
    }
  }

  return {
    ok: false,
    models: [],
    error: '上游端点未返回有效的模型列表，可手动直接输入模型标识'
  }
}
