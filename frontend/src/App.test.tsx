import { afterEach, beforeEach, expect, test } from 'bun:test'
import { cleanup, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Window } from 'happy-dom'
import { readFileSync } from 'node:fs'
import App from './App'
import type { ChatMessage } from './api'

const encoder = new TextEncoder()

const jsonResponse = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify({ success: true, code: init.status ?? 200, message: 'success', data }), {
  status: init.status ?? 200,
  headers: { 'content-type': 'application/json' },
})

const streamResponse = () => new Response(new ReadableStream({
  start(controller) {
    controller.enqueue(encoder.encode('data: {"type":"sources","sources":[{"documentId":11,"title":"Guide","chunkIndex":0,"content":"alpha source chunk"}]}\n\n'))
    controller.enqueue(encoder.encode('data: {"type":"delta","content":"| 类别 | 技术栈 | |------|--------| | 编程语言 | alpha answer | | 后端技术 | Node.js |"}\n\n'))
    controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
    controller.close()
  },
}), {
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
})

const setupDom = (url = 'http://localhost/') => {
  const window = new Window({ url })
  Object.assign(globalThis, {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    File: window.File,
    FormData: window.FormData,
    localStorage: window.localStorage,
    crypto: window.crypto,
  })

  return window
}

beforeEach(() => {
  setupDom()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

test('console completes knowledge base, upload, widget embed, and streamed QA flow with mocked backend', async () => {
  const knowledgeBase = { id: 7, name: 'Product KB', description: 'Docs', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', documentCount: 0, widgetCount: 0, sessionCount: 0 }
  const documentItem = { id: 11, knowledgeBaseId: 7, category: 'Guide', title: 'Guide', fileName: 'guide.md', mimeType: 'text/markdown', fileSize: 42, parseStatus: 'COMPLETED', parseError: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', chunkCount: 2 }
  const textDocumentItem = { id: 12, knowledgeBaseId: 7, category: 'FAQ', title: 'FAQ Note', fileName: null, mimeType: null, fileSize: null, parseStatus: 'COMPLETED', parseError: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', chunkCount: 1 }
  const widgetItem = { id: 'widget-real-1', knowledgeBaseId: 7, title: 'Support widget', botName: 'Support Bot', botAvatar: null, welcomeMessage: 'Hi', systemPrompt: null, isEnabled: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
  let createdKnowledgeBase = false
  let uploadedDocument = false
  let pastedDocument = false
  let createdWidget = false
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    fetchCalls.push({ url, init })

    if (url.endsWith('/admin/knowledge-bases') && init?.method !== 'POST') {
      return jsonResponse(createdKnowledgeBase ? [{ ...knowledgeBase, documentCount: Number(uploadedDocument) + Number(pastedDocument), widgetCount: createdWidget ? 1 : 0 }] : [])
    }

    if (url.endsWith('/admin/knowledge-bases') && init?.method === 'POST') {
      createdKnowledgeBase = true
      return jsonResponse(knowledgeBase, { status: 201 })
    }

    if (url.includes('/rag/documents?knowledgeBaseId=7')) {
      return jsonResponse({
        items: [uploadedDocument ? documentItem : null, pastedDocument ? textDocumentItem : null].filter(Boolean),
        pagination: { page: 1, pageSize: 5, total: Number(uploadedDocument) + Number(pastedDocument), totalPages: 1 },
        categories: [uploadedDocument ? 'Guide' : null, pastedDocument ? 'FAQ' : null].filter(Boolean),
      })
    }

    if (url.endsWith('/admin/knowledge-bases/7/widgets')) {
      return jsonResponse(createdWidget ? [widgetItem] : [])
    }

    if (url.endsWith('/rag/documents/upload')) {
      uploadedDocument = true
      return jsonResponse({ id: 11, title: 'Guide', knowledgeBaseId: 7, category: 'Guide', chunkCount: 2, embeddingModel: 'test-embedding', duplicated: false }, { status: 201 })
    }

    if (url.endsWith('/rag/documents') && init?.method === 'POST') {
      pastedDocument = true
      return jsonResponse({ id: 12, title: 'FAQ Note', knowledgeBaseId: 7, category: 'FAQ', chunkCount: 1, embeddingModel: 'test-embedding', duplicated: false }, { status: 201 })
    }

    if (url.endsWith('/admin/widgets') && init?.method === 'POST') {
      createdWidget = true
      return jsonResponse(widgetItem, { status: 201 })
    }

    if (url.endsWith('/rag/query/stream')) {
      return streamResponse()
    }

    throw new Error(`Unhandled fetch ${url}`)
  }

  const user = userEvent.setup({ document: globalThis.document })
  const view = render(<App />)

  await user.click(view.getByRole('button', { name: '导航 连接' }))
  expect(view.queryByLabelText('API Base URL')).toBeNull()
  await user.type(view.getByLabelText('后台口令 / API Key'), 'test-admin-key')
  await user.click(view.getByRole('button', { name: '保存配置' }))
  await user.click(view.getByRole('button', { name: '导航 知识库' }))

  await user.type(view.getByLabelText('名称'), 'Product KB')
  await user.type(view.getByLabelText('描述'), 'Docs')
  await user.click(view.getByRole('button', { name: '创建知识库' }))
  expect(await view.findByText('Product KB')).toBeTruthy()

  await user.upload(view.getByLabelText('文件'), new File(['# Guide\nalpha source chunk'], 'guide.md', { type: 'text/markdown' }))
  await user.click(view.getByRole('button', { name: '上传文件入库' }))
  expect(await view.findByText('guide.md')).toBeTruthy()

  await user.type(view.getByLabelText('文本标题'), 'FAQ Note')
  await user.type(view.getByLabelText('文本 / Markdown 内容'), '# FAQ\nalpha markdown note')
  await user.click(view.getByRole('button', { name: '粘贴内容入库' }))
  expect(await view.findByText('FAQ Note')).toBeTruthy()
  expect(view.getAllByText('Guide').length).toBeGreaterThan(0)
  expect(view.getByText('第 1 / 1 页 · 共 2 条')).toBeTruthy()
  expect(view.getAllByText('COMPLETED').length).toBeGreaterThan(0)

  await user.click(view.getByRole('button', { name: '导航 机器人' }))
  await user.clear(view.getByLabelText('Header 标题'))
  await user.type(view.getByLabelText('Header 标题'), 'Support widget')
  await user.clear(view.getByLabelText('Bot Name'))
  await user.type(view.getByLabelText('Bot Name'), 'Support Bot')
  await user.click(view.getByRole('button', { name: '创建 Bot 配置' }))

  const embedCode = await view.findByLabelText('嵌入代码')
  expect(embedCode.textContent).toContain('src="http://localhost/widget.js"')
  expect(embedCode.textContent).toContain('data-widget-id="widget-real-1"')
  expect(embedCode.textContent).not.toContain('data-api-base-url')
  const copyButton = view.getByRole('button', { name: '复制' })
  await waitFor(() => expect(copyButton.hasAttribute('disabled')).toBe(false))
  expect(copyButton.hasAttribute('disabled')).toBe(false)

  await user.click(view.getByRole('button', { name: '导航 测试' }))
  await user.type(view.getByPlaceholderText('输入一个要从当前知识库检索的问题'), 'alpha?')
  await user.click(view.getByRole('button', { name: '测试问答' }))

  await waitFor(() => expect(within(view.getByLabelText('测试回答')).getByRole('columnheader', { name: '类别' })).toBeTruthy())
  expect(within(view.getByLabelText('测试回答')).getByText('编程语言')).toBeTruthy()
  expect(within(view.getByLabelText('测试回答')).getByText(/alpha answer/)).toBeTruthy()
  expect(within(view.getByLabelText('命中来源')).getByText(/alpha source chunk/)).toBeTruthy()
  const questionCall = fetchCalls.find((call) => call.url.endsWith('/rag/query/stream'))
  expect(questionCall).toBeTruthy()
  expect((questionCall?.init?.headers as Record<string, string>)['x-admin-api-key']).toBe('test-admin-key')
})

test('widget chat page creates a session, stores messages, then restores history after refresh', async () => {
  cleanup()
  setupDom('http://localhost/widget-chat?widgetId=widget-real-1&apiBaseUrl=/api')
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
  const savedMessages: Array<ChatMessage & { sessionId: string }> = []
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    fetchCalls.push({ url, init })

    if (url.endsWith('/widgets/widget-real-1/config')) {
      return jsonResponse({ id: 'widget-real-1', knowledgeBaseId: 7, title: 'Support widget', botName: 'Support Bot', botAvatar: null, welcomeMessage: 'Hi from bot' })
    }

    if (url.endsWith('/chat/sessions') && init?.method === 'POST') {
      return jsonResponse({ id: 'session-1', widgetId: 'widget-real-1', knowledgeBaseId: 7, visitorId: 'visitor-1', title: 'Support widget', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', messages: [] }, { status: 201 })
    }

    if (url.endsWith('/chat/sessions/session-1') && init?.method !== 'POST') {
      return jsonResponse({ id: 'session-1', widgetId: 'widget-real-1', knowledgeBaseId: 7, visitorId: 'visitor-1', title: 'Support widget', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:02:00.000Z', messages: savedMessages })
    }

    if (url.endsWith('/chat/sessions/session-1/messages/stream')) {
      savedMessages.push({ id: 1, sessionId: 'session-1', role: 'USER', content: 'alpha?', metadata: null, createdAt: '2026-01-01T00:00:30.000Z' })
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"message","message":{"id":1,"sessionId":"session-1","role":"USER","content":"alpha?","metadata":null,"createdAt":"2026-01-01T00:00:30.000Z"}}\n\n'))
          controller.enqueue(encoder.encode('data: {"type":"sources","sources":[{"documentId":11,"title":"Guide","chunkIndex":0,"content":"alpha source"}]}\n\n'))
          const markdownReply = '| 类别 | 内容 | |------|------| | 全栈开发能力 | streamed reply | | AI 能力 | RAG 检索 |'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: markdownReply })}\n\n`))
          savedMessages.push({ id: 2, sessionId: 'session-1', role: 'ASSISTANT', content: markdownReply, metadata: { sources: [] }, createdAt: '2026-01-01T00:01:00.000Z' })
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'message', message: { id: 2, sessionId: 'session-1', role: 'ASSISTANT', content: markdownReply, metadata: { sources: [] }, createdAt: '2026-01-01T00:01:00.000Z' } })}\n\n`))
          controller.close()
        },
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }

    throw new Error(`Unhandled fetch ${url}`)
  }

  const user = userEvent.setup({ document: globalThis.document })
  const view = render(<App />)

  expect(await view.findByText('Support Bot')).toBeTruthy()
  expect(await view.findByText('Hi from bot')).toBeTruthy()
  await user.type(view.getByLabelText('输入问题'), 'alpha?')
  await user.click(view.getByRole('button', { name: '发送' }))

  expect(await view.findByText('全栈开发能力')).toBeTruthy()
  expect(view.getByText(/streamed reply/)).toBeTruthy()
  expect(view.getByText(/命中 1 条知识片段/)).toBeTruthy()
  expect(savedMessages.map((message) => [message.role, message.content])).toEqual([
    ['USER', 'alpha?'],
    ['ASSISTANT', '| 类别 | 内容 | |------|------| | 全栈开发能力 | streamed reply | | AI 能力 | RAG 检索 |'],
  ])
  expect(localStorage.getItem('agent-rag-widget-session-widget-real-1')).toBe('session-1')

  cleanup()
  const reloaded = render(<App />)
  expect(await reloaded.findByText('全栈开发能力')).toBeTruthy()
  expect(reloaded.getByText('alpha?')).toBeTruthy()
  expect(fetchCalls.some((call) => call.url.endsWith('/chat/sessions/session-1'))).toBe(true)
  expect(fetchCalls.filter((call) => call.url.endsWith('/chat/sessions') && call.init?.method === 'POST')).toHaveLength(1)
})

test('widget sdk initializes launcher and iframe from a one-line external script', () => {
  cleanup()
  const window = setupDom('https://external.example/page.html')
  const script = document.createElement('script')
  script.src = 'https://app.example/widget.js'
  script.dataset.widgetId = 'widget-real-1'
  document.head.appendChild(script)

  const code = readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8')
  new Function('window', 'document', 'CSS', code)(window, window.document, undefined)

  const root = document.querySelector('[data-agent-rag-root="widget-real-1"]')
  expect(root).toBeTruthy()
  const launcher = root?.shadowRoot?.querySelector<HTMLButtonElement>('button.launcher')
  const iframe = root?.shadowRoot?.querySelector<HTMLIFrameElement>('iframe')
  expect(launcher).toBeTruthy()
  expect(launcher?.querySelector('img')?.src).toBe('https://app.example/widget-logo.jpeg')
  expect(iframe).toBeTruthy()
  expect(iframe?.src).toContain('https://app.example/widget-chat?widgetId=widget-real-1')
  expect(iframe?.src).not.toContain('apiBaseUrl=')

  launcher?.click()
  expect(launcher?.getAttribute('aria-expanded')).toBe('true')
  expect(root?.shadowRoot?.querySelector('.frame-wrap')?.classList.contains('open')).toBe(true)
})

test('widget launcher can be dragged and persists its position', () => {
  cleanup()
  const window = setupDom('https://external.example/page.html')
  const script = document.createElement('script')
  script.src = 'https://app.example/widget.js'
  script.dataset.widgetId = 'widget-drag'
  document.head.appendChild(script)

  const code = readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8')
  new Function('window', 'document', 'CSS', code)(window, window.document, undefined)

  const launcher = document
    .querySelector('[data-agent-rag-root="widget-drag"]')
    ?.shadowRoot
    ?.querySelector<HTMLButtonElement>('button.launcher')
  expect(launcher).toBeTruthy()

  launcher?.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: 20, clientY: 20 }))
  launcher?.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 120, clientY: 140 }))
  launcher?.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 120, clientY: 140 }))

  expect(launcher?.style.left).toBeTruthy()
  expect(launcher?.style.top).toBeTruthy()
  expect(localStorage.getItem('agent-rag-widget-position-widget-drag')).toBeTruthy()
})

test('widget sdk allows explicit api base url override', () => {
  cleanup()
  const window = setupDom('https://external.example/page.html')
  const script = document.createElement('script')
  script.src = 'https://app.example/widget.js'
  script.dataset.widgetId = 'widget-real-1'
  script.dataset.apiBaseUrl = 'https://api.example/api'
  document.head.appendChild(script)

  const code = readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8')
  new Function('window', 'document', 'CSS', code)(window, window.document, undefined)

  const iframe = document
    .querySelector('[data-agent-rag-root="widget-real-1"]')
    ?.shadowRoot
    ?.querySelector<HTMLIFrameElement>('iframe')
  expect(iframe?.src).toContain('apiBaseUrl=https%3A%2F%2Fapi.example%2Fapi')
})
