/**
 * 请求 ID 中间件
 * 为每个请求生成唯一 ID，用于日志链路追踪
 * 参考成熟项目：所有日志、错误报告可串联同一请求
 */

const crypto = require('crypto');

function requestId(req, res, next) {
  // 优先使用客户端传入的 X-Request-ID，否则生成
  const id = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = requestId;
