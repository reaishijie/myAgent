import type { Context, MiddlewareHandler } from 'hono'

type BunFile = {
  exists: () => Promise<boolean>
  arrayBuffer: () => Promise<ArrayBuffer>
  size: number
}

type BunRuntime = {
  file: (path: string) => BunFile
}

const bunRuntime = () => (globalThis as typeof globalThis & { Bun?: BunRuntime }).Bun

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const getExtension = (path: string) => {
  const dotIndex = path.lastIndexOf('.')
  return dotIndex >= 0 ? path.slice(dotIndex).toLowerCase() : ''
}

const normalizeStaticPath = (requestPath: string) => {
  const pathname = decodeURIComponent(requestPath.split('?')[0] || '/')
  const normalized = pathname.replace(/^\/+/, '')

  if (!normalized || normalized.includes('..') || normalized.includes('\\')) {
    return null
  }

  return normalized
}

const joinStaticPath = (root: string, relativePath: string) => {
  const cleanRoot = root.replace(/\/+$/, '')
  return `${cleanRoot}/${relativePath}`
}

const serveFile = async (c: Context, filePath: string) => {
  const bun = bunRuntime()
  if (!bun) return null

  const file = bun.file(filePath)
  if (!(await file.exists())) return null

  const headers = new Headers()
  headers.set('content-type', contentTypes[getExtension(filePath)] || 'application/octet-stream')

  if (/\.(?:js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$/i.test(filePath)) {
    headers.set('cache-control', 'public, max-age=31536000, immutable')
  } else {
    headers.set('cache-control', 'no-cache')
  }

  return new Response(file as BodyInit, { status: 200, headers })
}

export const createStaticAssetsMiddleware = (staticRoot: string): MiddlewareHandler => {
  const indexPath = joinStaticPath(staticRoot, 'index.html')

  return async (c, next) => {
    const method = c.req.method.toUpperCase()
    const pathname = new URL(c.req.url).pathname

    if (pathname.startsWith('/api') || pathname === '/health') {
      await next()
      return
    }

    if (method !== 'GET' && method !== 'HEAD') {
      await next()
      return
    }

    const relativePath = normalizeStaticPath(pathname)
    if (relativePath) {
      const response = await serveFile(c, joinStaticPath(staticRoot, relativePath))
      if (response) return response
    }

    const indexResponse = await serveFile(c, indexPath)
    if (indexResponse) return indexResponse

    await next()
  }
}
