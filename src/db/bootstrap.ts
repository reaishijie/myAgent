import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { Logger } from '../utils/logger';

const logger = new Logger('DBBootstrap');

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() !== 'false';
};

export const ensureDatabaseReady = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('致命错误：环境变量 DATABASE_URL 未设置！');
  }

  const autoMigrate = parseBoolean(process.env.AUTO_MIGRATE, true);
  if (!autoMigrate) {
    logger.log('已跳过启动时数据库迁移');
    return;
  }

  logger.log('开始执行启动时数据库迁移');
  const migrationClient = postgres(databaseUrl, {
    max: 1,
    onnotice: () => {},
  });
  const migrationDb = drizzle(migrationClient);

  try {
    await migrate(migrationDb, { migrationsFolder: './drizzle' });
    logger.log('数据库迁移完成');
  } catch (error) {
    logger.error(
      '数据库迁移失败',
      error instanceof Error ? error.stack : String(error),
    );
    throw error;
  } finally {
    await migrationClient.end();
  }
};
