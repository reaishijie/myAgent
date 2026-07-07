export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
  error?: {
    code?: string
    message?: string
  }
}

export interface ConsoleConfig {
  apiBaseUrl: string
  adminApiKey: string
}

export interface KnowledgeBase {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  documentCount: number
  widgetCount: number
  sessionCount: number
}

export interface DocumentCreateResult {
  id: number
  title: string
  knowledgeBaseId: number | null
  category: string | null
  chunkCount: number
  embeddingModel: string | null
  duplicated: boolean
}

export interface KnowledgeDocument {
  id: number
  knowledgeBaseId: number | null
  title: string
  category: string | null
  fileName: string | null
  mimeType: string | null
  fileSize: number | null
  parseStatus: string
  parseError: string | null
  createdAt: string | null
  updatedAt: string | null
  chunkCount: number
}

export interface DocumentListResult {
  items: KnowledgeDocument[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  categories: string[]
}

export interface WidgetConfig {
  id: string
  knowledgeBaseId: number
  title: string
  botName: string
  botAvatar: string | null
  welcomeMessage: string | null
  systemPrompt?: string | null
  isEnabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ChatMessage {
  id: number
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  metadata: unknown
  createdAt: string | null
}

export interface ChatSession {
  id: string
  widgetId: string
  knowledgeBaseId: number
  visitorId: string | null
  title: string | null
  createdAt: string | null
  updatedAt: string | null
  messages: ChatMessage[]
}

export interface SourceChunk {
  documentId: number
  title: string
  chunkIndex: number
  content: string
}

export type StreamEvent =
  | { type: 'sources'; sources: SourceChunk[] }
  | { type: 'delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface CreateWidgetPayload {
  knowledgeBaseId: number
  title: string
  botName?: string
  botAvatar?: string | null
  welcomeMessage?: string | null
  systemPrompt?: string | null
  isEnabled?: boolean
}

export const defaultApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

const configStorageKey = 'agent-rag-console-config'

export const loadConsoleConfig = (): ConsoleConfig => {
  try {
    const raw = localStorage.getItem(configStorageKey)
    if (!raw) {
      return { apiBaseUrl: defaultApiBaseUrl, adminApiKey: '' }
    }

    const parsed = JSON.parse(raw) as Partial<ConsoleConfig>
    return {
      apiBaseUrl: parsed.apiBaseUrl?.trim() || defaultApiBaseUrl,
      adminApiKey: parsed.adminApiKey ?? '',
    }
  } catch {
    return { apiBaseUrl: defaultApiBaseUrl, adminApiKey: '' }
  }
}

export const saveConsoleConfig = (config: ConsoleConfig) => {
  localStorage.setItem(configStorageKey, JSON.stringify({
    apiBaseUrl: config.apiBaseUrl.trim() || defaultApiBaseUrl,
    adminApiKey: config.adminApiKey,
  }))
}

const normalizeBaseUrl = (apiBaseUrl: string) => apiBaseUrl.replace(/\/+$/, '')

const buildUrl = (apiBaseUrl: string, path: string) => `${normalizeBaseUrl(apiBaseUrl)}${path}`

const parseEnvelope = async <T>(response: Response): Promise<T> => {
  const text = await response.text()
  const payload = text ? JSON.parse(text) as ApiEnvelope<T> : null

  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || payload?.message || `Request failed with ${response.status}`
    throw new Error(message)
  }

  if (!payload) {
    throw new Error('Empty API response')
  }

