import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // 刚才你写 schema 代码的文件路径，支持通配符
  schema: './src/db/schema.ts', 
  
  // 生成的迁移 SQL 文件存放的目录
  out: './drizzle', 
  
  // 指定数据库方言
  dialect: 'postgresql', 
  
  // 数据库连接配置 (建议通过环境变量传入)
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/mydb',
  },
  
  // 是否在终端打印详细执行过程
  verbose: true,
  strict: true,
});