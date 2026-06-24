/**
 * 支付业务服务
 * 创建支付、处理回调、查询支付状态
 *
 * 阶段二完善：
 * - 集成订单状态机，所有状态变更走 canTransition 校验
 * - 集成支付幂等工具，回调处理使用原子条件 UPDATE
 * - 回调和主动查询复用统一的状态转换逻辑
 */

const { getDb } = require('../db');
const { genId, row, nowISO } = require('../utils');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { PaymentGatewayFactory } = require('./paymentGateway');
const { allocateCards } = require('./cardService');
const { canTransition } = require('./orderStateMachine');
const { tryMarkPaid, tryRecoverToPaid, tryMarkFailed } = require('./paymentIdempotent');
const config = require('../config/env');

/**
 * 创建支付订单
 * @param {object} params - { orderId, payCheck, protocol, host }
 *   payCheck: 支付方式记录 ID（payment_methods.id，如 pm_xxx）
 *   后端根据 payCheck 从数据库加载对应适配器与配置
 * @returns {Promise<{ payId, pay_url, qr_code, trade_no, channel }>}
 */
async function createPayment({ orderId, payCheck, protocol, host, contact }) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new AppError('订单不存在', 404, 'ORDER_NOT_FOUND');
  // 订单归属校验：contact 必须与下单时一致，防止他人凭 orderId 为订单创建支付
  if (contact && String(contact).trim() !== String(order.contact).trim()) {
    throw new AppError('联系方式与订单不匹配', 403, 'ORDER_CONTACT_MISMATCH');
  }
  // 状态机校验：只有 pending 订单才能创建支付
  if (!canTransition(order.status, 'paid')) {
    throw new AppError(`订单状态为 ${order.status}，不允许支付`, 400, 'ORDER_STATUS_NOT_PAYABLE');
  }
  const orderAmount = Number(order.amount);
  if (!Number.isFinite(orderAmount) || orderAmount < 0) {
    throw new AppError('订单金额无效', 400, 'INVALID_AMOUNT');
  }

  const factory = new PaymentGatewayFactory(db);
  // 数据库驱动：根据支付方式 ID 路由到对应 adapter
  const { id: pmId, adapter, method, gateway } = factory.getGatewayForPayCheck(payCheck);
  // 修复：baseUrl 从环境变量读取，避免被 Host 头欺骗
  const baseUrl = config.baseUrl || `${protocol}://${host}`;

  const result = await gateway.createPayment(row(order), baseUrl, method);

  // 创建支付记录（trade_no 为空时存 NULL，避免 UNIQUE 约束冲突）
  const payId = genId('pay');
  const now = nowISO();
  db.prepare(`
    INSERT INTO payments (id, order_id, order_no, channel, trade_no, amount, status, pay_url, qr_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
  `).run(payId, order.id, order.order_no, pmId, result.trade_no || null, order.amount, result.pay_url, result.qr_code, now, now);

  return {
    payId,
    channel: pmId,
    adapter,
    method,
    pay_url: result.pay_url,
    qr_code: result.qr_code,
    trade_no: result.trade_no,
  };
}

/**
 * 处理支付回调
 * @param {object} params - { channel, body }
 * @returns {Promise<'success'|'fail'>}
 */
