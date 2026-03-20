import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// 获取数据库连接字符串 (Bun 会自动读取 .env，所以直接拿 process.env 即可)
const databaseUrl = process.env.DATABASE_URL;
console.log('【1/3】检查环境变量 ')
if (!databaseUrl) {
  throw new Error('【x】环境变量 DATABASE_URL 未设置！');
}

const runMigrate = async () => {
  console.log('【2/3】 开始执行数据库迁移...');

  // 1. 创建专门用于迁移的数据库连接
  // 💡 关键点：{ max: 1 } 强制连接池只有一个连接，这在执行修改表结构 (DDL) 时非常重要，能避免死锁。
  const migrationClient = postgres(databaseUrl, { max: 1 });
  
  // 2. 包装成 Drizzle 实例
  const db = drizzle(migrationClient);

  try {
    // 3. 执行迁移
    // migrationsFolder 指向刚才 generate 生成的目录
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('【3/3】数据库迁移成功！所有的表和索引已就绪。');
  } catch (error) {
    console.error('【x】迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    // 4. 无论成功失败，务必关闭连接，否则脚本会一直挂起无法退出
    await migrationClient.end();
    process.exit(0);
  }
};

runMigrate();