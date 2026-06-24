/**
 * 邮件发送服务
 * 支持多种驱动：SMTP / Resend / 阿里云邮件推送 / 腾讯云 SES
 * 通过 mail.driver 配置切换，参考独角数卡 MailDriver 抽象
 */
const { getDb } = require('../db');
const logger = require('../utils/logger');
const { genId } = require('../utils/id');
const { nowISO, nowISOFromDate } = require('../utils/response');
const { escapeHtml } = require('../utils/html');
const { EMAIL_MAX_ATTEMPTS } = require('../config/constants');
const { getDriver } = require('./mailDriver');
const { getSetting } = require('./settingsService');

function getMailConfig() {
  const db = getDb();
  const get = (k, d = '') => {
    const r = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(k);
    return r ? r.value : d;
  };

  const driver = get('mail.driver', 'smtp');
  return {
    driver,
    // SMTP 配置
    host: get('mail.smtp_host'),
    port: parseInt(get('mail.smtp_port', '465'), 10),
    secure: get('mail.smtp_secure', 'ssl') === 'ssl',
    auth: {
      user: get('mail.from_addr'),
      pass: get('mail.smtp_pass'),
    },
    // 通用配置
    fromName: get('mail.from_name', 'Asolica'),
    fromAddr: get('mail.from_addr'),
    // Resend 配置
    apiKey: get('mail.resend_api_key'),
    // 阿里云邮件推送配置
    accessKeyId: get('mail.aliyun_access_key_id'),
    accessKeySecret: get('mail.aliyun_access_key_secret'),
    region: get('mail.aliyun_region', 'cn-hangzhou'),
    // 腾讯云 SES 配置
    secretId: get('mail.tencent_secret_id'),
    secretKey: get('mail.tencent_secret_key'),
    tencentRegion: get('mail.tencent_region', 'ap-guangzhou'),
  };
}

/**
 * 发送邮件（先入队 status=pending，发送成功更新 sent，失败更新 failed 并记录错误）
 * 定时任务会重试 failed 且 attempts < EMAIL_MAX_ATTEMPTS 的邮件
 */
async function sendMail({ to, subject, html, orderId }) {
  const db = getDb();

  // 1. 先入队（status=pending），保证邮件不丢失
  const emailId = genId('email');
  const now = nowISO();
  db.prepare(`
    INSERT INTO email_queue (id, to_addr, subject, body, status, order_id, attempts, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, 0, ?, ?)
  `).run(emailId, to, subject, html, orderId || null, now, now);

  // 2. 立即尝试发送
  try {
    await _sendViaDriver(to, subject, html);
    // 发送成功：更新状态（try-catch 保护，防止数据库锁导致 UPDATE 失败）
    try {
      const sentNow = nowISO();
      db.prepare(`
        UPDATE email_queue SET status = 'sent', sent_at = ?, updated_at = ?
        WHERE id = ?
      `).run(sentNow, sentNow, emailId);
    } catch (updateErr) {
      // UPDATE 失败不影响返回，定时任务会兜底处理 pending 超时邮件
      logger.error('邮件已发送但状态更新失败', { tag: 'email', emailId, error: updateErr.message });
    }
    return { messageId: emailId };
  } catch (err) {
    // 发送失败：记录错误，等待重试
    try {
      db.prepare(`
        UPDATE email_queue
        SET status = 'failed', last_error = ?, attempts = attempts + 1, updated_at = ?
        WHERE id = ?
      `).run(err.message.slice(0, 500), nowISO(), emailId);
    } catch (updateErr) {
      logger.error('邮件发送失败且状态更新也失败', { tag: 'email', emailId, sendError: err.message, updateError: updateErr.message });
    }
    logger.error('邮件发送失败', { tag: 'email', emailId, error: err.message });
    // 不抛错，因为已入队，定时任务会重试
    return { messageId: emailId, error: err.message };
  }
}

