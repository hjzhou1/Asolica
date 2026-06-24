/**
 * 业务错误类
 * 统一携带 status 和 code，方便路由层返回对应 HTTP 状态码
 * （阶段三会进一步统一错误处理中间件）
 */

class AppError extends Error {
  constructor(message, status = 500, code = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { AppError };
