import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createApp } from './app'

const staticRoot = '/tmp/agent-rag-static-test'
const originalStaticRoot = process.env.STATIC_ROOT

afterEach(async () => {
  process.env.STATIC_ROOT = originalStaticRoot
  await rm(staticRoot, { recursive: true, force: true })
})

describe('static assets hosting', () => {
  test('root keeps health response when no built frontend exists', async () => {
    delete process.env.STATIC_ROOT
    const app = createApp()

    const response = await app.request('http://localhost/')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
  })

  test('serves built frontend assets and falls back to index for SPA routes', async () => {
    process.env.STATIC_ROOT = staticRoot
    await mkdir(`${staticRoot}/assets`, { recursive: true })
    await writeFile(`${staticRoot}/index.html`, '<!doctype html><div id="root">console</div>')
    await writeFile(`${staticRoot}/assets/app.js`, 'console.log("app")')

    const app = createApp()

    const rootResponse = await app.request('http://localhost/')
    expect(await rootResponse.text()).toContain('console')
    expect(rootResponse.headers.get('content-type') || '').toContain('text/html')

    const assetResponse = await app.request('http://localhost/assets/app.js')
    expect(await assetResponse.text()).toContain('app')
    expect(assetResponse.headers.get('content-type') || '').toContain('text/javascript')

    const spaResponse = await app.request('http://localhost/admin/deep/link')
    expect(await spaResponse.text()).toContain('console')
  })
})