  return payload.data
}

const adminHeaders = (adminApiKey: string) => {
  if (!adminApiKey.trim()) {
    throw new Error('请先配置后台口令')
  }

  return { 'x-admin-api-key': adminApiKey.trim() }
}

export const createWidgetApiClient = (apiBaseUrl = defaultApiBaseUrl) => {
  const requestJson = async <T>(path: string, init: RequestInit = {}) => {
    const response = await fetch(buildUrl(apiBaseUrl, path), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    return parseEnvelope<T>(response)
  }

  return {
    getWidgetConfig: (widgetId: string) => requestJson<WidgetConfig>(`/widgets/${encodeURIComponent(widgetId)}/config`),

    createSession: (payload: { widgetId: string; visitorId?: string | null; title?: string | null }) => requestJson<ChatSession>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    getSession: (sessionId: string) => requestJson<ChatSession>(`/chat/sessions/${encodeURIComponent(sessionId)}`),

    streamMessage: async (sessionId: string, payload: { content: string; topK?: number }, onEvent: (event: StreamEvent | { type: 'message'; message: ChatMessage }) => void) => {
      const response = await fetch(buildUrl(apiBaseUrl, `/chat/sessions/${encodeURIComponent(sessionId)}/messages/stream`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Message stream failed with ${response.status}`)
      }

      await readSseStream(response, onEvent)
    },
  }
}

const readSseStream = async <T>(response: Response, onEvent: (event: T) => void) => {
  if (!response.body) {
    throw new Error('Stream response body is empty')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const rawEvent of events) {
      const line = rawEvent.split('\n').find((item) => item.startsWith('data: '))
      if (!line) {
        continue
      }

      onEvent(JSON.parse(line.slice(6)) as T)
    }
  }
}

export const createApiClient = (config: ConsoleConfig) => {
  const requestJson = async <T>(path: string, init: RequestInit = {}) => {
    const response = await fetch(buildUrl(config.apiBaseUrl, path), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    return parseEnvelope<T>(response)
  }

  const requestAdminJson = async <T>(path: string, init: RequestInit = {}) => requestJson<T>(path, {
    ...init,
    headers: {
      ...adminHeaders(config.adminApiKey),
      ...(init.headers ?? {}),
    },
  })

  return {
    listKnowledgeBases: () => requestAdminJson<KnowledgeBase[]>('/admin/knowledge-bases'),

    createKnowledgeBase: (payload: { name: string; description?: string }) => requestAdminJson<KnowledgeBase>('/admin/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    listDocuments: (payload: { knowledgeBaseId: number; category?: string; page?: number; pageSize?: number }) => {
      const params = new URLSearchParams({ knowledgeBaseId: String(payload.knowledgeBaseId) })
      if (payload.category?.trim()) params.set('category', payload.category.trim())
      if (payload.page) params.set('page', String(payload.page))
      if (payload.pageSize) params.set('pageSize', String(payload.pageSize))
      return requestAdminJson<DocumentListResult>(`/rag/documents?${params.toString()}`)
    },

    createTextDocument: (payload: { title: string; content: string; knowledgeBaseId?: number; category?: string }) => requestAdminJson<DocumentCreateResult>('/rag/documents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    uploadDocument: async (payload: { file: File; title?: string; knowledgeBaseId?: number; category?: string }) => {
      const form = new FormData()
      form.append('file', payload.file)
      if (payload.title?.trim()) {
        form.append('title', payload.title.trim())
      }
      if (payload.knowledgeBaseId) {
        form.append('knowledgeBaseId', String(payload.knowledgeBaseId))
      }
      if (payload.category?.trim()) {
        form.append('category', payload.category.trim())
      }

      const response = await fetch(buildUrl(config.apiBaseUrl, '/rag/documents/upload'), {
        method: 'POST',
        headers: adminHeaders(config.adminApiKey),
        body: form,
      })

      return parseEnvelope<DocumentCreateResult>(response)
    },

    listWidgets: (knowledgeBaseId: number) => requestAdminJson<WidgetConfig[]>(`/admin/knowledge-bases/${knowledgeBaseId}/widgets`),

    createWidget: (payload: CreateWidgetPayload) => requestAdminJson<WidgetConfig>('/admin/widgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

    updateWidget: (widgetId: string, payload: Partial<CreateWidgetPayload>) => requestAdminJson<WidgetConfig>(`/admin/widgets/${widgetId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

    streamQuestion: async (payload: { question: string; topK: number; knowledgeBaseId?: number; widgetId?: string; category?: string }, onEvent: (event: StreamEvent) => void) => {
      const response = await fetch(buildUrl(config.apiBaseUrl, '/rag/query/stream'), {
        method: 'POST',
        headers: payload.widgetId
          ? { 'content-type': 'application/json' }
          : { 'content-type': 'application/json', ...adminHeaders(config.adminApiKey) },
        body: JSON.stringify(payload),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Question stream failed with ${response.status}`)
      }

      await readSseStream<StreamEvent>(response, onEvent)
    },
  }
}
