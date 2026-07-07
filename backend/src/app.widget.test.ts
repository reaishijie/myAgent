import { expect, test } from 'bun:test'
import { createApp } from './app'

test('public widget endpoints expose CORS while admin remains protected', async () => {
  process.env.ADMIN_API_KEY = 'secret'
  const app = createApp()

  try {
    const widgetOptions = await app.request('/api/widgets/demo/config', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://example.com',
        'access-control-request-method': 'GET',
      },
    })
    expect(widgetOptions.headers.get('access-control-allow-origin')).toBe('*')

    const chatOptions = await app.request('/api/chat/sessions', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://example.com',
        'access-control-request-method': 'POST',
      },
    })
    expect(chatOptions.headers.get('access-control-allow-origin')).toBe('*')

    const uploadForm = new FormData()
    uploadForm.set('file', new File(['binary'], 'hello.png', { type: 'image/png' }))
    const uploadResponse = await app.request('/api/rag/documents/upload', {
      method: 'POST',
      headers: {
        origin: 'https://admin.example',
        'x-admin-api-key': 'secret',
      },
      body: uploadForm,
    })
    expect(uploadResponse.headers.get('access-control-allow-origin')).toBe('*')

    const adminResponse = await app.request('/api/admin/knowledge-bases')
    expect(adminResponse.status).toBe(401)

    const knowledgeBaseQuery = await app.request('/api/rag/query', {
      method: 'POST',
      headers: { origin: 'https://admin.example', 'content-type': 'application/json' },
      body: JSON.stringify({ knowledgeBaseId: 1, question: 'alpha', topK: 3 }),
    })
    expect(knowledgeBaseQuery.status).toBe(401)
    expect(knowledgeBaseQuery.headers.get('access-control-allow-origin')).toBe('*')
  } finally {
    delete process.env.ADMIN_API_KEY
  }
})
