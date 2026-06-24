/**
 * 统一错误处理中间件
 * 捕获所有未处理的错误，返回统一格式
 *
 * 阶段三完善：
 * - 区分 AppError（业务错误）和未知错误
 * - 业务错误返回具体 code 和 message
 * - 未知错误返回 500，生产环境隐藏详情
 * - 所有错误携带 requestId，便于链路追踪
 * - 404 错误统一处理
 */

const logger = require('../utils/logger');
const config = require('../config/env');
const { AppError } = require('../utils/errors');

/**
 * 404 处理中间件（放在所有路由之后）
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    ok: false,
    code: 'NOT_FOUND',
    message: `路径 ${req.method} ${req.path} 不存在`,
    requestId: req.requestId || null,
  });
}

/**
 * 统一错误处理中间件（放在最后）
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const requestId = req.requestId || null;

  // AppError：业务错误，返回具体 code 和 message
  if (err instanceof AppError) {
    // 4xx 级别错误记录 warn，5xx 记录 error
    if (err.status >= 500) {
      logger.error('业务错误', {
        requestId,
        method: req.method,
        path: req.path,
        code: err.code,
        error: err.message,
        stack: config.isDev ? err.stack : undefined,
      });
    } else {
      logger.warn('业务异常', {
        requestId,
        method: req.method,
        path: req.path,
        code: err.code,
        error: err.message,
      });
    }

    return res.status(err.status).json({
      ok: false,
      code: err.code || 'BUSINESS_ERROR',
      message: err.message,
      requestId,
    });
  }

  // 未知错误：返回 500，生产环境隐藏详情
  logger.error('未捕获错误', {
    requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: config.isDev ? err.stack : undefined,
  });

  res.status(err.status || 500).json({
    ok: false,
    code: 'INTERNAL_ERROR',
    message: config.isProd ? '服务器内部错误' : (err.message || '服务器内部错误'),
    requestId,
    ...(config.isDev && err.stack ? { stack: err.stack } : {}),
  });
}

module.exports = { errorHandler, notFoundHandler };
