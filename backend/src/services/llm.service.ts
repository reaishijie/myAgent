import { BusinessException } from '../core/exceptions'
import { normalizeBaseUrl, normalizeUsage, readJsonResponse, requireConfig, type FetchLike } from './openaiCompatible'

interface ChatResponse {
  choices: Array<{ message?: { content?: string } }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

interface ChatStreamResponse {
  choices: Array<{ delta?: { content?: string } }>
}

async function* readChatStream(response: Response) {
  if (!response.ok) {
    throw new BusinessException('Chat API request failed', 502, 'MODEL_API_FAILED')
  }

  if (!response.body) {
    throw new BusinessException('Chat API returned no stream body', 502, 'CHAT_STREAM_EMPTY')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of response.body as any) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue

      const body = JSON.parse(data) as ChatStreamResponse
      const content = body.choices[0]?.delta?.content
      if (content) yield content
    }
  }
}

export const LlmService = {
  async chat(prompt: string, fetchImpl: FetchLike = fetch) {
    const apiKey = requireConfig(process.env.OPENAI_CHAT_API_KEY, 'OPENAI_CHAT_API_KEY')
    const baseUrl = normalizeBaseUrl(requireConfig(process.env.OPENAI_CHAT_BASE_URL, 'OPENAI_CHAT_BASE_URL'))
    const model = requireConfig(process.env.OPENAI_CHAT_MODEL, 'OPENAI_CHAT_MODEL')

    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    })

    const body = await readJsonResponse<ChatResponse>(response, 'Chat')
    const answer = body.choices[0]?.message?.content?.trim()

    if (!answer) {
      throw new BusinessException('Chat API returned no answer', 502, 'CHAT_EMPTY')
    }

    return { answer, usage: normalizeUsage(body.usage) }
  },

  async *streamChat(prompt: string, fetchImpl: FetchLike = fetch) {
    const apiKey = requireConfig(process.env.OPENAI_CHAT_API_KEY, 'OPENAI_CHAT_API_KEY')
    const baseUrl = normalizeBaseUrl(requireConfig(process.env.OPENAI_CHAT_BASE_URL, 'OPENAI_CHAT_BASE_URL'))
    const model = requireConfig(process.env.OPENAI_CHAT_MODEL, 'OPENAI_CHAT_MODEL')

    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        stream: true,
      }),
    })

    yield* readChatStream(response)
  },
}
