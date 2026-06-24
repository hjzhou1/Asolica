/**
 * 管理后台 - 邮件模板管理
 * GET    /api/admin/email-templates
 * PUT    /api/admin/email-templates/:id
 * POST   /api/admin/email-templates/:id/test
 *
 * 参考独角数卡 EmailtplController
 */

const express = require('express');
const { getDb } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { row, rows, ok, fail, createLogger, nowISO } = require('../../utils');
const { sendTemplateEmail } = require('../../services/emailService');

const router = express.Router();
const log = createLogger(getDb);

/** GET /api/admin/email-templates - 获取所有邮件模板 */
router.get('/email-templates', authMiddleware, (req, res) => {
  const db = getDb();
  const list = db.prepare('SELECT * FROM email_templates ORDER BY created_at ASC').all();
  ok(res, rows(list));
});

/** PUT /api/admin/email-templates/:id - 更新邮件模板 */
router.put('/email-templates/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const tpl = db.prepare('SELECT id FROM email_templates WHERE id = ?').get(req.params.id);
  if (!tpl) return fail(res, '模板不存在', 404);

  const { tplName, tplContent, enabled } = req.body || {};
  const sets = [], values = [];
  if (tplName !== undefined) { sets.push('tpl_name = ?'); values.push(String(tplName)); }
  if (tplContent !== undefined) { sets.push('tpl_content = ?'); values.push(String(tplContent)); }
  if (enabled !== undefined) { sets.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  if (!sets.length) return fail(res, '没有需要更新的字段');
  sets.push('updated_at = ?');
  values.push(nowISO());
  values.push(req.params.id);
  db.prepare(`UPDATE email_templates SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
  log(req.adminId, req.adminName, 'update_email_template', 'email_template', req.params.id, '更新邮件模板', req.ip);
  ok(res, row(updated));
});

/** POST /api/admin/email-templates/:id/test - 发送测试邮件（使用该模板） */
router.post('/email-templates/:id/test', authMiddleware, async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(res, '请输入有效的邮箱地址');
  }
  const db = getDb();
  const tpl = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
  if (!tpl) return fail(res, '模板不存在', 404);

  // 用示例数据填充模板变量
  const sampleVars = {
    webname: 'Asolica',
    order_id: 'TEST-ORDER-001',
    product_name: '测试商品',
    buy_amount: '1',
    ord_price: '9.90',
    ord_info: '这是测试卡密内容',
    created_at: new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()),
    buyer_email: email,
  };

  try {
    await sendTemplateEmail(tpl.tpl_token, sampleVars, email, null);
    ok(res, { message: '测试邮件发送成功' });
  } catch (err) {
    fail(res, `邮件发送失败: ${err.message}`, 500);
  }
});

module.exports = router;
