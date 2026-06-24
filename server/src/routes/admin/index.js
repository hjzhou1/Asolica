/**
 * 管理后台路由汇总
 * /api/admin/*
 *
 * 挂载顺序：登录/改密/退出 → 仪表盘 → 分类 → 商品 → 卡密 → 订单 → 日志
 */

const express = require('express');
const router = express.Router();

// 登录 / 改密 / 退出
router.use(require('./password'));
// 仪表盘统计
router.use(require('./dashboard'));
// 分类 CRUD
router.use(require('./categories'));
// 商品 CRUD
router.use(require('./products'));
// 卡密管理
router.use(require('./cards'));
// 订单管理 + 趋势 + 导出
router.use(require('./orders'));
// 优惠码管理
router.use('/coupons', require('./coupons'));
// 邮件模板管理
router.use(require('./emailTemplates'));
// 邮件队列管理（发送记录 + 手动补发）
router.use(require('./emailQueue'));
// 操作日志
router.use(require('./logs'));

module.exports = router;
