/**
 * 订单业务服务
 * 订单创建、超时取消、补发、查询等核心业务逻辑
 *
 * 阶段一重构目标：
 * - 所有 orders 表 SQL 下沉到 repositories/orderRepo
 * - 所有 products/cards 表 SQL 下沉到对应 repositories
 * - 本文件只保留业务编排（校验、价格计算、事务、通知）
 */

const { getDb } = require('../db');
const { genId, genOrderNo, row } = require('../utils');
const { nowISO, nowISOPlus } = require('../utils/response');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config/env');
const { MAX_QTY, ORDER_TRANSITIONS } = require('../config/constants');
const { validateCoupon, consumeCoupon, rollbackCoupon } = require('./couponService');
const { sendOrderEmail, notifyAdminManualOrder, notifyOrderStatusChange } = require('./emailService');
const { triggerApiHook } = require('./apiHookService');
const productRepo = require('../repositories/productRepo');
const cardRepo = require('../repositories/cardRepo');
const orderRepo = require('../repositories/orderRepo');
const paymentRepo = require('../repositories/paymentRepo');

/**
 * 取消过期订单（原 app.js 中的定时任务逻辑）
 * 同时将关联的 pending payment 标记为 failed，并释放已分配卡密
 * 参考独角数卡 OrderExpired Job + CouponBack Job：
 *   - 过期订单标记为 expired（不再用 failed 混淆）
 *   - 释放已分配卡密
 *   - 回退优惠券使用次数（关键修复：原代码未回退）
 * @param {Database} [dbInstance]
 * @returns {number} 取消的订单数
 */
function cancelExpiredOrders(dbInstance) {
  const db = dbInstance || getDb();
  const txn = db.transaction(() => {
    const now = nowISO();
    // 查询过期订单（含卡密+优惠券信息）
    const expired = db.prepare(
      "SELECT id, card_ids, coupon_id FROM orders WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?"
    ).all(now);

    for (const order of expired) {
      // 释放已分配卡密
      let cardIds = [];
      try { cardIds = JSON.parse(order.card_ids || '[]'); } catch { cardIds = []; }
      if (cardIds.length > 0) {
        const placeholders = cardIds.map(() => '?').join(',');
        db.prepare(
          `UPDATE cards SET status = 'available', order_id = NULL, assigned_at = NULL WHERE id IN (${placeholders}) AND status = 'assigned'`
        ).run(...cardIds);
      }
      // 标记订单为 expired（参考独角数卡：独立过期状态，不再用 failed 混淆）
      db.prepare("UPDATE orders SET status = 'expired', card_ids = '[]', updated_at = ? WHERE id = ?")
        .run(now, order.id);
      // 标记关联的 pending payment 为 failed
      paymentRepo.markPendingPaymentsFailed(db, order.id, now);
      // 回退优惠券使用次数（参考独角数卡 CouponBack Job，关键修复）
      if (order.coupon_id) {
        rollbackCoupon(order.coupon_id);
      }
    }

    if (expired.length > 0) {
      const logId = genId('log');
      db.prepare('INSERT INTO operation_logs (id, action, target_type, detail, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(logId, 'auto_cancel', 'orders', `自动取消 ${expired.length} 笔超时订单`, now);
    }
    return expired.length;
  });
  const count = txn();
  if (count > 0) {
    process.stdout.write(`[auto-cancel] 取消 ${count} 笔超时订单\n`);
  }
  return count;
}

// ========== 下单相关辅助函数 ==========

/**
 * 解析批发价配置（参考独角数卡 format_wholesale_price）
 * 格式：每行 "数量=单价"，如 "5=3\n10=2.5"
 * @returns {Array<{number:number, price:number}>} 按数量升序
 */
function parseWholesalePriceCnf(cnf) {
  if (!cnf) return [];
  const lines = String(cnf).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const result = [];
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length !== 2) continue;
    const number = parseInt(parts[0], 10);
    const price = parseFloat(parts[1]);
    if (isNaN(number) || isNaN(price) || number < 1 || price < 0) continue;
    result.push({ number, price });
  }
  result.sort((a, b) => a.number - b.number);
  return result;
}

