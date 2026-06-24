/**
 * 管理后台 API 客户端
 * 所有接口对接后端 /api/admin/*
 */

const BASE = '/api';
import { setToken, getToken, clearToken, authHeader } from './_common.js';

// 重新导出 token 工具（保持向后兼容）
export { setToken, getToken, clearToken };

async function apiFetch(url, opts = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    // 401 全局处理：区分"登录时密码错误"和"已登录状态 token 过期"
    if (r.status === 401) {
      const hasToken = !!getToken();
      if (hasToken) {
        // 已登录状态的 401 = token 过期/失效，清除 token 并跳转登录页
        clearToken();
        localStorage.removeItem('admin_info');
        // 使用 hash 路由跳转（项目使用 createWebHashHistory）
        const loginHash = '#/login';
        if (typeof window !== 'undefined') {
          window.location.hash = loginHash;
        }
        throw new Error('登录已过期，请重新登录');
      }
      // 登录页的 401 = 密码错误，解析后端 message 返回
      let data;
      try { data = await r.json(); } catch { /* ignore */ }
      throw new Error(data?.message || '账号或密码错误');
    }
    let data;
    try { data = await r.json(); }
    catch { throw new Error(`响应解析失败 (${r.status})`); }
    if (!r.ok || data?.ok === false) {
      throw new Error(data?.message || `请求失败 (${r.status})`);
    }
    // 自动解包：后端 ok(res, data) 返回 {ok:true, data:...}，这里统一解包为 data 本身
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

// ---- 登录 ----
export async function adminLogin({ username, password }) {
  const data = await apiFetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return { token: data.token, admin: data.admin };
}

// ---- 修改密码 ----
export async function changePassword({ oldPwd, newPwd }) {
  return apiFetch(`${BASE}/admin/change-password`, {
    method: 'POST', headers: authHeader(true),
    body: JSON.stringify({ oldPwd, newPwd }),
  });
}

// ---- 仪表盘 ----
export async function getDashboard() {
  return apiFetch(`${BASE}/admin/dashboard`, { headers: authHeader() });
}

// ---- 分类 ----
export async function listCategories() {
  return apiFetch(`${BASE}/admin/categories`, { headers: authHeader() });
}
export async function createCategory(payload) {
  return apiFetch(`${BASE}/admin/categories`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify(payload),
  });
}
export async function updateCategory(id, patch) {
  return apiFetch(`${BASE}/admin/categories/${id}`, {
    method: 'PUT', headers: authHeader(true), body: JSON.stringify(patch),
  });
}
export async function deleteCategory(id) {
  return apiFetch(`${BASE}/admin/categories/${id}`, {
    method: 'DELETE', headers: authHeader(),
  });
}

// ---- 商品 ----
export async function listProducts() {
  return apiFetch(`${BASE}/admin/products`, { headers: authHeader() });
}
export async function createProduct(payload) {
  return apiFetch(`${BASE}/admin/products`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify(payload),
  });
}
export async function updateProduct(id, patch) {
  return apiFetch(`${BASE}/admin/products/${id}`, {
    method: 'PUT', headers: authHeader(true), body: JSON.stringify(patch),
  });
}
export async function deleteProduct(id, opts = {}) {
  // opts.cancelPending: true 时同时取消 pending 订单
  const qs = opts.cancelPending ? '?cancelPending=1' : '';
  const r = await fetch(`${BASE}/admin/products/${id}${qs}`, {
    method: 'DELETE', headers: authHeader(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // 409 PENDING_ORDERS_EXIST 需要把结构化错误抛给调用方处理
    const err = new Error(data?.message || `删除失败 (${r.status})`);
    err.code = data?.code;
    err.pendingCount = data?.pendingCount;
    throw err;
  }
  return data;
}
export async function getAllProductsStock() {
  return apiFetch(`${BASE}/admin/products/stock`, { headers: authHeader() });
}

// ---- 优惠码 ----
export async function listCoupons() {
  return apiFetch(`${BASE}/admin/coupons`, { headers: authHeader() });
}
export async function createCoupon(payload) {
  return apiFetch(`${BASE}/admin/coupons`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify(payload),
  });
}
export async function updateCoupon(id, patch) {
  return apiFetch(`${BASE}/admin/coupons/${id}`, {
    method: 'PUT', headers: authHeader(true), body: JSON.stringify(patch),
  });
}
export async function deleteCoupon(id) {
  return apiFetch(`${BASE}/admin/coupons/${id}`, {
    method: 'DELETE', headers: authHeader(),
  });
}

// ---- 卡密 ----
export async function listCards(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const query = qs.toString();
  return apiFetch(`${BASE}/admin/cards${query ? '?' + query : ''}`, { headers: authHeader() });
}
export async function batchImportCards(payload) {
  return apiFetch(`${BASE}/admin/cards/import`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify(payload),
  });
}
export async function deleteCard(id) {
  return apiFetch(`${BASE}/admin/cards/${id}`, {
    method: 'DELETE', headers: authHeader(),
  });
}

