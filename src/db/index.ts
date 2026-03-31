import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('致命错误：环境变量 DATABASE_URL 未设置！请检查 .env 或云端配置。')
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const createPrismaClient = () => {
  const adapter = new PrismaPg(connectionString)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