/**
 * 计算批发价优惠金额（参考独角数卡 calculateTheWholesalePrice）
 * @returns {number} 优惠金额（原总价 - 阶梯价后总价）
 */
function calcWholesaleDiscount(unitPrice, qty, conf) {
  if (!conf.length) return 0;
  let tierPrice = 0;
  for (const tier of conf) {
    if (qty >= tier.number) tierPrice = tier.price;
  }
  if (tierPrice <= 0) return 0;
  const originalTotal = +(unitPrice * qty).toFixed(2);
  const tierTotal = +(tierPrice * qty).toFixed(2);
  return +Math.max(0, originalTotal - tierTotal).toFixed(2);
}

/**
 * 解析其他输入框配置（参考独角数卡 format_charge_input）
 * 格式：每行 "字段=描述=是否必填=占位符"
 * @returns {Array<{field, desc, rule, placeholder}>}
 */
function parseOtherIpuCnf(cnf) {
  if (!cnf) return [];
  const lines = String(cnf).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const result = [];
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length < 3) continue;
    result.push({
      field: parts[0].trim(),
      desc: parts[1].trim(),
      rule: parts[2].trim() === 'true' || parts[2].trim() === '1',
      placeholder: (parts[3] || parts[1]).trim(),
    });
  }
  return result;
}

// 站点设置读取统一使用 settingsService.getSetting（带缓存）
const { getSetting: getSettingCached } = require('./settingsService');

// ========== 下单核心服务 ==========

/**
 * 创建订单（事务安全）
 * @param {object} params
 * @param {string} params.productId
 * @param {string} params.specId
 * @param {string} params.contact
 * @param {string} [params.email]
 * @param {number} [params.qty]
 * @param {string} [params.couponCode]
 * @param {string} [params.searchPwd]
 * @param {string} [params.otherIpu]
 * @param {string} [params.buyIp]
 * @param {object} [params.dbInstance]
 * @returns {object} camelCase 后的订单数据（含 codes 字段）
 */
