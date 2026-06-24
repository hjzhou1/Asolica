/**
 * 统一支付网关 - 数据库驱动版
 *
 * 参考独角数卡 pays 表设计：
 * - 支付方式配置在 payment_methods 表中管理
 * - 每个支付方式一行：adapter（适配器）+ method（支付方式）+ config（JSON 配置）
 * - 内置 adapter：hupi（虎皮椒）、yi（彩虹易支付）
 * - 新增同类型渠道时无需改代码，只需在后台添加 payment_methods 记录
 * - 新增 adapter 类型时才需要扩展 GatewayRegistry
 */
const crypto = require('crypto');

function md5(str) { return crypto.createHash('md5').update(String(str)).digest('hex'); }

/** 校验金额是否为有效正数 */
function validAmount(amount) {
  const n = Number(amount);
  return typeof n === 'number' && !isNaN(n) && isFinite(n) && n >= 0;
}

/** 时序安全的字符串比较，防止签名伪造的时序攻击 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ==================== 虎皮椒 (Hupi) Adapter ====================
class HupiGateway {
  constructor(config) {
    this.config = config;
    this.apiUrl = 'https://api.hupi.cn/v2/order/create';
  }

  async createPayment(order, baseUrl, method) {
    const { app_id, app_secret } = this.config;
    if (!app_id || !app_secret) throw new Error('虎皮椒 App ID 或密钥未配置');
    if (!validAmount(order.amount)) throw new Error('订单金额无效');
    const params = {
      appid: app_id,
      out_trade_no: order.orderNo,
      total_fee: Math.round(Number(order.amount) * 100), // 分
      title: order.productName || '商品购买',
      notify_url: `${baseUrl}/api/payment/callback/${this.config._pmId || 'hupi'}`,
      return_url: `${baseUrl}/#/dingdan/${order.id}?contact=${encodeURIComponent(order.contact || '')}`,
      type: method === 'wechat' ? 'wechat' : 'alipay',
    };
    params.sign = this.sign(params, app_secret);

    const url = new URL(this.apiUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const resp = await fetch(url.toString(), { signal: controller.signal });
      const data = await resp.json();
      if (data.code !== 0) throw new Error(data.msg || '虎皮椒创建支付失败');
      return {
        trade_no: data.data?.trade_no || '',
        pay_url: data.data?.pay_url || data.data?.qrcode || '',
        qr_code: data.data?.qrcode || '',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  verifyCallback(body) {
    const { app_secret } = this.config;
    const receivedSign = body.sign;
    const sign = this.sign(Object.fromEntries(
      Object.entries(body)
        .filter(([k]) => k !== 'sign')
        .sort(([a], [b]) => a.localeCompare(b))
    ), app_secret);
    if (!safeEqual(sign, receivedSign)) return { valid: false };
    const amount = Number(body.total_fee) / 100;
    if (!validAmount(amount)) return { valid: false };
    return { valid: true, trade_no: body.trade_no, amount };
  }

  /**
   * 主动查询订单支付状态（虎皮椒查询接口）
   */
  async queryOrderStatus(orderNo) {
    const { app_id, app_secret } = this.config;
    if (!app_id || !app_secret) return null;
    const params = {
      appid: app_id,
      out_trade_no: orderNo,
    };
    params.sign = this.sign(params, app_secret);
    const url = new URL('https://api.hupi.cn/v2/order/query');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timer);
      const data = await resp.json();
      const amount = data.data?.total_fee ? Number(data.data.total_fee) / 100 : 0;
      return {
        paid: data.code === 0 && data.data?.status === 1,
        trade_no: data.data?.trade_no || '',
        amount: validAmount(amount) ? amount : 0,
      };
    } catch {
      return null;
    }
  }

  sign(params, secret) {
    const keys = Object.keys(params).sort((a, b) => a.localeCompare(b));
    const str = keys.map(k => `${k}=${params[k]}`).join('&') + secret;
    return md5(str);
  }
}

// ==================== 彩虹易支付 (YiPay) Adapter ====================
class YiPayGateway {
  constructor(config) {
    this.config = config;
    this.apiUrl = (config.apiUrl || 'https://pay.yi-ai.com').replace(/\/+$/, '');
  }

