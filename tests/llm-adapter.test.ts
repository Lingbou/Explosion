import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveEndpoint } from '../src/main/llm/utils'
import { OpenAIChatClient } from '../src/main/llm/protocols/openai-chat'
import { AnthropicMessagesClient } from '../src/main/llm/protocols/anthropic-messages'
import { OpenAIResponsesClient } from '../src/main/llm/protocols/openai-responses'
import { fetchRemoteModels } from '../src/main/llm/model-fetcher'

describe('LLM Adapter & Protocols', () => {
  describe('resolveEndpoint', () => {
    it('normalizes trailing slashes and relative endpoints', () => {
      expect(resolveEndpoint('https://api.deepseek.com/', '/chat/completions')).toBe(
        'https://api.deepseek.com/chat/completions'
      )
      expect(resolveEndpoint('https://api.deepseek.com', 'chat/completions')).toBe(
        'https://api.deepseek.com/chat/completions'
      )
    })

    it('prevents duplicate /v1 paths', () => {
      expect(resolveEndpoint('https://api.openai.com/v1', '/v1/chat/completions')).toBe(
        'https://api.openai.com/v1/chat/completions'
      )
      expect(resolveEndpoint('https://api.openai.com/v1/', '/v1/models')).toBe(
        'https://api.openai.com/v1/models'
      )
    })
  })

  describe('OpenAIChatClient', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('generates chat completion and parses reasoning', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '南淮的雨夜很冷。',
              reasoning_content: '构思：先交代环境与氛围。'
            }
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      }) as unknown as typeof fetch

      const client = new OpenAIChatClient({
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'test-key',
        defaultModel: 'deepseek-chat'
      })

      const res = await client.generate({
        messages: [{ role: 'user', content: '写一段南淮的夜色' }]
      })

      expect(res.text).toBe('南淮的雨夜很冷。')
      expect(res.reasoning).toBe('构思：先交代环境与氛围。')
      expect(res.usage?.totalTokens).toBe(30)
    })
  })

  describe('AnthropicMessagesClient', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('separates system prompt from messages for Anthropic Messages API', async () => {
      let capturedBody: any = null

      global.fetch = vi.fn().mockImplementation((_url, init) => {
        capturedBody = JSON.parse(init.body)
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'msg-123',
            model: 'claude-3-7-sonnet-20250219',
            content: [{ type: 'text', text: '少年按住刀柄。' }],
            usage: { input_tokens: 15, output_tokens: 25 }
          })
        })
      }) as unknown as typeof fetch

      const client = new AnthropicMessagesClient({
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'sk-ant-test',
        defaultModel: 'claude-3-7-sonnet-20250219'
      })

      const res = await client.generate({
        messages: [
          { role: 'system', content: '你是一位主笔助手' },
          { role: 'user', content: '写一个动作' }
        ]
      })

      expect(capturedBody.system).toBe('你是一位主笔助手')
      expect(capturedBody.messages).toHaveLength(1)
      expect(capturedBody.messages[0].role).toBe('user')
      expect(res.text).toBe('少年按住刀柄。')
      expect(res.usage?.totalTokens).toBe(40)
    })
  })

  describe('OpenAIResponsesClient', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('parses responses API output_text and usage', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'resp-123',
          model: 'gpt-4o',
          output_text: '这是 Responses API 生成的段落。',
          usage: { input_tokens: 8, output_tokens: 12, total_tokens: 20 }
        })
      }) as unknown as typeof fetch

      const client = new OpenAIResponsesClient({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        defaultModel: 'gpt-4o'
      })

      const res = await client.generate({
        messages: [{ role: 'user', content: '测试' }]
      })

      expect(res.text).toBe('这是 Responses API 生成的段落。')
      expect(res.usage?.totalTokens).toBe(20)
    })
  })

  describe('fetchRemoteModels', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('fetches OpenAI format /models endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }]
        })
      }) as unknown as typeof fetch

      const res = await fetchRemoteModels({
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'test-key'
      })

      expect(res.ok).toBe(true)
      expect(res.models).toContain('deepseek-chat')
      expect(res.models).toContain('deepseek-reasoner')
    })
  })
})
