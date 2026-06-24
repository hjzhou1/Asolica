/**
 * 管理后台 - 登录 / 改密 / 退出
 * POST /api/admin/login
 * POST /api/admin/change-password
 * POST /api/admin/logout
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../../db');
const { signToken, authMiddleware } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { ok, fail, createLogger, nowISO, nowISOPlus } = require('../../utils');
const { ADMIN_LOCK_THRESHOLD, ADMIN_LOCK_MINUTES } = require('../../config/constants');

const router = express.Router();
const log = createLogger(getDb);

router.post('/login', validate(schemas.loginSchema), (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return fail(res, '请输入账号和密码');
  }
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

  // 账户锁定检查：即使账号不存在也先做存在性判断，避免泄露账号是否存在
  if (admin && admin.locked_until) {
    const lockedUntilMs = new Date(admin.locked_until).getTime();
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
      const remainMin = Math.ceil((lockedUntilMs - Date.now()) / 60000);
      return fail(res, `账户已锁定，请 ${remainMin} 分钟后再试`, 403);
    }
  }

  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    // 密码错误：仅当账号存在时才累计失败次数，避免对不存在的账号产生副作用
    if (admin) {
      const nextAttempts = (admin.failed_attempts || 0) + 1;
      if (nextAttempts >= ADMIN_LOCK_THRESHOLD) {
        // 达到阈值：锁定指定分钟并重置计数（使用上海时区 ISO 格式）
        const lockedUntil = nowISOPlus(ADMIN_LOCK_MINUTES * 60 * 1000);
        db.prepare('UPDATE admins SET failed_attempts = 0, locked_until = ? WHERE id = ?')
          .run(lockedUntil, admin.id);
        return fail(res, `密码错误次数过多，账户已锁定 ${ADMIN_LOCK_MINUTES} 分钟`, 403);
      }
      db.prepare('UPDATE admins SET failed_attempts = ? WHERE id = ?')
        .run(nextAttempts, admin.id);
    }
    return fail(res, '账号或密码错误', 400);
  }

  // 登录成功：重置失败次数与锁定状态
  db.prepare('UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = ?')
    .run(admin.id);

  const token = signToken({ id: admin.id });
  ok(res, {
    token,
    admin: { id: admin.id, username: admin.username, name: admin.name, role: admin.role },
  });
});

router.post('/change-password', authMiddleware, validate(schemas.changePasswordSchema), (req, res) => {
  const { oldPwd, newPwd } = req.body || {};
  if (!oldPwd || !newPwd) return fail(res, '请填写当前密码和新密码');
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.adminId);
  if (!admin || !bcrypt.compareSync(oldPwd, admin.password)) return fail(res, '当前密码不正确', 403);
  const hash = bcrypt.hashSync(newPwd, 12);
  // 改密成功后更新 token_invalidated_at，使此前签发的 JWT 全部失效
  db.prepare('UPDATE admins SET password = ?, token_invalidated_at = ? WHERE id = ?')
    .run(hash, nowISO(), req.adminId);
  log(req.adminId, req.adminName, 'change_password', 'admins', req.adminId, '修改管理员密码', req.ip);
  ok(res, null);
});

router.post('/logout', authMiddleware, (req, res) => {
  // 登出时更新 token_invalidated_at，使当前 token 在下次请求时被 authMiddleware 拒绝
  // 配合 authMiddleware 中的 iat < token_invalidated_at 校验实现 token 失效
  const db = getDb();
  db.prepare('UPDATE admins SET token_invalidated_at = ? WHERE id = ?')
    .run(nowISO(), req.adminId);
  log(req.adminId, req.adminName, 'logout', 'admins', req.adminId, '管理员登出', req.ip);
  ok(res, null);
});

module.exports = router;
