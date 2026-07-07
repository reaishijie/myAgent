import { NotFoundException } from '../core/exceptions'
import { getDb } from '../db'

interface CreateWidgetInput {
  knowledgeBaseId: number
  title: string
  botName?: string
  botAvatar?: string | null
  welcomeMessage?: string | null
  systemPrompt?: string | null
  isEnabled?: boolean
}

interface UpdateWidgetInput {
  knowledgeBaseId?: number
  title?: string
  botName?: string
  botAvatar?: string | null
  welcomeMessage?: string | null
  systemPrompt?: string | null
  isEnabled?: boolean
}

interface WidgetDependencies {
  db?: ReturnType<typeof getDb>
}

const widgetSelect = {
  id: true,
  knowledgeBaseId: true,
  title: true,
  botName: true,
  botAvatar: true,
  welcomeMessage: true,
  systemPrompt: true,
  isEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const

const publicWidgetSelect = {
  id: true,
  knowledgeBaseId: true,
  title: true,
  botName: true,
  botAvatar: true,
  welcomeMessage: true,
} as const

const ensureKnowledgeBaseExists = async (db: ReturnType<typeof getDb>, knowledgeBaseId: number) => {
  const knowledgeBase = await db.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    select: { id: true },
  })

  if (!knowledgeBase) {
    throw new NotFoundException('知识库不存在', 'KNOWLEDGE_BASE_NOT_FOUND')
  }
}

export const createWidgetService = (dependencies: WidgetDependencies = {}) => {
  const { db } = dependencies

  return {
    async listByKnowledgeBase(knowledgeBaseId: number) {
      const resolvedDb = db ?? getDb()
      await ensureKnowledgeBaseExists(resolvedDb, knowledgeBaseId)

      return resolvedDb.widget.findMany({
        where: { knowledgeBaseId },
        orderBy: { updatedAt: 'desc' },
        select: widgetSelect,
      })
    },

    async create(input: CreateWidgetInput) {
      const resolvedDb = db ?? getDb()
      await ensureKnowledgeBaseExists(resolvedDb, input.knowledgeBaseId)

      return resolvedDb.widget.create({
        data: {
          knowledgeBaseId: input.knowledgeBaseId,
          title: input.title.trim(),
          botName: input.botName?.trim() || 'AI Assistant',
          botAvatar: input.botAvatar?.trim() || null,
          welcomeMessage: input.welcomeMessage?.trim() || null,
          systemPrompt: input.systemPrompt?.trim() || null,
          isEnabled: input.isEnabled ?? true,
        },
        select: widgetSelect,
      })
    },

    async update(id: string, input: UpdateWidgetInput) {
      const resolvedDb = db ?? getDb()
      const existing = await resolvedDb.widget.findUnique({ where: { id }, select: { id: true } })
      if (!existing) {
        throw new NotFoundException('Widget 不存在', 'WIDGET_NOT_FOUND')
      }

      if (input.knowledgeBaseId) {
        await ensureKnowledgeBaseExists(resolvedDb, input.knowledgeBaseId)
      }

      return resolvedDb.widget.update({
        where: { id },
        data: {
          ...(input.knowledgeBaseId ? { knowledgeBaseId: input.knowledgeBaseId } : {}),
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.botName !== undefined ? { botName: input.botName.trim() || 'AI Assistant' } : {}),
          ...(input.botAvatar !== undefined ? { botAvatar: input.botAvatar?.trim() || null } : {}),
          ...(input.welcomeMessage !== undefined ? { welcomeMessage: input.welcomeMessage?.trim() || null } : {}),
          ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt?.trim() || null } : {}),
          ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        },
        select: widgetSelect,
      })
    },

    async get(id: string) {
      const resolvedDb = db ?? getDb()
      const item = await resolvedDb.widget.findUnique({ where: { id }, select: widgetSelect })
      if (!item) {
        throw new NotFoundException('Widget 不存在', 'WIDGET_NOT_FOUND')
      }

      return item
    },

    async getPublicConfig(id: string) {
      const resolvedDb = db ?? getDb()
      const item = await resolvedDb.widget.findFirst({
        where: { id, isEnabled: true },
        select: publicWidgetSelect,
      })
      if (!item) {
        throw new NotFoundException('Widget 不存在或已停用', 'WIDGET_NOT_FOUND')
      }

      return item
    },
  }
}

export const WidgetService = createWidgetService()
