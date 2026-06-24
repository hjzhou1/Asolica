/**
 * 系统设置 API
 *
 * GET  /api/admin/settings              - 获取所有设置（敏感字段脱敏）
 * PUT  /api/admin/settings              - 批量更新设置（白名单校验，掩码值跳过）
 * POST /api/admin/settings/test-email   - 发送测试邮件
 */

/**
 * @swagger
 * tags:
 *   - name: Settings
 *     description: 系统设置接口（需 JWT Bearer Token）
 */
const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { ok, fail, createLogger, nowISO } = require('../utils');
const { validate, schemas, SENSITIVE_KEYS } = require('../middleware/validate');
const { sendTestMail } = require('../services/emailService');
const { maskConfig, maskValue, isMaskedValue } = require('../utils/mask');

const router = express.Router();

const log = createLogger(getDb);

/**
 * 对敏感字段值进行脱敏处理
 * - 字符串类型（如 mail.smtp_pass）：直接掩码
 * - 对象类型（如支付渠道配置）：调用 maskConfig 掩码内部字段
 */
function maskSensitiveValue(key, value) {
  if (!SENSITIVE_KEYS.includes(key)) return value;
  if (typeof value === 'string') {
    return maskValue(value);
  }
  if (value && typeof value === 'object') {
    return maskConfig(value);
  }
  return value;
}

/** GET /api/admin/settings - 获取所有设置（敏感字段脱敏） */
/**
 * @swagger
 * /admin/settings:
 *   get:
 *     tags: [Settings]
 *     summary: 获取所有系统设置
 *     description: |
 *       返回所有系统设置项（站点信息、支付配置、邮件配置等）。
 *       敏感字段（mail.smtp_pass / mail.resend_api_key 等）已脱敏。
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 系统设置（键值对，敏感字段已脱敏）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: 设置项键值对（如 site.name, mail.smtp_host, order.search_pwd_enabled 等）
 *       401:
 *         description: 未授权
 */
router.get('/settings', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM site_settings ORDER BY key').all();
  const settings = {};
  for (const r of rows) {
    let val;
    try { val = JSON.parse(r.value); } catch { val = r.value; }
    // 对敏感字段脱敏后再返回
    settings[r.key] = maskSensitiveValue(r.key, val);
  }
  ok(res, settings);
});

/** PUT /api/admin/settings - 批量更新设置（白名单校验 + 掩码跳过） */
/**
 * @swagger
 * /admin/settings:
 *   put:
 *     tags: [Settings]
 *     summary: 批量更新系统设置
 *     description: |
 *       批量更新系统设置项。
 *       - 白名单校验：仅允许更新 ALLOWED_SETTING_KEYS 中的键
 *       - 掩码跳过：敏感字段若值为掩码（********）则跳过不更新
 *       允许的键包括：site.name, site.description, site.announcement, site.logo, site.favicon,
 *       mail.driver, mail.smtp_host, mail.smtp_port, mail.smtp_secure, mail.from_addr,
*       mail.smtp_pass, mail.from_name, order.search_pwd_enabled, order.manage_email
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: 要更新的设置项键值对
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     skipped:
 *                       type: array
 *                       items: { type: string }
 *                       description: 被跳过的键（掩码值未更新）
 *       400:
 *         description: 包含不允许的设置项
 *       401:
 *         description: 未授权
 */
router.put('/settings', authMiddleware, validate(schemas.updateSettingsSchema), (req, res) => {
  const db = getDb();
  const now = nowISO();
  const stmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)');
  const updates = req.body || {};
  const skipped = [];

  const txn = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      // 敏感字段：若值为掩码（前端未修改），跳过不更新
      if (SENSITIVE_KEYS.includes(key) && isMaskedValue(value)) {
        skipped.push(key);
        continue;
      }
      // 简单值直接存，对象/数组序列化为 JSON
      const val = typeof value === 'object' ? JSON.stringify(value) : String(value);
      stmt.run(key, val, now);
    }
  });
  txn();
  log(req.adminId, req.adminName, 'update_settings', 'settings', '', '更新系统设置', req.ip);

  // 失效设置缓存，确保下次读取拿到最新值
  const { invalidateAll } = require('../services/settingsService');
  invalidateAll();

  // 失效邮件驱动缓存，确保下次发送使用新配置
  const { invalidateDriver } = require('../services/mailDriver');
  invalidateDriver();

  ok(res, { skipped });
});

/** POST /api/admin/settings/test-email */
/**
 * @swagger
 * /admin/settings/test-email:
 *   post:
 *     tags: [Settings]
 *     summary: 发送测试邮件
 *     description: 使用当前邮件配置发送测试邮件，用于验证 SMTP 配置是否正确
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, description: 接收测试邮件的邮箱 }
 *     responses:
 *       200:
 *         description: 测试邮件发送成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *       400:
 *         description: 邮箱格式无效
 *       401:
 *         description: 未授权
 *       500:
 *         description: 邮件发送失败
 */
router.post('/settings/test-email', authMiddleware, async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(res, '请输入有效的邮箱地址');
  }

  try {
    await sendTestMail(email);
    ok(res, { message: '测试邮件发送成功' });
  } catch (err) {
    fail(res, `邮件发送失败: ${err.message}`, 500);
  }
});

module.exports = router;
