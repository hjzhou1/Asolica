/**
 * 优惠券业务服务
 * 参考独角数卡 CouponService
 *
 * 功能：
 * - CRUD：创建/查询/更新/删除优惠码
 * - 验证：下单时验证优惠码是否有效（启用+剩余次数+关联商品）
 * - 扣减：下单成功后扣减剩余次数
 * - 回退：订单过期/取消时回退使用次数
 */

const { getDb } = require('../db');
const { genId } = require('../utils/id');
const { nowISO } = require('../utils/response');

/**
 * 获取所有优惠码（带关联商品信息）
 * @returns {Array}
 */
function listCoupons() {
  const db = getDb();
  const coupons = db.prepare(
    'SELECT * FROM coupons WHERE deleted_at IS NULL ORDER BY created_at DESC'
  ).all();

  // 批量查询关联商品
  return coupons.map(c => {
    const products = db.prepare(
      `SELECT p.id, p.name FROM products p
       INNER JOIN coupon_products cp ON p.id = cp.product_id
       WHERE cp.coupon_id = ?`
    ).all(c.id);
    return {
      id: c.id,
      code: c.code,
      discount: c.discount,
      isOpen: c.is_open === 1,
      ret: c.ret,
      usedCount: c.used_count,
      note: c.note || '',
      expiresAt: c.expires_at || null,
      minAmount: c.min_amount || 0,
      perUserLimit: c.per_user_limit || 0,
      productIds: products.map(p => p.id),
      productNames: products.map(p => p.name),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  });
}

/**
 * 创建优惠码
 * @param {object} params - { code, discount, ret, note, productIds, expiresAt, minAmount, perUserLimit }
 * @returns {object} 创建的优惠码
 */
function createCoupon({ code, discount, ret = -1, note = '', productIds = [], expiresAt = null, minAmount = 0, perUserLimit = 0 }) {
  const db = getDb();
  const id = genId('cpn');
  const now = nowISO();

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO coupons (id, code, discount, is_open, ret, used_count, note, expires_at, min_amount, per_user_limit, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, 0, ?, ?, ?, ?, ?, ?)
    `).run(id, code, discount, ret, note, expiresAt, minAmount, perUserLimit, now, now);

    // 关联商品
    if (productIds.length > 0) {
      const stmt = db.prepare('INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)');
      for (const pid of productIds) {
        stmt.run(id, pid);
      }
    }
  });
  txn();

  return getCoupon(id);
}

/**
 * 按 ID 获取优惠码（带关联商品）
 * @param {string} id
 * @returns {object|null}
 */
function getCoupon(id) {
  const db = getDb();
  const c = db.prepare('SELECT * FROM coupons WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!c) return null;
  const products = db.prepare(
    `SELECT p.id, p.name FROM products p
     INNER JOIN coupon_products cp ON p.id = cp.product_id
     WHERE cp.coupon_id = ?`
  ).all(c.id);
  return {
    id: c.id,
    code: c.code,
    discount: c.discount,
    isOpen: c.is_open === 1,
    ret: c.ret,
    usedCount: c.used_count,
    note: c.note || '',
    expiresAt: c.expires_at || null,
    minAmount: c.min_amount || 0,
    perUserLimit: c.per_user_limit || 0,
    productIds: products.map(p => p.id),
    productNames: products.map(p => p.name),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

/**
 * 更新优惠码
 * @param {string} id
 * @param {object} params - { code?, discount?, isOpen?, ret?, note?, productIds? }
 */
function updateCoupon(id, params) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM coupons WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) throw new Error('优惠码不存在');

  const now = nowISO();
  const txn = db.transaction(() => {
    const fields = [];
    const values = [];
    if (params.code !== undefined) { fields.push('code = ?'); values.push(params.code); }
    if (params.discount !== undefined) { fields.push('discount = ?'); values.push(params.discount); }
    if (params.isOpen !== undefined) { fields.push('is_open = ?'); values.push(params.isOpen ? 1 : 0); }
    if (params.ret !== undefined) { fields.push('ret = ?'); values.push(params.ret); }
    if (params.note !== undefined) { fields.push('note = ?'); values.push(params.note); }
    if (params.expiresAt !== undefined) { fields.push('expires_at = ?'); values.push(params.expiresAt); }
    if (params.minAmount !== undefined) { fields.push('min_amount = ?'); values.push(params.minAmount); }
    if (params.perUserLimit !== undefined) { fields.push('per_user_limit = ?'); values.push(params.perUserLimit); }
    fields.push('updated_at = ?'); values.push(now);
    values.push(id);

    db.prepare(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // 更新关联商品（如果传了 productIds）
    if (params.productIds !== undefined) {
      db.prepare('DELETE FROM coupon_products WHERE coupon_id = ?').run(id);
      if (params.productIds.length > 0) {
        const stmt = db.prepare('INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)');
        for (const pid of params.productIds) {
          stmt.run(id, pid);
        }
      }
    }
  });
  txn();

  return getCoupon(id);
}

/**
 * 删除优惠码（软删除）
 * 参考独角数卡 SoftDeletes
 * @param {string} id
 */
function deleteCoupon(id) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM coupons WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) throw new Error('优惠码不存在');
  const now = nowISO();
  db.prepare('UPDATE coupons SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
}

/**
 * 验证优惠码（下单时调用）
 * 参考独角数卡 CouponService::withHasGoods
 * @param {string} code - 优惠码
 * @param {string} productId - 商品ID
 * @param {object} [opts] - 额外校验参数 { amount, contact }
 * @returns {{ valid: boolean, coupon?: object, message?: string }}
 */
function validateCoupon(code, productId, opts = {}) {
  const db = getDb();
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND deleted_at IS NULL').get(code);

  if (!coupon) {
    return { valid: false, message: '优惠码不存在' };
  }
  if (coupon.is_open !== 1) {
    return { valid: false, message: '优惠码已停用' };
  }
  if (coupon.ret === 0) {
    return { valid: false, message: '优惠码使用次数已用完' };
  }
  // 过期校验
  if (coupon.expires_at) {
    const now = nowISO();
    if (now >= coupon.expires_at) {
      return { valid: false, message: '优惠码已过期' };
    }
  }
  // 最低消费校验
  if (coupon.min_amount > 0 && opts.amount !== undefined) {
    if (Number(opts.amount) < coupon.min_amount) {
      return { valid: false, message: `订单金额需满 ${coupon.min_amount} 元才能使用此优惠码` };
    }
  }
  // 单用户使用次数校验
  if (coupon.per_user_limit > 0 && opts.contact) {
    const usedCount = db.prepare(
      "SELECT COUNT(*) as c FROM coupon_usages WHERE coupon_id = ? AND contact = ?"
    ).get(coupon.id, String(opts.contact).trim()).c;
    if (usedCount >= coupon.per_user_limit) {
      return { valid: false, message: `此优惠码每个用户限用 ${coupon.per_user_limit} 次` };
    }
  }

  // 检查是否关联该商品
  // 如果优惠码没有关联任何商品（coupon_products 表无记录），则对所有商品生效（全场通用）
  const linkedCount = db.prepare(
    'SELECT COUNT(*) as c FROM coupon_products WHERE coupon_id = ?'
  ).get(coupon.id).c;
  if (linkedCount > 0) {
    // 有关联商品时，检查该商品是否在关联列表中
    const linked = db.prepare(
      'SELECT 1 FROM coupon_products WHERE coupon_id = ? AND product_id = ?'
    ).get(coupon.id, productId);
    if (!linked) {
      return { valid: false, message: '该优惠码不适用于此商品' };
    }
  }
  // linkedCount === 0 表示全场通用，不检查商品关联

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount: coupon.discount,
      ret: coupon.ret,
    },
  };
}

/**
 * 扣减优惠码使用次数（下单成功后调用）
 * 参考独角数卡 CouponService::retDecr + used
 * 原子条件 UPDATE：仅当 ret > 0（有限次）或 ret = -1（无限次）时才扣减，防止并发超额使用
 * @param {string} couponId
 * @param {object} [opts] - { orderId, contact } 用于记录使用明细（支持 per_user_limit 校验）
 * @returns {boolean} 是否扣减成功（false 表示已被并发抢光）
 */
function consumeCoupon(couponId, opts = {}) {
  const db = getDb();
  const now = nowISO();
  const result = db.prepare(`
    UPDATE coupons
    SET used_count = used_count + 1,
        ret = CASE WHEN ret > 0 THEN ret - 1 ELSE ret END,
        updated_at = ?
    WHERE id = ? AND (ret > 0 OR ret = -1)
  `).run(now, couponId);
  if (result.changes > 0 && opts.orderId && opts.contact) {
    // 记录使用明细，支持 per_user_limit 校验
    db.prepare(
      'INSERT INTO coupon_usages (id, coupon_id, order_id, contact, used_at) VALUES (?, ?, ?, ?, ?)'
    ).run(genId('cu'), couponId, opts.orderId, String(opts.contact).trim(), now);
  }
  return result.changes > 0;
}

/**
 * 回退优惠码使用次数（订单过期/取消时调用）
 * 参考独角数卡 CouponService::retIncrByID
 * @param {string} couponId
 * @param {string} [orderId] - 传入则同时删除该订单的使用记录（幂等回退）
 */
function rollbackCoupon(couponId, orderId) {
  const db = getDb();
  const now = nowISO();
  db.prepare(`
    UPDATE coupons
    SET used_count = CASE WHEN used_count > 0 THEN used_count - 1 ELSE 0 END,
        ret = CASE WHEN ret >= 0 THEN ret + 1 ELSE ret END,
        updated_at = ?
    WHERE id = ?
  `).run(now, couponId);
  // 删除使用记录（幂等：仅删除该订单的记录，避免重复回退）
  if (orderId) {
    db.prepare('DELETE FROM coupon_usages WHERE coupon_id = ? AND order_id = ?').run(couponId, orderId);
  }
}

module.exports = {
  listCoupons,
  createCoupon,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  consumeCoupon,
  rollbackCoupon,
};
