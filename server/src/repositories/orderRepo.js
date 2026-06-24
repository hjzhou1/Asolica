/**
 * 订单数据访问层
 * 所有 orders 表查询集中到这里
 */

const { nowISO } = require('../utils/response');

function getOrderById(db, id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

function getOrderByOrderNo(db, orderNo) {
  return db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
}

function sumPaidDeliveredQty(db, productId, contact, since) {
  // 限购校验：计入 pending + paid + delivered
  // 原实现仅计入 paid/delivered，导致用户可无限开 pending 订单绕过限购
  // pending 订单过期后由 cancelExpiredOrders 自动释放，不会导致用户无法下单
  return db.prepare(`
    SELECT COALESCE(SUM(qty), 0) as total FROM orders
    WHERE product_id = ? AND contact = ? AND status IN ('pending','paid','delivered')
      AND created_at >= ?
  `).get(productId, contact, since).total;
}

function insertOrder(db, order) {
  const now = nowISO();
  db.prepare(`
    INSERT INTO orders (
      id, order_no, product_id, product_name, spec_id, spec_name,
      unit_price, contact, email, qty, amount, status, card_ids, paid_at, delivered_at, expires_at,
      coupon_id, coupon_code, coupon_discount, original_amount, buy_ip, type,
      search_pwd, info, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.orderNo,
    order.productId,
    order.productName,
    order.specId,
    order.specName,
    order.unitPrice,
    order.contact,
    order.email,
    order.qty,
    order.amount,
    order.status,
    order.cardIds,
    order.paidAt,
    order.deliveredAt,
    order.expiresAt,
    order.couponId,
    order.couponCode,
    order.couponDiscount,
    order.originalAmount,
    order.buyIp,
    order.type,
    order.searchPwd,
    order.info,
    now,
    now
  );
}

module.exports = {
  getOrderById,
  getOrderByOrderNo,
  sumPaidDeliveredQty,
  insertOrder,
};
