/**
 * 支付幂等键管理
 * 参考成熟支付系统：同一笔支付回调多次触发只处理一次
 *
 * 幂等键组成：channel（支付方式ID/适配器）+ trade_no（支付平台交易号）
 * 或：channel + orderNo（未拿到 trade_no 时用订单号兜底）
 *
 * 存储方式：payments 表的 status 字段 + 条件 UPDATE 实现幂等
 * （无需额外建表，利用数据库原子操作）
 */

const { getDb } = require('../db');
const { nowISO } = require('../utils/response');

/**
 * 生成幂等键
 * @param {string} channel - 支付方式ID或适配器名
 * @param {string} tradeNo - 支付平台交易号
 * @param {string} [orderNo] - 订单号（tradeNo 为空时兜底）
 * @returns {string}
 */
function buildIdempotentKey(channel, tradeNo, orderNo) {
  const id = tradeNo || orderNo || '';
  return `${channel}:${id}`;
}

/**
 * 原子更新支付记录状态（幂等核心）
 * 仅当 payment.status 仍为 fromStatus 时才更新为 toStatus
 * @param {object} db - 数据库实例
 * @param {string} paymentId - 支付记录ID
 * @param {string} fromStatus - 期望的当前状态
 * @param {string} toStatus - 目标状态
 * @param {object} extra - 附加更新字段 { tradeNo, callbackData }
 * @returns {number} changes - 更新行数（0 表示已被其他并发处理，幂等跳过）
 */
function atomicUpdateStatus(db, paymentId, fromStatus, toStatus, extra = {}) {
  const now = nowISO();
  const sets = [
    'status = ?',
    'updated_at = ?',
  ];
  const values = [toStatus, now];

  if (extra.tradeNo !== undefined) {
    sets.push('trade_no = ?');
    values.push(extra.tradeNo);
  }
  if (toStatus === 'paid') {
    sets.push('paid_at = ?');
    values.push(now);
  }
  if (extra.callbackData !== undefined) {
    sets.push('callback_data = ?');
    values.push(extra.callbackData);
  }

  values.push(paymentId, fromStatus);

  const result = db.prepare(
    `UPDATE payments SET ${sets.join(', ')} WHERE id = ? AND status = ?`
  ).run(...values);

  return result.changes;
}

/**
 * 尝试将支付记录从 pending 转为 paid（幂等）
 * 如果 payment 已不是 pending（已被其他回调处理），返回 0
 * @param {object} db
 * @param {string} paymentId
 * @param {object} extra - { tradeNo, callbackData }
 * @returns {number} changes
 */
function tryMarkPaid(db, paymentId, extra = {}) {
  return atomicUpdateStatus(db, paymentId, 'pending', 'paid', extra);
}

/**
 * 尝试将支付记录从 failed 恢复为 paid（过期/失败订单收到有效回调）
 * @param {object} db
 * @param {string} paymentId
 * @param {object} extra
 * @returns {number} changes
 */
function tryRecoverToPaid(db, paymentId, extra = {}) {
  return atomicUpdateStatus(db, paymentId, 'failed', 'paid', extra);
}

/**
 * 标记支付记录为 failed
 * @param {object} db
 * @param {string} paymentId
 * @param {object} extra
 * @returns {number} changes
 */
function tryMarkFailed(db, paymentId, extra = {}) {
  return atomicUpdateStatus(db, paymentId, 'pending', 'failed', extra);
}

module.exports = {
  tryMarkPaid,
  tryRecoverToPaid,
  tryMarkFailed,
};
