/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: 管理后台接口（需 JWT Bearer Token）
 */

/**
 * 管理后台 - 仪表盘统计
 * GET /api/admin/dashboard
 */

const express = require('express');
const { getDb } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { ok, nowISO } = require('../../utils');

const router = express.Router();

/** 获取上海时区当日日期 YYYY-MM-DD（复用 nowISO 切片，避免重复实现时区格式化） */
function getShanghaiToday() {
  return nowISO().slice(0, 10);
}

/** GET /api/admin/dashboard */
router.get('/dashboard', authMiddleware, (req, res) => {
  const db = getDb();
  const today = getShanghaiToday();
  const data = {
    orderCount: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
    // 按上海时区日期过滤，避免凌晨订单统计错位
    todayOrders: db.prepare(
      "SELECT COUNT(*) as c FROM orders WHERE substr(created_at, 1, 10) = ?"
    ).get(today).c,
    totalAmount: Number(db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as s FROM orders WHERE status IN ('paid','delivered')"
    ).get().s).toFixed(2),
    productCount: db.prepare('SELECT COUNT(*) as c FROM products').get().c,
    cardRemain: db.prepare("SELECT COUNT(*) as c FROM cards WHERE status = 'available'").get().c,
    lowStockCount: db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT COUNT(*) as stock FROM cards WHERE status = 'available'
        GROUP BY product_id
        HAVING stock < 5
      )
    `).get().c,
    pendingOrders: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c,
  };
  ok(res, data);
});

module.exports = router;
