import type { ChatMessageRole } from '@prisma/client'
import { BadRequestException, NotFoundException } from '../core/exceptions'
import { getDb } from '../db'
import { RagService } from './rag.service'

interface CreateChatSessionInput {
  widgetId: string
  visitorId?: string | null
  title?: string | null
}

interface AddChatMessageInput {
  role: ChatMessageRole
  content: string
  metadata?: unknown
}

interface SendWidgetMessageInput {
  content: string
  topK?: number
}

interface ChatSessionDependencies {
  db?: ReturnType<typeof getDb>
  queryStream?: typeof RagService.queryStream
}

const sessionSelect = {
  id: true,
  widgetId: true,
  knowledgeBaseId: true,
  visitorId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  messages: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      role: true,
      content: true,
      metadata: true,
      createdAt: true,
    },
  },
} as const

const messageSelect = {
  id: true,
  sessionId: true,
  role: true,
  content: true,
  metadata: true,
  createdAt: true,
} as const

export const createChatSessionService = (dependencies: ChatSessionDependencies = {}) => {
  const { db, queryStream = RagService.queryStream.bind(RagService) } = dependencies

  return {
    async create(input: CreateChatSessionInput) {
      const resolvedDb = db ?? getDb()
      const widget = await resolvedDb.widget.findFirst({
        where: { id: input.widgetId, isEnabled: true },
        select: { id: true, knowledgeBaseId: true },
      })

      if (!widget) {
        throw new NotFoundException('Widget 不存在或已停用', 'WIDGET_NOT_FOUND')
      }

      return resolvedDb.chatSession.create({
        data: {
          widgetId: widget.id,
          knowledgeBaseId: widget.knowledgeBaseId,
          visitorId: input.visitorId?.trim() || null,
          title: input.title?.trim() || null,
        },
        select: sessionSelect,
      })
    },

    async get(id: string) {
      const resolvedDb = db ?? getDb()
      const session = await resolvedDb.chatSession.findUnique({
        where: { id },
        select: sessionSelect,
      })

      if (!session) {
        throw new NotFoundException('会话不存在', 'CHAT_SESSION_NOT_FOUND')
      }

      return session
    },

    async addMessage(sessionId: string, input: AddChatMessageInput) {
      const resolvedDb = db ?? getDb()
      const session = await resolvedDb.chatSession.findUnique({
        where: { id: sessionId },
        select: { id: true },
      })

      if (!session) {
        throw new NotFoundException('会话不存在', 'CHAT_SESSION_NOT_FOUND')
      }

      return resolvedDb.chatMessage.create({
        data: {
          sessionId,
          role: input.role,
          content: input.content.trim(),
          metadata: input.metadata === undefined ? undefined : input.metadata as any,
        },
        select: messageSelect,
      })
    },

    async *sendWidgetMessage(sessionId: string, input: SendWidgetMessageInput) {
      const resolvedDb = db ?? getDb()
      const content = input.content.trim()
      if (!content) {
        throw new BadRequestException('消息内容不能为空', 'CHAT_MESSAGE_EMPTY')
      }

      const session = await resolvedDb.chatSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          widgetId: true,
          knowledgeBaseId: true,
          widget: { select: { id: true, isEnabled: true } },
        },
      })

      if (!session) {
        throw new NotFoundException('会话不存在', 'CHAT_SESSION_NOT_FOUND')
      }
      if (!session.widget?.isEnabled) {
        throw new NotFoundException('Widget 不存在或已停用', 'WIDGET_NOT_FOUND')
      }

      const userMessage = await resolvedDb.chatMessage.create({
        data: { sessionId, role: 'USER', content },
        select: messageSelect,
      })
      yield { type: 'message' as const, message: userMessage }

      let answer = ''
      let latestSources: unknown[] = []
      for await (const event of queryStream({
        question: content,
        topK: input.topK ?? 5,
        knowledgeBaseId: session.knowledgeBaseId,
        widgetId: session.widgetId,
      })) {
        if (event.type === 'sources') {
          latestSources = event.sources
        }
        if (event.type === 'delta') {
          answer += event.content
        }
        yield event
      }

      const assistantMessage = await resolvedDb.chatMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: answer || '知识库中没有找到相关内容。',
          metadata: { sources: latestSources },
        },
        select: messageSelect,
      })
      yield { type: 'message' as const, message: assistantMessage }
    },
  }
}

export const ChatSessionService = createChatSessionService()
