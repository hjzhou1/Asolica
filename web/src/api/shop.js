/**
 * 前台商城 API 客户端
 * 合并原 public.js + order.js + payment.js 的前台部分
 *
 * 统一使用 shopFetch 包装层，自动解包 {ok:true, data:...} 为 data 本身
 *
 * 接口列表：
 * - GET  /public/products            获取在售商品
 * - GET  /public/products/:id        获取单个商品详情
 * - GET  /public/categories          获取启用的分类
 * - GET  /public/announcement        获取站点公告
 * - GET  /public/stock               查询库存
 * - POST /store/order                用户下单
 * - POST /order/query                精准查询订单
 * - POST /order/query-by-contact     按联系方式查询订单
 * - GET  /order/:id                  按订单 ID 查询订单详情
 * - GET  /store/store-methods        获取已启用的支付渠道
 * - POST /store/create-payment       创建支付订单
 * - GET  /store/payment-status/:id   轮询支付状态
 */

const BASE = '/api';

/**
 * 统一 fetch 包装层（类似 admin.js 的 apiFetch）
 * - 自动解析 JSON
 * - 自动解包 {ok:true, data:...} → data
 * - HTTP 错误或 {ok:false} 时抛出 Error
 * @param {string} url
 * @param {RequestInit} [opts]
 * @param {number} [timeout=15000] 超时毫秒
 * @returns {Promise<any>} 解包后的业务数据
 */
async function shopFetch(url, opts = {}, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    let data;
    try { data = await r.json(); }
    catch { throw new Error(`响应解析失败 (${r.status})`); }

    if (!r.ok || data?.ok === false) {
      throw new Error(data?.message || `请求失败 (${r.status})`);
    }
    // 自动解包：后端 ok(res, data) 返回 {ok:true, data:...}
    if (data?.ok === true && 'data' in data) {
      return data.data;
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('请求超时');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** JSON POST 辅助 */
function postJSON(url, body) {
  return shopFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ============================================================
// 公开接口：商品/分类/库存
// ============================================================

/** 获取在售商品列表 */
export async function fetchProducts({ search, sortBy, categoryId } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (sortBy) params.set('sortBy', sortBy);
  if (categoryId) params.set('categoryId', categoryId);
  const qs = params.toString();
  return shopFetch(`${BASE}/public/products${qs ? '?' + qs : ''}`);
}

/** 获取单个商品详情（含库存） */
export async function fetchProductById(id) {
  return shopFetch(`${BASE}/public/products/${encodeURIComponent(id)}`);
}

/** 获取启用的分类列表 */
export async function fetchCategories() {
  return shopFetch(`${BASE}/public/categories`);
}

/** 获取站点公告 */
export async function getAnnouncement() {
  return shopFetch(`${BASE}/public/announcement`);
}

/** 获取站点基本信息（名称、描述） */
export async function fetchSiteInfo() {
  return shopFetch(`${BASE}/public/site-info`);
}

/** 获取前台下单配置（如查询密码是否启用） */
export async function getOrderConfig() {
  return shopFetch(`${BASE}/public/order-config`);
}

/** 查询商品库存（返回 -1 表示无限库存） */
export async function fetchStock(productId, specId) {
  let url = `${BASE}/public/stock?productId=${productId}`;
  if (specId) url += `&specId=${specId}`;
  const data = await shopFetch(url);
  // count=-1 表示无限库存，需原样返回；count=0 表示售罄
  const count = data?.count;
  return typeof count === 'number' ? count : 0;
}

// ============================================================
// 用户下单
// ============================================================

/**
 * 用户下单（自动扣库存 + 发卡）
 * @param {{ productId: string, specId: string, contact: string, email?: string, qty: number, couponCode?: string, otherIpu?: string, searchPwd?: string }}
 * @returns {Promise<Order>} 创建的订单对象
 */
export async function placeOrder({ productId, specId, contact, email, qty = 1, couponCode, otherIpu, searchPwd }) {
  const body = { productId, specId, contact, email, qty };
  if (couponCode) body.couponCode = couponCode;
  if (otherIpu) body.otherIpu = otherIpu;
  if (searchPwd) body.searchPwd = searchPwd;
  return postJSON(`${BASE}/store/order`, body);
}

/**
 * 验证优惠码
 * @param {{ code: string, productId: string }} params
 * @returns {Promise<{ couponId: string, code: string, discount: number }>}
 */
export async function validateCoupon({ code, productId }) {
  return postJSON(`${BASE}/store/validate-coupon`, { code, productId });
}

// ============================================================
// 订单查询
// ============================================================

/**
 * 精准查询：订单号 + 联系方式
 * @param {{ orderNo: string, contact: string }}
 * @returns {Promise<Object|null>}
 */
export async function orderQuery({ orderNo, contact }) {
  const data = await postJSON(`${BASE}/order/query`, { orderNo, contact });
  // 用 orderNo 判定订单存在，避免空对象被误判为有效订单
  return data && typeof data === 'object' && data.orderNo ? data : null;
}

/**
 * 联系方式查询：查最近 N 天该联系方式下的全部订单
 * 安全设计：需传 searchPwd 或 orderNo 作为双因子校验（与后端一致）
 * @param {{ contact: string, days?: number, searchPwd?: string, orderNo?: string }}
 * @returns {Promise<Array>}
 */
export async function orderQueryByContact({ contact, days = 3, searchPwd, orderNo }) {
  const body = { contact, days };
  if (searchPwd) body.searchPwd = searchPwd;
  if (orderNo) body.orderNo = orderNo;
  const data = await postJSON(`${BASE}/order/query-by-contact`, body);
  return Array.isArray(data) ? data : [];
}

/**
 * 按订单 ID 查询订单详情（需校验 contact）
 * @param {string} id 订单 ID
 * @param {string} contact 联系方式
 * @returns {Promise<Object|null>}
 */
export async function getOrderById(id, contact = '') {
  const qs = contact ? `?contact=${encodeURIComponent(contact)}` : '';
  const data = await shopFetch(`${BASE}/order/${encodeURIComponent(id)}${qs}`);
  return data && typeof data === 'object' && Object.keys(data).length > 0 ? data : null;
}

// ============================================================
// 支付
// ============================================================

/**
 * 获取可用的支付选项（具体支付方式，如支付宝/微信支付）
 * @returns {Promise<Array<{id: string, name: string, channel: string, method: string}>>}
 */
export async function getStoreMethods() {
  const data = await shopFetch(`${BASE}/store/store-methods`);
  return Array.isArray(data) ? data : [];
}

/**
 * 创建支付订单
 * @param {{ orderId: string, payCheck: string, contact: string }}
 * @returns {Promise<{ payId: string, pay_url: string, qr_code: string, trade_no: string, channel: string, method: string }>}
 */
export async function createPayment({ orderId, payCheck, contact }) {
  return postJSON(`${BASE}/store/create-payment`, { orderId, payCheck, contact });
}

/**
 * 轮询支付状态
 * @param {string} orderId
 * @returns {Promise<{ status: string, payment: Object|null }>}
 */
export async function getPaymentStatus(orderId) {
  return shopFetch(`${BASE}/store/payment-status/${encodeURIComponent(orderId)}`);
}
