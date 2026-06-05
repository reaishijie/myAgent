import { expect, test } from 'bun:test'
import { hashPassword } from './password'

test('hashPassword returns a non-plain-text hash', async () => {
  const hash = await hashPassword('secret-password')

  expect(hash).toStartWith('$')
  expect(hash).not.toBe('secret-password')
})
