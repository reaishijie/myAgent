import { NotFoundException } from '../core/exceptions'
import { getDb } from '../db'

interface CreateKnowledgeBaseInput {
  name: string
  description?: string | null
}

interface KnowledgeBaseDependencies {
  db?: ReturnType<typeof getDb>
}

const knowledgeBaseSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      documents: true,
      widgets: true,
      sessions: true,
    },
  },
} as const

const toKnowledgeBaseOutput = (item: any) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  documentCount: item._count?.documents ?? 0,
  widgetCount: item._count?.widgets ?? 0,
  sessionCount: item._count?.sessions ?? 0,
})

export const createKnowledgeBaseService = (dependencies: KnowledgeBaseDependencies = {}) => {
  const { db } = dependencies

  return {
    async list() {
      const resolvedDb = db ?? getDb()
      const items = await resolvedDb.knowledgeBase.findMany({
        orderBy: { createdAt: 'desc' },
        select: knowledgeBaseSelect,
      })

      return items.map(toKnowledgeBaseOutput)
    },

    async create(input: CreateKnowledgeBaseInput) {
      const resolvedDb = db ?? getDb()
      const item = await resolvedDb.knowledgeBase.create({
        data: {
          name: input.name.trim(),
          description: input.description?.trim() || null,
        },
        select: knowledgeBaseSelect,
      })

      return toKnowledgeBaseOutput(item)
    },

    async get(id: number) {
      const resolvedDb = db ?? getDb()
      const item = await resolvedDb.knowledgeBase.findUnique({
        where: { id },
        select: knowledgeBaseSelect,
      })

      if (!item) {
        throw new NotFoundException('知识库不存在', 'KNOWLEDGE_BASE_NOT_FOUND')
      }

      return toKnowledgeBaseOutput(item)
    },
  }
}

export const KnowledgeBaseService = createKnowledgeBaseService()
