/**
 * @swagger
 * tags:
 *   - name: Store
 *     description: 前台下单接口
 */

/**
 * 前台用户下单 API
 * POST /api/store/order - 创建订单并自动发卡（事务安全）
 *
 * 阶段三完善：
 * - 路由层使用 next(err) 代替 try/catch，由统一错误中间件处理
 * - AppError 自动携带 code 和 status，前端可据此展示
 */

const express = require('express');
const { validate, schemas } = require('../../middleware/validate');
const { validateCoupon } = require('../../services/couponService');
const { createOrder } = require('../../services/orderService');
const { AppError } = require('../../utils/errors');
const { ok, fail } = require('../../utils/response');
const { MAX_QTY } = require('../../config/constants');

const router = express.Router();

/** POST /api/store/validate-coupon - 验证优惠码并返回优惠金额 */
router.post('/validate-coupon', validate(schemas.validateCouponSchema), (req, res, next) => {
  try {
    const { code, productId } = req.body;
    const result = validateCoupon(code, productId);
    if (!result.valid) {
      throw new AppError(result.message, 400, 'COUPON_INVALID');
    }
    ok(res, {
      couponId: result.coupon.id,
      code: result.coupon.code,
      discount: result.coupon.discount,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/store/order */
router.post('/order', validate(schemas.storeOrderSchema), (req, res, next) => {
  try {
    const { productId, specId, contact, email, qty = 1, couponCode, searchPwd, otherIpu } = req.body;
    const orderData = createOrder({
      productId,
      specId,
      contact,
      email,
      qty: Math.max(1, Math.min(Number(qty) || 1, MAX_QTY)),
      couponCode,
      searchPwd,
      otherIpu,
      buyIp: req.ip || '',
    });
    ok(res, orderData, 201);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
