// 管理员全局状态（简单 reactive 单例，不上 Pinia）
// 后续所有管理页从这里拿管理员信息和 token

import { reactive, computed } from 'vue';
import { getToken, clearToken, setToken as setTokenToLS } from '../api/admin.js';

const state = reactive({
  token: getToken(),
  admin: null, // { id, username, name?, role? }
});

/**
 * 解码 JWT payload（用 TextDecoder 正确处理 UTF-8，避免中文 username 乱码）
 * @param {string} token
 * @returns {Object|null} payload 对象，格式异常时返回 null
 */
export function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/**
 * 检查 JWT 是否已过期
 * @param {string} token
 * @returns {boolean} true 表示已过期或格式异常
 */
export function isTokenExpired(token) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

// 恢复管理员信息（刷新页面时用）
function decodeToken(t) {
  if (!t || isTokenExpired(t)) return null;
  try {
    return JSON.parse(localStorage.getItem('admin_info') || 'null');
  } catch {
    return null;
  }
}

// 初始化时检查 token 是否过期，过期则清除
if (state.token && isTokenExpired(state.token)) {
  state.token = '';
  clearToken();
  localStorage.removeItem('admin_info');
}

state.admin = decodeToken(state.token);

const isAuthed = computed(() => Boolean(state.token) && !isTokenExpired(state.token));

function setAuth({ token, admin }) {
  state.token = token || '';
  state.admin = admin || null;
  setTokenToLS(state.token);
  if (admin) localStorage.setItem('admin_info', JSON.stringify(admin));
}

function logout() {
  state.token = '';
  state.admin = null;
  clearToken();
  localStorage.removeItem('admin_info');
}

export function useAdmin() {
  return { state, isAuthed, setAuth, logout };
}
