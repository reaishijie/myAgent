import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Logger } from './utils/logger'
import { customLogger } from './middleware/httpLogger.middleware'
import { BusinessException } from './core/exceptions'
import apiRouter from './routes'

export const createApp = () => {
  const app = new Hono()
  const errorLogger = new Logger('ExceptionFilter')

  app.use('*', customLogger())
  app.use('/api/widgets/*', cors({
    origin: '*',
    allowHeaders: ['content-type'],
    allowMethods: ['GET', 'OPTIONS'],
  }))
  app.use('/api/chat/*', cors({
    origin: '*',
    allowHeaders: ['content-type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }))
  const ragQueryCors = cors({
    origin: '*',
    allowHeaders: ['content-type', 'authorization', 'x-admin-api-key'],
    allowMethods: ['POST', 'OPTIONS'],
  })
  app.use('/api/rag/query', ragQueryCors)
  app.use('/api/rag/query/*', ragQueryCors)
  app.use('/api/admin/*', cors({
    origin: '*',
    allowHeaders: ['content-type', 'authorization', 'x-admin-api-key'],
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  }))
  const documentCors = cors({
    origin: '*',
    allowHeaders: ['content-type', 'authorization', 'x-admin-api-key'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
  app.use('/api/rag/documents', documentCors)
  app.use('/api/rag/documents/*', documentCors)

  app.get('/', (c) => {
    return c.json({ code: 200, status: 'ok', message: 'Backend service is healthy' })
  })

  app.route('/api', apiRouter)

  app.onError((err, c) => {
    if (err instanceof BusinessException) {
      errorLogger.warn(`[BusinessException] ${err.message}`)

      return c.json({
        success: false,
        code: err.statusCode,
        message: err.message,
        data: null,
        errorCode: err.errorCode || undefined,
      }, err.statusCode as any)
    }

    if ((err as any).code === '23505') {
      errorLogger.warn(`[DatabaseConflict] ${err.message}`)

      return c.json({
        success: false,
        code: 409,
        message: 'Data already exists, please do not submit it repeatedly',
        data: null,
      }, 409)
    }

    errorLogger.error(`[SystemError] ${err.message}`, err.stack)

    return c.json({
      success: false,
      code: 500,
      message: 'Internal server error',
      data: null,
    }, 500)
  })

  return app
}
