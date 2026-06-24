/**
 * 优惠码管理 API
 * /api/admin/coupons
 *
 * 参考独角数卡 CouponController
 * - GET    /           - 列表
 * - POST   /           - 创建
 * - GET    /:id        - 详情
 * - PUT    /:id        - 更新
 * - DELETE /:id        - 删除
 */

const express = require('express');
const { validate, schemas } = require('../../middleware/validate');
const { authMiddleware } = require('../../middleware/auth');
const { ok, fail } = require('../../utils');
const couponService = require('../../services/couponService');

const router = express.Router();

// 所有优惠码管理接口都需要管理员认证
router.use(authMiddleware);

/** GET /api/admin/coupons - 优惠码列表 */
router.get('/', (req, res) => {
  const list = couponService.listCoupons();
  ok(res, list);
});

/** POST /api/admin/coupons - 创建优惠码 */
router.post('/', validate(schemas.createCouponSchema), (req, res) => {
  try {
    const coupon = couponService.createCoupon(req.body);
    ok(res, coupon, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return fail(res, '优惠码已存在', 409);
    }
    return fail(res, e.message || '创建失败', 500);
  }
});

/** GET /api/admin/coupons/:id - 优惠码详情 */
router.get('/:id', (req, res) => {
  const coupon = couponService.getCoupon(req.params.id);
  if (!coupon) return fail(res, '优惠码不存在', 404);
  ok(res, coupon);
});

/** PUT /api/admin/coupons/:id - 更新优惠码 */
router.put('/:id', validate(schemas.updateCouponSchema), (req, res) => {
  try {
    const coupon = couponService.updateCoupon(req.params.id, req.body);
    if (!coupon) return fail(res, '优惠码不存在', 404);
    ok(res, coupon);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return fail(res, '优惠码已存在', 409);
    }
    return fail(res, e.message || '更新失败', 500);
  }
});

/** DELETE /api/admin/coupons/:id - 删除优惠码 */
router.delete('/:id', (req, res) => {
  try {
    couponService.deleteCoupon(req.params.id);
    ok(res, null);
  } catch (e) {
    fail(res, e.message || '删除失败', 500);
  }
});

module.exports = router;