function processCallback({ channel, body }) {
  const db = getDb();
  const factory = new PaymentGatewayFactory(db);

  try {
    // channel 参数现在可能是支付方式 ID（pm_xxx）或 adapter 名称（hupi/yi）
    let gateway, pm;
    const pmById = factory.getPaymentMethod(channel);
    if (pmById) {
      const r = factory.getGatewayForPayCheck(channel);
      gateway = r.gateway;
      pm = r;
    } else {
      const r = factory.getGatewayByAdapter(channel);
      gateway = r.gateway;
      pm = r.pm;
    }
    const result = gateway.verifyCallback(body);

    if (!result.valid) {
      logger.error('支付回调验签失败', { tag: '支付回调', channel, body });
      return 'fail';
    }

    // 按 adapter 取订单号字段，避免 || 兜底逻辑脆弱
    const orderNoFields = { hupi: 'out_trade_no', yi: 'out_trade_no' };
    const orderNo = body[orderNoFields[pm.adapter] || 'out_trade_no'] || body.pay_id;
    if (!orderNo) {
      logger.error('支付回调缺少订单号字段', { tag: '支付回调', channel, body });
      return 'fail';
    }

    let payment = db.prepare(
      'SELECT * FROM payments WHERE order_no = ? AND channel = ? ORDER BY created_at DESC LIMIT 1'
    ).get(orderNo, pm.id);
    if (!payment) {
      // 兼容旧回调：可能用 adapter 名称作为 channel
      payment = db.prepare(
        'SELECT * FROM payments WHERE order_no = ? AND channel LIKE ? ORDER BY created_at DESC LIMIT 1'
      ).get(orderNo, `${pm.adapter}%`);
      if (!payment) {
        logger.error('支付回调找不到对应支付记录', { tag: '支付回调', channel, orderNo });
        return 'fail';
      }
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id);
    if (!order) {
      logger.error('支付回调找不到订单', { tag: '支付回调', orderId: payment.order_id });
      return 'fail';
    }

    // 金额一致性校验：防止低额支付绕过
    const expectedAmount = Number(order.amount);
    const actualAmount = Number(result.amount);
    if (!Number.isFinite(expectedAmount) || !Number.isFinite(actualAmount) || Math.abs(expectedAmount - actualAmount) > 0.01) {
      logger.error('支付回调金额不匹配', { tag: '支付回调', orderNo: order.order_no, expectedAmount, actualAmount });
      // 使用幂等工具标记失败
      tryMarkFailed(db, payment.id, { callbackData: JSON.stringify(body) });
      // 返回 success 阻止通道重试，需人工介入
      return 'success';
    }

    // 状态机校验：检查订单是否允许转换到 paid
    if (!canTransition(order.status, 'paid')) {
      logger.info('支付回调：订单状态不允许转换到 paid，幂等跳过', { tag: '支付回调', orderNo: order.order_no, status: order.status });
      return 'success';
    }

    // 事务原子性：payment 更新 + order 状态更新在同一事务内
    // 使用幂等工具的条件 UPDATE，避免 TOCTOU 竞态
    const processTxn = db.transaction(() => {
      // 幂等核心：仅当 payment.status 仍为 pending 时才更新为 paid
      let changes = tryMarkPaid(db, payment.id, {
        tradeNo: result.trade_no || payment.trade_no,
        callbackData: JSON.stringify(body),
      });

      // 过期/失败订单的 payment 可能已被取消任务标记为 failed，允许恢复为 paid
      if (changes === 0 && (order.status === 'failed' || order.status === 'expired')) {
        changes = tryRecoverToPaid(db, payment.id, {
          tradeNo: result.trade_no || payment.trade_no,
          callbackData: JSON.stringify(body),
        });
      }

      // 如果没有更新到行（changes=0），说明已被其他回调处理，幂等跳过
      if (changes === 0) {
        return { skipped: true };
      }

      // 更新订单状态（状态机校验通过后执行）
      const now = nowISO();
      if (order.status === 'pending') {
        db.prepare(`
          UPDATE orders SET status = 'paid', paid_at = ?, payment_method = ?, payment_trade_no = ?,
          updated_at = ?
          WHERE id = ? AND status = 'pending'
        `).run(now, pm.id, result.trade_no || '', now, payment.order_id);
      } else if (order.status === 'failed' || order.status === 'expired') {
        // 过期（expired）或失败（failed）但回调延迟到达且金额正确：恢复订单并补发
        logger.info('支付回调：订单已过期/失败但收到有效回调，恢复并补发', { tag: '支付回调', orderNo: order.order_no, prevStatus: order.status });
        db.prepare(`
          UPDATE orders SET status = 'paid', paid_at = ?, payment_method = ?, payment_trade_no = ?,
          expires_at = NULL, updated_at = ?
          WHERE id = ? AND status IN ('failed','expired')
        `).run(now, pm.id, result.trade_no || '', now, payment.order_id);
      }
      return { skipped: false };
    });
    const result_txn = processTxn();

    // 幂等跳过：payment 已被其他并发回调处理
    if (result_txn.skipped) {
      logger.info('支付回调幂等跳过（事务内）', { tag: '支付回调', paymentId: payment.id });
      return 'success';
    }

    // 发卡（事务外执行，内部自带事务）
    // 失败时标记订单为 failed 待人工处理，避免卡在 paid 未 delivered
    // 注意：仍返回 'success' 给支付网关，因为支付已成功，不能让网关重复回调
    try {
      allocateCards(payment.order_id, db);
    } catch (allocErr) {
      logger.error('支付回调发卡失败，标记订单为异常状态', {
        tag: '支付回调', paymentId: payment.id, error: allocErr.message, stack: allocErr.stack,
      });
      try {
        db.prepare("UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'paid'")
          .run(nowISO(), payment.order_id);
      } catch (updateErr) {
        logger.error('标记订单失败状态时出错', { tag: '支付回调', error: updateErr.message });
      }
    }

    return 'success';
  } catch (err) {
    logger.error('支付回调处理失败', { tag: '支付回调', channel, error: err.message });
    return 'fail';
  }
}

