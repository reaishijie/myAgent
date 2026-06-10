import { expect, test } from 'bun:test'
import { decryptSecret, encryptSecret } from './cryptoSecret'
import { maskSecret } from './maskSecret'

test('maskSecret keeps only a small prefix and suffix', () => {
  expect(maskSecret('sk-1234567890abcdef')).toBe('sk-****cdef')
})

test('encryptSecret stores a reversible non-plain-text value', async () => {
  const encrypted = await encryptSecret('secret-api-key', 'unit-test-secret')

  expect(encrypted).not.toBe('secret-api-key')
  await expect(decryptSecret(encrypted, 'unit-test-secret')).resolves.toBe('secret-api-key')
})