// ---- 订单 ----
// 支持服务端分页：page/pageSize/status/keyword
export async function listOrders(params = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', params.page);
  if (params.pageSize) qs.set('pageSize', params.pageSize);
  if (params.status) qs.set('status', params.status);
  if (params.keyword) qs.set('keyword', params.keyword);
  const query = qs.toString();
  return apiFetch(`${BASE}/admin/orders${query ? `?${query}` : ''}`, { headers: authHeader() });
}
export async function createOrder(payload) {
  return apiFetch(`${BASE}/admin/orders`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify(payload),
  });
}
export async function reissueOrder(id) {
  return apiFetch(`${BASE}/admin/orders/${id}/reissue`, {
    method: 'POST', headers: authHeader(),
  });
}
export async function deleteOrder(id) {
  return apiFetch(`${BASE}/admin/orders/${id}`, {
    method: 'DELETE', headers: authHeader(),
  });
}

// ---- 趋势 ----
export async function getTrend(days = 7) {
  return apiFetch(`${BASE}/admin/trend?days=${encodeURIComponent(days)}`, { headers: authHeader() });
}

// ---- 系统设置 ----
export async function getSettings() {
  return apiFetch(`${BASE}/admin/settings`, { headers: authHeader() });
}
export async function updateSettings(data) {
  return apiFetch(`${BASE}/admin/settings`, {
    method: 'PUT', headers: authHeader(true), body: JSON.stringify(data),
  });
}
export async function testEmail(email) {
  return apiFetch(`${BASE}/admin/settings/test-email`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify({ email }),
  });
}

// ---- 支付方式（数据库驱动） ----
export async function listPaymentMethods() {
  return apiFetch(`${BASE}/admin/payment-methods`, { headers: authHeader() });
}
export async function createPaymentMethod(payload) {
  return apiFetch(`${BASE}/admin/payment-methods`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify(payload),
  });
}
export async function updatePaymentMethod(id, patch) {
  return apiFetch(`${BASE}/admin/payment-methods/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: authHeader(true), body: JSON.stringify(patch),
  });
}
export async function deletePaymentMethod(id) {
  return apiFetch(`${BASE}/admin/payment-methods/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: authHeader(),
  });
}
export async function getPaymentAdapters() {
  return apiFetch(`${BASE}/admin/payment-adapters`, { headers: authHeader() });
}

// ---- 操作日志 ----
export async function getLogs(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const s = qs.toString();
  return apiFetch(`${BASE}/admin/logs${s ? '?' + s : ''}`, { headers: authHeader() });
}

// ---- 邮件模板（参考独角数卡） ----
export async function listEmailTemplates() {
  return apiFetch(`${BASE}/admin/email-templates`, { headers: authHeader() });
}
export async function updateEmailTemplate(id, patch) {
  return apiFetch(`${BASE}/admin/email-templates/${id}`, {
    method: 'PUT', headers: authHeader(true), body: JSON.stringify(patch),
  });
}
export async function testEmailTemplate(id, email) {
  return apiFetch(`${BASE}/admin/email-templates/${id}/test`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify({ email }),
  });
}

// ---- 邮件队列（发送记录 + 手动补发） ----
export async function listEmailQueue(params = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', params.page);
  if (params.pageSize) qs.set('pageSize', params.pageSize);
  if (params.status) qs.set('status', params.status);
  if (params.keyword) qs.set('keyword', params.keyword);
  if (params.orderId) qs.set('orderId', params.orderId);
  const s = qs.toString();
  return apiFetch(`${BASE}/admin/email-queue${s ? '?' + s : ''}`, { headers: authHeader() });
}
export async function getEmailQueueDetail(id) {
  return apiFetch(`${BASE}/admin/email-queue/${id}`, { headers: authHeader() });
}
export async function resendEmailQueue(id, overrides = {}) {
  return apiFetch(`${BASE}/admin/email-queue/${id}/resend`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify(overrides),
  });
}
export async function batchResendEmailQueue(ids) {
  return apiFetch(`${BASE}/admin/email-queue/batch-resend`, {
    method: 'POST', headers: authHeader(true), body: JSON.stringify({ ids }),
  });
}
export async function deleteEmailQueue(id) {
  return apiFetch(`${BASE}/admin/email-queue/${id}`, {
    method: 'DELETE', headers: authHeader(),
  });
}
