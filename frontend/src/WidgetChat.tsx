import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createWidgetApiClient, defaultApiBaseUrl } from './api'
import type { ChatMessage, ChatSession, SourceChunk, WidgetConfig } from './api'

interface WidgetChatProps {
  widgetId: string
  apiBaseUrl?: string
}

type LocalMessage = {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
  streaming?: boolean
}

type ChatStatus = 'loading' | 'ready' | 'sending' | 'receiving' | 'error'

const visitorStorageKey = 'agent-rag-widget-visitor-id'
const sessionStoragePrefix = 'agent-rag-widget-session-'

const getOrCreateVisitorId = () => {
  const existing = localStorage.getItem(visitorStorageKey)
  if (existing) {
    return existing
  }

  const next = `visitor-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
  localStorage.setItem(visitorStorageKey, next)
  return next
}

const toLocalMessage = (message: ChatMessage): LocalMessage => ({
  id: String(message.id),
  role: message.role === 'ASSISTANT' ? 'ASSISTANT' : 'USER',
  content: message.content,
  createdAt: message.createdAt ?? new Date().toISOString(),
})

const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value))

const avatarFallback = (name: string) => name.trim().slice(0, 1).toUpperCase() || 'A'

const parseInlineMarkdown = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = []
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))
    if (match[2] && match[3]) nodes.push(<a href={match[3]} key={`${match.index}-link`} target="_blank" rel="noreferrer">{match[2]}</a>)
    else if (match[5]) nodes.push(<strong key={`${match.index}-strong`}>{match[5]}</strong>)
    else if (match[7]) nodes.push(<code key={`${match.index}-code`}>{match[7]}</code>)
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

const normalizeMarkdownContent = (content: string) => content
  .replace(/([^\n])\s+([-*+]\s+\*\*[^*]+\*\*[：:])/g, '$1\n$2')
  .replace(/([^\n])\s+(\d+\.\s+\*\*[^*]+\*\*[：:])/g, '$1\n$2')
  .replace(/([^\n])\s+(#{1,4}\s+)/g, '$1\n$2')
  .replace(/\|\s+(?=\|)/g, '|\n')

const isListLine = (line: string) => /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(line)
const isHeadingLine = (line: string) => /^#{1,4}\s+/.test(line)
const isTableLine = (line: string) => /^\s*\|.+\|\s*$/.test(line)
const isTableSeparatorLine = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
const parseTableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())

function MarkdownMessage({ content, fallback }: { content: string; fallback?: string }) {
  const normalizedContent = normalizeMarkdownContent(content)
  if (!normalizedContent.trim()) return fallback ? <p>{fallback}</p> : null

  const lines = normalizedContent.split('\n')
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      index += index < lines.length ? 1 : 0
      blocks.push(<pre key={`code-${index}`}><code>{codeLines.join('\n')}</code></pre>)
      continue
    }

    if (isTableLine(line) && index + 1 < lines.length && isTableSeparatorLine(lines[index + 1])) {
      const headers = parseTableCells(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && isTableLine(lines[index])) {
        rows.push(parseTableCells(lines[index]))
        index += 1
      }
      blocks.push(
        <div className="widget-markdown-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>{headers.map((header, cellIndex) => <th key={`head-${cellIndex}`}>{parseInlineMarkdown(header)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => <td key={`cell-${cellIndex}`}>{parseInlineMarkdown(row[cellIndex] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const children = parseInlineMarkdown(heading[2])
      if (level <= 2) blocks.push(<h3 key={`heading-${index}`}>{children}</h3>)
      else blocks.push(<h4 key={`heading-${index}`}>{children}</h4>)
      index += 1
      continue
    }

    if (isListLine(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items: ReactNode[] = []
      while (index < lines.length && isListLine(lines[index]) && /^\s*\d+\.\s+/.test(lines[index]) === ordered) {
        items.push(<li key={`item-${index}`}>{parseInlineMarkdown(lines[index].replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, ''))}</li>)
        index += 1
      }
      blocks.push(ordered ? <ol key={`list-${index}`}>{items}</ol> : <ul key={`list-${index}`}>{items}</ul>)
      continue
    }

    const paragraph: string[] = [trimmed]
    index += 1
    while (index < lines.length && lines[index].trim() && !isHeadingLine(lines[index]) && !isListLine(lines[index]) && !lines[index].trim().startsWith('```')) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push(<p key={`paragraph-${index}`}>{parseInlineMarkdown(paragraph.join(' '))}</p>)
  }

  return <div className="widget-markdown-message">{blocks}</div>
}

