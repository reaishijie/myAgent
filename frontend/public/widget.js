(() => {
  const currentScript = document.currentScript || Array.from(document.scripts).find((script) => script.src && script.src.includes('/widget.js'))
  if (!currentScript) return

  const scriptUrl = new URL(currentScript.src, window.location.href)
  const params = new URLSearchParams(scriptUrl.search)
  const widgetId = currentScript.dataset.widgetId || params.get('widgetId')
  if (!widgetId) {
    console.warn('[AgentRAG Widget] Missing data-widget-id')
    return
  }

  const existingRoot = Array.from(document.querySelectorAll('[data-agent-rag-root]')).find((item) => item.dataset.agentRagRoot === widgetId)
  if (existingRoot) {
    return
  }

  const apiBaseUrl = currentScript.dataset.apiBaseUrl || params.get('apiBaseUrl') || ''
  const title = currentScript.dataset.title || 'Ask AI'
  const iconUrl = currentScript.dataset.iconUrl || `${scriptUrl.origin}/widget-logo.jpeg`
  const root = document.createElement('div')
  root.dataset.agentRagRoot = widgetId
  const shadow = root.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    .launcher {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 2147483000;
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border: 0;
      border-radius: 20px;
      background: #102027;
      color: #f7fffc;
      box-shadow: 0 18px 42px rgba(16, 32, 39, 0.24);
      cursor: grab;
      touch-action: none;
      user-select: none;
      font: 800 22px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .launcher.dragging { cursor: grabbing; transition: box-shadow 160ms ease; }
    .launcher.dragging:hover { transform: none; }
    .launcher img {
      display: block;
      width: 46px;
      height: 46px;
      border-radius: 16px;
      object-fit: cover;
      background: #fff;
    }
    .launcher:hover { transform: translateY(-2px); box-shadow: 0 22px 50px rgba(16, 32, 39, 0.3); }
    .launcher:focus-visible { outline: 3px solid rgba(83, 199, 170, 0.55); outline-offset: 3px; }
    .launcher::after {
      content: '';
      position: absolute;
      right: 8px;
      top: 8px;
      width: 12px;
      height: 12px;
      border: 2px solid #102027;
      border-radius: 999px;
      background: #53c7aa;
    }
    .frame-wrap {
      position: fixed;
      right: 22px;
      bottom: 92px;
      z-index: 2147482999;
      width: min(390px, calc(100vw - 32px));
      height: min(650px, calc(100vh - 124px));
      overflow: hidden;
      border: 1px solid rgba(16, 32, 39, 0.12);
      border-radius: 24px;
      background: #fff;
      box-shadow: 0 28px 80px rgba(16, 32, 39, 0.25);
      opacity: 0;
      transform: translateY(12px) scale(0.98);
      transform-origin: bottom right;
      pointer-events: none;
      transition: opacity 180ms ease, transform 180ms ease;
    }
    .frame-wrap.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    iframe { display: block; width: 100%; height: 100%; border: 0; background: #f7fbfa; }
    @media (max-width: 520px) {
      .launcher { right: 16px; bottom: 16px; width: 56px; height: 56px; }
      .frame-wrap {
        inset: 10px;
        width: auto;
        height: auto;
        border-radius: 22px;
        transform-origin: bottom center;
      }
    }
  `

  const frameWrap = document.createElement('div')
  frameWrap.className = 'frame-wrap'
  const iframe = document.createElement('iframe')
  iframe.title = title
  iframe.allow = 'clipboard-write'
  const iframeUrl = new URL('/widget-chat', scriptUrl.origin)
  iframeUrl.searchParams.set('widgetId', widgetId)
  if (apiBaseUrl) {
    iframeUrl.searchParams.set('apiBaseUrl', apiBaseUrl)
  }
  iframe.src = iframeUrl.toString()
  frameWrap.appendChild(iframe)

  const button = document.createElement('button')
  button.className = 'launcher'
  button.type = 'button'
  button.setAttribute('aria-label', title)
  button.setAttribute('aria-expanded', 'false')
  const icon = document.createElement('img')
  icon.src = iconUrl
  icon.alt = ''
  icon.decoding = 'async'
  icon.loading = 'lazy'
  button.appendChild(icon)

  const positionStorageKey = `agent-rag-widget-position-${widgetId}`
  const margin = 10
  let suppressClick = false
  let dragState = null

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

  const saveButtonPosition = () => {
    const rect = button.getBoundingClientRect()
    localStorage.setItem(positionStorageKey, JSON.stringify({ left: rect.left, top: rect.top }))
  }

  const placeButton = (left, top) => {
    const width = button.offsetWidth || 58
    const height = button.offsetHeight || 58
    const nextLeft = clamp(left, margin, window.innerWidth - width - margin)
    const nextTop = clamp(top, margin, window.innerHeight - height - margin)
    button.style.left = `${nextLeft}px`
    button.style.top = `${nextTop}px`
    button.style.right = 'auto'
    button.style.bottom = 'auto'
    updateFramePosition()
  }

  function updateFramePosition() {
    if (window.innerWidth <= 520) {
      frameWrap.style.left = ''
      frameWrap.style.top = ''
      frameWrap.style.right = ''
      frameWrap.style.bottom = ''
      return
    }

    const buttonRect = button.getBoundingClientRect()
    const frameWidth = Math.min(390, window.innerWidth - 32)
    const frameHeight = Math.min(650, window.innerHeight - 124)
    const left = clamp(buttonRect.right - frameWidth, margin, window.innerWidth - frameWidth - margin)
    const preferredTop = buttonRect.top - frameHeight - 12
    const fallbackTop = buttonRect.bottom + 12
    const top = preferredTop >= margin
      ? preferredTop
      : clamp(fallbackTop, margin, window.innerHeight - frameHeight - margin)

    frameWrap.style.left = `${left}px`
    frameWrap.style.top = `${top}px`
    frameWrap.style.right = 'auto'
    frameWrap.style.bottom = 'auto'
  }

  const restoreButtonPosition = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(positionStorageKey) || 'null')
      if (typeof saved?.left === 'number' && typeof saved?.top === 'number') {
        placeButton(saved.left, saved.top)
        return
      }
    } catch {
      // Ignore corrupt persisted positions and fall back to bottom-right.
    }

    placeButton(window.innerWidth - (button.offsetWidth || 58) - 22, window.innerHeight - (button.offsetHeight || 58) - 22)
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return
    const rect = button.getBoundingClientRect()
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    }
    button.classList.add('dragging')
    button.setPointerCapture?.(event.pointerId)
  })

  button.addEventListener('pointermove', (event) => {
    if (!dragState) return
    const dx = event.clientX - dragState.startX
    const dy = event.clientY - dragState.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragState.moved = true
    }
    if (dragState.moved) {
      event.preventDefault()
      placeButton(dragState.left + dx, dragState.top + dy)
    }
  })

  const finishDrag = (event) => {
    if (!dragState) return
    button.classList.remove('dragging')
    button.releasePointerCapture?.(event.pointerId)
    if (dragState.moved) {
      suppressClick = true
      saveButtonPosition()
      window.setTimeout(() => {
        suppressClick = false
      }, 0)
    }
    dragState = null
  }

  button.addEventListener('pointerup', finishDrag)
  button.addEventListener('pointercancel', finishDrag)

  button.addEventListener('click', () => {
    if (suppressClick) return
    updateFramePosition()
    const isOpen = frameWrap.classList.toggle('open')
    button.setAttribute('aria-expanded', String(isOpen))
  })

  window.addEventListener('resize', () => {
    const rect = button.getBoundingClientRect()
    placeButton(rect.left, rect.top)
  })

  shadow.append(style, frameWrap, button)
  document.documentElement.appendChild(root)
  restoreButtonPosition()
})()
