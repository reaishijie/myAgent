import { Hono } from 'hono'
import { Logger } from './utils/logger'
import { customLogger } from './middleware/httpLogger.middleware'
import { BusinessException } from './core/exceptions'
import apiRouter from './routes'

export const createApp = () => {
  const app = new Hono()
  const errorLogger = new Logger('ExceptionFilter')

  app.use('*', customLogger())

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
