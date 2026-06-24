/**
 * 邮件驱动抽象层
 *
 * 支持 4 种发送方式：
 * 1. smtp    - 个人/企业邮箱（默认，通过 nodemailer）
 * 2. resend  - Resend.com（海外推荐，免费 3000封/月，HTTP API）
 * 3. aliyun  - 阿里云邮件推送（国内推荐，便宜稳定，HTTP API）
 * 4. tencent - 腾讯云 SES（HTTP API）
 *
 * 设计参考：独角数卡 MailDriver 抽象 + Laravel Mail transport 机制
 * 每个驱动实现统一接口 send({ to, subject, html, fromName, fromAddr }) → { messageId }
 */

const nodemailer = require('nodemailer');
const https = require('https');
const { URL } = require('url');

// ============ SMTP 驱动 ============
function createSmtpDriver(config) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.auth.user, pass: config.auth.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return {
    async send({ to, subject, html, fromName, fromAddr }) {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromAddr}>`,
        to, subject, html,
      });
      return { messageId: info.messageId };
    },
    async close() { transporter.close(); },
  };
}

// ============ Resend 驱动（HTTP API） ============
// 文档：https://resend.com/docs/api-reference/emails/send-email
function createResendDriver(config) {
  const apiKey = config.apiKey;
  const fromAddr = config.fromAddr;
  const fromName = config.fromName;

  return {
    async send({ to, subject, html, fromName: fn, fromAddr: fa }) {
      const senderName = fn || fromName;
      const senderAddr = fa || fromAddr;
      const body = JSON.stringify({
        from: `"${senderName}" <${senderAddr}>`,
        to, subject, html,
      });
      const result = await _httpsRequest({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        body,
      });
      if (result.status >= 400) {
        throw new Error(`Resend API 错误 (${result.status}): ${result.body}`);
      }
      const data = JSON.parse(result.body);
      return { messageId: data.id };
    },
    async close() { /* HTTP 无状态，无需关闭 */ },
  };
}

// ============ 阿里云邮件推送驱动（HTTP API） ============
// 文档：https://help.aliyun.com/document_detail/29444.html
// 使用 SingleSendMail 接口
function createAliyunDriver(config) {
  const accessKeyId = config.accessKeyId;
  const accessKeySecret = config.accessKeySecret;
  const accountName = config.fromAddr; // 阿里云邮件推送的发信地址
  const fromAlias = config.fromName;
  const region = config.region || 'cn-hangzhou';

  return {
    async send({ to, subject, html, fromName: fn, fromAddr: fa }) {
      // 阿里云邮件推送需要签名，这里用最简实现
      // 实际生产建议用 @alicloud/dm20151123 SDK，这里为避免引入额外依赖用 HTTP
      const params = {
        Action: 'SingleSendMail',
        AccountName: fa || accountName,
        AddressType: '1',
        ReplyToAddress: 'true',
        ToAddress: to,
        Subject: subject,
        HtmlBody: html,
        FromAlias: fn || fromAlias,
        Format: 'JSON',
        Version: '2015-11-23',
        AccessKeyId: accessKeyId,
        SignatureMethod: 'HMAC-SHA1',
        Timestamp: new Date().toISOString(),
        SignatureVersion: '1.0',
        SignatureNonce: Math.random().toString(36).slice(2),
        RegionId: region,
      };
      params.Signature = _aliyunSign('POST', params, accessKeySecret);
      const body = _urlencodeParams(params);
      const result = await _httpsRequest({
        hostname: `dm.${region}.aliyuncs.com`,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
        body,
      });
      if (result.status >= 400) {
        throw new Error(`阿里云邮件推送错误 (${result.status}): ${result.body}`);
      }
      const data = JSON.parse(result.body);
      if (data.Code) {
        throw new Error(`阿里云邮件推送错误: ${data.Code} - ${data.Message}`);
      }
      return { messageId: data.EnvId };
    },
    async close() { /* HTTP 无状态 */ },
  };
}

// ============ 腾讯云 SES 驱动（HTTP API） ============
// 文档：https://cloud.tencent.com/document/product/1288/51034
function createTencentDriver(config) {
  const secretId = config.secretId;
  const secretKey = config.secretKey;
  const fromEmail = config.fromAddr;
  const fromName = config.fromName;
  const region = config.region || 'ap-guangzhou';

  return {
    async send({ to, subject, html, fromName: fn, fromAddr: fa }) {
      // 腾讯云 SES 用 TC3-HMAC-SHA256 签名
      // 为避免实现复杂签名，这里用最简版，生产建议用 tencentcloud-sdk-nodejs
      const service = 'ses';
      const host = `ses.tencentcloudapi.com`;
      const payload = JSON.stringify({
        FromEmailAddress: fn ? `"${fn}" <${fa || fromEmail}>` : (fa || fromEmail),
        Destination: [to],
        Subject: subject,
        Template: { HtmlContent: html },
      });
      const result = await _httpsRequest({
        hostname: host,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-TC-Action': 'SendEmail',
          'X-TC-Region': region,
          'X-TC-Version': '2020-10-02',
          'Authorization': _tencentSign(secretId, secretKey, service, host, payload),
        },
        body: payload,
      });
      if (result.status >= 400) {
        throw new Error(`腾讯云 SES 错误 (${result.status}): ${result.body}`);
      }
      const data = JSON.parse(result.body);
      if (data.Response?.Error) {
        throw new Error(`腾讯云 SES 错误: ${data.Response.Error.Code} - ${data.Response.Error.Message}`);
      }
      return { messageId: data.Response?.Result?.MessageId };
    },
    async close() { /* HTTP 无状态 */ },
  };
}

// ============ 工具函数 ============

/** HTTPS 请求封装 */
function _httpsRequest({ hostname, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('请求超时')); });
    if (body) req.write(body);
    req.end();
  });
}

/** 阿里云签名算法 */
function _aliyunSign(method, params, secret) {
  const crypto = require('crypto');
  const sorted = Object.keys(params).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  ).join('&');
  const stringToSign = `${method}&${encodeURIComponent('/')}&${encodeURIComponent(sorted)}`;
  return crypto.createHmac('sha1', `${secret}&`).update(stringToSign).digest('base64');
}

/** URL 编码参数 */
function _urlencodeParams(params) {
  return Object.keys(params).map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  ).join('&');
}

/** 腾讯云 TC3-HMAC-SHA256 签名（简化版） */
function _tencentSign(secretId, secretKey, service, host, payload) {
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = `POST\n/\n\ncontent-type:application/json\nhost:${host}\n\ncontent-type;host\n${hashedPayload}`;
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonical = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonical}`;

  const secretDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;
}

