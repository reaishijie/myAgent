import { expect, test } from '@playwright/test'

const adminKey = 'playwright-admin-key'
test('browser completes knowledge base, upload, widget embed, and QA flow against real backend', async ({ page, context }) => {
  const uniqueName = `E2E KB ${Date.now()}-${crypto.randomUUID()}`
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByRole('button', { name: '导航 连接' }).click()

  await expect(page.getByLabel('API Base URL')).toHaveCount(0)
  await page.getByLabel('后台口令 / API Key').fill(adminKey)
  await page.getByRole('button', { name: '保存配置' }).click()
  await expect(page.getByText('Admin key configured')).toBeVisible()
  await page.getByRole('button', { name: '导航 知识库' }).click()
  await expect(page.getByLabel('名称')).toBeEnabled()
  await expect(page.getByRole('button', { name: '创建知识库' })).toBeEnabled()

  await page.getByLabel('名称').fill(uniqueName)
  await page.getByLabel('描述').fill('Playwright browser verification')
  await page.getByRole('button', { name: '创建知识库' }).click()
  const createdKnowledgeBase = page.getByRole('button', { name: new RegExp(`^Knowledge base ${uniqueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} #\\d+$`) })
  await expect(createdKnowledgeBase).toBeVisible()
  await createdKnowledgeBase.click()
  await expect(createdKnowledgeBase).toHaveClass(/selected/)

  const markdownText = `# Browser verification\n\n${uniqueName} alpha source chunk for retrieval.`
  await page.getByLabel('文件').setInputFiles({
    name: 'browser-verification.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(markdownText),
  })
  await page.getByRole('button', { name: '上传并入库' }).click()
  await expect(page.getByRole('status')).toContainText('文档上传并入库成功')
  await expect(page.getByText('browser-verification.md').first()).toBeVisible()
  await expect(page.getByText('COMPLETED').first()).toBeVisible()

  const plainText = `${uniqueName} beta plain text source for retrieval.`
  await page.getByLabel('文件').setInputFiles({
    name: 'browser-verification.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(plainText),
  })
  await page.getByRole('button', { name: '上传并入库' }).click()
  await expect(page.getByRole('status')).toContainText('文档上传并入库成功')
  await expect(page.getByText('browser-verification.txt').first()).toBeVisible()

  await page.getByRole('button', { name: '导航 机器人' }).click()
  await expect(page.getByLabel('Header 标题')).toBeEnabled()
  await expect(page.getByRole('button', { name: '创建 Bot 配置' })).toBeEnabled()
  await page.getByLabel('Header 标题').fill('Browser Verified Widget')
  await page.getByLabel('Bot Name').fill('Browser Bot')
  await page.getByLabel('Welcome Message').fill('Welcome from browser test')
  await expect(page.getByRole('button', { name: '创建 Bot 配置' })).toBeEnabled()
  await page.getByRole('button', { name: '创建 Bot 配置' }).click()
  const embedCode = page.getByLabel('嵌入代码')
  await expect(embedCode).toContainText('data-widget-id=')
  const embedScript = await embedCode.textContent()
  expect(embedScript).toBeTruthy()
  const widgetId = embedScript?.match(/data-widget-id="([^"]+)"/)?.[1]
  expect(widgetId).toBeTruthy()
  await page.getByRole('button', { name: '复制' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('data-widget-id=')

  await page.getByRole('button', { name: '导航 测试' }).click()
  await page.getByPlaceholder('输入一个要从当前知识库检索的问题').fill(`${uniqueName} alpha?`)
  await page.getByRole('button', { name: '测试问答' }).click()
  await expect(page.getByLabel('测试回答')).toContainText('验收回答')
  await expect(page.getByLabel('命中来源')).toContainText(uniqueName)

  const externalPage = await context.newPage()
  await externalPage.setContent(`<!doctype html><html><head><title>External Host</title></head><body><h1>External page</h1>${embedScript}</body></html>`)
  await expect(externalPage.getByRole('button', { name: 'Ask AI' })).toBeVisible()
  await externalPage.getByRole('button', { name: 'Ask AI' }).click()
  const chatFrame = externalPage.frameLocator('iframe[title="Ask AI"]')
  await expect(chatFrame.getByText('Browser Bot')).toBeVisible()
  await expect(chatFrame.getByText('Welcome from browser test')).toBeVisible()
  await expect(chatFrame.locator('time').first()).toBeVisible()
  await chatFrame.getByLabel('输入问题').fill(`${uniqueName} beta?`)
  await chatFrame.getByRole('button', { name: '发送' }).click()
  await expect(chatFrame.getByText('验收回答')).toBeVisible()
  await expect(chatFrame.locator('time')).toHaveCount(3)
})
