/**
 * @swagger
 * tags:
 *   - name: Order
 *     description: 订单查询接口
 */

/**
 * 前台订单查询 API
 * GET /api/order/:id        - 按 ID+联系方式查询（需传 contact 查询参数）
 * POST /api/order/query      - 订单号+联系方式精准查询
 * POST /api/order/query-by-contact - 按联系方式查最近 N 天订单
 */

const express = require('express');
const { getDb } = require('../../db');
const { validate, schemas } = require('../../middleware/validate');
const { row, rows, ok, fail } = require('../../utils');
const { getPaymentMethodName, batchGetPaymentNames } = require('../../utils/payment');
const paymentRepo = require('../../repositories/paymentRepo');

const router = express.Router();

const PAYMENT_STATUS_LABELS = {
  pending: '待支付',
  paid: '已支付',
  failed: '支付失败',
  refunded: '已退款',
};

/**
 * 为订单补充卡密内容 + 支付信息（仅 delivered 状态返回卡密，其他状态隐藏）
 * 参考独角数卡前台订单详情：展示支付方式、商品、卡密、状态等完整信息
 */
function enrichOrder(order, db) {
  if (!order) return order;

  // 1. 仅已发货订单才返回卡密内容，防止未支付订单提前获取卡密
  if (order.status === 'delivered') {
    const cardIds = order.cardIds || [];
    if (cardIds.length > 0) {
      const codes = db.prepare(
        `SELECT content FROM cards WHERE id IN (${cardIds.map(() => '?').join(',')})`
      ).all(...cardIds).map(c => c.content);
      order.codes = codes;
    }
  }

  // 2. 补充商品图片
  if (order.productId) {
    const product = db.prepare('SELECT image FROM products WHERE id = ? AND deleted_at IS NULL').get(order.productId);
    if (product) order.productImage = product.image || '';
  }

  // 3. 补充支付信息（支付方式友好名称来自 payment_methods 表配置，而非硬编码）
  if (order.paymentMethod) {
    order.paymentMethodLabel = getPaymentMethodName(order.paymentMethod, db);
  }
  // 从 payments 表补充支付方式（支付宝/微信）和交易号
  const payment = db.prepare(
    'SELECT channel, trade_no, status, paid_at FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(order.id);
  if (payment) {
    order.paymentChannel = payment.channel;
    order.paymentChannelLabel = getPaymentMethodName(payment.channel, db);
    order.paymentTradeNo = payment.trade_no || '';
    order.paymentPaidAt = payment.paid_at || '';
    // 支付状态友好描述
    order.paymentStatusLabel = {
      pending: '待支付',
      paid: '已支付',
      failed: '支付失败',
      refunded: '已退款',
    }[payment.status] || payment.status;
  }

  return order;
}

/**
 * 批量补充订单的卡密/商品图片/支付信息（消除 N+1）
 * 原 enrichOrder 每条订单执行 3-4 次 SQL，10 条订单 = 30-40 次查询；
 * 本函数用 4 次批量查询替代 N*4 次。
 */
function enrichOrdersBatch(orders, db) {
  if (!orders || orders.length === 0) return orders;

  // 1. 批量查询卡密内容（仅 delivered 状态）
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const allCardIds = deliveredOrders.flatMap(o => o.cardIds || []);
  const cardContentMap = new Map();
  if (allCardIds.length > 0) {
    const placeholders = allCardIds.map(() => '?').join(',');
    const cardRows = db.prepare(`SELECT id, content FROM cards WHERE id IN (${placeholders})`).all(...allCardIds);
    for (const c of cardRows) cardContentMap.set(c.id, c.content);
  }
  for (const o of deliveredOrders) {
    const cardIds = o.cardIds || [];
    if (cardIds.length > 0) {
      o.codes = cardIds.map(id => cardContentMap.get(id)).filter(Boolean);
    }
  }

  // 2. 批量查询商品图片
  const productIds = [...new Set(orders.map(o => o.productId).filter(Boolean))];
  const productImageMap = new Map();
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => '?').join(',');
    const productRows = db.prepare(`SELECT id, image FROM products WHERE id IN (${placeholders}) AND deleted_at IS NULL`).all(...productIds);
    for (const p of productRows) productImageMap.set(p.id, p.image || '');
  }
  for (const o of orders) {
    if (o.productId) o.productImage = productImageMap.get(o.productId) || '';
  }

  // 3. 批量查询支付信息（paymentRepo 每个订单取最新一条）
  const orderIds = orders.map(o => o.id);
  const paymentMap = paymentRepo.getPaymentsByOrderIds(db, orderIds);

  // 4. 批量查询支付方式名称
  const channels = [...new Set([
    ...orders.map(o => o.paymentMethod).filter(Boolean),
    ...[...paymentMap.values()].map(p => p.channel).filter(Boolean),
  ])];
  const channelNames = batchGetPaymentNames(channels, db);

  for (const o of orders) {
    if (o.paymentMethod) {
      o.paymentMethodLabel = channelNames.get(o.paymentMethod) || o.paymentMethod;
    }
    const payment = paymentMap.get(o.id);
    if (payment) {
      o.paymentChannel = payment.channel;
      o.paymentChannelLabel = channelNames.get(payment.channel) || payment.channel;
      o.paymentTradeNo = payment.trade_no || '';
      o.paymentPaidAt = payment.paid_at || '';
      o.paymentStatusLabel = PAYMENT_STATUS_LABELS[payment.status] || payment.status;
    }
  }

  return orders;
}