// ============ 驱动工厂 ============

let cachedDriver = null;
let cachedDriverKey = null;

/**
 * 获取邮件驱动（带缓存，配置变更时重建）
 * @param {object} config - 邮件配置
 * @returns {object} 驱动实例
 */
function getDriver(config) {
  // 用 driver+host+user 作为缓存 key，配置变更时自动重建
  const key = `${config.driver}|${config.host || ''}|${config.auth?.user || config.apiKey || config.accessKeyId || ''}`;
  if (cachedDriver && cachedDriverKey === key) {
    return cachedDriver;
  }
  // 释放旧驱动
  if (cachedDriver?.close) {
    try { cachedDriver.close(); } catch (_) { /* ignore */ }
  }

  switch (config.driver) {
    case 'resend':
      cachedDriver = createResendDriver(config);
      break;
    case 'aliyun':
      cachedDriver = createAliyunDriver(config);
      break;
    case 'tencent':
      cachedDriver = createTencentDriver(config);
      break;
    case 'smtp':
    default:
      cachedDriver = createSmtpDriver(config);
      break;
  }
  cachedDriverKey = key;
  return cachedDriver;
}

/** 失效驱动缓存（配置变更时调用） */
function invalidateDriver() {
  if (cachedDriver?.close) {
    try { cachedDriver.close(); } catch (_) { /* ignore */ }
  }
  cachedDriver = null;
  cachedDriverKey = null;
}

module.exports = { getDriver, invalidateDriver };
