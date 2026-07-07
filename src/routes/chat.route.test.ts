import { expect, test } from 'bun:test'
import chatApp from './chat.route'
import { ChatSessionService } from '../services/chatSession.service'

const readSseMessages = async (response: Response) => {
  const text = await response.text()
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((event) => JSON.parse(event.replace(/^data: /, '')))
}

test('chat stream hides internal errors from public SSE response', async () => {
  const original = ChatSessionService.sendWidgetMessage
  ChatSessionService.sendWidgetMessage = (async function* () {
    throw new Error('Unique constraint failed on the fields: (`id`)')
  }) as typeof ChatSessionService.sendWidgetMessage

  try {
    const response = await chatApp.request('/sessions/session-1/messages/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    })

    expect(response.status).toBe(200)
    const events = await readSseMessages(response)
    expect(events).toEqual([{ type: 'error', message: '回答失败，请稍后重试。' }])
  } finally {
    ChatSessionService.sendWidgetMessage = original
  }
})
