import { expect, test } from 'bun:test'
import { Hono } from 'hono'
import { BusinessException } from '../core/exceptions'
import { requireAdminApiKey } from './adminAuth.middleware'

const createTestApp = () => {
  const app = new Hono()
  app.use('*', requireAdminApiKey())
  app.get('/admin-only', (c) => c.json({ ok: true }))
  app.onError((err, c) => {
    if (err instanceof BusinessException) {
      return c.json({ message: err.message, errorCode: err.errorCode }, err.statusCode as any)
    }

    throw err
  })

  return app
}

test('admin auth rejects missing api key with 401', async () => {
  process.env.ADMIN_API_KEY = 'secret'
  const app = createTestApp()

  const response = await app.request('/admin-only')

  expect(response.status).toBe(401)
})

test('admin auth rejects invalid api key with 403', async () => {
  process.env.ADMIN_API_KEY = 'secret'
  const app = createTestApp()

  const response = await app.request('/admin-only', {
    headers: { 'x-admin-api-key': 'wrong' },
  })

  expect(response.status).toBe(403)
})

test('admin auth accepts x-admin-api-key', async () => {
  process.env.ADMIN_API_KEY = 'secret'
  const app = createTestApp()

  const response = await app.request('/admin-only', {
    headers: { 'x-admin-api-key': 'secret' },
  })

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
})
