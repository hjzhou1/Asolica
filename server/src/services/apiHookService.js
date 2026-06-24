/**
 * API 回调服务
 * 参考独角数卡 ApiHook Job：
 * - 订单支付成功后向商品配置的 api_hook URL 发送 POST JSON
 * - 失败不阻塞主流程，仅记录日志
 * - 增加简单签名（HMAC-SHA256），比独角数卡明文更安全
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const { getDb } = require('../db');
const logger = require('../utils/logger');

/** 发送 HTTP 请求（Promise 封装） */
function httpRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('请求超时')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * 订单支付成功后触发 API 回调
 * 参考独角数卡 ApiHook::handle()
 * @param {object} order - 订单行（snake_case）
 */
function triggerApiHook(order) {
  const db = getDb();
  const product = db.prepare('SELECT api_hook FROM products WHERE id = ?').get(order.product_id);
  if (!product || !product.api_hook) return;

  const payload = {
    title: order.product_name,
    order_sn: order.order_no,
    email: order.email || '',
    actual_price: Number(order.amount || 0),
    order_info: order.info || '',
    good_id: order.product_id,
    gd_name: order.product_name,
    qty: order.qty,
    contact: order.contact,
    created_at: order.created_at,
  };

  // 签名：HMAC-SHA256(order_no + amount + timestamp, order_no)
  // 接收方可校验签名防止伪造
  const timestamp = Math.floor(Date.now() / 1000);
  const signBase = `${order.order_no}${order.amount}${timestamp}`;
  const signature = crypto
    .createHmac('sha256', order.order_no)
    .update(signBase)
    .digest('hex');

  const body = JSON.stringify({
    ...payload,
    timestamp,
    signature,
  });

  httpRequest(product.api_hook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': String(timestamp),
    },
    body,
  }).then((res) => {
    if (res.status >= 200 && res.status < 300) {
      logger.info('API 回调成功', { tag: 'apihook', orderNo: order.order_no, url: product.api_hook, status: res.status });
    } else {
      logger.error('API 回调失败', { tag: 'apihook', orderNo: order.order_no, status: res.status, body: res.body.slice(0, 200) });
    }
  }).catch((e) => {
    logger.error('API 回调异常', { tag: 'apihook', orderNo: order.order_no, error: e.message });
  });
}

module.exports = { triggerApiHook };
