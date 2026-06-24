/**
 * 数据库备份脚本（使用 better-sqlite3 的 backup API，保证 WAL 模式下一致性）
 * 用法: node scripts/backup.js
 * 建议通过 cron 定时执行: 0 2 * * * cd /path/to/server && node scripts/backup.js
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'asolica.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 7; // 保留最近 7 份备份

if (!fs.existsSync(DB_PATH)) {
  console.error('[备份] 数据库文件不存在:', DB_PATH);
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const d = new Date();
const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
const dest = path.join(BACKUP_DIR, `asolica_${stamp}.db`);

try {
  // 使用 better-sqlite3 的 backup API，保证 WAL 模式下数据一致性
  // backup() 会在源数据库上获取共享锁，安全地复制所有页面到目标文件
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  db.backup(dest)
    .then(() => {
      db.close();
      console.log(`[备份] 成功: ${dest}`);

      // 清理旧备份
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('asolica_') && f.endsWith('.db'))
        .sort();
      while (files.length > MAX_BACKUPS) {
        const old = files.shift();
        fs.unlinkSync(path.join(BACKUP_DIR, old));
        console.log(`[备份] 删除旧备份: ${old}`);
      }
    })
    .catch((err) => {
      db.close();
      console.error('[备份] 失败:', err.message);
      process.exit(1);
    });
} catch (err) {
  console.error('[备份] 打开数据库失败:', err.message);
  process.exit(1);
}
