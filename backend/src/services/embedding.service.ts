import { BusinessException } from '../core/exceptions'
import { normalizeBaseUrl, normalizeUsage, readJsonResponse, requireConfig, type FetchLike } from './openaiCompatible'

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>
  model?: string
  usage?: {
    prompt_tokens?: number
    total_tokens?: number
  }
}

export const EmbeddingService = {
  async embed(input: string | string[], fetchImpl: FetchLike = fetch) {
    const apiKey = requireConfig(process.env.OPENAI_EMBEDDING_API_KEY, 'OPENAI_EMBEDDING_API_KEY')
    const baseUrl = normalizeBaseUrl(requireConfig(process.env.OPENAI_EMBEDDING_BASE_URL, 'OPENAI_EMBEDDING_BASE_URL'))
    const model = requireConfig(process.env.OPENAI_EMBEDDING_MODEL, 'OPENAI_EMBEDDING_MODEL')

    const response = await fetchImpl(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, input }),
    })

    const body = await readJsonResponse<EmbeddingResponse>(response, 'Embedding')
    const embeddings = body.data.map((item) => item.embedding)

    if (embeddings.length === 0) {
      throw new BusinessException('Embedding API returned no vectors', 502, 'EMBEDDING_EMPTY')
    }

    return { embeddings, model, usage: normalizeUsage(body.usage) }
  },
}