/** GET /api/order/:id - 按 ID + 联系方式查订单（contact 必填，防止 IDOR 枚举） */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const { contact } = req.query;

  if (!id) return fail(res, '缺少订单ID', 400);
  if (!contact || !String(contact).trim()) {
    return fail(res, '请提供联系方式以查询订单', 400);
  }

  const db = getDb();
  const order = db.prepare(
    'SELECT * FROM orders WHERE id = ? AND contact = ? COLLATE NOCASE'
  ).get(id, String(contact).trim());

  if (!order) return ok(res, null);

  const result = enrichOrder(row(order), db);
  return ok(res, result);
});

/** POST /api/order/query - 订单号 + 联系方式精准查询 */
router.post('/query', validate(schemas.orderQuerySchema), (req, res) => {
  const { orderNo, contact } = req.body;
  if (!orderNo?.trim() || !contact?.trim()) {
    return fail(res, '请输入订单号和联系方式', 400);
  }

  const db = getDb();
  const order = db.prepare(
    "SELECT * FROM orders WHERE order_no = ? AND contact = ? COLLATE NOCASE"
  ).get(orderNo.trim(), contact.trim());

  if (!order) return ok(res, null);

  const result = enrichOrder(row(order), db);
  return ok(res, result);
});

/**
 * POST /api/order/query-by-contact - 按联系方式查询订单
 * 两种模式：
 * 1. 精准查询：联系方式 + 订单号（永不过期）→ POST /api/order/query
 * 2. 模糊查询：仅联系方式（本接口，限制 N 天内）
 *
 * 安全设计：
 * - 开启 order.search_pwd_enabled 时必须传 searchPwd（双因子：联系方式+查询密码）
 * - 未开启查询密码时，纯联系方式模糊查询仅限制最近 days 天订单
 * - 卡密/卡号仅订单状态为 delivered 时返回（enrichOrder 中已控制）
 */
