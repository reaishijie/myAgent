import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { ApiResponse } from '../core/response'
import { ChatSessionService } from '../services/chatSession.service'

const sessionIdParamSchema = z.object({
  sessionId: z.string().trim().min(1),
})

const createSessionSchema = z.object({
  widgetId: z.string().trim().min(1, 'Widget ID 不能为空'),
  visitorId: z.string().trim().max(120).optional().nullable(),
  title: z.string().trim().max(120).optional().nullable(),
})

const createMessageSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT', 'SYSTEM']),
  content: z.string().trim().min(1, '消息内容不能为空'),
  metadata: z.unknown().optional(),
})

const sendMessageSchema = z.object({
  content: z.string().trim().min(1, '消息内容不能为空'),
  topK: z.number().int().min(1).max(10).optional(),
})

const chatApp = new Hono()

chatApp.post('/sessions', zValidator('json', createSessionSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await ChatSessionService.create(data)

  return c.json(ApiResponse.success(result, '会话创建成功', 201), 201)
})

chatApp.get('/sessions/:sessionId', zValidator('param', sessionIdParamSchema), async (c) => {
  const { sessionId } = c.req.valid('param')
  const result = await ChatSessionService.get(sessionId)

  return c.json(ApiResponse.success(result))
})

chatApp.post('/sessions/:sessionId/messages', zValidator('param', sessionIdParamSchema), zValidator('json', createMessageSchema), async (c) => {
  const { sessionId } = c.req.valid('param')
  const data = c.req.valid('json')
  const result = await ChatSessionService.addMessage(sessionId, data)

  return c.json(ApiResponse.success(result, '消息已保存', 201), 201)
})

chatApp.post('/sessions/:sessionId/messages/stream', zValidator('param', sessionIdParamSchema), zValidator('json', sendMessageSchema), async (c) => {
  const { sessionId } = c.req.valid('param')
  const data = c.req.valid('json')
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of ChatSessionService.sendWidgetMessage(sessionId, data)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Stream failed'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8',
    },
  })
})

export default chatApp
