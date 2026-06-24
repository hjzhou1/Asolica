/**
 * 订单/支付相关工具函数（消除 routes/admin/orders.js 与 routes/shop/order.js 的重复）
 */

const { getDb } = require('../db');

/**
 * 查询支付方式的友好名称（从 payment_methods 表读取）
 * 兼容旧数据：channel 可能是 payment_methods.id 或 adapter 名称
 * @param {string} channel - 支付方式ID或适配器名
 * @param {object} [db] - 数据库实例（不传则内部获取）
 * @returns {string}
 */
function getPaymentMethodName(channel, db) {
  if (!channel) return '';
  const conn = db || getDb();
  let pm = conn.prepare('SELECT name FROM payment_methods WHERE id = ?').get(channel);
  if (!pm) {
    pm = conn.prepare('SELECT name FROM payment_methods WHERE adapter = ? AND enabled = 1 LIMIT 1').get(channel);
  }
  return pm ? pm.name : channel;
}

/**
 * 批量查询支付方式名称（消除 N+1）
 * @param {string[]} channels - 支付方式ID/适配器名数组
 * @param {object} [db]
 * @returns {Map<string, string>} channel → name
 */
function batchGetPaymentNames(channels, db) {
  const conn = db || getDb();
  const map = new Map();
  const unique = [...new Set(channels.filter(Boolean))];
  for (const ch of unique) {
    map.set(ch, getPaymentMethodName(ch, conn));
  }
  return map;
}

module.exports = {
  getPaymentMethodName,
  batchGetPaymentNames,
};
