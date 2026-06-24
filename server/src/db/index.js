/**
 * SQLite 数据库初始化（重构后入口）
 *
 * 职责：
 * - 创建数据库连接并设置 PRAGMA
 * - 加载并执行 db/migrations/ 下的所有迁移
 * - 执行 db/seeds/ 下的种子数据
 *
 * 9 张表：admins / categories / products / cards / orders / payments /
 *        operation_logs / site_settings / email_queue / media_files
 *
 * 迁移系统：
 * - schema_version 表记录已应用的迁移版本
 * - 每个迁移在事务内执行，幂等（已应用不会重复执行）
 * - 版本 1 = 初始 schema（所有 CREATE TABLE，含最新字段）
 * - 版本 2+ = 历史迁移（ADD COLUMN / 重建表等，用于升级旧数据库）
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config/env');
const { seedSettings, seedAdmin } = require('./seeds');

let db;

/**
 * 加载 migrations 目录下的所有迁移文件（按文件名排序）
 */
function loadMigrations() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .sort();
  return files.map(f => require(path.join(dir, f)));
}

// ========== 迁移辅助函数 ==========

/** 检查表中是否存在指定列 */
function columnExists(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  return cols.includes(column);
}

/** 安全地添加列（若已存在则跳过） */
function addColumnIfMissing(db, table, column, typeDef) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
  }
}

/** 创建迁移版本记录表 */
function initSchemaVersion(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/** 获取当前已应用的最高迁移版本 */
function getCurrentVersion(db) {
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
  return row?.v || 0;
}

/**
 * 执行所有未应用的迁移
 */
function runMigrations(dbInstance) {
  const target = dbInstance || db;
  if (!target) {
    throw new Error('runMigrations: 数据库未初始化，请先调用 getDb()');
  }

  initSchemaVersion(target);
  const current = getCurrentVersion(target);
  const migrations = loadMigrations();
  const helpers = { columnExists, addColumnIfMissing };

  for (const m of migrations) {
    if (m.version <= current) continue;

    if (m.transactional === false) {
      // 非事务型迁移（自行管理事务与 PRAGMA）
      m.up(target, helpers);
      target.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(m.version, m.name);
    } else {
      // 事务型迁移：整个迁移 + 版本记录在单事务内完成
      const txn = target.transaction(() => {
        m.up(target, helpers);
        target.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(m.version, m.name);
      });
      txn();
    }
    console.log(`[migration] 已应用迁移 v${m.version}: ${m.name}`);
  }
}

function getDb() {
  if (!db) {
    // 自动创建数据库目录（防止首次部署时 data/ 不存在）
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      process.stdout.write(`[初始化] 已自动创建数据库目录: ${dbDir}\n`);
    }

    db = new Database(config.dbPath);
    // ---- 数据库性能与并发优化 PRAGMA ----
    db.pragma('journal_mode = WAL');        // WAL 模式：读写并发更好
    db.pragma('foreign_keys = ON');         // 启用外键约束
    db.pragma('synchronous = NORMAL');      // WAL 模式下推荐，兼顾安全与性能
    db.pragma('busy_timeout = 5000');       // 并发等待 5 秒，避免 SQLITE_BUSY
    db.pragma('cache_size = -64000');       // 64MB 页缓存
    db.pragma('temp_store = MEMORY');       // 临时表与索引使用内存
    runMigrations(db);
    seedSettings(db);
    seedAdmin(db);
  }
  return db;
}

module.exports = { getDb, runMigrations };
