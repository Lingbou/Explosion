/**
 * Resolves and normalizes an API endpoint given a base URL and relative endpoint path.
 * Prevents issues like duplicate `/v1` segments or trailing slash glitches.
 */
export function resolveEndpoint(baseUrl: string, endpoint: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '')
  let target = endpoint.trim()

  if (!target.startsWith('/')) {
    target = `/${target}`
  }

  // If base already ends with /v1 and endpoint starts with /v1, avoid /v1/v1
  if (base.endsWith('/v1') && target.startsWith('/v1/')) {
    target = target.slice(3)
  }

  // If base doesn't have /v1, and target is /chat/completions or /models or /responses or /messages,
  // check if baseUrl is meant to have /v1 (unless it's ollama or custom non-v1)
  return `${base}${target}`
}

/**
 * Parses Server-Sent Events (SSE) stream buffer into individual data lines.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<{ event?: string; data: string }> {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent: string | undefined

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) {
          currentEvent = undefined
          continue
        }

        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
          continue
        }

        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          yield { event: currentEvent, data }
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      yield { data: buffer.trim().slice(5).trim() }
    }
  } finally {
    reader.releaseLock()
  }
}