function createOrder({
  productId,
  specId,
  contact,
  email,
  qty = 1,
  couponCode,
  searchPwd,
  otherIpu,
  buyIp,
  dbInstance,
}) {
  const db = dbInstance || getDb();
  const numQty = Math.max(1, Math.min(Number(qty) || 1, MAX_QTY));
  const contactStr = String(contact).trim();
  const emailStr = String(email || '').trim() || null;

  // 1. 商品与规格校验
  const product = productRepo.getActiveProductById(db, productId);
  if (!product) {
    throw new AppError('商品不存在或已下架', 404, 'PRODUCT_NOT_FOUND');
  }

  let specs = [];
  try { specs = JSON.parse(product.card_specs || '[]'); } catch { /* ignore */ }
  const spec = specs.find(s => s.id === specId);
  if (!spec) throw new AppError('该规格不存在', 400, 'SPEC_NOT_FOUND');
  if (spec.status === 'off') throw new AppError('该规格已下架', 400, 'SPEC_OFF');

  const productType = product.type === 'manual' ? 'manual' : 'auto';
  const unitPrice = Number(spec.price) || 0;

  // 2. 循环卡密校验
  if (productType === 'auto' && numQty > 1) {
    const loopCount = cardRepo.countAvailableLoop(db, productId, specId);
    if (loopCount > 0) {
      throw new AppError('此商品包含循环卡密，最多购买1件', 409, 'LOOP_CARD_LIMIT');
    }
  }

  // 3. 限购校验
  const buyLimitNum = Number(product.buy_limit_num) || 0;
  if (buyLimitNum > 0) {
    // 使用上海时区 ISO 格式，与 nowISO() 保持一致
    const cutoffD = new Date(Date.now() - 30 * 86400000);
    const cutoffParts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(cutoffD);
    const getCo = (t) => cutoffParts.find(p => p.type === t)?.value || '';
    const cutoff = `${getCo('year')}-${getCo('month')}-${getCo('day')}T${getCo('hour')}:${getCo('minute')}:${getCo('second')}.000+08:00`;
    const bought = orderRepo.sumPaidDeliveredQty(db, productId, contactStr, cutoff);
    if (bought + numQty > buyLimitNum) {
      throw new AppError(
        `该商品限购 ${buyLimitNum} 个，您近30天已购 ${bought} 个，本次最多可购 ${Math.max(0, buyLimitNum - bought)} 个`,
        409,
        'BUY_LIMIT_EXCEEDED'
      );
    }
  }

  // 4. 查询密码校验
  const searchPwdEnabled = getSettingCached('order.search_pwd_enabled', '0') === '1';
  const searchPwdStr = String(searchPwd || '').trim();
  if (searchPwdEnabled && !searchPwdStr) {
    throw new AppError('请输入查询密码', 400, 'SEARCH_PWD_REQUIRED');
  }

  // 5. 其他输入框校验（仅 manual 类型）
  let infoStr = '';
  if (productType === 'manual' && product.other_ipu_cnf) {
    const fields = parseOtherIpuCnf(product.other_ipu_cnf);
    if (fields.length > 0) {
      let userInput = {};
      try { userInput = otherIpu ? JSON.parse(otherIpu) : {}; } catch { userInput = {}; }
      const parts = [];
      for (const f of fields) {
        const val = String(userInput[f.field] ?? '').trim();
        if (f.rule && !val) {
          throw new AppError(`请填写 ${f.desc}`, 400, 'OTHER_IPU_REQUIRED');
        }
        if (val) parts.push(`${f.desc}:${val}`);
      }
      infoStr = parts.join('\n');
    }
  }

  // 6. 价格计算（优惠券校验前先算好原始金额）
  const originalAmount = +(unitPrice * numQty).toFixed(2);
  const wholesaleConf = parseWholesalePriceCnf(product.wholesale_price_cnf);
  const wholesaleDiscount = calcWholesaleDiscount(unitPrice, numQty, wholesaleConf);

  // 7. 优惠券验证（传入 opts 避免满减门槛和单用户限制被绕过）
  let couponInfo = null;
  let couponDiscount = 0;
  if (couponCode) {
    const result = validateCoupon(couponCode, productId, {
      amount: originalAmount,
      contact: contactStr,
    });
    if (!result.valid) {
      throw new AppError(result.message, 400, 'COUPON_INVALID');
    }
    couponInfo = result.coupon;
    couponDiscount = result.coupon.discount;
  }

  const totalAmount = +Math.max(0, originalAmount - wholesaleDiscount - couponDiscount).toFixed(2);

  const now = nowISO();
  const isFree = totalAmount === 0;
  const isPending = !isFree || productType === 'manual';
  // 使用 nowISOPlus 确保与 cancelExpiredOrders 中的 nowISO() 格式完全一致（上海时区 +08:00）
  // 避免 toISOString()（UTC Z 格式）与 nowISO()（+08:00 格式）字符串比较错误
  const expiresAt = isPending
    ? nowISOPlus(config.orderExpireMinutes * 60 * 1000)
    : null;

  // 8. 生成订单号并创建订单（带重试）
  const orderId = genId('ord');
  let orderNo = '';
  let orderCreated = false;
  const MAX_RETRY = 3;

  for (let attempt = 0; attempt < MAX_RETRY && !orderCreated; attempt++) {
    orderNo = genOrderNo();
    try {
      const createOrderTxn = db.transaction(() => {
        let cardIds = [];

        if (!isPending && productType === 'auto') {
          // 免费自动发货：直接分配卡密
          const picked = cardRepo.pickAvailable(db, productId, specId, numQty);
          if (picked.length < numQty) {
            throw new AppError(`库存不足！当前剩余 ${picked.length} 个，需要 ${numQty} 个`, 409, 'STOCK_INSUFFICIENT');
          }
          cardIds = picked.map(c => c.id);
        } else if (isPending && productType === 'auto') {
          // 付费自动发货：仅检查库存
          const available = cardRepo.countAvailable(db, productId, specId);
          if (available < numQty) {
            throw new AppError(`库存不足！当前剩余 ${available} 个，需要 ${numQty} 个`, 409, 'STOCK_INSUFFICIENT');
          }
        }
        // manual 类型：无需库存检查

        const status = isPending ? 'pending' : 'delivered';
        orderRepo.insertOrder(db, {
          id: orderId,
          orderNo,
          productId,
          productName: product.name,
          specId: spec.id,
          specName: spec.name,
          unitPrice,
          contact: contactStr,
          email: emailStr,
          qty: numQty,
          amount: totalAmount,
          status,
          cardIds: JSON.stringify(cardIds),
          paidAt: isPending ? null : now,
          deliveredAt: status === 'delivered' ? now : null,
          expiresAt,
          couponId: couponInfo ? couponInfo.id : null,
          couponCode: couponInfo ? couponInfo.code : '',
          couponDiscount,
          originalAmount,
          buyIp: buyIp || '',
          type: productType,
          searchPwd: searchPwdStr,
          info: infoStr,
        });

        // 免费自动发货：真正分配卡密 + 销量统计
        if (!isPending && productType === 'auto' && cardIds.length > 0) {
          let assigned = 0;
          for (const cid of cardIds) {
            const r = cardRepo.assignCard(db, cid, orderId, now);
            if (r.changes === 1) {
              assigned++;
              const cardRow = cardRepo.getCardById(db, cid);
              if (cardRow && cardRow.is_loop === 1) {
                cardRepo.resetLoopCard(db, cid);
              }
            }
          }
          if (assigned < cardIds.length) {
            throw new AppError('卡密被并发占用，请重试', 409, 'CONCURRENT_CARD_CONFLICT');
          }
          productRepo.incrementSalesVolume(db, productId, numQty);
        }

        // 扣减优惠券使用次数（原子操作，防止并发超额使用）
        if (couponInfo) {
          const consumed = consumeCoupon(couponInfo.id, {
            orderId,
            contact: contactStr,
          });
          if (!consumed) {
            throw new AppError('优惠码已被其他订单抢用，请重试', 409, 'COUPON_RACE_CONFLICT');
          }
        }
      });

      createOrderTxn();
      orderCreated = true;
    } catch (err) {
      const isUniqueError = err.code === 'SQLITE_CONSTRAINT_UNIQUE'
        || /UNIQUE constraint failed: orders\.order_no/i.test(err.message);
      if (isUniqueError) {
        if (attempt === MAX_RETRY - 1) {
          throw new AppError('订单号生成失败，请重试', 500, 'ORDER_NO_GENERATION_FAILED');
        }
        continue;
      }
      throw err;
    }
  }

  // 9. 组装返回数据
  const order = orderRepo.getOrderById(db, orderId);
  const orderData = row(order);

  if (orderData.status === 'delivered') {
    const cardIds = orderData.cardIds || [];
    if (cardIds.length > 0) {
      orderData.codes = cardRepo.getCardsByIds(db, cardIds).map(c => c.content);
    }
  }

  // 10. 异步通知（失败不影响下单结果）
  if (emailStr && orderData.status === 'delivered') {
    sendOrderEmail(orderData, emailStr).catch((e) => {
      logger.error('邮件发送失败', { tag: 'orderService', error: e.message });
    });
  }
  if (productType === 'manual') {
    notifyAdminManualOrder(order).catch((e) => {
      logger.error('管理员通知失败', { tag: 'orderService', error: e.message });
    });
  }
  if (orderData.status === 'delivered') {
    triggerApiHook(order);
  }

  return orderData;
}

