import { Hono } from 'hono'
import { Logger } from './utils/logger'
import { customLogger } from './middleware/httpLogger.middleware'

const app = new Hono()
const appLogger = new Logger('APP')

// 日志中间件
app.use('*', customLogger())

app.get('/', (c) => {
  return c.json({code: 200, status: 'ok', message: '后端服务正常运行！'})
})

const port = parseInt(process.env.PORT || '3000', 10);

export default {
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