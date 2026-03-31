import { db } from './index'
import { Logger } from '../utils/logger'

const logger = new Logger('DBBootstrap')

export const ensureDatabaseReady = async () => {
  try {
    await db.$connect()
    logger.log('数据库连接检查通过')
  } catch (error) {
    logger.error(
      '数据库连接失败',
      error instanceof Error ? error.stack : String(error),
    )
    throw error
  }
}
