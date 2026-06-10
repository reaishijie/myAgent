export type ResourceFilters = Record<string, unknown>

const isPresent = (value: unknown) => value !== undefined && value !== null && value !== ''
const numberKeys = new Set([
  'id',
  'userId',
  'modelId',
  'channelId',
  'conversationId',
  'generationJobId',
  'modelInvocationId',
  'skillId',
  'userSkillId',
])

const normalizeValue = (key: string, value: unknown) => {
  if (numberKeys.has(key)) {
    return typeof value === 'number' ? value : Number(value)
  }

  return value
}

export const pickFilters = (filters: ResourceFilters = {}, keys: string[]) => {
  const where: Record<string, unknown> = {}

  for (const key of keys) {
    const value = filters[key]
    if (isPresent(value)) {
      where[key] = normalizeValue(key, value)
    }
  }

  return where
}

export const createdAtRange = (filters: ResourceFilters = {}) => {
  const range: Record<string, unknown> = {}

  if (isPresent(filters.startAt)) {
    range.gte = filters.startAt instanceof Date ? filters.startAt : new Date(filters.startAt as string)
  }

  if (isPresent(filters.endAt)) {
    range.lte = filters.endAt instanceof Date ? filters.endAt : new Date(filters.endAt as string)
  }

  return Object.keys(range).length > 0 ? { createdAt: range } : {}
}
