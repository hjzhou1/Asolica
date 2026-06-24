/**
 * 业务辅助工具（操作日志记录器等）
 */

const { genId } = require('./id');
const { nowISO } = require('./response');

/**
 * 日志辅助函数（在路由中使用时需传入 getDb）
 */
function createLogger(dbFn) {
  return (adminId, adminName, action, targetType, targetId, detail, ip) => {
    try {
      const db = dbFn();
      db.prepare(`
        INSERT INTO operation_logs (id, admin_id, admin_name, action, target_type, target_id, detail, ip, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(genId('log'), adminId || '', adminName || '', action, targetType || '', targetId || '', detail || '', ip || '', nowISO());
    } catch (_) { /* 日志记录失败不影响主流程 */ }
  };
}

module.exports = { createLogger };
