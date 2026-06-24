/**
 * 管理后台 - 商品 CRUD
 * GET    /api/admin/products
 * POST   /api/admin/products
 * PUT    /api/admin/products/:id
 * DELETE /api/admin/products/:id  （软删除）
 * GET    /api/admin/products/stock
 * GET    /api/admin/products/:id/stock
 */

const express = require('express');
const { getDb } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { genId, row, rows, ok, fail, paginate, createLogger, nowISO } = require('../../utils');

const router = express.Router();
const log = createLogger(getDb);

router.get('/products', authMiddleware, (req, res) => {
  const db = getDb();
  const baseSql = `
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.deleted_at IS NULL
    ORDER BY p.ord DESC, p.created_at DESC
  `;
  // 强制分页，避免商品量大时全量返回导致性能问题
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 200;
  const result = paginate(db, baseSql, null, { page, pageSize, maxPageSize: 500, params: [] });
  ok(res, { ...result, data: rows(result.data) });
});

router.post('/products', authMiddleware, validate(schemas.createProductSchema), (req, res) => {
  const {
    name, categoryId, status = 'on', desc = '', image = '', content = '',
    cardSpecs = [], type = 'auto', buyLimitNum = 0, ord = 0,
    wholesalePriceCnf = '', otherIpuCnf = '', apiHook = '',
  } = req.body || {};
  if (!name?.trim()) return fail(res, '商品名称不能为空');
  if (!categoryId) return fail(res, '请选择分类');
  const db = getDb();
  if (!db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(categoryId)) {
    return fail(res, '分类不存在', 404);
  }
  const specs = (Array.isArray(cardSpecs) ? cardSpecs : []).filter(s => s?.name?.trim()).map(s => ({
    id: s.id || genId('spec'), name: String(s.name).trim(),
    durationSeconds: Math.max(0, Number(s.durationSeconds) || 0),
    price: Math.max(0, Number(s.price) || 0), status: s.status === 'off' ? 'off' : 'on',
  }));
  const id = genId('prd');
  const now = nowISO();
  db.prepare(`INSERT INTO products (id, category_id, name, status, \`desc\`, image, content, card_specs, type, buy_limit_num, ord, wholesale_price_cnf, other_ipu_cnf, api_hook, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, categoryId, String(name).trim(), status, String(desc), String(image), String(content),
      JSON.stringify(specs), type === 'manual' ? 'manual' : 'auto',
      Math.max(0, Math.floor(Number(buyLimitNum) || 0)), Math.floor(Number(ord) || 0),
      String(wholesalePriceCnf), String(otherIpuCnf), String(apiHook), now, now);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  log(req.adminId, req.adminName, 'create_product', 'product', id, `创建商品: ${name}`, req.ip);
  ok(res, row(product), 201);
});

router.put('/products/:id', authMiddleware, validate(schemas.updateProductSchema), (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM products WHERE id = ? AND deleted_at IS NULL').get(req.params.id)) {
    return fail(res, '商品不存在', 404);
  }
  const patch = req.body || {};
  const fields = [], values = [];
  if (patch.name !== undefined) { fields.push('name = ?'); values.push(String(patch.name).trim()); }
  if (patch.categoryId !== undefined) {
    if (!db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(patch.categoryId)) {
      return fail(res, '分类不存在', 404);
    }
    fields.push('category_id = ?'); values.push(patch.categoryId);
  }
  if (patch.status !== undefined) { fields.push('status = ?'); values.push(patch.status); }
  if (patch.desc !== undefined) { fields.push('`desc` = ?'); values.push(String(patch.desc)); }
  if (patch.image !== undefined) { fields.push('image = ?'); values.push(String(patch.image)); }
  if (patch.content !== undefined) { fields.push('content = ?'); values.push(String(patch.content)); }
  if (patch.cardSpecs !== undefined) {
    fields.push('card_specs = ?');
    const specs = Array.isArray(patch.cardSpecs) ? patch.cardSpecs : [];
    values.push(JSON.stringify(specs.filter(s => s?.name?.trim()).map(s => ({
      id: s.id || genId('spec'), name: String(s.name).trim(),
      durationSeconds: Math.max(0, Number(s.durationSeconds) || 0),
      price: Math.max(0, Number(s.price) || 0), status: s.status === 'off' ? 'off' : 'on',
    }))));
  }
  if (patch.type !== undefined) {
    fields.push('type = ?'); values.push(patch.type === 'manual' ? 'manual' : 'auto');
  }
  if (patch.buyLimitNum !== undefined) {
    fields.push('buy_limit_num = ?'); values.push(Math.max(0, Math.floor(Number(patch.buyLimitNum) || 0)));
  }
  if (patch.ord !== undefined) {
    fields.push('ord = ?'); values.push(Math.floor(Number(patch.ord) || 0));
  }
  if (patch.wholesalePriceCnf !== undefined) {
    fields.push('wholesale_price_cnf = ?'); values.push(String(patch.wholesalePriceCnf));
  }
  if (patch.otherIpuCnf !== undefined) {
    fields.push('other_ipu_cnf = ?'); values.push(String(patch.otherIpuCnf));
  }
  if (patch.apiHook !== undefined) {
    fields.push('api_hook = ?'); values.push(String(patch.apiHook));
  }
  fields.push('updated_at = ?');
  values.push(nowISO());
  values.push(req.params.id);
  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  log(req.adminId, req.adminName, 'update_product', 'product', req.params.id, '更新商品', req.ip);
  ok(res, row(updated));
});

router.delete('/products/:id', authMiddleware, (req, res) => {
  const db = getDb();
  // 软删除：参考独角数卡 SoftDeletes，仅标记 deleted_at，保留数据可恢复
  const product = db.prepare('SELECT id FROM products WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!product) return fail(res, '商品不存在', 404);
  // 仍检查可用卡密（防止误删有库存商品）
  if (db.prepare("SELECT id FROM cards WHERE product_id = ? AND status = 'available' AND deleted_at IS NULL LIMIT 1").get(req.params.id)) {
    return fail(res, '该商品下还有可用卡密，请先删除卡密', 409);
  }

  // 检查是否有 pending 订单
  const pendingCount = db.prepare(
    "SELECT COUNT(*) as c FROM orders WHERE product_id = ? AND status = 'pending'"
  ).get(req.params.id).c;

  const cancelPending = req.query.cancelPending === '1' || req.body?.cancelPending === true;

  if (pendingCount > 0 && !cancelPending) {
    // 提示管理员：有 pending 订单，需确认是否取消
    return res.status(409).json({
      ok: false,
      code: 'PENDING_ORDERS_EXIST',
      message: `该商品下有 ${pendingCount} 个待支付订单，是否同时取消这些订单？`,
      pendingCount,
    });
  }

  const now = nowISO();
  const txn = db.transaction(() => {
    // 取消 pending 订单 + 回退优惠券
    if (pendingCount > 0 && cancelPending) {
      const pendingOrders = db.prepare(
        "SELECT id, coupon_id FROM orders WHERE product_id = ? AND status = 'pending'"
      ).all(req.params.id);
      for (const o of pendingOrders) {
        db.prepare("UPDATE orders SET status = 'expired', updated_at = ? WHERE id = ?").run(now, o.id);
        if (o.coupon_id) {
          // 回退优惠券（幂等）
          const { rollbackCoupon } = require('../../services/couponService');
          rollbackCoupon(o.coupon_id, o.id);
        }
      }
      log(req.adminId, req.adminName, 'cancel_pending_orders', 'orders', req.params.id,
        `删除商品时取消 ${pendingCount} 个 pending 订单`, req.ip);
    }
    db.prepare('UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, req.params.id);
  });
  txn();
  log(req.adminId, req.adminName, 'delete_product', 'product', req.params.id, '删除商品(软删除)', req.ip);
  ok(res, { cancelledPending: pendingCount });
});

router.get('/products/stock', authMiddleware, (req, res) => {
  const db = getDb();
  const list = db.prepare(
    "SELECT product_id as productId, spec_id as specId, COUNT(*) as count FROM cards WHERE status = 'available' AND deleted_at IS NULL GROUP BY product_id, spec_id"
  ).all();
  ok(res, list);
});

router.get('/products/:id/stock', authMiddleware, (req, res) => {
  const db = getDb();
  let sql = "SELECT COUNT(*) as c FROM cards WHERE product_id = ? AND status = 'available' AND deleted_at IS NULL";
  const params = [req.params.id];
  if (req.query.specId) { sql += ' AND spec_id = ?'; params.push(req.query.specId); }
  ok(res, db.prepare(sql).get(...params).c);
});

module.exports = router;