export function WidgetChat({ widgetId, apiBaseUrl = defaultApiBaseUrl }: WidgetChatProps) {
  const api = useMemo(() => createWidgetApiClient(apiBaseUrl), [apiBaseUrl])
  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<ChatStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<SourceChunk[]>([])
  const endRef = useRef<HTMLDivElement | null>(null)

  const sessionStorageKey = `${sessionStoragePrefix}${widgetId}`

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, status])

  const bootstrap = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const loadedConfig = await api.getWidgetConfig(widgetId)
      setConfig(loadedConfig)

      const existingSessionId = localStorage.getItem(sessionStorageKey)
      let activeSession: ChatSession | null = null
      if (existingSessionId) {
        try {
          activeSession = await api.getSession(existingSessionId)
        } catch {
          localStorage.removeItem(sessionStorageKey)
        }
      }

      if (!activeSession) {
        activeSession = await api.createSession({
          widgetId,
          visitorId: getOrCreateVisitorId(),
          title: loadedConfig.title,
        })
        localStorage.setItem(sessionStorageKey, activeSession.id)
      }

      setSession(activeSession)
      const persistedMessages = activeSession.messages
        .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
        .map(toLocalMessage)
      setMessages(persistedMessages.length > 0 ? persistedMessages : (loadedConfig.welcomeMessage ? [{
        id: 'welcome',
        role: 'ASSISTANT',
        content: loadedConfig.welcomeMessage,
        createdAt: new Date().toISOString(),
      }] : []))
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : '聊天窗口加载失败')
      setStatus('error')
    }
  }, [api, sessionStorageKey, widgetId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void bootstrap()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [bootstrap])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = input.trim()
    if (!content || !session || status === 'sending' || status === 'receiving') {
      return
    }

    const now = new Date().toISOString()
    const assistantId = `assistant-${Date.now()}`
    setInput('')
    setSources([])
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'USER', content, createdAt: now },
      { id: assistantId, role: 'ASSISTANT', content: '', createdAt: now, streaming: true },
    ])

    try {
      setStatus('sending')
      await api.streamMessage(session.id, { content, topK: 5 }, (eventData) => {
        if (eventData.type === 'sources') {
          setSources(eventData.sources)
        }
        if (eventData.type === 'delta') {
          setStatus('receiving')
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, content: `${message.content}${eventData.content}` }
            : message))
        }
        if (eventData.type === 'message' && eventData.message.role === 'ASSISTANT') {
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...toLocalMessage(eventData.message), id: assistantId, streaming: false }
            : message))
        }
        if (eventData.type === 'error') {
          throw new Error(eventData.message)
        }
      })
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : '消息发送失败')
      setStatus('error')
      setMessages((current) => current.map((message) => message.id === assistantId
        ? { ...message, content: message.content || '回答失败，请重试。', streaming: false }
        : message))
    }
  }

  const isBusy = status === 'loading' || status === 'sending' || status === 'receiving'
  const botName = config?.botName ?? 'AI Assistant'

  return (
    <main className="widget-chat-shell">
      <header className="widget-chat-header">
        <div className="widget-avatar" aria-hidden="true">
          {config?.botAvatar ? <img src={config.botAvatar} alt="" /> : <span>{avatarFallback(botName)}</span>}
        </div>
        <div>
          <p>{config?.title ?? 'Knowledge chat'}</p>
          <strong>{botName}</strong>
        </div>
        <span className={`widget-status ${isBusy ? 'busy' : 'ready'}`}>{isBusy ? 'Streaming' : 'Online'}</span>
      </header>

      <section className="widget-chat-messages" aria-live="polite">
        {messages.map((message) => (
          <article className={`widget-message ${message.role.toLowerCase()}`} key={message.id}>
            <div className="widget-message-bubble">
              <MarkdownMessage content={message.content} fallback={message.streaming ? '正在思考中...' : ''} />
              {message.streaming && <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>}
            </div>
            <time>{formatTime(message.createdAt)}</time>
          </article>
        ))}
        <div ref={endRef} />
      </section>

      {sources.length > 0 && (
        <details className="widget-sources">
          <summary>命中 {sources.length} 条知识片段</summary>
          {sources.slice(0, 3).map((source) => (
            <p key={`${source.documentId}-${source.chunkIndex}`}>{source.title} · chunk {source.chunkIndex}</p>
          ))}
        </details>
      )}

      {error && (
        <div className="widget-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void bootstrap()}>重试</button>
        </div>
      )}

      <form className="widget-chat-form" onSubmit={submit}>
        <textarea
          aria-label="输入问题"
          disabled={!session || status === 'loading'}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="输入问题，Enter 发送"
          value={input}
        />
        <button disabled={!input.trim() || !session || isBusy} type="submit">
          {status === 'sending' || status === 'receiving' ? '生成中' : '发送'}
        </button>
      </form>
    </main>
  )
}
