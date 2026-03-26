import { Hono } from 'hono'
import { Logger } from './utils/logger'
import { customLogger } from './middleware/httpLogger.middleware'
import { BusinessException } from './core/exceptions'
import apiRouter from './routes'
import { ensureDatabaseReady } from './db/bootstrap'

await ensureDatabaseReady();

const app = new Hono()
const appLogger = new Logger('APP')
const errorLogger = new Logger('ExceptionFilter')

// 日志中间件
app.use('*', customLogger())

app.get('/', (c) => {
  return c.json({code: 200, status: 'ok', message: '后端服务正常运行！'})
})

app.route('/api', apiRouter)

// 核心：全局异常拦截器
app.onError((err, c) => {
  // 情况 1：捕获到我们自己抛出的业务异常 (如 NotFoundException)
  if (err instanceof BusinessException) {
    errorLogger.warn(`[业务异常] ${err.message}`);
    // 严格对齐我们刚才讨论的 ApiResponse 格式：包含 success, code, message, data
    return c.json({
      success: false,
      code: err.statusCode,
      message: err.message,
      data: null,
      errorCode: err.errorCode || undefined,
    }, err.statusCode as any);
  }

  // 情况 2：数据库级别报错 (比如 Drizzle 抛出的唯一索引冲突)
  if ((err as any).code === '23505') {
    errorLogger.warn(`[数据库冲突] ${err.message}`);
    return c.json({
      success: false,
      code: 409,
      message: '数据已存在，请勿重复提交',
      data: null,
    }, 409);
  }

  // 情况 3：兜底逻辑，未知的致命系统错误 (比如空指针、数据库宕机)
  // 必须打印完整堆栈，但给前端返回模糊提示，防止泄露服务器代码机密！
  errorLogger.error(`[系统崩溃] ${err.message}`, err.stack);
  return c.json({
    success: false,
    code: 500,
    message: '服务器内部开小差了，请稍后再试',
    data: null,
  }, 500);
});

const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

export default {
  hostname: host,
  port: port, // 指定运行端口
  fetch: app.fetch, // 绑定 Hono 的请求处理函数
}

appLogger.log(`✨ 应用程序启动成功 ⇩⇩⇩ `);
console.log(`
        ╔══════════════════════════════╗
        ║   Server is running...       ║
        ║   http://localhost:${port}      ║
        ╚══════════════════════════════╝
`);
