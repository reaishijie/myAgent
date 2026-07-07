import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  createApiClient,
  defaultApiBaseUrl,
  loadConsoleConfig,
  saveConsoleConfig,
} from './api'
import type {
  ConsoleConfig,
  KnowledgeBase,
  KnowledgeDocument,
  SourceChunk,
  WidgetConfig,
} from './api'
import { WidgetChat } from './WidgetChat'
import './styles.css'

interface Notice {
  type: 'success' | 'error' | 'info'
  message: string
}

type BusyKey = 'knowledge' | 'upload' | 'widget' | 'question' | 'copy'
type ConsoleRoute = '/' | '/settings' | '/knowledge' | '/documents' | '/widget' | '/playground'

const routes: Array<{ path: ConsoleRoute; label: string; eyebrow: string; title: string }> = [
  { path: '/', label: '总览', eyebrow: 'Flow', title: '执行总览' },
  { path: '/settings', label: '连接', eyebrow: 'Connection', title: '后台口令' },
  { path: '/knowledge', label: '知识库', eyebrow: 'Knowledge', title: '知识库管理' },
  { path: '/documents', label: '文档', eyebrow: 'Documents', title: '文档入库' },
  { path: '/widget', label: '机器人', eyebrow: 'Widget', title: 'Widget 配置' },
  { path: '/playground', label: '测试', eyebrow: 'Playground', title: '知识库问答测试' },
]

const initialWidgetForm = {
  title: 'Website assistant',
  botName: 'AI Assistant',
  botAvatar: '',
  welcomeMessage: '你好，我可以根据知识库内容回答问题。',
  systemPrompt: '',
  isEnabled: true,
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试'

const uniqueKnowledgeBases = (items: KnowledgeBase[]) => Array.from(
  new Map(items.map((item) => [item.id, item])).values(),
)

const getConsoleRoute = (): ConsoleRoute => {
  const path = window.location.pathname as ConsoleRoute
  return routes.some((item) => item.path === path) ? path : '/'
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '未记录'
  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const parseInlineMarkdown = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = []
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index))
    }

    if (match[2] && match[3]) {
      nodes.push(<a href={match[3]} key={`${match.index}-link`} target="_blank" rel="noreferrer">{match[2]}</a>)
    } else if (match[5]) {
      nodes.push(<strong key={`${match.index}-strong`}>{match[5]}</strong>)
    } else if (match[7]) {
      nodes.push(<code key={`${match.index}-code`}>{match[7]}</code>)
    }

    cursor = match.index + match[0].length
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes
}

const isListLine = (line: string) => /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(line)
const isHeadingLine = (line: string) => /^#{1,4}\s+/.test(line)
const isTableLine = (line: string) => /^\s*\|.+\|\s*$/.test(line)
const isTableSeparatorLine = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
const parseTableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())

