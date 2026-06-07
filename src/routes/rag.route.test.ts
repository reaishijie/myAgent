import { expect, test } from 'bun:test'

test('rag route module imports', async () => {
  const route = await import('./rag.route')

  expect(route.default).toBeDefined()
})
