import { afterEach, expect, test } from 'bun:test'
import { EmbeddingService } from './embedding.service'
import { LlmService } from './llm.service'
import { normalizeBaseUrl } from './openaiCompatible'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

test('normalizeBaseUrl removes trailing slashes', () => {
  expect(normalizeBaseUrl('https://example.com/v1///')).toBe('https://example.com/v1')
})

test('EmbeddingService uses embedding-specific configuration', async () => {
  process.env.OPENAI_EMBEDDING_API_KEY = 'embedding-key'
  process.env.OPENAI_EMBEDDING_BASE_URL = 'https://embedding.example/v1/'
  process.env.OPENAI_EMBEDDING_MODEL = 'embedding-model'
  process.env.OPENAI_CHAT_API_KEY = 'chat-key'
  process.env.OPENAI_CHAT_BASE_URL = 'https://chat.example/v1'
  process.env.OPENAI_CHAT_MODEL = 'chat-model'

  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })

    return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 })
  }

  const result = await EmbeddingService.embed('hello', fetchImpl as typeof fetch)

  expect(result).toEqual({ embeddings: [[0.1, 0.2]], model: 'embedding-model' })
  expect(calls[0].url).toBe('https://embedding.example/v1/embeddings')
  expect(calls[0].init.headers).toEqual({
    authorization: 'Bearer embedding-key',
    'content-type': 'application/json',
  })
  expect(JSON.parse(String(calls[0].init.body))).toEqual({ model: 'embedding-model', input: 'hello' })
})

test('LlmService uses chat-specific configuration', async () => {
  process.env.OPENAI_EMBEDDING_API_KEY = 'embedding-key'
  process.env.OPENAI_EMBEDDING_BASE_URL = 'https://embedding.example/v1'
  process.env.OPENAI_EMBEDDING_MODEL = 'embedding-model'
  process.env.OPENAI_CHAT_API_KEY = 'chat-key'
  process.env.OPENAI_CHAT_BASE_URL = 'https://chat.example/v1/'
  process.env.OPENAI_CHAT_MODEL = 'chat-model'

  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })

    return new Response(JSON.stringify({ choices: [{ message: { content: 'answer' } }] }), { status: 200 })
  }

  const answer = await LlmService.chat('question', fetchImpl as typeof fetch)

  expect(answer).toBe('answer')
  expect(calls[0].url).toBe('https://chat.example/v1/chat/completions')
  expect(calls[0].init.headers).toEqual({
    authorization: 'Bearer chat-key',
    'content-type': 'application/json',
  })
  expect(JSON.parse(String(calls[0].init.body))).toEqual({
    model: 'chat-model',
    messages: [{ role: 'user', content: 'question' }],
    temperature: 0.2,
  })
})

test('LlmService streams chat deltas from OpenAI-compatible SSE', async () => {
  process.env.OPENAI_CHAT_API_KEY = 'chat-key'
  process.env.OPENAI_CHAT_BASE_URL = 'https://chat.example/v1/'
  process.env.OPENAI_CHAT_MODEL = 'chat-model'

  const encoder = new TextEncoder()
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })

    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }), { status: 200 })
  }

  const chunks: string[] = []
  for await (const chunk of LlmService.streamChat('question', fetchImpl as typeof fetch)) {
    chunks.push(chunk)
  }

  expect(chunks).toEqual(['你', '好'])
  expect(calls[0].url).toBe('https://chat.example/v1/chat/completions')
  expect(JSON.parse(String(calls[0].init.body))).toEqual({
    model: 'chat-model',
    messages: [{ role: 'user', content: 'question' }],
    temperature: 0.2,
    stream: true,
  })
})