/**
 * 查询支付状态
 * @param {string} orderId
 * @returns {{ status, payment }}
 */
function getPaymentStatus(orderId) {
  const db = getDb();
  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new AppError('订单不存在', 404, 'ORDER_NOT_FOUND');
  const payment = db.prepare('SELECT id, channel, trade_no, status, qr_code FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1').get(orderId);
  return { status: order.status, payment: payment ? row(payment) : null };
}

/**
 * 主动查询支付平台并同步状态（回调丢失时的兜底机制）
 * 前端轮询触发：当订单仍为 pending 但支付平台已显示已支付时，主动补单
 * @param {string} orderId
 * @returns {{ status, payment, synced?: boolean }}
 */
async function syncPaymentStatus(orderId) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new AppError('订单不存在', 404, 'ORDER_NOT_FOUND');

  // 状态机校验：只有 pending 订单才需要主动查询
  if (order.status !== 'pending') {
    return getPaymentStatus(orderId);
  }

  // 查找该订单的支付记录
  const payment = db.prepare(
    'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(orderId);
  if (!payment) {
    return getPaymentStatus(orderId);
  }

  // 已支付/已失败的支付记录不再查询
  if (payment.status !== 'pending') {
    return getPaymentStatus(orderId);
  }

  // 通过支付方式 ID 获取适配器，主动查询支付平台
  try {
    const factory = new PaymentGatewayFactory(db);
    const { gateway, id: pmId } = factory.getGatewayForPayCheck(payment.channel);
    if (!gateway.queryOrderStatus) {
      // 适配器不支持主动查询，返回当前状态
      return getPaymentStatus(orderId);
    }

    const result = await gateway.queryOrderStatus(order.order_no);
    if (!result || !result.paid) {
      // 支付平台确认未支付，返回当前状态
      return getPaymentStatus(orderId);
    }

    // 金额校验
    const expectedAmount = Number(order.amount);
    const actualAmount = Number(result.amount);
    if (!Number.isFinite(expectedAmount) || !Number.isFinite(actualAmount) || Math.abs(expectedAmount - actualAmount) > 0.01) {
      logger.error('主动查询金额不匹配', { tag: '支付同步', orderNo: order.order_no, expectedAmount, actualAmount });
      return getPaymentStatus(orderId);
    }

    // 状态机校验：再次确认订单仍可转换到 paid
    if (!canTransition(order.status, 'paid')) {
      logger.info('主动查询：订单状态不允许转换到 paid，跳过', { tag: '支付同步', orderNo: order.order_no, status: order.status });
      return getPaymentStatus(orderId);
    }

    // 支付平台确认已支付，执行补单（使用幂等工具）
    logger.info('主动查询发现已支付，执行补单', { tag: '支付同步', orderNo: order.order_no });

    const processTxn = db.transaction(() => {
      // 幂等核心：仅当 payment.status 仍为 pending 时才更新
      const changes = tryMarkPaid(db, payment.id, {
        tradeNo: result.trade_no || payment.trade_no,
        callbackData: JSON.stringify({ source: 'sync_query', trade_no: result.trade_no }),
      });

      if (changes === 0) return { skipped: true };

      const now = nowISO();
      db.prepare(`
        UPDATE orders SET status = 'paid', paid_at = ?, payment_method = ?, payment_trade_no = ?,
        updated_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(now, pmId, result.trade_no || '', now, payment.order_id);
      return { skipped: false };
    });
    const txnResult = processTxn();
    if (!txnResult.skipped) {
      try {
        allocateCards(payment.order_id, db);
      } catch (allocErr) {
        // 发卡失败（如库存已被占用）：标记订单为 failed 状态待人工处理
        // 避免订单卡在 paid 但未 delivered 的中间状态
        logger.error('补单发卡失败，标记订单为异常状态', {
          tag: '支付同步', orderNo: order.order_no, error: allocErr.message, stack: allocErr.stack,
        });
        try {
          db.prepare("UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'paid'")
            .run(nowISO(), payment.order_id);
        } catch (updateErr) {
          logger.error('标记订单失败状态时出错', { tag: '支付同步', error: updateErr.message });
        }
      }
    }
  } catch (err) {
    logger.error('主动查询支付状态失败', { tag: '支付同步', error: err.message, stack: err.stack });
  }

  return getPaymentStatus(orderId);
}

module.exports = { createPayment, processCallback, getPaymentStatus, syncPaymentStatus };
