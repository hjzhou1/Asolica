/**
 * 支付记录数据访问层
 * 所有 payments 表查询集中到这里，消除散落在路由/服务层的直接 SQL
 */

/**
 * 查询单个订单的最新支付记录
 * @returns {object|null}
 */
function getPaymentByOrderId(db, orderId) {
  return db.prepare(
    'SELECT channel, trade_no, status, paid_at FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(orderId);
}

/**
 * 批量查询多个订单的支付记录（每个 order_id 取最新一条）
 * 消除 N+1：原实现每条订单单独查询 payments 表
 * @param {string[]} orderIds
 * @returns {Map<string, object>} orderId → payment
 */
function getPaymentsByOrderIds(db, orderIds) {
  if (!orderIds || orderIds.length === 0) return new Map();
  const placeholders = orderIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT order_id, channel, trade_no, status, paid_at FROM payments
     WHERE order_id IN (${placeholders}) ORDER BY created_at DESC`
  ).all(...orderIds);
  // 按 order_id 分组，取最新一条（已按 created_at DESC 排序）
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.order_id)) map.set(r.order_id, r);
  }
  return map;
}

/**
 * 将订单关联的 pending 支付记录标记为 failed（用于过期订单取消）
 */
function markPendingPaymentsFailed(db, orderId, now) {
  db.prepare("UPDATE payments SET status = 'failed', updated_at = ? WHERE order_id = ? AND status = 'pending'")
    .run(now, orderId);
}

module.exports = {
  getPaymentByOrderId,
  getPaymentsByOrderIds,
  markPendingPaymentsFailed,
};
