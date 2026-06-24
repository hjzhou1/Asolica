/**
 * 限流中间件配置
 *
 * 设计原则：
 * 1. 不按「全局 + skip」的方式写，而是按路由组单独挂载 limiter。
 * 2. 静态资源不经过任何限流。
 * 3. 写操作（下单、创建支付、登录）严格限流；读操作（商品列表、订单查询）宽松限流。
 * 4. 管理后台操作频繁，单独给高额度。
 * 5. 支付回调是支付平台服务端调用，不限流。
 */

const rateLimit = require('express-rate-limit');

// 公开读取接口（产品列表、分类等）
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: '访问过于频繁，请稍后再试' },
});

// 前台下单（20次/60秒/IP）
const orderCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: '下单过于频繁，请稍后再试' },
});

// 创建支付订单（20次/60秒/IP）
const paymentCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: '创建支付过于频繁，请稍后再试' },
});

// 支付状态轮询（60次/分钟/IP，对应前端 3-10 秒轮询间隔）
const paymentStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: '支付状态查询过于频繁，请稍后再试' },
});

// 订单查询（根据订单号/联系方式查询，30次/60秒/IP）
const orderQueryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: '订单查询过于频繁，请稍后再试' },
});

// 管理后台（1000次/15分钟/IP）
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: '管理后台操作过于频繁，请稍后再试' },
});

// 登录接口（5次/60秒/IP，成功不计入）
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: '登录尝试过于频繁，请 1 分钟后再试' },
});

module.exports = {
  publicReadLimiter,
  orderCreateLimiter,
  paymentCreateLimiter,
  paymentStatusLimiter,
  orderQueryLimiter,
  adminLimiter,
  loginLimiter,
};