/** 实际通过驱动发送（内部函数，统一入口） */
async function _sendViaDriver(to, subject, html) {
  const config = getMailConfig();
  // 根据驱动类型校验必要配置
  if (config.driver === 'smtp') {
    if (!config.host || !config.auth.user) {
      throw new Error('SMTP 邮件服务未配置：请填写 SMTP 服务器和发信地址');
    }
  } else if (config.driver === 'resend') {
    if (!config.apiKey || !config.fromAddr) {
      throw new Error('Resend 邮件服务未配置：请填写 API Key 和发信地址');
    }
  } else if (config.driver === 'aliyun') {
    if (!config.accessKeyId || !config.accessKeySecret || !config.fromAddr) {
      throw new Error('阿里云邮件推送未配置：请填写 AccessKey 和发信地址');
    }
  } else if (config.driver === 'tencent') {
    if (!config.secretId || !config.secretKey || !config.fromAddr) {
      throw new Error('腾讯云 SES 未配置：请填写 SecretId/SecretKey 和发信地址');
    }
  } else {
    throw new Error(`不支持的邮件驱动: ${config.driver}`);
  }

  const driver = getDriver(config);
  return driver.send({
    to, subject, html,
    fromName: config.fromName,
    fromAddr: config.fromAddr,
  });
}

/** 重试失败邮件（由定时任务调用） */
async function retryFailedEmails() {
  const db = getDb();
  // 查询需要重试的邮件：
  // 1. failed 状态且尝试次数未达上限
  // 2. pending 状态超过 5 分钟（兜底：sendMail 中 UPDATE 未执行的情况，如进程重启/SMTP Promise 挂起）
  // 注意：created_at 用 nowISO() 写入（上海时区 ISO 格式），不能用 datetime('now')（UTC 格式）比较
  const cutoff = nowISOFromDate(new Date(Date.now() - 5 * 60 * 1000));
  const pending = db.prepare(`
    SELECT * FROM email_queue
    WHERE (status = 'failed' AND attempts < ?)
       OR (status = 'pending' AND created_at < ?)
    ORDER BY created_at ASC LIMIT 20
  `).all(EMAIL_MAX_ATTEMPTS, cutoff);

  let retried = 0;
  let succeeded = 0;

  for (const email of pending) {
    retried++;
    try {
      await _sendViaDriver(email.to_addr, email.subject, email.body);
      const sentNow = nowISO();
      db.prepare(`
        UPDATE email_queue SET status = 'sent', sent_at = ?, updated_at = ?
        WHERE id = ?
      `).run(sentNow, sentNow, email.id);
      succeeded++;
    } catch (err) {
      const newAttempts = (email.attempts || 0) + 1;
      db.prepare(`
        UPDATE email_queue
        SET last_error = ?, attempts = ?, updated_at = ?
        WHERE id = ?
      `).run(err.message.slice(0, 500), newAttempts, nowISO(), email.id);

      // 死信告警：重试次数耗尽，记录 error 级别日志便于运维介入
      if (newAttempts >= EMAIL_MAX_ATTEMPTS) {
        logger.error('邮件重试耗尽，进入死信状态', {
          tag: 'email-dead-letter',
          emailId: email.id,
          to: email.to_addr,
          subject: email.subject,
          orderId: email.order_id,
          attempts: newAttempts,
          lastError: err.message,
        });
      }
    }
  }

  if (retried > 0) {
    logger.info('邮件重试完成', { tag: 'email', retried, succeeded });
  }
  return { retried, succeeded };
}

