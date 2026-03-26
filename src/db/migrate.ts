import { ensureDatabaseReady } from './bootstrap';

try {
  await ensureDatabaseReady();
  process.exit(0);
} catch (error) {
  console.error('【x】迁移过程中发生错误:', error);
  process.exit(1);
}