const normalizeMarkdownContent = (content: string) => content
  // Some LLMs stream compact Markdown like "说明： - **A**：... - **B**：...".
  // Make these bullets render as real list items even when the model forgot newlines.
  .replace(/([^\n])\s+([-*+]\s+\*\*[^*]+\*\*[：:])/g, '$1\n$2')
  .replace(/([^\n])\s+(\d+\.\s+\*\*[^*]+\*\*[：:])/g, '$1\n$2')
  .replace(/([^\n])\s+(#{1,4}\s+)/g, '$1\n$2')
  // Compact Markdown tables may arrive as "| A | B | |---|---| | a | b |".
  .replace(/\|\s+(?=\|)/g, '|\n')

function MarkdownAnswer({ content }: { content: string }) {
  const normalizedContent = normalizeMarkdownContent(content)

  if (!normalizedContent.trim()) {
    return <p className="muted">流式回答会显示在这里。</p>
  }

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
      const language = trimmed.slice(3).trim()
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      index += index < lines.length ? 1 : 0
      blocks.push(<pre key={`code-${index}`}><code data-language={language || undefined}>{codeLines.join('\n')}</code></pre>)
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
        <div className="markdown-table-wrap" key={`table-${index}`}>
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
      if (level === 1) blocks.push(<h1 key={`heading-${index}`}>{children}</h1>)
      else if (level === 2) blocks.push(<h2 key={`heading-${index}`}>{children}</h2>)
      else if (level === 3) blocks.push(<h3 key={`heading-${index}`}>{children}</h3>)
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

  return <div className="markdown-answer">{blocks}</div>
}

function ConsoleApp() {
  const [route, setRoute] = useState<ConsoleRoute>(() => getConsoleRoute())
  const [config, setConfig] = useState<ConsoleConfig>(() => loadConsoleConfig())
  const [configDraft, setConfigDraft] = useState<ConsoleConfig>(() => loadConsoleConfig())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState<BusyKey | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<number | null>(null)
  const [knowledgeForm, setKnowledgeForm] = useState({ name: '', description: '' })
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [textTitle, setTextTitle] = useState('')
  const [textCategory, setTextCategory] = useState('')
  const [textContent, setTextContent] = useState('')
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [documentCategories, setDocumentCategories] = useState<string[]>([])
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState('')
  const [documentPagination, setDocumentPagination] = useState({ page: 1, pageSize: 5, total: 0, totalPages: 1 })
  const [widget, setWidget] = useState<WidgetConfig | null>(null)
  const [widgetForm, setWidgetForm] = useState(initialWidgetForm)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<SourceChunk[]>([])
  const knowledgeLoadRequestId = useRef(0)
  const selectedKnowledgeBaseIdRef = useRef<number | null>(null)
  const documentCategoryFilterRef = useRef('')
  const documentPageRef = useRef(1)

  const api = useMemo(() => createApiClient(config), [config])
  const hasAdminKey = Boolean(config.adminApiKey.trim())
  const selectedKnowledgeBase = knowledgeBases.find((item) => item.id === selectedKnowledgeBaseId) ?? null
  const canUseKnowledgeBase = hasAdminKey && selectedKnowledgeBaseId !== null
  const widgetScriptUrl = `${window.location.origin}/widget.js`
  const embedCode = widget
    ? `<script src="${widgetScriptUrl}" data-widget-id="${widget.id}" defer></script>`
    : ''
  const currentRoute = routes.find((item) => item.path === route) ?? routes[0]
  const totalDocuments = knowledgeBases.reduce((sum, item) => sum + item.documentCount, 0)
  const totalWidgets = knowledgeBases.reduce((sum, item) => sum + item.widgetCount, 0)
  const completedSteps = [hasAdminKey, knowledgeBases.length > 0, documents.length > 0, Boolean(widget), sources.length > 0 || answer.length > 0].filter(Boolean).length

  const navigate = useCallback((nextRoute: ConsoleRoute) => {
    window.history.pushState({}, '', nextRoute)
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const syncRoute = () => setRoute(getConsoleRoute())
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    selectedKnowledgeBaseIdRef.current = selectedKnowledgeBaseId
  }, [selectedKnowledgeBaseId])

  useEffect(() => {
    documentCategoryFilterRef.current = documentCategoryFilter
  }, [documentCategoryFilter])

  const applyWidgetToForm = useCallback((nextWidget: WidgetConfig | null, fallbackTitle: string) => {
    setWidget(nextWidget)
    setWidgetForm(nextWidget
      ? {
        title: nextWidget.title,
        botName: nextWidget.botName,
        botAvatar: nextWidget.botAvatar ?? '',
        welcomeMessage: nextWidget.welcomeMessage ?? '',
        systemPrompt: nextWidget.systemPrompt ?? '',
        isEnabled: nextWidget.isEnabled ?? true,
      }
      : { ...initialWidgetForm, title: fallbackTitle })
  }, [])

  const loadKnowledgeBaseDetails = useCallback(async (knowledgeBase: KnowledgeBase, options: { category?: string; page?: number } = {}) => {
    try {
      const category = options.category ?? documentCategoryFilterRef.current
      const page = options.page ?? documentPageRef.current
      const [loadedDocuments, loadedWidgets] = await Promise.all([
        api.listDocuments({ knowledgeBaseId: knowledgeBase.id, category, page, pageSize: 5 }),
        api.listWidgets(knowledgeBase.id),
      ])
      setDocuments(loadedDocuments.items)
      setDocumentPagination(loadedDocuments.pagination)
      setDocumentCategories(loadedDocuments.categories)
      applyWidgetToForm(loadedWidgets[0] ?? null, `${knowledgeBase.name} assistant`)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    }
  }, [api, applyWidgetToForm])

  const loadKnowledgeBases = useCallback(async () => {
    if (!hasAdminKey) return

    const requestId = knowledgeLoadRequestId.current + 1
    knowledgeLoadRequestId.current = requestId

    try {
      setBusy('knowledge')
      const items = await api.listKnowledgeBases()
      if (requestId !== knowledgeLoadRequestId.current) return

      setKnowledgeBases(uniqueKnowledgeBases(items))
      const currentSelectedId = selectedKnowledgeBaseIdRef.current
      const nextSelectedId = currentSelectedId && items.some((item) => item.id === currentSelectedId)
        ? currentSelectedId
        : items[0]?.id ?? null
      selectedKnowledgeBaseIdRef.current = nextSelectedId
      setSelectedKnowledgeBaseId(nextSelectedId)
      const nextSelected = items.find((item) => item.id === nextSelectedId)
      if (nextSelected) {
        await loadKnowledgeBaseDetails(nextSelected)
      } else {
        setDocuments([])
        applyWidgetToForm(null, initialWidgetForm.title)
      }
    } catch (error) {
      if (requestId === knowledgeLoadRequestId.current) {
        setNotice({ type: 'error', message: getErrorMessage(error) })
      }
    } finally {
      if (requestId === knowledgeLoadRequestId.current) {
        setBusy(null)
      }
    }
  }, [api, applyWidgetToForm, hasAdminKey, loadKnowledgeBaseDetails])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKnowledgeBases()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadKnowledgeBases])

  const selectKnowledgeBase = (item: KnowledgeBase) => {
    selectedKnowledgeBaseIdRef.current = item.id
    documentCategoryFilterRef.current = ''
    documentPageRef.current = 1
    setSelectedKnowledgeBaseId(item.id)
    setDocumentCategoryFilter('')
    void loadKnowledgeBaseDetails(item, { category: '', page: 1 })
  }

  const handleSaveConfig = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextConfig = {
      adminApiKey: configDraft.adminApiKey.trim(),
    }
    knowledgeLoadRequestId.current += 1
    saveConsoleConfig(nextConfig)
    setConfig(nextConfig)
    setConfigDraft(nextConfig)
    setNotice({ type: 'success', message: '后台口令已保存到当前浏览器' })
  }

  const handleCreateKnowledgeBase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = knowledgeForm.name.trim()
    if (!name) {
      setNotice({ type: 'error', message: '请输入知识库名称' })
      return
    }

    try {
      setBusy('knowledge')
      const created = await api.createKnowledgeBase({
        name,
        description: knowledgeForm.description.trim() || undefined,
      })
      knowledgeLoadRequestId.current += 1
      setKnowledgeBases((items) => uniqueKnowledgeBases([created, ...items]))
      selectKnowledgeBase(created)
      setKnowledgeForm({ name: '', description: '' })
      setNotice({ type: 'success', message: '知识库创建成功' })
      navigate('/documents')
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const refreshAfterDocumentChange = async (knowledgeBaseId: number) => {
    const refreshedKnowledgeBases = await api.listKnowledgeBases()
    setKnowledgeBases(uniqueKnowledgeBases(refreshedKnowledgeBases))
    const refreshedSelected = refreshedKnowledgeBases.find((item) => item.id === knowledgeBaseId)
    if (refreshedSelected) {
      await loadKnowledgeBaseDetails(refreshedSelected, { page: documentPageRef.current })
    }
  }

  const handleUploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!uploadFile) {
      setNotice({ type: 'error', message: '请选择要上传的文档' })
      return
    }
    const currentSelectedId = selectedKnowledgeBaseIdRef.current
    if (!currentSelectedId) {
      setNotice({ type: 'error', message: '请先选择知识库' })
      return
    }

    try {
      setBusy('upload')
      const uploaded = await api.uploadDocument({
        file: uploadFile,
        title: uploadTitle.trim() || undefined,
        category: uploadCategory.trim() || undefined,
        knowledgeBaseId: currentSelectedId,
      })
      setUploadFile(null)
      setUploadTitle('')
      await refreshAfterDocumentChange(currentSelectedId)
      setNotice({ type: 'success', message: uploaded.duplicated ? '文档已存在，已展示已有入库结果' : '文档上传并入库成功' })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const handleCreateTextDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = textTitle.trim()
    const content = textContent.trim()
    if (!title) {
      setNotice({ type: 'error', message: '请输入文本标题' })
      return
    }
    if (!content) {
      setNotice({ type: 'error', message: '请粘贴文本或 Markdown 内容' })
      return
    }
    const currentSelectedId = selectedKnowledgeBaseIdRef.current
    if (!currentSelectedId) {
      setNotice({ type: 'error', message: '请先选择知识库' })
      return
    }

    try {
      setBusy('upload')
      const created = await api.createTextDocument({
        title,
        content,
        category: textCategory.trim() || undefined,
        knowledgeBaseId: currentSelectedId,
      })
      setTextTitle('')
      setTextContent('')
      await refreshAfterDocumentChange(currentSelectedId)
      setNotice({ type: 'success', message: created.duplicated ? '内容已存在，已展示已有入库结果' : '文本内容已入库' })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const handleSaveWidget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const currentSelectedId = selectedKnowledgeBaseIdRef.current
    if (!currentSelectedId) {
      setNotice({ type: 'error', message: '请先选择知识库' })
      return
    }

    const payload = {
      knowledgeBaseId: currentSelectedId,
      title: widgetForm.title.trim(),
      botName: widgetForm.botName.trim() || undefined,
      botAvatar: widgetForm.botAvatar.trim() || null,
      welcomeMessage: widgetForm.welcomeMessage.trim() || null,
      systemPrompt: widgetForm.systemPrompt.trim() || null,
      isEnabled: widgetForm.isEnabled,
    }

    if (!payload.title) {
      setNotice({ type: 'error', message: '请输入 Widget 标题' })
      return
    }

    try {
      setBusy('widget')
      const saved = widget ? await api.updateWidget(widget.id, payload) : await api.createWidget(payload)
      applyWidgetToForm(saved, `${selectedKnowledgeBase?.name ?? 'Knowledge'} assistant`)
      const refreshedKnowledgeBases = await api.listKnowledgeBases()
      setKnowledgeBases(uniqueKnowledgeBases(refreshedKnowledgeBases))
      setNotice({ type: 'success', message: widget ? 'Bot 配置已更新' : 'Bot 配置已创建' })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const handleCopyEmbedCode = async () => {
    if (!embedCode) return

    try {
      setBusy('copy')
      await navigator.clipboard.writeText(embedCode)
      setNotice({ type: 'success', message: '嵌入代码已复制' })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const handleAskQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) {
      setNotice({ type: 'error', message: '请输入测试问题' })
      return
    }
    const currentSelectedId = selectedKnowledgeBaseIdRef.current
    if (!currentSelectedId) {
      setNotice({ type: 'error', message: '请先选择知识库' })
      return
    }

    try {
      setBusy('question')
      setAnswer('')
      setSources([])
      await api.streamQuestion({ question: trimmedQuestion, topK: 5, knowledgeBaseId: currentSelectedId, category: documentCategoryFilterRef.current || undefined }, (eventData) => {
        if (eventData.type === 'sources') {
          setSources(eventData.sources)
        }
        if (eventData.type === 'delta') {
          setAnswer((current) => `${current}${eventData.content}`)
        }
        if (eventData.type === 'error') {
          setNotice({ type: 'error', message: eventData.message })
        }
      })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const renderDashboard = () => (
    <div className="route-stack">
      <section className="flow-card flow-hero" data-tone="green">
        <div className="hero-copy">
          <span className="flow-seal flow-seal--green">✓ MVP 控制台</span>
          <p className="eyebrow">FLOW REPORT</p>
          <h1>Agent RAG 管理台</h1>
          <p>按执行流组织知识库、文档、机器人和外站接入。每一步都有明确状态、来源和验证结果。</p>
          <code>/flow status F1-agent-rag-mvp</code>
        </div>
        <div className="progress-ring" aria-label={`完成 ${completedSteps} / 5`}>
          <strong>{Math.round((completedSteps / 5) * 100)}%</strong>
          <span>{completedSteps}/5 步</span>
        </div>
      </section>

      <section className="flow-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Execution rail</p>
            <h2>接入流程</h2>
          </div>
          <span className={hasAdminKey ? 'flow-seal flow-seal--green' : 'flow-seal flow-seal--amber'}>
            {hasAdminKey ? '口令已配置' : '等待口令'}
          </span>
        </div>
        <div className="progress-rail" aria-label="MVP 接入进度">
          {[
            { label: '连接', done: hasAdminKey, path: '/settings' as ConsoleRoute },
            { label: '知识库', done: knowledgeBases.length > 0, path: '/knowledge' as ConsoleRoute },
            { label: '文档', done: documents.length > 0, path: '/documents' as ConsoleRoute },
            { label: 'Widget', done: Boolean(widget), path: '/widget' as ConsoleRoute },
            { label: '测试', done: sources.length > 0 || answer.length > 0, path: '/playground' as ConsoleRoute },
          ].map((step, index) => (
            <button aria-label={`流程 ${step.label}`} className="rail-step" key={step.label} type="button" onClick={() => navigate(step.path)}>
              <span className={step.done ? 'flow-node node-green' : 'flow-node node-gray'}>{step.done ? '✓' : index + 1}</span>
              <span>{step.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="summary-grid">
        <article className="flow-card metric-card" data-tone="blue">
          <span className="eyebrow">Knowledge bases</span>
          <strong>{knowledgeBases.length}</strong>
          <p>当前已加载知识库</p>
        </article>
        <article className="flow-card metric-card" data-tone="green">
          <span className="eyebrow">Documents</span>
          <strong>{totalDocuments}</strong>
          <p>所有知识库文档计数</p>
        </article>
        <article className="flow-card metric-card" data-tone="amber">
          <span className="eyebrow">Widgets</span>
          <strong>{totalWidgets}</strong>
          <p>已配置外站入口</p>
        </article>
      </section>

      <section className="flow-card flow-goal-card">
        <div className="goal-header">
          <span className="flow-node node-blue">i</span>
          <div>
            <p className="eyebrow">Current context</p>
            <h2>{selectedKnowledgeBase?.name ?? '尚未选择知识库'}</h2>
          </div>
        </div>
        <details open>
          <summary>下一步建议</summary>
          <p>{!hasAdminKey ? '先进入“连接”保存后台口令。' : !selectedKnowledgeBase ? '进入“知识库”创建或选择一个知识库。' : !documents.length ? '进入“文档”上传文件，或直接粘贴文本/Markdown。' : !widget ? '进入“机器人”配置 Widget 并复制接入脚本。' : '进入“测试”发起一次流式问答并查看 sources。'}</p>
        </details>
      </section>
    </div>
  )

  const renderSettings = () => (
    <section className="flow-card setup-panel" data-tone={hasAdminKey ? 'green' : 'amber'}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Connection</p>
          <h2>后台口令</h2>
        </div>
        {!hasAdminKey && <span className="flow-seal flow-seal--amber">需要配置</span>}
        {hasAdminKey && <span className="flow-seal flow-seal--green">Admin key configured</span>}
      </div>
      <form className="form-grid settings-form" onSubmit={handleSaveConfig}>
        <label>
          <span>后台口令 / API Key</span>
          <input
            value={configDraft.adminApiKey}
            onChange={(event) => setConfigDraft((current) => ({ ...current, adminApiKey: event.target.value }))}
            placeholder="输入后保存在当前浏览器"
            type="password"
          />
        </label>
        <p className="muted">API 地址由前端部署环境变量 VITE_API_BASE_URL 固定配置。</p>
        <button className="primary-button" type="submit">保存配置</button>
      </form>
    </section>
  )

  const renderKnowledge = () => (
    <section className="flow-card" data-tone="blue">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Knowledge</p>
          <h2>知识库</h2>
        </div>
        <button type="button" className="ghost-button" onClick={loadKnowledgeBases} disabled={!hasAdminKey || busy === 'knowledge'}>
          刷新
        </button>
      </div>
      <div className="route-columns">
        <form className="form-stack" onSubmit={handleCreateKnowledgeBase}>
          <label>
            <span>名称</span>
            <input
              value={knowledgeForm.name}
              onChange={(event) => setKnowledgeForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="产品帮助中心"
              disabled={!hasAdminKey}
            />
          </label>
          <label>
            <span>描述</span>
            <textarea
              value={knowledgeForm.description}
              onChange={(event) => setKnowledgeForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="这个知识库覆盖哪些内容"
              disabled={!hasAdminKey}
            />
          </label>
          <button className="primary-button" type="submit" disabled={!hasAdminKey || busy === 'knowledge'}>
            创建知识库
          </button>
        </form>
        <div className="item-list" aria-label="知识库列表">
          {knowledgeBases.map((item) => (
            <button
              aria-label={`Knowledge base ${item.name} #${item.id}`}
              className={item.id === selectedKnowledgeBaseId ? 'list-item selected' : 'list-item'}
              key={item.id}
              type="button"
              onClick={() => selectKnowledgeBase(item)}
            >
              <span>
                <strong>{item.name}</strong>
                <small>{item.description || 'No description'}</small>
              </span>
              <span className="meta-line">{item.documentCount} docs · {item.widgetCount} bots · {item.sessionCount} sessions</span>
            </button>
          ))}
          {hasAdminKey && knowledgeBases.length === 0 && <p className="muted">还没有知识库。</p>}
          {!hasAdminKey && <p className="muted">保存后台口令后加载知识库。</p>}
        </div>
      </div>
    </section>
  )

  const renderDocuments = () => (
    <section className="flow-card" data-tone="green">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Documents</p>
          <h2>文档入库</h2>
        </div>
        <span className="flow-seal flow-seal--gray">{selectedKnowledgeBase?.name ?? '未选择知识库'}</span>
      </div>
      <div className="route-columns">
        <div className="document-ingest-stack">
          <form className="form-stack mini-panel" onSubmit={handleUploadDocument}>
            <div>
              <p className="eyebrow">File source</p>
              <h3>上传文件</h3>
            </div>
            <label>
              <span>文件标题</span>
              <input
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="默认使用文件名"
                disabled={!canUseKnowledgeBase}
              />
            </label>
            <label>
              <span>分类</span>
              <input
                value={uploadCategory}
                onChange={(event) => setUploadCategory(event.target.value)}
                placeholder="例如：产品手册 / 售后 / API"
                disabled={!canUseKnowledgeBase}
              />
            </label>
            <label>
              <span>文件</span>
              <input
                accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                type="file"
                disabled={!canUseKnowledgeBase}
              />
            </label>
            <button className="primary-button" type="submit" disabled={!canUseKnowledgeBase || busy === 'upload'}>
              {busy === 'upload' ? '处理中...' : '上传文件入库'}
            </button>
          </form>

          <form className="form-stack mini-panel" onSubmit={handleCreateTextDocument}>
            <div>
              <p className="eyebrow">Text / Markdown</p>
              <h3>粘贴内容</h3>
            </div>
            <label>
              <span>文本标题</span>
              <input
                value={textTitle}
                onChange={(event) => setTextTitle(event.target.value)}
                placeholder="例如：产品 FAQ / API 片段"
                disabled={!canUseKnowledgeBase}
              />
            </label>
            <label>
              <span>分类</span>
              <input
                value={textCategory}
                onChange={(event) => setTextCategory(event.target.value)}
                placeholder="例如：FAQ / Markdown / 规范"
                disabled={!canUseKnowledgeBase}
              />
            </label>
            <label>
              <span>文本 / Markdown 内容</span>
              <textarea
                className="markdown-input"
                value={textContent}
                onChange={(event) => setTextContent(event.target.value)}
                placeholder={'可直接粘贴 Markdown，例如：\n# 标题\n- 要点\n```ts\nconst ok = true\n```'}
                disabled={!canUseKnowledgeBase}
              />
            </label>
            <button className="primary-button" type="submit" disabled={!canUseKnowledgeBase || busy === 'upload'}>
              {busy === 'upload' ? '处理中...' : '粘贴内容入库'}
            </button>
          </form>
        </div>
        <div className="table-list">
          <form className="document-filter" onSubmit={(event) => {
            event.preventDefault()
            if (!selectedKnowledgeBase) return
            documentCategoryFilterRef.current = documentCategoryFilter
            documentPageRef.current = 1
            void loadKnowledgeBaseDetails(selectedKnowledgeBase, { category: documentCategoryFilter, page: 1 })
          }}>
            <label>
              <span>分类检索</span>
              <input
                list="document-categories"
                value={documentCategoryFilter}
                onChange={(event) => setDocumentCategoryFilter(event.target.value)}
                placeholder="留空查看全部"
                disabled={!canUseKnowledgeBase}
              />
              <datalist id="document-categories">
                {documentCategories.map((category) => <option key={category} value={category} />)}
              </datalist>
            </label>
            <button className="ghost-button" type="submit" disabled={!canUseKnowledgeBase}>筛选</button>
          </form>
          {documents.map((item) => (
            <div className="table-row" key={`${item.id}-${item.chunkCount}`}>
              <strong>{item.title}</strong>
              <span>{item.category || '未分类'}</span>
              <span>{item.fileName || 'Manual document'}</span>
              <span>{item.chunkCount} chunks</span>
              <span>{item.parseStatus}</span>
              <span>{formatDate(item.updatedAt)}</span>
            </div>
          ))}
          {documents.length === 0 && <p className="muted">当前筛选下没有文档。</p>}
          <div className="pager" aria-label="文档分页">
            <button className="ghost-button" type="button" disabled={!selectedKnowledgeBase || documentPagination.page <= 1} onClick={() => {
              if (!selectedKnowledgeBase) return
              const nextPage = Math.max(1, documentPagination.page - 1)
              documentPageRef.current = nextPage
              void loadKnowledgeBaseDetails(selectedKnowledgeBase, { page: nextPage })
            }}>上一页</button>
            <span>第 {documentPagination.page} / {documentPagination.totalPages} 页 · 共 {documentPagination.total} 条</span>
            <button className="ghost-button" type="button" disabled={!selectedKnowledgeBase || documentPagination.page >= documentPagination.totalPages} onClick={() => {
              if (!selectedKnowledgeBase) return
              const nextPage = Math.min(documentPagination.totalPages, documentPagination.page + 1)
              documentPageRef.current = nextPage
              void loadKnowledgeBaseDetails(selectedKnowledgeBase, { page: nextPage })
            }}>下一页</button>
          </div>
        </div>
      </div>
    </section>
  )

  const renderWidget = () => (
    <div className="route-columns wide-route">
      <section className="flow-card" data-tone="amber">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Bot</p>
            <h2>Widget 配置</h2>
          </div>
          {widget && <span className="flow-seal flow-seal--green">widgetId: {widget.id}</span>}
        </div>
        <form className="form-stack" onSubmit={handleSaveWidget}>
          <label>
            <span>Header 标题</span>
            <input value={widgetForm.title} onChange={(event) => setWidgetForm((current) => ({ ...current, title: event.target.value }))} disabled={!canUseKnowledgeBase} />
          </label>
          <label>
            <span>Bot Name</span>
            <input value={widgetForm.botName} onChange={(event) => setWidgetForm((current) => ({ ...current, botName: event.target.value }))} disabled={!canUseKnowledgeBase} />
          </label>
          <label>
            <span>Avatar URL</span>
            <input value={widgetForm.botAvatar} onChange={(event) => setWidgetForm((current) => ({ ...current, botAvatar: event.target.value }))} placeholder="https://..." disabled={!canUseKnowledgeBase} />
          </label>
          <label>
            <span>Welcome Message</span>
            <textarea value={widgetForm.welcomeMessage} onChange={(event) => setWidgetForm((current) => ({ ...current, welcomeMessage: event.target.value }))} disabled={!canUseKnowledgeBase} />
          </label>
          <label>
            <span>System Prompt</span>
            <textarea value={widgetForm.systemPrompt} onChange={(event) => setWidgetForm((current) => ({ ...current, systemPrompt: event.target.value }))} placeholder="可选，覆盖默认助手行为" disabled={!canUseKnowledgeBase} />
          </label>
          <label className="checkbox-row">
            <input checked={widgetForm.isEnabled} onChange={(event) => setWidgetForm((current) => ({ ...current, isEnabled: event.target.checked }))} type="checkbox" disabled={!canUseKnowledgeBase} />
            <span>启用 Widget</span>
          </label>
          <button className="primary-button" type="submit" disabled={!canUseKnowledgeBase || busy === 'widget'}>
            {widget ? '保存 Bot 配置' : '创建 Bot 配置'}
          </button>
        </form>
      </section>

      <section className="flow-card embed-panel" data-tone="blue">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Embed</p>
            <h2>一行接入代码</h2>
          </div>
          <button type="button" className="ghost-button" onClick={handleCopyEmbedCode} disabled={!embedCode || busy === 'copy'}>
            复制
          </button>
        </div>
        <pre className="code-box" aria-label="嵌入代码">{embedCode || '保存 Widget 后生成包含 widgetId 的 script 代码。'}</pre>
        <details>
          <summary>接入说明</summary>
          <p>把这段代码粘贴到任意 HTML 页面。脚本会创建 Shadow DOM 悬浮入口，并用 iframe 加载聊天窗口。</p>
        </details>
      </section>
    </div>
  )

  const renderPlayground = () => (
    <section className="flow-card" data-tone="blue">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Playground</p>
          <h2>知识库问答测试</h2>
        </div>
        <span className="flow-seal flow-seal--gray">Top K 5</span>
      </div>
      <form className="question-form" onSubmit={handleAskQuestion}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="输入一个要从当前知识库检索的问题"
          disabled={!selectedKnowledgeBaseId || busy === 'question'}
        />
        <button className="primary-button" type="submit" disabled={!selectedKnowledgeBaseId || busy === 'question'}>
          {busy === 'question' ? '生成中...' : '测试问答'}
        </button>
      </form>
      <div className="answer-grid">
        <div className="answer-box" aria-label="测试回答">
          <strong>Answer</strong>
          <MarkdownAnswer content={answer} />
        </div>
        <div className="sources-box" aria-label="命中来源">
          <strong>Sources</strong>
          {sources.map((source) => (
            <article key={`${source.documentId}-${source.chunkIndex}`}>
              <span>{source.title} · chunk {source.chunkIndex}</span>
              <p>{source.content}</p>
            </article>
          ))}
          {sources.length === 0 && <p className="muted">命中的片段会显示在这里。</p>}
        </div>
      </div>
    </section>
  )

  const renderRoute = () => {
    if (route === '/settings') return renderSettings()
    if (route === '/knowledge') return renderKnowledge()
    if (route === '/documents') return renderDocuments()
    if (route === '/widget') return renderWidget()
    if (route === '/playground') return renderPlayground()
    return renderDashboard()
  }

  return (
    <main className="flow-shell">
      <aside className="flow-sidebar" aria-label="Console navigation">
        <div className="brand-block">
          <span className="brand-mark">AR</span>
          <div>
            <strong>Agent RAG</strong>
            <span>Flow Console</span>
          </div>
        </div>
        <nav className="nav-list">
          {routes.map((item) => (
            <button
              aria-label={`导航 ${item.label}`}
              className={route === item.path ? 'active' : ''}
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
            >
              <span>{item.label}</span>
              <small>{item.eyebrow}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="flow-workspace">
        <header className="route-header">
          <div>
            <p className="eyebrow">{currentRoute.eyebrow}</p>
            <h1>{currentRoute.title}</h1>
          </div>
          <div className={hasAdminKey ? 'flow-seal flow-seal--green' : 'flow-seal flow-seal--amber'}>
            {hasAdminKey ? 'Admin key configured' : 'Admin key required'}
          </div>
        </header>

        {notice && (
          <div className={`notice ${notice.type}`} role="status">
            <span>{notice.message}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button>
          </div>
        )}

        {renderRoute()}
      </section>
    </main>
  )
}

function App() {
  const params = new URLSearchParams(window.location.search)
  const widgetId = params.get('widgetId')?.trim()
  const apiBaseUrl = params.get('apiBaseUrl')?.trim() || defaultApiBaseUrl

  if (window.location.pathname === '/widget-chat' && widgetId) {
    return <WidgetChat widgetId={widgetId} apiBaseUrl={apiBaseUrl} />
  }

  return <ConsoleApp />
}

export default App
