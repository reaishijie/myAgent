import { expect, test } from 'bun:test'
import { chunkText } from './chunkText'

test('chunkText returns one trimmed chunk when text fits', () => {
  expect(chunkText('  hello rag  ', { chunkSize: 20, overlap: 5 })).toEqual(['hello rag'])
})

test('chunkText splits text with overlap', () => {
  expect(chunkText('abcdefghij', { chunkSize: 4, overlap: 1 })).toEqual(['abcd', 'defg', 'ghij'])
})

test('chunkText skips whitespace-only input', () => {
  expect(chunkText('   ', { chunkSize: 4, overlap: 1 })).toEqual([])
})

test('chunkText rejects invalid overlap', () => {
  expect(() => chunkText('abcdef', { chunkSize: 4, overlap: 4 })).toThrow('RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE')
})
