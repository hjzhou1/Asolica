/**
 * API 公共工具（token 管理 + 认证头）
 * 抽取自 admin.js 和 media.js 的重复定义
 */

const TOKEN_KEY = 'admin_token';

export function setToken(token) {
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** 构造认证头，json=true 时附加 Content-Type */
export function authHeader(json = false) {
  const h = { Authorization: `Bearer ${getToken()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
