/**
 * 管理后台 - 订单管理
 * GET    /api/admin/orders
 * POST   /api/admin/orders
 * PUT    /api/admin/orders/:id
 * POST   /api/admin/orders/:id/reissue
 * DELETE /api/admin/orders/:id
 * GET    /api/admin/trend
 * GET    /api/admin/export/orders
 * GET    /api/admin/export/cards
 */

const express = require('express');
const { getDb } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { genId, genOrderNo, row, rows, nowISO, nowISOPlus, ok, fail, paginate, createLogger } = require('../../utils');
const { batchGetPaymentNames } = require('../../utils/payment');
const logger = require('../../utils/logger');
const { sendOrderEmail, notifyAdminManualOrder } = require('../../services/emailService');
const { updateOrderStatus } = require('../../services/orderService');
const paymentRepo = require('../../repositories/paymentRepo');

const router = express.Router();
const log = createLogger(getDb);

/** CSV 单元格转义：防止公式注入 */
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

router.get('/orders', authMiddleware, (req, res) => {
  const db = getDb();
  // 服务端分页 + 筛选（status/keyword），避免全量加载导致前端卡顿
  const { status, keyword } = req.query;
  const where = [];
  const params = [];
  if (status && status !== 'all') {
    where.push('o.status = ?');
    params.push(status);
  }
  if (keyword && String(keyword).trim()) {
    const kw = `%${String(keyword).trim()}%`;
    where.push('(o.order_no LIKE ? OR o.contact LIKE ? OR o.email LIKE ?)');
    params.push(kw, kw, kw);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const baseSql = `SELECT o.* FROM orders o ${whereSql} ORDER BY o.created_at DESC`;

  // 强制分页（默认 page=1, pageSize=50），避免全量返回
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize, 10) : 50;
  const result = paginate(db, baseSql, null, { page, pageSize, maxPageSize: 200, params });
  const data = rows(result.data);

  // 批量补充支付信息（paymentRepo 统一 payments 表查询，消除 N+1）
  if (data.length > 0) {
    const orderIds = data.map(o => o.id);
    const paymentMap = paymentRepo.getPaymentsByOrderIds(db, orderIds);
    // 批量查询支付方式名称（消除支付方式名称的 N+1）
    const channels = [...new Set([
      ...data.map(o => o.paymentMethod),
      ...[...paymentMap.values()].map(p => p.channel),
    ])].filter(Boolean);
    const channelNames = batchGetPaymentNames(channels, db);
    for (const o of data) {
      const p = paymentMap.get(o.id);
      if (p) {
        o.paymentChannel = p.channel;
        o.paymentChannelLabel = channelNames.get(p.channel) || p.channel;
        o.paymentTradeNo = p.trade_no || '';
        o.paymentPaidAt = p.paid_at || '';
      }
      if (o.paymentMethod) {
        o.paymentMethodLabel = channelNames.get(o.paymentMethod) || o.paymentMethod;
      }
    }
  }
  return ok(res, { ...result, data });
});

