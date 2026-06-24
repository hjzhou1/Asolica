/**
 * 管理后台 - 邮件队列管理
 * GET    /api/admin/email-queue              列表（支持分页/筛选/统计）
 * GET    /api/admin/email-queue/:id          详情
 * POST   /api/admin/email-queue/:id/resend   手动补发单封（可覆盖收件人/主题/正文）
 * POST   /api/admin/email-queue/batch-resend 批量补发
 * DELETE /api/admin/email-queue/:id          删除记录
 */

const express = require('express');
const { getDb } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { row, rows, paginate, ok, fail } = require('../../utils');
const { resendEmail, batchResendEmails } = require('../../services/emailService');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * 列表 + 筛选 + 统计
 * Query: page, pageSize, status (pending/sent/failed/all), keyword (收件人/主题模糊), orderId
 */
router.get('/email-queue', authMiddleware, (req, res) => {
  const db = getDb();
  const { page, pageSize, status, keyword, orderId } = req.query;

  const where = [];
  const params = [];

  if (status && status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }
  if (keyword) {
    where.push('(to_addr LIKE ? OR subject LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (orderId) {
    where.push('order_id = ?');
    params.push(orderId);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const baseSql = `SELECT * FROM email_queue ${whereClause} ORDER BY created_at DESC`;

  const result = paginate(db, baseSql, null, {
    page, pageSize, params,
  });
  result.data = rows(result.data);

  // 统计卡片数据
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM email_queue
  `).get();

  result.stats = {
    total: stats.total || 0,
    sent: stats.sent || 0,
    failed: stats.failed || 0,
    pending: stats.pending || 0,
    successRate: stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0,
  };

  ok(res, result);
});

/** 详情 */
router.get('/email-queue/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const email = db.prepare('SELECT * FROM email_queue WHERE id = ?').get(req.params.id);
  if (!email) return fail(res, '邮件记录不存在', 404);
  return ok(res, row(email));
});

/**
 * 手动补发单封
 * Body: { to?, subject?, body? } - 可选覆盖字段
 */
router.post('/email-queue/:id/resend', authMiddleware, async (req, res) => {
  const { to, subject, body } = req.body || {};
  const result = await resendEmail(req.params.id, { to, subject, body });
  if (result.success) {
    logger.info('管理员手动补发邮件', {
      tag: 'email-admin',
      adminId: req.adminId,
      emailId: req.params.id,
      to,
    });
    return ok(res, { success: true });
  }
  return fail(res, result.error || '补发失败', 400);
});

/**
 * 批量补发
 * Body: { ids: string[] }
 */
router.post('/email-queue/batch-resend', authMiddleware, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return fail(res, '请选择要补发的邮件', 400);
  }
  if (ids.length > 100) {
    return fail(res, '单次最多补发 100 封邮件', 400);
  }
  const results = await batchResendEmails(ids);
  logger.info('管理员批量补发邮件', {
    tag: 'email-admin',
    adminId: req.adminId,
    total: results.total,
    succeeded: results.succeeded,
    failed: results.failed,
  });
  return ok(res, results);
});

/** 删除记录（仅允许删除已发送或重试耗尽的死信） */
router.delete('/email-queue/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const email = db.prepare('SELECT status, attempts FROM email_queue WHERE id = ?').get(req.params.id);
  if (!email) return fail(res, '邮件记录不存在', 404);

  // 安全限制：pending 状态不允许删除（可能正在发送中）
  if (email.status === 'pending') {
    return fail(res, '发送中的邮件不允许删除', 400);
  }

  db.prepare('DELETE FROM email_queue WHERE id = ?').run(req.params.id);
  logger.info('管理员删除邮件记录', {
    tag: 'email-admin',
    adminId: req.adminId,
    emailId: req.params.id,
  });
  return ok(res, { success: true });
});

module.exports = router;