/**
 * 管理后台更新订单（状态变更 + 字段更新）
 * 修复点：卡密释放/优惠券回退/销量回退/订单字段更新全部合并到同一事务，
 *         避免原实现中 releaseTxn 与 UPDATE orders 分离导致的数据不一致。
 *
 * @param {object} params
 * @param {string} params.orderId
 * @param {object} params.patch - { status?, contact?, email? }
 * @param {object} [params.adminInfo] - { id, name, ip } 用于日志
 * @param {object} [params.dbInstance]
 * @returns {object} 更新后的订单（camelCase）
 */
function updateOrderStatus({ orderId, patch, adminInfo = {}, dbInstance }) {
  const db = dbInstance || getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new AppError('订单不存在', 404, 'ORDER_NOT_FOUND');

  const validStatuses = ['pending', 'paid', 'delivered', 'refunded', 'failed', 'expired'];
  if (patch.status !== undefined) {
    if (!validStatuses.includes(patch.status)) {
      throw new AppError('无效的订单状态', 400, 'INVALID_STATUS');
    }
    const allowed = ORDER_TRANSITIONS[order.status] || [];
    if (!allowed.includes(patch.status)) {
      throw new AppError(`不允许从 ${order.status} 转换到 ${patch.status}`, 409, 'INVALID_TRANSITION');
    }
  }

  const sets = [];
  const values = [];
  const cardIds = (() => { try { return JSON.parse(order.card_ids || '[]'); } catch { return []; } })();
  const now = nowISO();

  // 单一事务：状态副作用 + 字段更新原子化
  const updateTxn = db.transaction(() => {
    if (patch.status !== undefined) {
      sets.push('status = ?');
      values.push(patch.status);
      if (patch.status === 'paid' || patch.status === 'delivered') {
        sets.push('paid_at = COALESCE(paid_at, ?)');
        values.push(now);
      }
      if (patch.status === 'delivered' && order.status !== 'delivered') {
        sets.push('delivered_at = ?');
        values.push(now);
        // 人工处理订单完成时增加销量
        productRepo.incrementSalesVolume(db, order.product_id, order.qty);
      }
      // 退款/失败时释放已分配的卡密 + 回退优惠券 + 回退销量
      if ((patch.status === 'refunded' || patch.status === 'failed') && cardIds.length > 0) {
        const placeholders = cardIds.map(() => '?').join(',');
        db.prepare(
          `UPDATE cards SET status = 'available', order_id = NULL, assigned_at = NULL WHERE id IN (${placeholders})`
        ).run(...cardIds);
        sets.push("card_ids = '[]'");
        if (order.coupon_id) {
          rollbackCoupon(order.coupon_id);
        }
        // 仅从 delivered 退款时回退销量（销量之前已被计入）
        if (patch.status === 'refunded' && order.status === 'delivered') {
          db.prepare('UPDATE products SET sales_volume = MAX(sales_volume - ?, 0) WHERE id = ?')
            .run(order.qty, order.product_id);
        }
      }
    }
    if (patch.contact !== undefined) { sets.push('contact = ?'); values.push(String(patch.contact).trim()); }
    if (patch.email !== undefined) { sets.push('email = ?'); values.push(String(patch.email || '')); }
    if (!sets.length) throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS');
    sets.push('updated_at = ?');
    values.push(now, orderId);
    db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  });

  updateTxn();

  const updatedOrder = row(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));

  // 事务外：异步通知（失败不影响更新结果）
  if (patch.status !== undefined && order.type === 'manual') {
    notifyOrderStatusChange(updatedOrder, patch.status).catch((e) => {
      logger.error('状态变更邮件通知失败', { tag: 'orderService', orderNo: order.order_no, error: e.message });
    });
    // 标记为 delivered 时触发 API 回调（人工处理完成）
    if (patch.status === 'delivered') {
      triggerApiHook(updatedOrder);
    }
  }

  return { updatedOrder, originalStatus: order.status, orderNo: order.order_no };
}

module.exports = { cancelExpiredOrders, createOrder, updateOrderStatus };