router.post('/query-by-contact', (req, res) => {
  const { contact, searchPwd, orderNo, days = 3 } = req.body || {};
  if (!contact?.trim()) return fail(res, '请输入联系方式', 400);

  const db = getDb();
  const { getBool } = require('../../services/settingsService');
  const searchPwdEnabled = getBool('order.search_pwd_enabled');

  if (searchPwdEnabled) {
    // 模式一：联系方式 + 查询密码（可查全部订单）
    if (!searchPwd?.trim()) {
      return fail(res, '请输入查询密码', 400);
    }
    const numDays = Math.max(1, Math.min(Number(days) || 3, 30));
    const cutoffMs = Date.now() - numDays * 86400000;
    const cutoffD = new Date(cutoffMs);
    const cutoffParts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(cutoffD);
    const getC = (t) => cutoffParts.find(p => p.type === t)?.value || '';
    const cutoff = `${getC('year')}-${getC('month')}-${getC('day')}T${getC('hour')}:${getC('minute')}:${getC('second')}.000+08:00`;

    const list = db.prepare(
      `SELECT * FROM orders WHERE contact = ? COLLATE NOCASE AND search_pwd = ? AND created_at >= ? ORDER BY created_at DESC`
    ).all(contact.trim(), String(searchPwd).trim(), cutoff);
    const results = rows(list);
    enrichOrdersBatch(results, db);
    return ok(res, results);
  }

  // 模式二：仅联系方式（模糊查询，仅限最近 days 天）
  // 安全措施：时间窗口限制 + enrichOrder 中已对非 delivered 订单隐藏卡密
  const numDays = Math.max(1, Math.min(Number(days) || 3, 30));
  const cutoffMs = Date.now() - numDays * 86400000;
  const cutoffD = new Date(cutoffMs);
  const cutoffParts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(cutoffD);
  const getC = (t) => cutoffParts.find(p => p.type === t)?.value || '';
  const cutoff = `${getC('year')}-${getC('month')}-${getC('day')}T${getC('hour')}:${getC('minute')}:${getC('second')}.000+08:00`;

  const list = db.prepare(
    `SELECT * FROM orders WHERE contact = ? COLLATE NOCASE AND created_at >= ? ORDER BY created_at DESC`
  ).all(contact.trim(), cutoff);
  const results = rows(list);
  enrichOrdersBatch(results, db);
  return ok(res, results);
});

/**
 * POST /api/order/query-by-email - 按邮箱查询订单
 * 两种模式：
 * 1. 精准查询：邮箱 + 订单号（永不过期）→ POST /api/order/query
 * 2. 模糊查询：仅邮箱（本接口，限制 N 天内）
 *
 * 安全设计：
 * - 开启 order.search_pwd_enabled 时必须传 searchPwd（双因子：邮箱+查询密码）
 * - 未开启查询密码时，纯邮箱模糊查询仅限制最近 days 天订单
 * - 卡密/卡号仅订单状态为 delivered 时返回（enrichOrder 中已控制）
 */
router.post('/query-by-email', (req, res) => {
  const { email, searchPwd, orderNo, days = 3 } = req.body || {};
  if (!email?.trim()) return fail(res, '请输入邮箱', 400);

  const db = getDb();
  const { getBool } = require('../../services/settingsService');
  const searchPwdEnabled = getBool('order.search_pwd_enabled');

  if (searchPwdEnabled) {
    // 模式一：邮箱 + 查询密码（可查该邮箱全部订单）
    if (!searchPwd?.trim()) {
      return fail(res, '请输入查询密码', 400);
    }
    const list = db.prepare(
      "SELECT * FROM orders WHERE email = ? COLLATE NOCASE AND search_pwd = ? ORDER BY created_at DESC LIMIT 10"
    ).all(email.trim(), String(searchPwd).trim());
    const results = rows(list);
    enrichOrdersBatch(results, db);
    return ok(res, results);
  }

  // 模式二：仅邮箱（模糊查询，仅限最近 days 天）
  // 安全措施：时间窗口限制 + enrichOrder 中已对非 delivered 订单隐藏卡密
  const numDays = Math.max(1, Math.min(Number(days) || 3, 30));
  const cutoffMs = Date.now() - numDays * 86400000;
  const cutoffD = new Date(cutoffMs);
  const cutoffParts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(cutoffD);
  const getC = (t) => cutoffParts.find(p => p.type === t)?.value || '';
  const cutoff = `${getC('year')}-${getC('month')}-${getC('day')}T${getC('hour')}:${getC('minute')}:${getC('second')}.000+08:00`;

  const list = db.prepare(
    `SELECT * FROM orders WHERE email = ? COLLATE NOCASE AND created_at >= ? ORDER BY created_at DESC LIMIT 10`
  ).all(email.trim(), cutoff);
  const results = rows(list);
  enrichOrdersBatch(results, db);
  return ok(res, results);
});

module.exports = router;
