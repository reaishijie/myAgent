import { expect, test } from 'bun:test'
import { createChatSessionService } from './chatSession.service'

test('chat session service creates a session from enabled widget', async () => {
  const db = {
    widget: {
      findFirst: async () => ({ id: 'widget-1', knowledgeBaseId: 7 }),
    },
    chatSession: {
      create: async ({ data }: any) => ({ id: 'session-1', ...data, createdAt: null, updatedAt: null, messages: [] }),
    },
  }

  const service = createChatSessionService({ db: db as any })
  const result = await service.create({ widgetId: 'widget-1', visitorId: '  visitor  ', title: '  Chat  ' })

  expect(result).toEqual({
    id: 'session-1',
    widgetId: 'widget-1',
    knowledgeBaseId: 7,
    visitorId: 'visitor',
    title: 'Chat',
    createdAt: null,
    updatedAt: null,
    messages: [],
  })
})

test('chat session service saves a message', async () => {
  const db = {
    chatSession: {
      findUnique: async () => ({ id: 'session-1' }),
    },
    chatMessage: {
      create: async ({ data }: any) => ({ id: 1, ...data, createdAt: null }),
    },
  }

  const service = createChatSessionService({ db: db as any })
  const result = await service.addMessage('session-1', { role: 'USER', content: '  hello  ', metadata: { source: 'test' } })

  expect(result).toEqual({
    id: 1,
    sessionId: 'session-1',
    role: 'USER',
    content: 'hello',
    metadata: { source: 'test' },
    createdAt: null,
  })
})

test('chat session service streams a widget answer and persists both sides', async () => {
  const savedMessages: any[] = []
  const db = {
    chatSession: {
      findUnique: async () => ({ id: 'session-1', widgetId: 'widget-1', knowledgeBaseId: 7, widget: { id: 'widget-1', isEnabled: true } }),
    },
    chatMessage: {
      create: async ({ data }: any) => {
        const message = { id: savedMessages.length + 1, ...data, metadata: data.metadata ?? null, createdAt: null }
        savedMessages.push(message)
        return message
      },
    },
  }
  async function* queryStream(input: any) {
    expect(input).toMatchObject({ question: 'hello', knowledgeBaseId: 7, widgetId: 'widget-1' })
    yield { type: 'sources' as const, sources: [{ documentId: 1, title: 'Doc', chunkIndex: 0, content: 'hello source' }] }
    yield { type: 'delta' as const, content: 'hi ' }
    yield { type: 'delta' as const, content: 'there' }
    yield { type: 'done' as const }
  }

  const service = createChatSessionService({ db: db as any, queryStream: queryStream as any })
  const events = []
  for await (const event of service.sendWidgetMessage('session-1', { content: '  hello  ' })) {
    events.push(event)
  }

  expect(events.map((event: any) => event.type)).toEqual(['message', 'sources', 'delta', 'delta', 'done', 'message'])
  expect(savedMessages.map((message) => [message.role, message.content])).toEqual([
    ['USER', 'hello'],
    ['ASSISTANT', 'hi there'],
  ])
  expect(savedMessages[1].metadata.sources).toHaveLength(1)
})

test('chat session service can read back persisted widget conversation history', async () => {
  const persistedMessages = [
    { id: 1, role: 'USER', content: 'hello', metadata: null, createdAt: '2026-01-01T00:00:30.000Z' },
    { id: 2, role: 'ASSISTANT', content: 'hi there', metadata: { sources: [] }, createdAt: '2026-01-01T00:01:00.000Z' },
  ]
  const db = {
    chatSession: {
      findUnique: async ({ where }: any) => where.id === 'session-1'
        ? {
          id: 'session-1',
          widgetId: 'widget-1',
          knowledgeBaseId: 7,
          visitorId: 'visitor-1',
          title: 'Support widget',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:01:00.000Z',
          messages: persistedMessages,
        }
        : null,
    },
  }

  const service = createChatSessionService({ db: db as any })
  const session = await service.get('session-1')

  expect(session.messages).toEqual(persistedMessages)
  expect(session.messages.map((message: any) => [message.role, message.content])).toEqual([
    ['USER', 'hello'],
    ['ASSISTANT', 'hi there'],
  ])
})
