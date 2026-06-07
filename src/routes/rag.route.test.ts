import { expect, test } from 'bun:test'

test('rag route module imports', async () => {
  const route = await import('./rag.route')

  expect(route.default).toBeDefined()
})

test('rag route exposes stream query endpoint', async () => {
  const route = await import('./rag.route')
  const routes = (route.default as any).routes as Array<{ path: string; method: string }>

  expect(routes.some((item) => item.method === 'POST' && item.path === '/query/stream')).toBe(true)
})
