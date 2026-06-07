import { BusinessException } from '../core/exceptions'
import { normalizeBaseUrl, readJsonResponse, requireConfig, type FetchLike } from './openaiCompatible'

interface ChatResponse {
  choices: Array<{ message?: { content?: string } }>
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

    return answer
  },
}
