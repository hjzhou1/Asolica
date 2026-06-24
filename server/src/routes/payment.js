/**
 * 支付 API 路由
 *
 * GET  /api/store/store-methods            - 前台获取启用的支付方式
 * POST /api/store/create-payment           - 创建支付订单
 * POST /api/payment/callback/:channel      - 各渠道支付回调
 * GET  /api/payment/callback/:channel      - 部分渠道 GET 回调
 * GET  /api/store/payment-status/:orderId  - 前台轮询支付状态
 * GET  /api/admin/payment-methods        - 管理员获取支付方式列表
 * POST /api/admin/payment-methods        - 管理员创建支付方式
 * PUT  /api/admin/payment-methods/:id    - 管理员更新支付方式
 * DELETE /api/admin/payment-methods/:id  - 管理员删除支付方式
 */

/**
 * @swagger
 * tags:
 *   - name: Payment
 *     description: 支付接口（前台下单支付、回调、渠道配置）
 *   - name: Payment Admin
 *     description: 支付方式管理接口（需 JWT Bearer Token）
 */
const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { PaymentGatewayFactory, GatewayRegistry } = require('../services/paymentGateway');
const { ok, fail, createLogger, genId, nowISO, row } = require('../utils');
const { validate, schemas } = require('../middleware/validate');
const { createPayment, processCallback, syncPaymentStatus } = require('../services/paymentService');
const { maskConfig, isMaskedValue, SECRET_FIELDS: ADAPTER_SECRET_KEYS } = require('../utils/mask');

const shopRouter = express.Router();
const callbackRouter = express.Router();
const adminRouter = express.Router();

const log = createLogger(getDb);

// ===== 管理后台 =====

/** GET /api/admin/payment-methods - 获取支付方式列表 */
adminRouter.get('/payment-methods', authMiddleware, (req, res) => {
  const db = getDb();
  const factory = new PaymentGatewayFactory(db);
  const list = factory.listPaymentMethods().map(pm => {
    let config = {};
    try { config = JSON.parse(pm.config || '{}'); } catch { config = {}; }
    return { ...row(pm), config: maskConfig(config) };
  });
  ok(res, list);
});

/** GET /api/admin/payment-adapters - 获取支持的支付适配器列表 */
adminRouter.get('/payment-adapters', authMiddleware, (req, res) => {
  ok(res, { adapters: Object.keys(GatewayRegistry) });
});

/** POST /api/admin/payment-methods - 创建支付方式 */
adminRouter.post('/payment-methods', authMiddleware, validate(schemas.createPaymentMethodSchema), (req, res) => {
  const { name, adapter, method, config = {}, sort = 0, enabled = true, icon = '' } = req.body || {};
  if (!GatewayRegistry[adapter]) return fail(res, `未知适配器: ${adapter}`);

  const db = getDb();
  const id = genId('pm');
  const now = nowISO();
  db.prepare(`
    INSERT INTO payment_methods (id, name, adapter, method, config, sort, enabled, icon, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, adapter, method, JSON.stringify(config || {}), sort, enabled ? 1 : 0, icon, now, now);

  log(req.adminId, req.adminName, 'create_payment_method', 'payment_method', id, `创建支付方式: ${name}`, req.ip);
  const created = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);
  ok(res, { ...row(created), config: maskConfig(JSON.parse(created.config || '{}')) }, 201);
});

/** PUT /api/admin/payment-methods/:id - 更新支付方式 */
adminRouter.put('/payment-methods/:id', authMiddleware, validate(schemas.updatePaymentMethodSchema), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const pm = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);
  if (!pm) return fail(res, '支付方式不存在', 404);

  let currentConfig = {};
  try { currentConfig = JSON.parse(pm.config || '{}'); } catch { currentConfig = {}; }

  const patch = req.body || {};
  const sets = [], values = [];

  if (patch.name !== undefined) { sets.push('name = ?'); values.push(String(patch.name)); }
  if (patch.adapter !== undefined) {
    if (!GatewayRegistry[patch.adapter]) return fail(res, `未知适配器: ${patch.adapter}`);
    sets.push('adapter = ?'); values.push(patch.adapter);
  }
  if (patch.method !== undefined) { sets.push('method = ?'); values.push(patch.method); }
  if (patch.sort !== undefined) { sets.push('sort = ?'); values.push(Number(patch.sort) || 0); }
  if (patch.enabled !== undefined) { sets.push('enabled = ?'); values.push(patch.enabled ? 1 : 0); }
  if (patch.icon !== undefined) { sets.push('icon = ?'); values.push(String(patch.icon)); }

  if (patch.config !== undefined) {
    // 合并配置：掩码值保留原值不覆盖
    const merged = { ...currentConfig };
    for (const [k, v] of Object.entries(patch.config)) {
      if (ADAPTER_SECRET_KEYS.includes(k) && isMaskedValue(v)) continue;
      merged[k] = v;
    }
    sets.push('config = ?'); values.push(JSON.stringify(merged));
  }

  if (!sets.length) return fail(res, '没有需要更新的字段');
  sets.push('updated_at = ?');
  values.push(nowISO());
  values.push(id);
  db.prepare(`UPDATE payment_methods SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  log(req.adminId, req.adminName, 'update_payment_method', 'payment_method', id, `更新支付方式: ${pm.name}`, req.ip);
  const updated = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);
  ok(res, { ...row(updated), config: maskConfig(JSON.parse(updated.config || '{}')) });
});

/** DELETE /api/admin/payment-methods/:id - 删除支付方式 */
adminRouter.delete('/payment-methods/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const pm = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);
  if (!pm) return fail(res, '支付方式不存在', 404);
  db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
  log(req.adminId, req.adminName, 'delete_payment_method', 'payment_method', id, `删除支付方式: ${pm.name}`, req.ip);
  ok(res, { message: '已删除' });
});

// ===== 前台（无认证） =====

/** GET /api/store/store-methods - 前台获取可用的支付选项 */
shopRouter.get('/store-methods', (req, res) => {
  const db = getDb();
  const factory = new PaymentGatewayFactory(db);
  const methods = factory.getEnabledMethods();
  ok(res, methods.map(pm => row(pm)));
});

/** POST /api/store/create-payment */
shopRouter.post('/create-payment', validate(schemas.createPaymentSchema), async (req, res, next) => {
  try {
    const { orderId, payCheck, contact } = req.body;
    const result = await createPayment({
      orderId,
      payCheck,
      contact,
      protocol: req.protocol,
      host: req.get('host'),
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/store/payment-status/:orderId - 前端轮询，触发主动查询兜底 */
shopRouter.get('/payment-status/:orderId', async (req, res, next) => {
  try {
    const result = await syncPaymentStatus(req.params.orderId);
    ok(res, result);
  } catch (err) {
    next(err);
  }
});

// ===== 支付回调（无需认证，支付平台调用） =====
// 回调路由挂载在 /api 下，完整路径为 /api/payment/callback/:channel

/** POST /api/payment/callback/:channel */
callbackRouter.post('/payment/callback/:channel', (req, res) => {
  const { channel } = req.params;
  const result = processCallback({ channel, body: req.body });
  res.send(result);
});

/** GET /api/payment/callback/:channel - 部分支付平台（如易支付）使用 GET 回调 */
callbackRouter.get('/payment/callback/:channel', (req, res) => {
  const { channel } = req.params;
  const result = processCallback({ channel, body: req.query });
  res.send(result);
});

module.exports = { shopRouter, callbackRouter, adminRouter };
