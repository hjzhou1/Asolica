#!/usr/bin/env node
/**
 * 管理员密码重置工具
 *
 * 用法：
 *   node scripts/reset-password.js          # 生成随机密码
 *   node scripts/reset-password.js mypass   # 使用指定密码
 *
 * 适用场景：
 *   - 忘记管理员密码
 *   - 密码文件丢失
 *   - 日志中找不到密码
 */

const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// 确保能加载到 db 模块
const dbPath = path.join(__dirname, '../src/db');
const { getDb } = require(dbPath);

function main() {
  const newPwd = process.argv[2] || crypto.randomBytes(12).toString('base64');
  const hash = bcrypt.hashSync(newPwd, 12);

  const db = getDb();

  // 检查管理员是否存在
  const admin = db.prepare('SELECT id, username FROM admins LIMIT 1').get();
  if (!admin) {
    console.error('错误：数据库中没有管理员账号。请先启动服务创建管理员。');
    process.exit(1);
  }

  // 更新密码
  db.prepare('UPDATE admins SET password = ?, token_invalidated_at = ? WHERE id = ?')
    .run(hash, new Date().toISOString(), admin.id);

  // 同时更新密码文件
  const fs = require('fs');
  const dataDir = path.join(__dirname, '../data');
  const pwdFilePath = path.join(dataDir, 'admin_password.txt');
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(pwdFilePath,
      `管理员账号: ${admin.username}\n密码: ${newPwd}\n重置时间: ${new Date().toISOString()}\n\n请立即登录后修改密码！\n`);
  } catch (e) {
    // 写入失败不影响密码重置
  }

  console.log(`
  ========================================
  管理员密码已重置！

  用户名: ${admin.username}
  新密码: ${newPwd}

  请立即登录后在后台修改密码。
  ========================================
  `);

  process.exit(0);
}

main();