/** 发送测试邮件 */
async function sendTestMail(to) {
  const config = getMailConfig();
  // 复用驱动校验逻辑
  if (config.driver === 'smtp' && (!config.host || !config.auth.user)) {
    throw new Error('请先配置 SMTP 服务器信息');
  }
  if (config.driver === 'resend' && !config.apiKey) {
    throw new Error('请先配置 Resend API Key');
  }
  if (config.driver === 'aliyun' && !config.accessKeyId) {
    throw new Error('请先配置阿里云邮件推送 AccessKey');
  }
  if (config.driver === 'tencent' && !config.secretId) {
    throw new Error('请先配置腾讯云 SES SecretId');
  }

  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
    <h2 style="color:#6366f1;">✅ 邮件配置成功</h2>
    <p>如果您收到此邮件，说明 ${config.driver.toUpperCase()} 邮件配置正确。</p>
    <p style="color:#9ca3af;font-size:12px;">发送时间: ${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())}</p>
  </div>`;

  await _sendViaDriver(to, 'Asolica - 邮件配置测试', html);
  return true;
}

/** 发送订单通知邮件（卡密发放时） */
async function sendOrderEmail(order, contactEmail) {
  if (!contactEmail) return;

  const siteName = getSetting('site.name', 'Asolica');

  // 查询卡密内容
  const cardIds = Array.isArray(order.cardIds) ? order.cardIds : [];
  let codesHtml = '';
  if (cardIds.length > 0) {
    const db = getDb();
    const cardRows = db.prepare(
      `SELECT content FROM cards WHERE id IN (${cardIds.map(() => '?').join(',')})`
    ).all(...cardIds);
    codesHtml = cardRows.map(c =>
      `<div style="background:#f3f4f6;padding:8px 12px;margin:4px 0;border-radius:6px;font-family:monospace;">${escapeHtml(c.content)}</div>`
    ).join('');
  }

  const vars = {
    webname: siteName,
    order_id: order.orderNo || '',
    product_name: order.productName || '',
    buy_amount: order.qty || 0,
    ord_price: Number(order.amount || 0).toFixed(2),
    ord_info: codesHtml || '',
    created_at: order.createdAt || '',
    buyer_email: contactEmail,
  };

  // 使用 email_templates 表统一模板（card_send_user_email），不再使用 site_settings.mail.template
  await sendTemplateEmail('card_send_user_email', vars, contactEmail, order.id).catch((e) => {
    logger.error('订单邮件发送失败', { tag: 'email', orderNo: order.orderNo, error: e.message });
  });
}

/**
 * 通过邮件模板发送多场景邮件（参考独角数卡 replace_mail_tpl + MailSend Job）
 * @param {string} tplToken - 模板标识：card_send_user_email / manual_send_manage_mail / pending_order / completed_order / failed_order
 * @param {object} vars - 模板变量 { webname, order_id, product_name, buy_amount, ord_price, ord_info, created_at, buyer_email }
 * @param {string} to - 收件人
 * @param {string} [orderId] - 关联订单ID
 */
async function sendTemplateEmail(tplToken, vars, to, orderId) {
  if (!to) return;
  const db = getDb();
  const tpl = db.prepare('SELECT * FROM email_templates WHERE tpl_token = ? AND enabled = 1').get(tplToken);
  if (!tpl) {
    logger.warn('邮件模板不存在或已禁用', { tag: 'email', tplToken });
    return;
  }

  // 简单字符串替换（参考独角数卡 replace_mail_tpl）
  let subject = tpl.tpl_name;
  let html = tpl.tpl_content;
  for (const [key, val] of Object.entries(vars)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g');
    subject = subject.replace(placeholder, String(val ?? ''));
    html = html.replace(placeholder, String(val ?? ''));
  }

  await sendMail({ to, subject, html, orderId });
}

/**
 * 订单状态变更时发送对应邮件（参考独角数卡 OrderUpdated Listener）
 * 仅 manual 类型订单状态变更时通知用户
 * @param {object} order - 订单行（snake_case 原始字段）
 * @param {string} newStatus - 新状态
 */
async function notifyOrderStatusChange(order, newStatus) {
  const db = getDb();
  const siteName = getSetting('site.name', 'Asolica');
  const baseVars = {
    webname: siteName,
    order_id: order.order_no,
    product_name: order.product_name,
    buy_amount: order.qty,
    ord_price: Number(order.amount || 0).toFixed(2),
    ord_info: (order.info || '').replace(/\n/g, '<br/>'),
    created_at: order.created_at,
    buyer_email: order.email || '',
  };

  // 状态 → 模板映射（参考独角数卡 OrderUpdated）
  const statusTplMap = {
    pending: 'pending_order',
    delivered: 'completed_order',
    failed: 'failed_order',
  };

  const tplToken = statusTplMap[newStatus];
  if (!tplToken) return; // 其他状态不发邮件

  // 发给用户
  if (order.email) {
    await sendTemplateEmail(tplToken, baseVars, order.email, order.id).catch((e) => {
      logger.error('状态变更邮件发送失败', { tag: 'email', orderNo: order.order_no, status: newStatus, error: e.message });
    });
  }
}

/** HTML 转义已下沉到 utils/html.js，此处通过 import 使用 */

/**
 * 人工处理订单下单时通知管理员（参考独角数卡 processManual → manual_send_manage_mail）
 * @param {object} order - 订单行（snake_case）
 */
async function notifyAdminManualOrder(order) {
  const manageEmail = getSetting('order.manage_email', '');
  if (!manageEmail) return;
  const siteName = getSetting('site.name', 'Asolica');
  const vars = {
    webname: siteName,
    order_id: order.order_no,
    product_name: order.product_name,
    buy_amount: order.qty,
    ord_price: Number(order.amount || 0).toFixed(2),
    ord_info: (order.info || '').replace(/\n/g, '<br/>'),
    created_at: order.created_at,
    buyer_email: order.email || '',
  };
  await sendTemplateEmail('manual_send_manage_mail', vars, manageEmail, order.id).catch((e) => {
    logger.error('管理员通知邮件发送失败', { tag: 'email', orderNo: order.order_no, error: e.message });
  });
}

/**
 * 手动补发单封邮件（管理员后台触发）
 * @param {string} emailId - 邮件队列ID
 * @param {object} [overrides] - 可选覆盖字段 { to, subject, body }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function resendEmail(emailId, overrides = {}) {
  const db = getDb();
  const email = db.prepare('SELECT * FROM email_queue WHERE id = ?').get(emailId);
  if (!email) {
    return { success: false, error: '邮件记录不存在' };
  }

  const to = overrides.to || email.to_addr;
  const subject = overrides.subject || email.subject;
  const body = overrides.body || email.body;

  // 如果收件人被修改，同步更新记录
  if (overrides.to && overrides.to !== email.to_addr) {
    db.prepare('UPDATE email_queue SET to_addr = ?, updated_at = ? WHERE id = ?')
      .run(overrides.to, nowISO(), emailId);
  }
  if (overrides.subject && overrides.subject !== email.subject) {
    db.prepare('UPDATE email_queue SET subject = ?, updated_at = ? WHERE id = ?')
      .run(overrides.subject, nowISO(), emailId);
  }
  if (overrides.body && overrides.body !== email.body) {
    db.prepare('UPDATE email_queue SET body = ?, updated_at = ? WHERE id = ?')
      .run(overrides.body, nowISO(), emailId);
  }

  try {
    await _sendViaDriver(to, subject, body);
    const sentNow = nowISO();
    db.prepare(`
      UPDATE email_queue
      SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_error = NULL, updated_at = ?
      WHERE id = ?
    `).run(sentNow, sentNow, emailId);
    logger.info('手动补发邮件成功', { tag: 'email', emailId, to });
    return { success: true };
  } catch (err) {
    const newAttempts = (email.attempts || 0) + 1;
    db.prepare(`
      UPDATE email_queue
      SET status = 'failed', last_error = ?, attempts = ?, updated_at = ?
      WHERE id = ?
    `).run(err.message.slice(0, 500), newAttempts, nowISO(), emailId);
    logger.error('手动补发邮件失败', { tag: 'email', emailId, to, error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * 批量补发邮件（管理员后台触发）
 * @param {string[]} emailIds - 邮件ID列表
 * @returns {Promise<{total: number, succeeded: number, failed: number, errors: Array}>}
 */
async function batchResendEmails(emailIds) {
  const results = { total: emailIds.length, succeeded: 0, failed: 0, errors: [] };
  for (const id of emailIds) {
    const r = await resendEmail(id);
    if (r.success) {
      results.succeeded++;
    } else {
      results.failed++;
      results.errors.push({ id, error: r.error });
    }
  }
  return results;
}

module.exports = {
  sendMail,
  sendTestMail,
  sendOrderEmail,
  sendTemplateEmail,
  notifyOrderStatusChange,
  notifyAdminManualOrder,
  retryFailedEmails,
  resendEmail,
  batchResendEmails,
};