router.post('/orders', authMiddleware, validate(schemas.createOrderSchema), (req, res) => {
  const db = getDb();
  const { productId, specId, contact, email, qty = 1, status = 'paid' } = req.body || {};
  if (!productId || !specId) return fail(res, '请选择商品和规格');
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(productId);
  if (!product) return fail(res, '商品不存在', 404);
  let specs = [];
  try { specs = JSON.parse(product.card_specs || '[]'); } catch { /* ignore */ }
  const spec = specs.find(s => s.id === specId);
  if (!spec) return fail(res, '该商品没有这个规格');
  const unitPrice = Number(spec.price) || 0;
  const id = genId('ord');
  const ts = nowISO();
  const productType = product.type === 'manual' ? 'manual' : 'auto';

  // paid/delivered 状态都视为已付款
  // auto 类型需分配卡密；manual 类型仅标记状态（人工处理）
  const shouldDeliver = (status === 'paid' || status === 'delivered') && productType === 'auto';
  const isManualPaid = (status === 'paid' || status === 'delivered') && productType === 'manual';

  let orderNo = '';
  let orderCreated = false;
  const MAX_RETRY = 3;
  for (let attempt = 0; attempt < MAX_RETRY && !orderCreated; attempt++) {
    orderNo = genOrderNo();
    const createTxn = db.transaction(() => {
      const paidAt = (shouldDeliver || isManualPaid) ? ts : null;
      const deliveredAt = shouldDeliver ? ts : null;
      const amount = +(unitPrice * qty).toFixed(2);
      db.prepare(`INSERT INTO orders (id, order_no, product_id, product_name, spec_id, spec_name,
        unit_price, contact, email, qty, amount, original_amount, status, paid_at, delivered_at, type, buy_ip, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, orderNo, productId, product.name, spec.id, spec.name,
          unitPrice, String(contact || '').trim(), String(email || '') || null, qty,
          amount, amount, status, paidAt, deliveredAt,
          productType, req.ip || '', ts, ts);

      if (shouldDeliver) {
        let poolSql = "SELECT * FROM cards WHERE product_id = ? AND status = 'available' AND deleted_at IS NULL";
        const params = [productId];
        if (specId) { poolSql += ' AND spec_id = ?'; params.push(specId); }
        poolSql += ' LIMIT ?'; params.push(qty);
        const pool = db.prepare(poolSql).all(...params);
        if (pool.length < qty) {
          throw new Error(`可用卡密不足：需 ${qty} 条，剩 ${pool.length} 条`);
        }
        let assigned = 0;
        const cardIds = [];
        for (const card of pool) {
          const r = db.prepare(
            "UPDATE cards SET status = 'assigned', order_id = ?, assigned_at = ? WHERE id = ? AND status = 'available'"
          ).run(id, ts, card.id);
          if (r.changes === 1) { assigned++; cardIds.push(card.id); }
        }
        if (assigned < qty) {
          throw new Error('卡密被并发占用，请重试');
        }
        // paid 状态分配卡密后升级为 delivered
        const finalStatus = status === 'paid' ? 'delivered' : status;
        db.prepare('UPDATE orders SET card_ids = ?, status = ? WHERE id = ?')
          .run(JSON.stringify(cardIds), finalStatus, id);
        // 销量统计
        db.prepare('UPDATE products SET sales_volume = sales_volume + ? WHERE id = ?').run(qty, productId);
      }
    });

    try {
      createTxn();
      orderCreated = true;
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed: orders\.order_no/i.test(e.message)) {
        if (attempt === MAX_RETRY - 1) return fail(res, '订单号生成失败，请重试', 500);
        continue;
      }
      return fail(res, e.message || '创建订单失败', 409);
    }
  }
  const order = row(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
  // 异步发送邮件通知（不阻塞响应）
  if (shouldDeliver && email) {
    sendOrderEmail(order, email).catch(e => {
      logger.error('订单邮件发送失败', { tag: 'admin', orderNo, error: e.message });
    });
  }
  // 后台开 manual 订单时通知管理员邮箱
  if (productType === 'manual') {
    notifyAdminManualOrder(order).catch(e => {
      logger.error('管理员通知失败', { tag: 'admin', orderNo, error: e.message });
    });
  }
  log(req.adminId, req.adminName, 'create_order', 'order', id, `后台开单 ${orderNo}`, req.ip);
  ok(res, order, 201);
});

router.put('/orders/:id', authMiddleware, validate(schemas.updateOrderSchema), (req, res) => {
  // 业务逻辑（含事务安全的卡密释放/优惠券回退/销量回退）下沉到 orderService.updateOrderStatus
  try {
    const { orderNo } = updateOrderStatus({
      orderId: req.params.id,
      patch: req.body || {},
      adminInfo: { id: req.adminId, name: req.adminName, ip: req.ip },
    });
    log(req.adminId, req.adminName, 'update_order', 'order', req.params.id, `修改订单状态为 ${req.body?.status || ''}`, req.ip);
    ok(res, null);
  } catch (e) {
    if (e.name === 'AppError') return fail(res, e.message, e.status || 400);
    return fail(res, e.message || '更新订单失败', 500);
  }
});

router.post('/orders/:id/reissue', authMiddleware, (req, res) => {
  const db = getDb();
  const order = row(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  if (!order) return fail(res, '订单不存在', 404);

  // 仅已支付/已发货订单可补发，防止未支付订单绕过支付直接补发
  if (order.status !== 'paid' && order.status !== 'delivered') {
    return fail(res, `当前状态(${order.status})不允许补发，仅 paid/delivered 可补发`, 409);
  }

  const currentCardIds = order.cardIds || [];
  const need = order.qty - currentCardIds.length;
  if (need <= 0) {
    const codes = currentCardIds.length > 0
      ? db.prepare(`SELECT content FROM cards WHERE id IN (${currentCardIds.map(() => '?').join(',')})`).all(...currentCardIds).map(r => r.content)
      : [];
    return ok(res, { codes });
  }

  let poolSql = "SELECT * FROM cards WHERE product_id = ? AND status = 'available' AND deleted_at IS NULL";
  const params = [order.productId];
  if (order.specId) { poolSql += ' AND spec_id = ?'; params.push(order.specId); }
  poolSql += ' LIMIT ?'; params.push(need);

  const pool = db.prepare(poolSql).all(...params);
  if (pool.length < need) return fail(res, `可用卡密不足：需 ${need} 条，剩 ${pool.length} 条`, 409);

  const assignTime = nowISO();
  const pickedIds = pool.map(c => c.id);
  const assignTxn = db.transaction(() => {
    // 并发安全：仅当 status='available' 时才分配
    let assigned = 0;
    for (const card of pool) {
      const r = db.prepare(
        "UPDATE cards SET status = 'assigned', order_id = ?, assigned_at = ? WHERE id = ? AND status = 'available'"
      ).run(order.id, assignTime, card.id);
      if (r.changes === 1) assigned++;
    }
    if (assigned < pool.length) {
      throw new Error('卡密被并发占用，请重试');
    }
    const newCardIds = [...currentCardIds, ...pickedIds];
    db.prepare(
      "UPDATE orders SET card_ids = ?, status = 'delivered', paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE id = ?"
    ).run(JSON.stringify(newCardIds), assignTime, assignTime, order.id);
  });
  try {
    assignTxn();
  } catch (e) {
    return fail(res, e.message || '补发失败', 409);
  }
  log(req.adminId, req.adminName, 'reissue_order', 'order', order.id, `补发订单 ${order.orderNo}`, req.ip);
  ok(res, { codes: pool.map(c => c.content) });
});

router.delete('/orders/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT card_ids, status FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return fail(res, '订单不存在', 404);

  const cardIds = (() => {
    try { return JSON.parse(order.card_ids || '[]'); } catch { return []; }
  })();

  // 已发货订单的卡密已被消费，不释放回池（防止二次销售）
  // 仅 pending/paid/failed/refunded 状态下释放已分配卡密
  const shouldRelease = order.status !== 'delivered';

  const deleteTxn = db.transaction(() => {
    if (shouldRelease && cardIds.length > 0) {
      db.prepare(
        `UPDATE cards SET status = 'available', order_id = NULL, assigned_at = NULL WHERE id IN (${cardIds.map(() => '?').join(',')})`
      ).run(...cardIds);
    } else if (cardIds.length > 0) {
      // delivered 状态：卡密标记为已售出，保留 order_id 引用便于追溯
      db.prepare(
        `UPDATE cards SET status = 'sold' WHERE id IN (${cardIds.map(() => '?').join(',')}) AND status = 'assigned'`
      ).run(...cardIds);
    }
    // 删除订单
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  });

  deleteTxn();
  log(req.adminId, req.adminName, 'delete_order', 'order', req.params.id,
    `删除订单(状态:${order.status}, 释放卡密:${shouldRelease ? '是' : '否'})`, req.ip);
  ok(res, null);
});

// ---- 趋势 & 导出 ----

router.get('/trend', authMiddleware, (req, res) => {
  const db = getDb();
  const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 30);

  // 计算起始日期（上海时区，N 天前的那一天）
  const startDate = nowISOPlus(-(days - 1) * 86400000).slice(0, 10);

  // 单次 GROUP BY 查询替代循环 N*2 次查询（消除 N+1）
  // substr(created_at, 1, 10) 取日期部分（YYYY-MM-DD），按上海时区分组
  const orderCounts = db.prepare(
    "SELECT substr(created_at, 1, 10) as date, COUNT(*) as c FROM orders WHERE substr(created_at, 1, 10) >= ? GROUP BY substr(created_at, 1, 10)"
  ).all(startDate);
  const amountSums = db.prepare(
    "SELECT substr(created_at, 1, 10) as date, COALESCE(SUM(amount), 0) as s FROM orders WHERE substr(created_at, 1, 10) >= ? AND status IN ('paid','delivered') GROUP BY substr(created_at, 1, 10)"
  ).all(startDate);

  const countMap = new Map(orderCounts.map(r => [r.date, r.c]));
  const amountMap = new Map(amountSums.map(r => [r.date, Number(r.s).toFixed(2)]));

  // 填充每一天的数据（即使没订单也要返回 0）
  const trends = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = nowISOPlus(-i * 86400000).slice(0, 10);
    trends.push({
      date,
      orders: countMap.get(date) || 0,
      amount: Number(amountMap.get(date) || 0),
    });
  }
  ok(res, trends);
});

router.get('/export/orders', authMiddleware, (req, res) => {
  const db = getDb();
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  const headers = ['订单号', '商品', '规格', '单价', '数量', '金额', '联系方式', '邮箱', '状态', '创建时间'];
  const rows_csv = orders.map(o => [
    o.order_no, o.product_name, o.spec_name, o.unit_price, o.qty, o.amount,
    o.contact, o.email || '', o.status, o.created_at
  ]);
  const csv = [headers.map(csvCell).join(','), ...rows_csv.map(r => r.map(csvCell).join(','))].join('\n');
  const today = nowISO().slice(0, 10).replace(/-/g, '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=orders_${today}.csv`);
  res.send('\uFEFF' + csv);
});

router.get('/export/cards', authMiddleware, (req, res) => {
  const db = getDb();
  const cards = db.prepare(`
    SELECT c.*, p.name as product_name FROM cards c
    LEFT JOIN products p ON c.product_id = p.id
    WHERE c.deleted_at IS NULL
    ORDER BY c.created_at DESC
  `).all();
  const headers = ['卡密内容', '商品', '规格', '时长(秒)', '状态', '关联订单', '分配时间', '创建时间'];
  const rows_csv = cards.map(c => [
    c.content, c.product_name || '', c.type, c.duration_seconds, c.status, c.order_id || '', c.assigned_at || '', c.created_at
  ]);
  const csv = [headers.map(csvCell).join(','), ...rows_csv.map(r => r.map(csvCell).join(','))].join('\n');
  const today = nowISO().slice(0, 10).replace(/-/g, '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=cards_${today}.csv`);
  res.send('\uFEFF' + csv);
});

module.exports = router;
