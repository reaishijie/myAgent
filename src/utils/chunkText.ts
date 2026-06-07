export interface ChunkTextOptions {
  chunkSize?: number
  overlap?: number
}

const DEFAULT_CHUNK_SIZE = 800
const DEFAULT_OVERLAP = 120

export const chunkText = (text: string, options: ChunkTextOptions = {}) => {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const overlap = options.overlap ?? DEFAULT_OVERLAP

  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('RAG_CHUNK_SIZE must be a positive integer')
  }

  if (!Number.isInteger(overlap) || overlap < 0) {
    throw new Error('RAG_CHUNK_OVERLAP must be a non-negative integer')
  }

  if (overlap >= chunkSize) {
    throw new Error('RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE')
  }

  const normalized = text.trim()
  if (!normalized) return []

  const chunks: string[] = []
  const step = chunkSize - overlap

  for (let start = 0; start < normalized.length; start += step) {
    const chunk = normalized.slice(start, start + chunkSize).trim()
    if (chunk) chunks.push(chunk)
    if (start + chunkSize >= normalized.length) break
  }

  return chunks
}
