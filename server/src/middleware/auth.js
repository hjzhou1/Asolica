/**
 * JWT 认证中间件
 * 环境变量 JWT_SECRET 必须设置（至少 32 字符）
 * 校验逻辑已集中到 config/env.js，本文件仅负责签发与验证
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { JWT_EXPIRES, JWT_ALGORITHMS } = require('../config/constants');

const SECRET = config.jwtSecret;

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES, algorithm: 'HS256' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return res.status(401).json({ ok: false, code: 'TOKEN_MISSING', message: '未提供认证令牌' });
  }
  try {
    const payload = jwt.verify(match[1], SECRET, { algorithms: JWT_ALGORITHMS });
    req.adminId = payload.id;
    // 查一下管理员名字，方便日志记录；同时检查 token 是否在改密后签发
    try {
      const { getDb } = require('../db');
      const admin = getDb().prepare('SELECT name, token_invalidated_at FROM admins WHERE id = ?').get(payload.id);
      req.adminName = admin?.name || '';
      // JWT 撤销：若改密时间存在，且 token 签发时间早于改密时间，则拒绝
      if (admin && admin.token_invalidated_at) {
        const invalidatedAtMs = new Date(admin.token_invalidated_at).getTime();
        const iatMs = (payload.iat || 0) * 1000;
        if (Number.isFinite(invalidatedAtMs) && iatMs < invalidatedAtMs) {
          return res.status(401).json({ ok: false, code: 'TOKEN_REVOKED', message: '令牌已失效，请重新登录' });
        }
      }
    } catch { req.adminName = ''; }
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, code: 'TOKEN_EXPIRED', message: '令牌无效或已过期' });
  }
}

module.exports = { signToken, authMiddleware };
