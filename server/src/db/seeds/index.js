/**
 * 种子数据：默认站点设置 + 默认管理员账号
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config/env');

/** 创建默认站点设置 */
function seedSettings(db) {
  const defaults = {
    'site.name': 'Asolica 货源商铺',
    'site.description': '数字商品 · 自动发卡',
    'site.announcement': '',
    'site.logo': '',
    'site.favicon': '',
    // 支付渠道已改为数据库驱动（payment_methods 表），此处不再写入旧 site_settings 键
    'mail.driver': 'smtp',
    'mail.smtp_host': '',
    'mail.smtp_port': '465',
    'mail.smtp_secure': 'ssl',
    'mail.from_addr': '',
    'mail.smtp_pass': '',
    'mail.from_name': 'Asolica',
    // 查询密码开关（参考独角数卡 is_open_search_pwd）
    'order.search_pwd_enabled': '0',
    // 管理员通知邮箱（人工处理订单时通知管理员）
    'order.manage_email': '',
  };
  const stmt = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  const runMany = db.transaction(() => {
    for (const [k, v] of Object.entries(defaults)) {
      stmt.run(k, v);
    }
  });
  runMany();
}

/** 创建默认管理员账号 */
function seedAdmin(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
  if (count === 0) {
    // 安全修复：不再硬编码 admin123，从环境变量读取，未设置则生成随机密码
    const defaultPwd = config.adminDefaultPassword;
    if (!defaultPwd) {
      // 生成随机密码并打印一次
      const randomPwd = crypto.randomBytes(12).toString('base64');
      const hash = bcrypt.hashSync(randomPwd, 12);
      db.prepare(
        'INSERT INTO admins (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), 'admin', hash, '超级管理员', 'super');
      process.stdout.write(`\n  [安全提示] 已创建默认管理员账号:\n  用户名: admin\n  密码: ${randomPwd}\n  请立即登录后修改密码！\n  （此密码仅显示一次）\n\n`);
      // 将密码写入独立文件，方便后续查看
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.dirname(config.dbPath);
      const pwdFilePath = path.join(dataDir, 'admin_password.txt');
      try {
        // 确保 data 目录存在
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(pwdFilePath, `管理员账号: admin\n密码: ${randomPwd}\n创建时间: ${new Date().toISOString()}\n\n请立即登录后修改密码！此文件仅供首次查看，查看后建议删除。\n`);
        process.stdout.write(`  [提示] 密码已保存到: ${pwdFilePath}\n\n`);
      } catch (e) {
        // 如果写入失败，忽略错误，密码已在 stdout 输出
      }
    } else {
      const hash = bcrypt.hashSync(defaultPwd, 12);
      db.prepare(
        'INSERT INTO admins (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), 'admin', hash, '超级管理员', 'super');
      process.stdout.write(`\n  [安全提示] 已通过 ADMIN_DEFAULT_PASSWORD 创建管理员 admin\n  请立即登录后修改密码！\n\n`);
    }
  }
}

module.exports = { seedSettings, seedAdmin };
