import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if(!connectionString) {
  throw new Error('致命错误：环境变量 DATABASE_URL 未设置！请检查 .env 或云端配置。');
}

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false, // ⚠️ serverless 推荐
  connect_timeout: 3,
  onnotice: () => {},
})

export const db = drizzle(client, { schema })