  async createPayment(order, baseUrl, method) {
    const { pid, key } = this.config;
    if (!pid) throw new Error('易支付商户PID未配置');
    if (!key) throw new Error('易支付商户密钥未配置');
    if (!validAmount(order.amount)) throw new Error('订单金额无效');
    const params = {
      pid: String(pid),
      type: method === 'wechat' ? 'wxpay' : 'alipay',
      out_trade_no: order.orderNo,
      notify_url: `${baseUrl}/api/payment/callback/${this.config._pmId || 'yi'}`,
      return_url: `${baseUrl}/#/dingdan/${order.id}?contact=${encodeURIComponent(order.contact || '')}`,
      name: order.productName || '商品购买',
      money: Number(order.amount).toFixed(2),
    };
    params.sign = this.sign(params, key);
    params.sign_type = 'MD5';

    const url = new URL(`${this.apiUrl}/submit.php`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return { trade_no: '', pay_url: url.toString(), qr_code: '' };
  }

  verifyCallback(body) {
    const { key } = this.config;
    const receivedSign = body.sign;
    const sign = this.sign(Object.fromEntries(
      Object.entries(body)
        .filter(([k]) => k !== 'sign' && k !== 'sign_type')
        .sort(([a], [b]) => a.localeCompare(b))
    ), key);
    if (!safeEqual(sign, receivedSign)) return { valid: false };
    const amount = Number(body.money);
    if (!validAmount(amount)) return { valid: false };
    return {
      valid: body.trade_status === 'TRADE_SUCCESS',
      trade_no: body.trade_no,
      amount,
    };
  }

  /**
   * 主动查询订单支付状态（易支付 API 查询接口）
   * 用于回调丢失或延迟时，前端轮询触发主动查询
   * 安全修复：使用 sign 签名方式查询，不将商户密钥暴露在 URL 中
   */
  async queryOrderStatus(orderNo) {
    const { pid, key } = this.config;
    if (!pid || !key) return null;
    // 使用签名方式查询，密钥不进入 URL（避免泄露到访问日志/网络日志）
    const params = { act: 'order', pid: String(pid), out_trade_no: orderNo };
    params.sign = this.sign(params, key);
    params.sign_type = 'MD5';
    const url = new URL(`${this.apiUrl}/api.php`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timer);
      const data = await resp.json();
      // 易支付返回 status=1 表示已支付
      const amount = Number(data.money);
      return {
        paid: data.status === 1,
        trade_no: data.trade_no || '',
        amount: validAmount(amount) ? amount : 0,
      };
    } catch {
      return null;
    }
  }

  sign(params, key) {
    const keys = Object.keys(params)
      .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
      .sort();
    const str = keys.map(k => `${k}=${params[k]}`).join('&') + key;
    return md5(str);
  }
}

// ==================== Adapter 注册表 ====================
const GatewayRegistry = {
  hupi: HupiGateway,
  yi: YiPayGateway,
};

// ==================== 工厂：从数据库 payment_methods 表读取 ====================
class PaymentGatewayFactory {
  constructor(db) {
    this.db = db;
  }

  /** 获取所有已启用的支付方式（前台展示用） */
  getEnabledMethods() {
    const methods = this.db.prepare(
      `SELECT id, name, adapter, method FROM payment_methods WHERE enabled = 1 ORDER BY sort ASC, created_at ASC`
    ).all();

    // 当同一 method（如 alipay）有多个 adapter 时，名称带渠道后缀
    const methodCount = {};
    for (const m of methods) {
      methodCount[m.method] = (methodCount[m.method] || 0) + 1;
    }

    return methods.map(m => ({
      id: m.id,
      payCheck: m.id,
      name: methodCount[m.method] > 1
        ? `${m.name}(${m.adapter})`
        : m.name,
      adapter: m.adapter,
      method: m.method,
    }));
  }

  /** 根据支付方式 ID 获取对应 Gateway */
  getGatewayForPayCheck(payCheck) {
    const pm = this.db.prepare('SELECT * FROM payment_methods WHERE id = ? AND enabled = 1').get(payCheck);
    if (!pm) throw new Error('支付方式不存在或未启用');

    const Cls = GatewayRegistry[pm.adapter];
    if (!Cls) throw new Error(`未知支付适配器: ${pm.adapter}`);

    let config = {};
    try { config = JSON.parse(pm.config || '{}'); } catch { config = {}; }
    config._pmId = pm.id;

    return {
      id: pm.id,
      adapter: pm.adapter,
      method: pm.method,
      name: pm.name,
      gateway: new Cls(config),
    };
  }

  /** 根据 adapter 名称获取 Gateway（用于回调路由） */
  getGatewayByAdapter(adapter) {
    const pm = this.db.prepare(
      `SELECT * FROM payment_methods WHERE adapter = ? AND enabled = 1 ORDER BY sort ASC LIMIT 1`
    ).get(adapter);
    if (!pm) throw new Error(`支付方式适配器不存在或未启用: ${adapter}`);

    const Cls = GatewayRegistry[pm.adapter];
    if (!Cls) throw new Error(`未知支付适配器: ${pm.adapter}`);

    let config = {};
    try { config = JSON.parse(pm.config || '{}'); } catch { config = {}; }
    config._pmId = pm.id;

    return { gateway: new Cls(config), pm };
  }

  /** 获取支付方式详情 */
  getPaymentMethod(id) {
    return this.db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);
  }

  /** 获取所有支付方式（管理后台用） */
  listPaymentMethods() {
    return this.db.prepare(
      `SELECT * FROM payment_methods ORDER BY sort ASC, created_at ASC`
    ).all();
  }
}

module.exports = { PaymentGatewayFactory, GatewayRegistry };
