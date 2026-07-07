import { Logger } from './utils/logger'
import { ensureDatabaseReady } from './db/bootstrap'
import { createApp } from './app'

await ensureDatabaseReady()

const app = createApp()
const appLogger = new Logger('APP')

const host = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

export default {
  hostname: host,
  port,
  fetch: app.fetch,
}

appLogger.log('Application started successfully')
console.log(`Server is running at http://localhost:${port}`)
